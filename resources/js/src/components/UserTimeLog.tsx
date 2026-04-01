import { useState, useEffect, useRef, useCallback } from "react";
import useConfirm from '../hooks/useConfirm';
import { RefreshCw, Clock, LogOut } from "lucide-react";
import { LoadingState } from './ui/LoadingState';

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
  const [userRole, setUserRole] = useState<string | null>(null);
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
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to load logs: ${res.status} ${text}`);
      }
      const data = await res.json();
      // Accept both array and { data: [...] } shapes
      let logsArr: any = [];
      if (Array.isArray(data)) {
        logsArr = data;
      } else if (data && Array.isArray(data.data)) {
        logsArr = data.data;
      } else {
        logsArr = [];
      }
      setLogs(logsArr);
      setLastRefreshed(new Date());
    } catch (e: any) {
      // Do not clear logs on error; just leave as is
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

  // Consume any short-lived time log stored during login (in case event fired before dashboard mounted)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('last_time_log');
      if (raw) {
        const tl = JSON.parse(raw);
        if (tl && tl.id) {
          const entry: TimeLogEntry = {
            id: tl.id,
            user_id: tl.user_id,
            time_in: tl.time_in,
            time_out: tl.time_out,
            note: tl.note ?? null,
            created_at: tl.created_at ?? tl.time_in ?? new Date().toISOString(),
          };
          setLogs((prev) => [entry, ...prev.filter((p) => p.id !== entry.id)]);
        }
        sessionStorage.removeItem('last_time_log');
      }
    } catch (e) {
      // ignore JSON errors
    }
  }, []);

  // Fetch current user id and role for realtime channel subscription and permissions
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/user', { credentials: 'include', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
        if (res.ok) {
          const data = await res.json();
          if (mounted && data?.id) setUserId(data.id);
          if (mounted && data?.role) setUserRole(data.role);
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
    if (!Array.isArray(entries)) return [];
    const sessions = entries
      .filter((e) => e && typeof e === "object" && e.id)
      .map((e) => ({
        id: `timelog-${e.id}`,
        // prefer display_time_in/display_time_out if provided by API (audit timestamps)
        time_in: (e as any).display_time_in ?? e.time_in,
        time_out: (e as any).display_time_out ?? e.time_out,
        note: e.note,
      }));
    return sessions.sort((a, b) => {
      const aTime = a.time_in || a.time_out || "";
      const bTime = b.time_in || b.time_out || "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  };

  const sessions = groupIntoSessions(logs);
  const confirm = useConfirm();
  const { showConfirm } = confirm;

  // Compute total worked seconds for today and this week based on sessions
  const computeTotals = (sessions: Session[]) => {
    const nowLocal = new Date();
    const todayStart = new Date(nowLocal);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekStart = new Date(todayStart);
    const day = weekStart.getDay(); // 0=Sun,1=Mon,...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diffToMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const overlapSeconds = (start: Date, end: Date, rangeStart: Date, rangeEnd: Date) => {
      const s = Math.max(start.getTime(), rangeStart.getTime());
      const e = Math.min(end.getTime(), rangeEnd.getTime());
      if (e <= s) return 0;
      return Math.floor((e - s) / 1000);
    };

    let todaySeconds = 0;
    let weekSeconds = 0;

    sessions.forEach((s) => {
      if (!s.time_in) return;
      const start = new Date(s.time_in);
      if (isNaN(start.getTime())) return;
      let end = s.time_out ? new Date(s.time_out) : nowLocal;
      if (isNaN(end.getTime()) || end < start) end = start;

      todaySeconds += overlapSeconds(start, end, todayStart, todayEnd);
      weekSeconds += overlapSeconds(start, end, weekStart, weekEnd);
    });

    return { todaySeconds, weekSeconds };
  };

  const formatTotalDuration = (seconds: number) => {
    const sec = Math.max(0, Math.floor(seconds));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return `${sec}s`;
  };

  const { todaySeconds, weekSeconds } = computeTotals(sessions);

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

    // Also subscribe to user-level audit log events so we can refresh UI
    const userChannel = Echo.private('user.' + userId);
    const auditHandler = (payload: any) => {
      // payload: { id, user_id, action, ip_address, created_at }
      if (payload?.action === 'login' || payload?.action === 'logout') {
        // refresh logs to ensure timestamps match audit records
        fetchLogs(true);
      }
    };
    userChannel.listen('AuditLogCreated', auditHandler);

    return () => {
      try { channel.stopListening('TimeLogUpdated'); } catch (e) { /* ignore */ }
      try { userChannel.stopListening('AuditLogCreated'); } catch (e) { /* ignore */ }
    };
  }, [userId]);

  // Listen for manual timeLogCreated event emitted right after login
  useEffect(() => {
    const listener = (e: any) => {
      const tl = e?.detail;
      if (!tl) return;
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
    window.addEventListener('timeLogCreated', listener as EventListener);
    return () => window.removeEventListener('timeLogCreated', listener as EventListener);
  }, []);

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

    // Always return full date/time string for tooltip and display
    const fullDateTime = d.toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return { date: "Today", time: timeOnly, period, fullDateTime };
    } else if (isYesterday) {
      return { date: "Yesterday", time: timeOnly, period, fullDateTime };
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
        fullDateTime,
      };
    }
  };

  const formatYmd = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
    <div className="bg-white rounded-lg shadow border border-slate-200 p-4 mb-6 dark:bg-slate-900/80 dark:border-slate-700">
      <div className="text-xs text-gray-500 mb-2 dark:text-slate-400">All times are shown in your local timezone.</div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-green-700 dark:text-green-300">My Time Log</span>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded bg-white border-slate-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
        {lastRefreshed && (
          <span className="text-xs text-gray-400 ml-2 dark:text-slate-500">
            Updated {lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
          <span className="font-semibold">Today:</span>
          <span>{formatTotalDuration(todaySeconds)}</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/10 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-800">
          <span className="font-semibold">This week:</span>
          <span>{formatTotalDuration(weekSeconds)}</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/70">
            <tr>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Date</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Time In</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Time Out</th>
              <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Status</th>
              {userRole === 'Admin' && <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100 dark:bg-slate-900/60 dark:divide-slate-700">
            {loading ? (
              <tr><td colSpan={userRole === 'Admin' ? 5 : 4} className="px-4 py-6 text-center text-gray-400 dark:text-slate-300"><LoadingState message="Loading time logs" size="sm" className="py-2" /></td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={userRole === 'Admin' ? 5 : 4} className="px-4 py-6 text-center text-gray-400 dark:text-slate-300">No time logs found.</td></tr>
            ) : (
              sessions.map((session) => {
                const timeIn = formatDateTime(session.time_in);
                const timeOut = formatDateTime(session.time_out);
                const displayDate = formatYmd(session.time_in || session.time_out);
                const displayDateFull = timeIn?.fullDateTime || timeOut?.fullDateTime || '';
                const extractId = (sid: string) => {
                  const parts = sid.split('-');
                  const n = parts[parts.length - 1];
                  return Number(n) || null;
                };
                const tlId = extractId(session.id);
                return (
                  <tr key={session.id}>
                    <td className="px-4 py-2">
                      <span className="text-sm text-gray-700 dark:text-slate-100" title={displayDateFull}>{displayDate}</span>
                    </td>
                    <td className="px-4 py-2">
                      {timeIn ? (
                        <div>
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-0.5 dark:text-slate-500">Time In</span>
                          <span className="block text-xs text-gray-500 dark:text-slate-300">{timeIn.date}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-green-700 font-semibold dark:text-green-300">{timeIn.time}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium dark:bg-slate-800 dark:text-slate-300">{timeIn.period}</span>
                          </div>
                        </div>
                      ) : <span className="text-gray-400 dark:text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {timeOut ? (
                        <div title={`Logged out at ${timeOut.fullDateTime}`}>
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-0.5 dark:text-slate-500">Time Out</span>
                          <span className="block text-xs text-gray-500 dark:text-slate-300">{timeOut.date}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-red-600 font-semibold dark:text-red-400">{timeOut.time}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium dark:bg-slate-800 dark:text-slate-300">{timeOut.period}</span>
                            <span className="ml-2 text-xs text-blue-500 bg-blue-50 rounded px-1.5 py-0.5 dark:text-blue-300 dark:bg-blue-950/40" title="This is the logout time">Logged out</span>
                          </div>
                          <span className="block text-xs text-gray-400 mt-1 dark:text-slate-500">{timeOut.fullDateTime}</span>
                        </div>
                      ) : <span className="text-gray-400 dark:text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {!session.time_out && session.time_in ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full dark:bg-green-900/40 dark:text-green-300">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse dark:bg-green-400"></span>
                          Active ({formatElapsed(session.time_in)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full dark:bg-slate-800 dark:text-slate-300">
                          <LogOut className="w-3 h-3" />
                          Ended
                        </span>
                      )}
                    </td>
                    {userRole === 'Admin' && (
                      <td className="px-4 py-2 text-right">
                        {tlId ? (
                          <button
                            onClick={async () => {
                              showConfirm('Delete this time log?', async () => {
                                try {
                                  // ensure csrf cookie
                                  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
                                  const xsrf = (() => {
                                    const value = `; ${document.cookie}`;
                                    const parts = value.split(`; XSRF-TOKEN=`);
                                    if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(';').shift() || '');
                                    return '';
                                  })();
                                  const res = await fetch(`/api/time-logs/admin/${tlId}`, {
                                    method: 'DELETE',
                                    credentials: 'include',
                                    headers: { 'X-XSRF-TOKEN': xsrf },
                                  });
                                  if (!res.ok) {
                                    const txt = await res.text().catch(() => '');
                                    throw new Error(txt || 'Delete failed');
                                  }
                                  // remove from UI
                                  setLogs((prev) => prev.filter((l) => l.id !== tlId));
                                  alert('Deleted');
                                } catch (e: any) {
                                  if (e?.message?.toLowerCase().includes('unauthorized') || e?.message?.toLowerCase().includes('forbidden')) {
                                    alert('Delete failed: not authorized');
                                  } else {
                                    alert('Delete failed');
                                  }
                                }
                              });
                            }}
                            className="px-2 py-1 text-xs border rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/25 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/30"
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {confirm.ConfirmModalRenderer()}
    </div>
  );
}

