import { useState, useEffect } from "react";
import { LogIn, LogOut, Search, ChevronLeft, ChevronRight, Filter, Users, GraduationCap, Shield, Clock } from "lucide-react";

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
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");

  const fetchLogs = async (pageNum: number) => {
    try {
      setLoading(true);
      await fetch("/sanctum/csrf-cookie", { credentials: "include" });
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
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
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

    // For each user, pair logins with logouts
    Object.keys(userLogs).forEach((userIdStr) => {
      const userId = parseInt(userIdStr);
      const userEntries = userLogs[userId].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Track pending logout entries
      const pendingLogouts: AuditEntry[] = [];

      userEntries.forEach((entry) => {
        if (entry.action === "logout") {
          pendingLogouts.push(entry);
        } else if (entry.action === "login") {
          // Pair with most recent pending logout if exists
          const matchingLogout = pendingLogouts.shift();
          sessions.push({
            id: `session-${entry.id}`,
            user: entry.user,
            user_id: userId,
            time_in: entry.created_at,
            time_out: matchingLogout ? matchingLogout.created_at : null,
            ip_address: entry.ip_address,
            login_id: entry.id,
            logout_id: matchingLogout ? matchingLogout.id : null,
          });
        }
      });

      // Handle any remaining pending logouts (logouts without matching logins)
      pendingLogouts.forEach((logout) => {
        sessions.push({
          id: `session-${logout.id}`,
          user: logout.user,
          user_id: userId,
          time_in: null,
          time_out: logout.created_at,
          ip_address: logout.ip_address,
          login_id: null,
          logout_id: logout.id,
        });
      });
    });

    // Sort sessions by most recent activity
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

  const formatDateTime = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const fullTime = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const time = fullTime.replace(/\s?(AM|PM)$/i, "").trim();
    const period = d.getHours() >= 12 ? "PM" : "AM";

    if (isToday) {
      return { date: "Today", time, period };
    } else if (isYesterday) {
      return { date: "Yesterday", time, period };
    } else {
      return {
        date: d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        time,
        period,
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
        <span className="text-sm text-gray-500">{total} total entries</span>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-700 mb-1">
            <Shield className="w-4 h-4" />
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
                              <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{timeIn.period}</span>
                              {!timeOut && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                  Active
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
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-red-600">{timeOut.time}</span>
                              <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{timeOut.period}</span>
                            </div>
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
