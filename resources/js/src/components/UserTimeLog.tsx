import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Clock, LogOut } from "lucide-react";

interface TimeLogEntry {
  id: number;
  user_id: number;
  time_in: string | null;
  time_out: string | null;
  note?: string | null;
  created_at: string;
}

interface Session {
  id: string;
  time_in: string | null;
  time_out: string | null;
  note?: string | null;
}

export function UserTimeLog() {
  const [logs, setLogs] = useState<TimeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [userId, setUserId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch only current user's time logs
  const fetchLogs = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const res = await fetch("/api/time-logs/me", {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!res.ok) throw new Error("Failed to load logs");
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
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

  // Fetch current user id for realtime channel subscription
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/user', { credentials: 'include', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
        if (res.ok) {
          const data = await res.json();
          if (mounted && data?.id) setUserId(data.id);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Tick every second for live timer
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Convert TimeLog entries into sessions
  const groupIntoSessions = (entries: TimeLogEntry[]): Session[] => {
    const sessions = entries.map((e) => ({
      id: `timelog-${e.id}`,
      time_in: e.time_in,
      time_out: e.time_out,
      note: e.note,
    }));
    return sessions.sort((a, b) => {
      const aTime = a.time_in || a.time_out || "";
      const bTime = b.time_in || b.time_out || "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  };

  const sessions = groupIntoSessions(logs);

  // Realtime: subscribe to user's private channel for new time-log entries
  useEffect(() => {
    if (!userId) return;
    const Echo = (window as any).Echo;
    if (!Echo || typeof Echo.private !== 'function') return;

    const channel = Echo.private('time-logs.' + userId);
    const handler = (payload: any) => {
      // payload contains { time_log: { id, user_id, time_in, time_out, note, ... } }
      const tl = payload.time_log || payload;
      const entry: TimeLogEntry = {
        id: tl.id,
        user_id: tl.user_id,
        time_in: tl.time_in,
        time_out: tl.time_out,
        note: tl.note ?? null,
        created_at: tl.created_at ?? tl.time_in ?? new Date().toISOString(),
      };
      setLogs((prev) => [entry, ...prev.filter((p) => p.id !== entry.id)]);
      setLastRefreshed(new Date());
    };

    channel.listen('TimeLogUpdated', handler);

    return () => {
      try {
        channel.stopListening('AuditLogCreated');
      } catch (e) {
        // ignore
      }
    };
  }, [userId]);

  const formatDateTime = (iso: string | null) => {
    if (!iso) return null;
    // Use native Date parsing for ISO8601 timestamps (with timezone)
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    // Build localized time string with AM/PM, then split into time and period.
    const fullTime = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const m = fullTime.match(/^(.*)\s?(AM|PM)$/i);
    const timeOnly = m ? m[1].trim() : fullTime;
    const period = m ? m[2].toUpperCase() : (d.getHours() >= 12 ? "PM" : "AM");

    if (isToday) {
      return { date: "Today", time: timeOnly, period };
    } else if (isYesterday) {
      return { date: "Yesterday", time: timeOnly, period };
    } else {
      return {
        date: d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        time: timeOnly,
        period,
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
                              <div className="flex items-baseline gap-2">
                                <span className="text-green-700 font-semibold">{timeIn.time}</span>
                                <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{timeIn.period}</span>
                              </div>
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                    <td className="px-4 py-2">
                      {timeOut ? (
                        <div>
                          <span className="block text-xs text-gray-500">{timeOut.date}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-red-600 font-semibold">{timeOut.time}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{timeOut.period}</span>
                          </div>
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
