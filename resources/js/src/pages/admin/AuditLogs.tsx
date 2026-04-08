import { useState, useEffect, useRef, useCallback } from "react";
import useConfirm from '../../hooks/useConfirm';
import usePrompt from '../../hooks/usePrompt';
import { LogIn, LogOut, Search, ChevronLeft, ChevronRight, Filter, Users, GraduationCap, Shield, Clock, RefreshCw } from "lucide-react";

interface AuditUser {
  id: number;
  fullname: string;
  email: string;
  role: string;
  department: string | null;
}

interface AuditEntry {
  id: number;
  user_id: number;
  action: "login" | "logout";
  ip_address: string | null;
  created_at: string;
  user: AuditUser | null;
  time_log?: {
    id: number;
    time_in: string | null;
    time_out: string | null;
    note?: string | null;
  } | null;
}

interface PaginatedResponse {
  data: AuditEntry[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

interface Session {
  id: string;
  user: AuditUser | null;
  user_id: number;
  audit_login_at: string | null;
  audit_logout_at: string | null;
  time_in: string | null;
  time_out: string | null;
  ip_address: string | null;
  login_id: number | null;
  logout_id: number | null;
}

type RoleFilter = "All" | "Employee" | "Instructor" | "Admin";

export function AuditLogs() {
  const API = "/api/admin";
  // Sorting state
  const [sortField, setSortField] = useState<'time_in' | 'time_out' | 'name'>('time_in');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Custom sorting function
  const sortSessions = (sessions: Session[]) => {
    return [...sessions].sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'name') {
        aVal = a.user?.fullname || '';
        bVal = b.user?.fullname || '';
      } else {
        aVal = a[sortField] || '';
        bVal = b[sortField] || '';
      }
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
  };
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift();
  };

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doFetch = useCallback(async (pageNum: number, _silent = false) => {
    try {
      setLoading(true);
      if (!_silent) setLoadError(null);
      let url = `${API}/audit-logs?page=${pageNum}&per_page=100`;
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-XSRF-TOKEN": decodeURIComponent(getCookie("XSRF-TOKEN") || ""),
        },
      });
      if (!res.ok) {
        let message = `Failed to load audit logs (${res.status})`;
        const text = await res.text().catch(() => "");
        if (text) {
          try {
            const parsed = JSON.parse(text);
            message = parsed?.message || message;
          } catch {
            // keep fallback message
          }
        }
        throw new Error(message);
      }
      const data: PaginatedResponse = await res.json();
      setLogs(data.data);
      setPage(data.current_page);
      setLastPage(data.last_page);
      setTotal(data.total);
      setLoadError(null);
    } catch (err: any) {
      const message = err?.message || "Failed to load audit logs";
      setLoadError(message);
      if (!_silent) showToast(message);
    } finally {
      setLoading(false);
    }
  }, [API]);

  const confirm = useConfirm();
  const { showConfirm } = confirm;
  const { showPrompt, PromptModalRenderer } = usePrompt();

  const fetchLogs = (pageNum: number) => doFetch(pageNum, false);

  const showToast = (msg: string, ms = 3500) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), ms);
  };

  // Initial load + start 30-second auto-poll
  useEffect(() => {
    doFetch(1, false);
    pollRef.current = setInterval(() => doFetch(1, true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [doFetch]);

  // (live tick disabled in this build)
  // Group logs into sessions (pair login with logout)
  const groupIntoSessions = (entries: AuditEntry[]): Session[] => {
    const byUser: Record<number, Session[]> = {};
    const sorted = [...entries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const e of sorted) {
      const uid = e.user_id;
      if (!byUser[uid]) byUser[uid] = [];
      if (e.action === "login") {
        const prefIn = (e as any).time_log?.time_in ?? e.created_at;
        const prefOut = (e as any).time_log?.time_out ?? null;
        byUser[uid].push({
          id: `session-login-${e.id}`,
          user: e.user,
          user_id: uid,
          audit_login_at: e.created_at,
          audit_logout_at: null,
          // prefer attached time_log time_in if backend supplied it
          time_in: prefIn,
          time_out: prefOut,
          ip_address: e.ip_address,
          login_id: e.id,
          logout_id: null,
        });
      } else {
        const userSessions = byUser[uid];
        const last = userSessions[userSessions.length - 1];
        if (last && last.time_out === null) {
          // prefer attached time_log time_out when available
          last.time_out = (e as any).time_log?.time_out ?? e.created_at;
          last.audit_logout_at = e.created_at;
          last.logout_id = e.id;
        } else {
          userSessions.push({
            id: `session-logout-${e.id}`,
            user: e.user,
            user_id: uid,
            audit_login_at: null,
            audit_logout_at: e.created_at,
            time_in: (e as any).time_log?.time_in ?? null,
            time_out: (e as any).time_log?.time_out ?? e.created_at,
            ip_address: e.ip_address,
            login_id: null,
            logout_id: e.id,
          });
        }
      }
    }

    let sessionsArr: Session[] = Object.values(byUser).flat();
    sessionsArr = sessionsArr.sort((a, b) => {
      const aTime = a.time_in || a.time_out || "";
      const bTime = b.time_in || b.time_out || "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    return sessionsArr;
  };

  const sessions = groupIntoSessions(logs);

  // Apply role/search filters
  const filteredSessions = sortSessions(
    sessions.filter((s) => {
      if (roleFilter !== "All") {
        const userRole = (s.user?.role || "").trim().toLowerCase();
        const selectedRole = roleFilter.trim().toLowerCase();
        if (userRole !== selectedRole) return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      return (s.user?.fullname || "").toLowerCase().includes(q) || (s.user?.email || "").toLowerCase().includes(q);
    })
  );

  const groupedByUser: Record<number, Session[]> = {};
  filteredSessions.forEach((s) => {
    groupedByUser[s.user_id] = groupedByUser[s.user_id] || [];
    groupedByUser[s.user_id].push(s);
  });

  Object.keys(groupedByUser).forEach((k) => {
    groupedByUser[Number(k)] = groupedByUser[Number(k)].sort((a, b) => {
      const aTime = a.time_in || a.time_out || "";
      const bTime = b.time_in || b.time_out || "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  });

  const userGroups = Object.values(groupedByUser);

  const stats = {
    admin: sessions.filter((s) => (s.user?.role || "").toLowerCase() === "admin").length,
    instructor: sessions.filter((s) => (s.user?.role || "").toLowerCase() === "instructor").length,
    employee: sessions.filter((s) => (s.user?.role || "").toLowerCase() === "employee").length,
    totalSessions: sessions.length,
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const fullTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const m = fullTime.match(/^(.*)\s?(AM|PM)$/i);
    const timeOnly = m ? m[1].trim() : fullTime;
    const period = m ? m[2].toUpperCase() : (d.getHours() >= 12 ? "PM" : "AM");
    if (isToday) return { date: "Today", time: timeOnly, period };
    if (isYesterday) return { date: "Yesterday", time: timeOnly, period };
    return {
      date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
      time: timeOnly,
      period,
    };
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

  const resolvedTimeIn = (s: Session) => {
    if (s.time_in && s.audit_login_at) {
      const drift = Math.abs(new Date(s.time_in).getTime() - new Date(s.audit_login_at).getTime());
      return drift > 5 * 60 * 1000 ? s.audit_login_at : s.time_in;
    }
    return s.time_in ?? s.audit_login_at ?? null;
  };

  const resolvedTimeOut = (s: Session) => {
    if (s.time_out && s.audit_logout_at) {
      const drift = Math.abs(new Date(s.time_out).getTime() - new Date(s.audit_logout_at).getTime());
      return drift > 5 * 60 * 1000 ? s.audit_logout_at : s.time_out;
    }
    return s.time_out ?? s.audit_logout_at ?? null;
  };

  // Realtime: subscribe to admin time-log updates so the admin list refreshes
  useEffect(() => {
    const Echo = (window as any).Echo;
    if (!Echo || typeof Echo.private !== 'function') return;
    const channel = Echo.private('time-logs.admin');
    const handler = () => {
      // Refresh audit logs when a time-log is updated
      fetchLogs(1);
    };
    channel.listen('TimeLogUpdated', handler);
    return () => {
      try { channel.stopListening('TimeLogUpdated'); } catch (e) { /* ignore */ }
    };
  }, []);

  // Realtime: listen for audit-log creations so admin view updates on user login/logout
  useEffect(() => {
    const Echo = (window as any).Echo;
    if (!Echo || typeof Echo.private !== 'function') return;
    const channel = Echo.private('audit-logs.admin');
    const handler = () => {
      // Refresh audit logs when a new audit log is created
      fetchLogs(1);
    };
    channel.listen('AuditLogCreated', handler);
    return () => {
      try { channel.stopListening('AuditLogCreated'); } catch (e) { /* ignore */ }
    };
  }, []);

  // Modal state for managing a user's time logs
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState<AuditUser | null>(null);
  const [modalTimeLogs, setModalTimeLogs] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalRefreshing, setModalRefreshing] = useState(false);
  const [modalLastRefreshed, setModalLastRefreshed] = useState<Date | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const getCookieValue = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  };

  const fetchUserTimeLogs = useCallback(async (userId: number) => {
    try {
      setModalLoading(true);
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const res = await fetch(`/api/time-logs/${userId}`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': decodeURIComponent(getCookieValue('XSRF-TOKEN') || ''),
        },
      });
      if (!res.ok) throw new Error('Failed to load user time logs');
      const data = await res.json();
      setModalTimeLogs(Array.isArray(data) ? data : []);
      setModalLastRefreshed(new Date());
    } catch (e) {
      setModalTimeLogs([]);
    } finally {
      setModalLoading(false);
    }
  }, []);

  const getXsrf = () => decodeURIComponent(getCookieValue('XSRF-TOKEN') || '');

  const sessionPrimaryId = (s: Session) => s.logout_id ?? s.login_id ?? null;

  const visibleSessionIds = Array.from(
    new Set(
      userGroups
        .flat()
        .map((s) => sessionPrimaryId(s))
        .filter((id): id is number => !!id)
    )
  );

  const updateTimeLog = async (id: number, payload: any) => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    const res = await fetch(`/api/time-logs/admin/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getXsrf() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Update failed');
    await fetchLogs(1);
  };

  const archiveTimeLog = async (id: number, archived: boolean) => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    const res = await fetch(`/api/time-logs/admin/${id}/archive`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getXsrf() },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) throw new Error('Archive failed');
    await fetchLogs(1);
  };

  const deleteTimeLog = async (id: number) => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    const res = await fetch(`/api/time-logs/admin/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': getXsrf() },
    });
    if (!res.ok) throw new Error('Delete failed');
    await fetchLogs(1);
  };

  const deleteAllTimeLogs = async () => {
    if (!modalUser || modalTimeLogs.length === 0) return;

    let deletedCount = 0;
    let failedCount = 0;

    for (const tl of modalTimeLogs) {
      try {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
        const res = await fetch(`/api/time-logs/admin/${tl.id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'X-XSRF-TOKEN': getXsrf() },
        });
        if (res.ok) {
          deletedCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    await fetchLogs(1);
    await fetchUserTimeLogs(modalUser.id);

    if (failedCount > 0) {
      alert(`Deleted ${deletedCount} time logs. ${failedCount} failed.`);
    } else {
      alert(`Deleted all ${deletedCount} time logs successfully.`);
    }
  };

  const openManageModal = (user: AuditUser | null) => {
    if (!user) return;
    setModalUser(user);
    setModalOpen(true);
    fetchUserTimeLogs(user.id);
  };

  const closeManageModal = () => {
    setModalOpen(false);
    setModalUser(null);
    setModalTimeLogs([]);
  };

  const refreshModal = async () => {
    if (!modalUser) return;
    try {
      setModalRefreshing(true);
      await fetchUserTimeLogs(modalUser.id);
      setModalLastRefreshed(new Date());
    } finally {
      setModalRefreshing(false);
    }
  };


  const roleFilterButtons: { value: RoleFilter; label: string; icon: React.ReactNode; color: string }[] = [
    { value: "All", label: "All Roles", icon: <Filter className="w-4 h-4" />, color: "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" },
    { value: "Admin", label: "Admin", icon: <Shield className="w-4 h-4" />, color: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/45" },
    { value: "Instructor", label: "Instructor", icon: <GraduationCap className="w-4 h-4" />, color: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/45" },
    { value: "Employee", label: "Employee", icon: <Users className="w-4 h-4" />, color: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/45" },
  ];

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      {/* Toast notification (simple) */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50">
          <div className="bg-white border border-slate-200 rounded-lg shadow px-4 py-2 text-sm text-gray-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 flex items-center gap-3">
            <div>{toastMessage}</div>
            <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-gray-600">×</button>
          </div>
        </div>
      )}
      {/* Sorting Controls */}
      <div className="mb-4 flex gap-2 items-center">
        <span className="text-sm text-gray-600 dark:text-slate-300">Sort by:</span>
        <select value={sortField} onChange={e => setSortField(e.target.value as any)} className="px-2 py-1 border rounded text-sm bg-white text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700">
          <option value="time_in">Time In</option>
          <option value="time_out">Time Out</option>
          <option value="name">Name</option>
        </select>
        <button
          className="px-2 py-1 border rounded text-sm border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </button>
      </div>
        <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">All times are shown in your local timezone.</div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Audit Logs</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Shows login/logout activity and user time logs for all users (Admins, Instructors, Employees). Use the role filters to narrow results.
          </p>
        </div>
        <span className="text-sm text-gray-500 dark:text-slate-400">{total} total entries</span>
      </div>

      {loadError && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200 flex items-center justify-between gap-2">
          <span>{loadError}</span>
          <button
            onClick={() => fetchLogs(page)}
            className="rounded border border-amber-400 px-2 py-1 text-xs font-medium hover:bg-amber-100 dark:border-amber-600 dark:hover:bg-amber-900/40"
          >
            Retry
          </button>
        </div>
      )}

      {/* Manage Time Logs Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeManageModal}></div>
          <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-2xl z-50 p-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium">Manage Time Logs for {modalUser?.fullname}</h3>
                {modalLastRefreshed && (
                  <div className="text-xs text-gray-500">Updated {modalLastRefreshed.toLocaleTimeString()}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {modalTimeLogs.length > 0 && (
                  <button
                    onClick={() => {
                      showConfirm(`Delete all ${modalTimeLogs.length} time logs for ${modalUser?.fullname}?`, async () => {
                        await deleteAllTimeLogs();
                      });
                    }}
                    className="px-2 py-1 text-xs border rounded border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200 dark:border-rose-700 dark:bg-rose-900/35 dark:text-rose-300 dark:hover:bg-rose-900/55"
                  >
                    Delete All
                  </button>
                )}
                <button
                  onClick={refreshModal}
                  disabled={modalRefreshing}
                  className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50 flex items-center"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  {modalRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <button onClick={closeManageModal} className="text-gray-500">Close</button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {modalLoading ? (
                <div className="text-center text-gray-500">Loading...</div>
              ) : modalTimeLogs.length === 0 ? (
                <div className="text-center text-gray-500">No time logs for this user.</div>
              ) : (
                <div className="space-y-3 pr-2">
                  {modalTimeLogs.map((tl) => (
                    <div key={tl.id} className="border rounded p-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-gray-600">Time In: {tl.time_in || '—'}</div>
                        <div className="text-sm text-gray-600">Time Out: {tl.time_out || '—'}</div>
                        <div className="text-sm text-gray-600">Status: {(tl.time_out == null) ? 'Active' : 'Inactive'}</div>
                        <div className="text-sm text-gray-500">Note: {tl.note || '—'}</div>
                        <div className="text-sm text-gray-400">Archived: {tl.archived ? 'Yes' : 'No'}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => {
                            showPrompt('Enter new Time In (ISO or YYYY-MM-DD HH:MM):', tl.time_in || '', async (newIn) => {
                              showPrompt('Enter new Time Out (ISO or YYYY-MM-DD HH:MM):', tl.time_out || '', async (newOut) => {
                                if (newIn === null && newOut === null) return;
                                try {
                                  await updateTimeLog(tl.id, { time_in: newIn || null, time_out: newOut || null });
                                  alert('Updated');
                                } catch (e) { alert('Update failed'); }
                              });
                            });
                          }}
                          className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await archiveTimeLog(tl.id, !tl.archived);
                              alert(tl.archived ? 'Unarchived' : 'Archived');
                            } catch (e) { alert('Archive failed'); }
                          }}
                          className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                        >
                          {tl.archived ? 'Unarchive' : 'Archive'}
                        </button>
                        <button
                          onClick={() => {
                            showConfirm('Delete this time log?', async () => {
                              try { await deleteTimeLog(tl.id); alert('Deleted'); } catch (e) { alert('Delete failed'); }
                            });
                          }}
                          className="px-2 py-1 text-xs border rounded border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200 dark:border-rose-700 dark:bg-rose-900/35 dark:text-rose-300 dark:hover:bg-rose-900/55"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-900/20 dark:border-purple-800/40">
          <div className="flex items-center gap-2 text-purple-700 mb-1">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium">Admin Sessions</span>
          </div>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">{stats.admin}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800/40">
          <div className="flex items-center gap-2 text-blue-700 mb-1">
            <GraduationCap className="w-4 h-4" />
            <span className="text-xs font-medium">Instructor Sessions</span>
          </div>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.instructor}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-emerald-900/20 dark:border-emerald-800/40">
          <div className="flex items-center gap-2 text-green-700 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Employee Sessions</span>
          </div>
          <p className="text-2xl font-bold text-green-800 dark:text-emerald-300">{stats.employee}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 dark:bg-slate-800/70 dark:border-slate-700">
          <div className="flex items-center gap-2 text-gray-700 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Total Sessions</span>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-200">{stats.totalSessions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-md text-sm focus:ring-green-500 focus:border-green-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        {/* Role Filter Buttons */}
        <div className="flex gap-2">
          {roleFilterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setRoleFilter(btn.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                roleFilter === btn.value
                  ? btn.color + " ring-2 ring-offset-1 ring-gray-400"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filters Summary */}
      {(roleFilter !== "All" || search) && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
          <span>Showing:</span>
          {roleFilter !== "All" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-full text-xs">
              {roleFilter}
              <button onClick={() => setRoleFilter("All")} className="ml-1 text-gray-400 hover:text-gray-600">×</button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-full text-xs">
              "{search}"
              <button onClick={() => setSearch("")} className="ml-1 text-gray-400 hover:text-gray-600">×</button>
            </span>
          )}
          <span className="text-gray-400 dark:text-slate-500">({filteredSessions.length} sessions)</span>
        </div>
      )}

      {/* Bulk actions (visible when users selected) */}
      {selectedLogIds.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <div className="text-sm text-gray-700 dark:text-slate-300">{selectedLogIds.length} item(s) selected</div>
          <button
            onClick={async () => {
              showConfirm(`Delete ${selectedLogIds.length} selected log(s)?`, async () => {
                try {
                  setLoading(true);
                  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
                  const res = await fetch('/api/admin/audit-logs/bulk-delete', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getXsrf() },
                    body: JSON.stringify({ ids: selectedLogIds }),
                  });
                  if (!res.ok) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(txt || 'Bulk delete failed');
                  }
                  const data = await res.json().catch(() => null);
                  await fetchLogs(1);
                  setSelectedLogIds([]);
                  setSelectedUserIds([]);
                  showToast(data && data.deleted !== undefined ? `Deleted ${data.deleted} rows` : 'Bulk delete completed');
                } catch (e: any) {
                  if ((e?.message || '').toLowerCase().includes('forbidden') || (e?.message || '').toLowerCase().includes('unauthorized')) {
                    showToast('Bulk delete failed: not authorized');
                  } else {
                    showToast('Bulk delete failed');
                  }
                } finally { setLoading(false); }
              });
            }}
            className="px-3 py-1 text-sm bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40 dark:hover:bg-red-900/35"
          >
            Delete Logs
          </button>
          <button onClick={() => { setSelectedLogIds([]); setSelectedUserIds([]); }} className="px-2 py-1 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">Clear</button>
        </div>
      )}

      {/* Bulk actions (visible when users selected) */}
      {selectedUserIds.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <div className="text-sm text-gray-700 dark:text-slate-300">{selectedUserIds.length} user(s) selected</div>
          <button
            onClick={async () => {
              showConfirm(`Delete all audit logs for ${selectedUserIds.length} selected user(s)?`, async () => {
                try {
                  setLoading(true);
                  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
                  const res = await fetch('/api/admin/audit-logs/bulk-delete-by-users', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getXsrf() },
                    body: JSON.stringify({ user_ids: selectedUserIds }),
                  });
                  if (!res.ok) throw new Error('Bulk delete by users failed');
                  const data = await res.json().catch(() => null);
                  await fetchLogs(1);
                  setSelectedUserIds([]);
                  setSelectedLogIds([]);
                  showToast(data && data.deleted !== undefined ? `Deleted ${data.deleted} rows` : 'Bulk delete completed');
                } catch (e) { alert('Bulk delete failed'); } finally { setLoading(false); }
              });
            }}
            className="px-3 py-1 text-sm bg-red-600 text-white border rounded hover:bg-red-700"
          >
            Delete All Logs For Selected Users
          </button>
          <button onClick={() => setSelectedUserIds([])} className="px-2 py-1 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto overflow-y-auto max-h-[700px]">
          <table style={{minWidth: '1400px'}} className="min-w-full divide-y divide-gray-200 table-fixed w-full">
            <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        setSelectedLogIds(visibleSessionIds);
                        // select all visible users as well
                        const visibleUserIds = userGroups.map((g) => g[0].user_id).filter(Boolean) as number[];
                        setSelectedUserIds(visibleUserIds);
                      } else {
                        setSelectedLogIds([]);
                        setSelectedUserIds([]);
                      }
                    }}
                    checked={visibleSessionIds.length > 0 && selectedLogIds.length === visibleSessionIds.length}
                    className="h-4 w-4 text-green-600 border-slate-300 rounded"
                  />
                </th>
                <th style={{width: '220px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  User
                </th>
                <th style={{width: '90px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Role
                </th>
                <th style={{width: '120px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Department
                </th>
                <th style={{width: '120px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  IP Address
                </th>
                <th style={{width: '150px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Date
                </th>
                <th style={{width: '140px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1 text-green-600">
                    <LogIn className="w-3 h-3" />
                    Login (Audit)
                  </div>
                </th>
                <th style={{width: '140px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1 text-green-700">
                    <Clock className="w-3 h-3" />
                    Actual Time In
                  </div>
                </th>
                <th style={{width: '140px'}} className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1 text-red-600">
                    <LogOut className="w-3 h-3" />
                    Time Out (Actual)
                  </div>
                </th>
                <th style={{width: '100px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th style={{width: '100px'}} className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1 text-blue-700">
                    <Clock className="w-3 h-3" />
                    Duration
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                <tr>
                  <td colSpan={12} className="px-6 py-8 text-center text-gray-400 dark:text-slate-500">
                    Loading...
                  </td>
                </tr>
              </tbody>
            ) : userGroups.length === 0 ? (
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                <tr>
                  <td colSpan={12} className="px-6 py-8 text-center text-gray-400 dark:text-slate-500">
                    {loadError ? "Unable to load audit logs right now." : "No audit logs found."}
                  </td>
                </tr>
              </tbody>
            ) : (
              userGroups.map((group) => {
                const latest = group[0];
                return (
                  <tbody key={`group-${latest.user_id}`} className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                    <tr className="bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/60 dark:hover:bg-slate-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedLogIds.includes(sessionPrimaryId(latest) || -1)}
                            onChange={(e) => {
                              e.stopPropagation();
                              const id = sessionPrimaryId(latest);
                              if (!id) return;
                              if (e.target.checked) {
                                setSelectedLogIds((s) => Array.from(new Set([...s, id])));
                                // also select the user for user-level bulk actions
                                if (latest.user_id) setSelectedUserIds((u) => Array.from(new Set([...u, latest.user_id])));
                              } else {
                                setSelectedLogIds((s) => s.filter((i) => i !== id));
                                if (latest.user_id) setSelectedUserIds((u) => u.filter((x) => x !== latest.user_id));
                              }
                            }}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap overflow-hidden" style={{width: '220px'}}>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center min-w-0">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                                  latest.user?.role?.toLowerCase() === "admin"
                                    ? "bg-purple-100 text-purple-700"
                                    : latest.user?.role?.toLowerCase() === "instructor"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {(latest.user?.fullname || "?").charAt(0).toUpperCase()}
                              </div>
                              <div className="ml-3 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{latest.user?.fullname || "Unknown"}</p>
                                <p className="text-xs text-gray-500 truncate">{latest.user?.email || "—"}</p>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap overflow-hidden" style={{width: '90px'}}>
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                              latest.user?.role?.toLowerCase() === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : latest.user?.role?.toLowerCase() === "instructor"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {latest.user?.role || "—"}
                          </span>
                        </td>
                        <td style={{width: '120px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden text-sm text-gray-600">{latest.user?.department || "—"}</td>
                        <td style={{width: '120px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden text-sm text-gray-500 font-mono">{latest.ip_address || "—"}</td>
                        <td style={{width: '150px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden text-sm text-gray-600">
                          {formatYmd(resolvedTimeIn(latest) || resolvedTimeOut(latest))}
                        </td>
                        <td style={{width: '140px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden">
                          {formatDateTime(latest.audit_login_at) ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">{formatDateTime(latest.audit_login_at)?.date}</span>
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-12 text-right tabular-nums text-sm font-medium text-green-600">{formatDateTime(latest.audit_login_at)?.time}</span>
                                <span className="inline-flex w-10 justify-center text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{formatDateTime(latest.audit_login_at)?.period}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td style={{width: '140px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden">
                          {resolvedTimeIn(latest) ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">{formatDateTime(resolvedTimeIn(latest))?.date}</span>
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-12 text-right tabular-nums text-sm font-medium text-green-700">{formatDateTime(resolvedTimeIn(latest))?.time}</span>
                                <span className="inline-flex w-10 justify-center text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{formatDateTime(resolvedTimeIn(latest))?.period}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td style={{width: '140px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden">
                          {resolvedTimeOut(latest) ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">{formatDateTime(resolvedTimeOut(latest))?.date}</span>
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-12 text-right tabular-nums text-sm font-medium text-red-600">{formatDateTime(resolvedTimeOut(latest))?.time}</span>
                                <span className="inline-flex w-10 justify-center text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{formatDateTime(resolvedTimeOut(latest))?.period}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td style={{width: '100px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden">
                          {resolvedTimeOut(latest) == null ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/35 dark:text-emerald-300 dark:border-emerald-700/60">Active</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-600">Inactive</span>
                          )}
                        </td>
                        <td style={{width: '100px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden text-sm text-blue-700 font-semibold">
                          {(() => {
                            const timeIn = resolvedTimeIn(latest);
                            const timeOut = resolvedTimeOut(latest);
                            if (!timeIn || !timeOut) return '—';
                            const diff = Math.abs(new Date(timeOut).getTime() - new Date(timeIn).getTime());
                            const hours = Math.floor(diff / 3600000);
                            const mins = Math.floor((diff % 3600000) / 60000);
                            return `${hours}h ${mins}m`;
                          })()}
                        </td>
                        <td style={{width: '170px'}} className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openManageModal(latest.user)}
                              className="px-2 py-1 text-xs border rounded border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-900/50"
                            >
                              Manage
                            </button>
                            <button
                              onClick={async () => {
                                const id = sessionPrimaryId(latest);
                                if (!id) return;
                                    showConfirm('Delete this audit log?', async () => {
                                      try {
                                        setLoading(true);
                                        await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
                                        const res = await fetch('/api/admin/audit-logs/bulk-delete', {
                                          method: 'POST',
                                          credentials: 'include',
                                          headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getXsrf() },
                                          body: JSON.stringify({ ids: [id] }),
                                        });
                                        if (!res.ok) throw new Error('Delete failed');
                                        await fetchLogs(1);
                                        setSelectedLogIds((s) => s.filter((i) => i !== id));
                                      } catch (e) { alert('Delete failed'); } finally { setLoading(false); }
                                    });
                              }}
                              className="px-2 py-1 text-xs border rounded border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200 dark:border-rose-700 dark:bg-rose-900/35 dark:text-rose-300 dark:hover:bg-rose-900/55"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Older sessions for this user */}
                      {group.slice(1).map((older) => (
                        <tr key={older.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/70">
                          <td className="px-6 py-2 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedLogIds.includes(sessionPrimaryId(older) || -1)}
                              onChange={(e) => {
                                e.stopPropagation();
                                const id = sessionPrimaryId(older);
                                if (!id) return;
                                if (e.target.checked) setSelectedLogIds((s) => Array.from(new Set([...s, id])));
                                else setSelectedLogIds((s) => s.filter((i) => i !== id));
                              }}
                            />
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap overflow-hidden" style={{width: '220px'}}>
                            <div className="ml-3 min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">{older.user?.fullname || 'Unknown'}</p>
                              <p className="text-xs text-gray-400 truncate">Past session</p>
                            </div>
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap overflow-hidden" style={{width: '90px'}}><span className="text-xs text-gray-500">{older.user?.role || '—'}</span></td>
                          <td style={{width: '120px'}} className="px-6 py-2 whitespace-nowrap overflow-hidden text-sm text-gray-600">{older.user?.department || '—'}</td>
                          <td style={{width: '120px'}} className="px-6 py-2 whitespace-nowrap overflow-hidden text-sm text-gray-500 font-mono">{older.ip_address || '—'}</td>
                          <td style={{width: '150px'}} className="px-6 py-2 whitespace-nowrap overflow-hidden text-sm text-gray-600">{formatYmd(resolvedTimeIn(older) || resolvedTimeOut(older))}</td>
                          <td style={{width: '140px'}} className="px-6 py-2 whitespace-nowrap overflow-hidden">
                            {formatDateTime(older.audit_login_at) ? (
                              <div>
                                <span className="text-xs text-gray-500">{formatDateTime(older.audit_login_at)?.date}</span>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block w-12 text-right tabular-nums text-sm text-gray-700">{formatDateTime(older.audit_login_at)?.time}</span>
                                  <span className="inline-flex w-10 justify-center text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{formatDateTime(older.audit_login_at)?.period}</span>
                                </div>
                              </div>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td style={{width: '140px'}} className="px-6 py-2 whitespace-nowrap overflow-hidden">
                            {resolvedTimeIn(older) ? (
                              <div>
                                <span className="text-xs text-gray-500">{formatDateTime(resolvedTimeIn(older))?.date}</span>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block w-12 text-right tabular-nums text-sm text-gray-700">{formatDateTime(resolvedTimeIn(older))?.time}</span>
                                  <span className="inline-flex w-10 justify-center text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{formatDateTime(resolvedTimeIn(older))?.period}</span>
                                </div>
                              </div>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td style={{width: '140px'}} className="px-6 py-2 whitespace-nowrap overflow-hidden">
                            {formatDateTime(resolvedTimeOut(older)) ? (
                              <div>
                                <span className="text-xs text-gray-500">{formatDateTime(resolvedTimeOut(older))?.date}</span>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block w-12 text-right tabular-nums text-sm text-gray-600">{formatDateTime(resolvedTimeOut(older))?.time}</span>
                                  <span className="inline-flex w-10 justify-center text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{formatDateTime(resolvedTimeOut(older))?.period}</span>
                                </div>
                              </div>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td style={{width: '100px'}} className="px-6 py-2 whitespace-nowrap overflow-hidden">
                            {resolvedTimeOut(older) == null ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/35 dark:text-emerald-300 dark:border-emerald-700/60">Active</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-600">Inactive</span>
                            )}
                          </td>
                          <td style={{width: '100px'}} className="px-6 py-2 whitespace-nowrap overflow-hidden text-sm text-blue-700 font-semibold">
                            {(() => {
                              const timeIn = resolvedTimeIn(older);
                              const timeOut = resolvedTimeOut(older);
                              if (!timeIn || !timeOut) return '—';
                              const diff = Math.abs(new Date(timeOut).getTime() - new Date(timeIn).getTime());
                              const hours = Math.floor(diff / 3600000);
                              const mins = Math.floor((diff % 3600000) / 60000);
                              return `${hours}h ${mins}m`;
                            })()}
                          </td>
                          <td style={{width: '170px'}} className="px-6 py-2 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={async () => {
                                  const id = sessionPrimaryId(older);
                                  if (!id) return;
                                  showConfirm('Delete this audit log?', async () => {
                                    try {
                                      setLoading(true);
                                      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
                                      const res = await fetch('/api/admin/audit-logs/bulk-delete', {
                                        method: 'POST',
                                        credentials: 'include',
                                        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getXsrf() },
                                        body: JSON.stringify({ ids: [id] }),
                                      });
                                      if (!res.ok) throw new Error('Delete failed');
                                      await fetchLogs(1);
                                      setSelectedLogIds((s) => s.filter((i) => i !== id));
                                    } catch (e) { alert('Delete failed'); } finally { setLoading(false); }
                                  });
                                }}
                                className="px-2 py-1 text-xs border rounded border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200 dark:border-rose-700 dark:bg-rose-900/35 dark:text-rose-300 dark:hover:bg-rose-900/55"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  );
                })
              )}
          </table>
        </div>

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Page {page} of {lastPage}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => fetchLogs(page - 1)}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => fetchLogs(page + 1)}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      {confirm.ConfirmModalRenderer()}
      <PromptModalRenderer />
    </div>
  );
}
