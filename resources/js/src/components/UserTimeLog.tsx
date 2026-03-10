import React, { useState, useEffect, useRef, useCallback } from "react";
import { LogIn, LogOut, RefreshCw, Clock } from "lucide-react";

interface AuditEntry {
  id: number;
  user_id: number;
  action: "login" | "logout";
  ip_address: string | null;
  created_at: string;
}

interface Session {
  id: string;
  time_in: string | null;
  time_out: string | null;
  login_id: number | null;
  logout_id: number | null;
}

export function UserTimeLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch only current user's logs
  const fetchLogs = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const res = await fetch("/api/me/audit-logs", {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!res.ok) throw new Error("Failed to load logs");
      const data = await res.json();
      setLogs(data.data || []);
      setLastRefreshed(new Date());
    } catch {
      /* ignore */
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchLogs(false);
    pollRef.current = setInterval(() => fetchLogs(true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLogs]);

  // Tick every second for live timer
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Group into sessions (LIFO stack)
  const groupIntoSessions = (entries: AuditEntry[]): Session[] => {
    const sessions: Session[] = [];
    const stack: AuditEntry[] = [];
    const sorted = [...entries].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id
    );
    sorted.forEach((entry) => {
      if (entry.action === "login") {
        stack.push(entry);
      } else if (entry.action === "logout") {
        if (stack.length > 0) {
          const login = stack.pop()!;
          sessions.push({
            id: `session-${login.id}`,
            time_in: login.created_at,
            time_out: entry.created_at,
            login_id: login.id,
            logout_id: entry.id,
          });
        } else {
          sessions.push({
            id: `session-${entry.id}`,
            time_in: null,
            time_out: entry.created_at,
            login_id: null,
            logout_id: entry.id,
          });
        }
      }
    });
    stack.forEach((login) => {
      sessions.push({
        id: `session-${login.id}`,
        time_in: login.created_at,
        time_out: null,
        login_id: login.id,
        logout_id: null,
      });
    });
    return sessions.sort((a, b) => {
      const aTime = a.time_in || a.time_out || "";
      const bTime = b.time_in || b.time_out || "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  };

  const sessions = groupIntoSessions(logs);

  const formatDateTime = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    if (isToday) {
      return { date: "Today", time: timeStr };
    } else if (isYesterday) {
      return { date: "Yesterday", time: timeStr };
    } else {
      return {
        date: d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        time: timeStr,
      };
    }
  };

  const formatElapsed = (isoStart: string): string => {
    const diff = Math.max(0, Math.floor((now.getTime() - new Date(isoStart).getTime()) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="bg-white rounded-lg shadow border p-4 mb-6">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-green-700">My Time Log</span>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
        {lastRefreshed && (
          <span className="text-xs text-gray-400 ml-2">
            Updated {lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Time In</th>
              <th className="px-4 py-2 text-left">Time Out</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No time logs found.</td></tr>
            ) : (
              sessions.slice(0, 5).map((session) => {
                const timeIn = formatDateTime(session.time_in);
                const timeOut = formatDateTime(session.time_out);
                return (
                  <tr key={session.id}>
                    <td className="px-4 py-2">
                      {timeIn ? (
                        <div>
                          <span className="block text-xs text-gray-500">{timeIn.date}</span>
                          <span className="block text-green-700 font-semibold">{timeIn.time}</span>
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {timeOut ? (
                        <div>
                          <span className="block text-xs text-gray-500">{timeOut.date}</span>
                          <span className="block text-red-600 font-semibold">{timeOut.time}</span>
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {!session.time_out && session.time_in ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          Active ({formatElapsed(session.time_in)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                          <LogOut className="w-3 h-3" />
                          Ended
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
