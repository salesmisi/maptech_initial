import { useState, useEffect, useRef, useCallback } from "react";
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
  time_in: string | null;
  time_out: string | null;
  ip_address: string | null;
  login_id: number | null;
  logout_id: number | null;
}

type RoleFilter = "All" | "Employee" | "Instructor" | "Admin";

export function AuditLogs() {
  const API = "/api/admin";

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift();
  };

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doFetch = useCallback(async (pageNum: number, silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const res = await fetch(`${API}/audit-logs?page=${pageNum}&per_page=100`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-XSRF-TOKEN": decodeURIComponent(getCookie("XSRF-TOKEN") || ""),
        },
      });
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data: PaginatedResponse = await res.json();
      setLogs(data.data);
      setPage(data.current_page);
      setLastPage(data.last_page);
      setTotal(data.total);
      setLastRefreshed(new Date());
    } catch {
      /* ignore */
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [API]);

  const fetchLogs = (pageNum: number) => doFetch(pageNum, false);

  // Initial load + start 30-second auto-poll
  useEffect(() => {
    doFetch(1, false);
    pollRef.current = setInterval(() => doFetch(1, true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [doFetch]);

  // Tick every second to drive the live elapsed timer
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Group logs into sessions (pair login with logout)
  const groupIntoSessions = (entries: AuditEntry[]): Session[] => {
    const sessions: Session[] = [];
    const userLogs: { [userId: number]: AuditEntry[] } = {};

    // Group by user
    entries.forEach((entry) => {
      const userId = entry.user_id;
      if (!userLogs[userId]) userLogs[userId] = [];
      userLogs[userId].push(entry);
    });

    // For each user, pair logins with logouts using a LIFO stack (ascending order)
    // Each logout pairs with the most recent unmatched login before it
    Object.keys(userLogs).forEach((userIdStr) => {
      const userId = parseInt(userIdStr);
      // Sort ascending by time, using id as tiebreaker for same-timestamp entries
      const userEntries = userLogs[userId].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
          a.id - b.id
      );

      const loginStack: AuditEntry[] = [];

      userEntries.forEach((entry) => {
        if (entry.action === "login") {
          loginStack.push(entry);
        } else if (entry.action === "logout") {
          if (loginStack.length > 0) {
            const matchedLogin = loginStack.pop()!;
            sessions.push({
              id: `session-${matchedLogin.id}`,
              user: matchedLogin.user,
              user_id: userId,
              time_in: matchedLogin.created_at,
              time_out: entry.created_at,
              ip_address: matchedLogin.ip_address,
              login_id: matchedLogin.id,
              logout_id: entry.id,
            });
          } else {
            // Orphaned logout with no matching login
            sessions.push({
              id: `session-${entry.id}`,
              user: entry.user,
              user_id: userId,
              time_in: null,
              time_out: entry.created_at,
              ip_address: entry.ip_address,
              login_id: null,
              logout_id: entry.id,
            });
          }
        }
      });

      // Remaining logins in the stack have no matching logout yet (Active sessions)
      loginStack.forEach((login) => {
        sessions.push({
          id: `session-${login.id}`,
          user: login.user,
          user_id: userId,
          time_in: login.created_at,
          time_out: null,
          ip_address: login.ip_address,
          login_id: login.id,
          logout_id: null,
        });
      });
    });

    // Sort sessions by most recent activity (descending)
    return sessions.sort((a, b) => {
      const aTime = a.time_in || a.time_out || "";
      const bTime = b.time_in || b.time_out || "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  };

  // Filter logs by search and role
  const filteredLogs = logs.filter((l) => {
    const matchesSearch = search.trim()
      ? l.user?.fullname.toLowerCase().includes(search.toLowerCase()) ||
        l.user?.email.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesRole =
      roleFilter === "All" ||
      l.user?.role?.toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  const sessions = groupIntoSessions(filteredLogs);

  // Group filtered logs by role for statistics
  const stats = {
    admin: sessions.filter((s) => s.user?.role?.toLowerCase() === "admin").length,
    instructor: sessions.filter((s) => s.user?.role?.toLowerCase() === "instructor").length,
    employee: sessions.filter((s) => s.user?.role?.toLowerCase() === "employee").length,
    totalSessions: sessions.length,
  };

  // Format elapsed time for active sessions
  const formatElapsed = (isoStart: string): string => {
    const diff = Math.max(0, Math.floor((now.getTime() - new Date(isoStart).getTime()) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

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

  const roleFilterButtons: { value: RoleFilter; label: string; icon: React.ReactNode; color: string }[] = [
    { value: "All", label: "All Roles", icon: <Filter className="w-4 h-4" />, color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
    { value: "Admin", label: "Admin", icon: <Shield className="w-4 h-4" />, color: "bg-purple-100 text-purple-700 hover:bg-purple-200" },
    { value: "Instructor", label: "Instructor", icon: <GraduationCap className="w-4 h-4" />, color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
    { value: "Employee", label: "Employee", icon: <Users className="w-4 h-4" />, color: "bg-green-100 text-green-700 hover:bg-green-200" },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track login and logout activity by role
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-gray-400">
              Updated {lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
            </span>
          )}
          <button
            onClick={() => doFetch(page, true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <span className="text-sm text-gray-500">{total} total entries</span>
        </div>
            <span className="text-xs font-medium">Admin Sessions</span>
          </div>
          <p className="text-2xl font-bold text-purple-800">{stats.admin}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 mb-1">
            <GraduationCap className="w-4 h-4" />
            <span className="text-xs font-medium">Instructor Sessions</span>
          </div>
          <p className="text-2xl font-bold text-blue-800">{stats.instructor}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Employee Sessions</span>
          </div>
          <p className="text-2xl font-bold text-green-800">{stats.employee}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-700 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Total Sessions</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.totalSessions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:ring-green-500 focus:border-green-500"
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
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
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
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <span>Showing:</span>
          {roleFilter !== "All" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
              {roleFilter}
              <button onClick={() => setRoleFilter("All")} className="ml-1 text-gray-400 hover:text-gray-600">×</button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
              "{search}"
              <button onClick={() => setSearch("")} className="ml-1 text-gray-400 hover:text-gray-600">×</button>
            </span>
          )}
          <span className="text-gray-400">({sessions.length} sessions)</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1 text-green-600">
                    <LogIn className="w-3 h-3" />
                    Time In
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1 text-red-600">
                    <LogOut className="w-3 h-3" />
                    Time Out
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => {
                  const timeIn = formatDateTime(session.time_in);
                  const timeOut = formatDateTime(session.time_out);

                  return (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                              session.user?.role?.toLowerCase() === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : session.user?.role?.toLowerCase() === "instructor"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {session.user?.fullname?.charAt(0) || "?"}
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              {session.user?.fullname || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {session.user?.email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            session.user?.role?.toLowerCase() === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : session.user?.role?.toLowerCase() === "instructor"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {session.user?.role || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {session.user?.department || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {session.ip_address || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {timeIn ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">{timeIn.date}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-green-600">{timeIn.time}</span>
                              {!timeOut && session.time_in && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                  {formatElapsed(session.time_in)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {timeOut ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">{timeOut.date}</span>
                            <span className="text-sm font-medium text-red-600">{timeOut.time}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="px-6 py-3 bg-gray-50 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
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
    </div>
  );
}
