import { useState, useEffect, useRef, useCallback } from "react";
import { LogIn, LogOut, Search, ChevronLeft, ChevronRight, Filter, Users, GraduationCap, Shield, Clock, RefreshCw, X, Download, FileText, FileSpreadsheet, ChevronDown, Eye, AlertCircle } from "lucide-react";
import { LoadingState } from '../../components/ui/LoadingState';

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

type RoleFilter = "All" | "Employee" | "Instructor" | "Admin";

interface AuditLogRetentionPolicy {
  enabled: boolean;
  retention_value: number;
  retention_unit: 'days' | 'weeks' | 'months' | 'years';
  configured?: boolean;
}

export function AuditLogs() {
  const API = "/api/admin";
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

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<string>('');
  const [retentionPolicy, setRetentionPolicy] = useState<AuditLogRetentionPolicy | null>(null);
  const [retentionPolicyLoading, setRetentionPolicyLoading] = useState(false);

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

  useEffect(() => {
    const loadRetentionPolicy = async () => {
      try {
        setRetentionPolicyLoading(true);
        const res = await fetch(`${API}/audit-log-retention-policy`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          return;
        }

        const data: AuditLogRetentionPolicy = await res.json();
        setRetentionPolicy(data);
      } catch (err) {
        console.error('Failed to load audit log retention policy:', err);
        setRetentionPolicy({ enabled: false, retention_value: 365, retention_unit: 'days', configured: false });
      } finally {
        setRetentionPolicyLoading(false);
      }
    };

    loadRetentionPolicy();
  }, []);

  // (live tick disabled in this build)
  const filteredLogs = logs.filter((entry) => {
    if (roleFilter !== "All") {
      const userRole = (entry.user?.role || "").trim().toLowerCase();
      const selectedRole = roleFilter.trim().toLowerCase();
      if (userRole !== selectedRole) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (entry.user?.fullname || "").toLowerCase().includes(q) || (entry.user?.email || "").toLowerCase().includes(q) || (entry.action || "").toLowerCase().includes(q);
  });

  const stats = {
    admin: logs.filter((s) => (s.user?.role || "").toLowerCase() === "admin").length,
    instructor: logs.filter((s) => (s.user?.role || "").toLowerCase() === "instructor").length,
    employee: logs.filter((s) => (s.user?.role || "").toLowerCase() === "employee").length,
    totalSessions: logs.length,
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

  const resolvedTimeInEntry = (e: AuditEntry) => e.time_log?.time_in ?? null;
  const resolvedTimeOutEntry = (e: AuditEntry) => e.time_log?.time_out ?? null;

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

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  // Modal state for audit-log details
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntry, setModalEntry] = useState<AuditEntry | null>(null);

  const openDetailsModal = (entry: AuditEntry) => {
    setModalEntry(entry);
    setModalOpen(true);
  };

  const closeDetailsModal = () => {
    setModalOpen(false);
    setModalEntry(null);
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    const params: any = {};
    if (roleFilter !== 'All') params.role = roleFilter;
    if (period) params.period = period;
    params.format = format;
    const qs = new URLSearchParams(params).toString();
    window.open(`/api/admin/audit-logs/export?${qs}`, '_blank');
    setShowExportMenu(false);
  };

  const roleFilterButtons: { value: RoleFilter; label: string; icon: React.ReactNode; color: string }[] = [
    { value: "All", label: "All Roles", icon: <Filter className="w-4 h-4" />, color: "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" },
    { value: "Admin", label: "Admin", icon: <Shield className="w-4 h-4" />, color: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/45" },
    { value: "Instructor", label: "Instructor", icon: <GraduationCap className="w-4 h-4" />, color: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/45" },
    { value: "Employee", label: "Employee", icon: <Users className="w-4 h-4" />, color: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/45" },
  ];

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      {/* Toast notification (simple) */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50">
          <div className="bg-white border border-slate-200 rounded-lg shadow px-4 py-2 text-sm text-gray-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 flex items-center gap-3">
            <div>{toastMessage}</div>
            <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">×</button>
          </div>
        </div>
      )}
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

      {/* Retention policy notice */}
      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold">Audit log retention policy</div>
            {retentionPolicyLoading ? (
              <div>Loading the current retention policy...</div>
            ) : retentionPolicy ? (
              retentionPolicy.enabled ? (
                <div>
                  Logs older than {retentionPolicy.retention_value} {retentionPolicy.retention_unit} are soft-deleted automatically.
                  You can change this in Settings.
                </div>
              ) : (
                <div>
                  Automatic soft delete is currently disabled{retentionPolicy.configured === false ? ' or not configured yet' : ''}.
                  Enable and configure it in Settings if retention is required.
                </div>
              )
            ) : (
              <div>Retention policy could not be loaded right now, but this page will still work normally.</div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log Details Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeDetailsModal}></div>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg w-11/12 max-w-2xl z-50 p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium">Audit Log Details</h3>
                <div className="text-xs text-gray-500 dark:text-slate-400">Review the exact event that occurred in the system.</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={closeDetailsModal} className="text-gray-500 dark:text-slate-400">Close</button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto space-y-4 pr-2">
              {modalEntry ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-950/40">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{modalEntry.user?.fullname || 'Unknown user'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{modalEntry.user?.email || '—'}</div>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${modalEntry.action === 'login' ? 'bg-green-100 text-green-800 dark:bg-green-900/35 dark:text-green-300' : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'}`}>
                        {modalEntry.action === 'login' ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                        {modalEntry.action === 'login' ? 'Login event' : 'Logout event'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Date & Time</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{new Date(modalEntry.created_at).toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">IP Address</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{modalEntry.ip_address || '—'}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Department</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{modalEntry.user?.department || '—'}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Role</div>
                      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{modalEntry.user?.role || '—'}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Event details</div>
                    <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      {modalEntry.action === 'login'
                        ? 'The user successfully authenticated into the system.'
                        : 'The user ended the active session or was logged out.'}
                    </div>
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Related time log: {modalEntry.time_log ? `#${modalEntry.time_log.id}` : '—'}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-900/20 dark:border-purple-800/40">
          <div className="flex items-center gap-2 text-purple-700 mb-1">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium">Admin Events</span>
          </div>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">{stats.admin}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800/40">
          <div className="flex items-center gap-2 text-blue-700 mb-1">
            <GraduationCap className="w-4 h-4" />
            <span className="text-xs font-medium">Instructor Events</span>
          </div>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.instructor}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-800/40">
          <div className="flex items-center gap-2 text-green-700 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Employee Events</span>
          </div>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">{stats.employee}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 dark:bg-slate-800/70 dark:border-slate-700">
          <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Total Audit Events</span>
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

        {/* Period selector moved into export menu for clarity */}

        <div className="relative ml-auto" ref={exportMenuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
            {period ? (
              <span className="ml-2 inline-block bg-white/10 text-white text-xs px-2 py-0.5 rounded-full">{period.charAt(0).toUpperCase() + period.slice(1)}</span>
            ) : null}
            <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 py-2 px-2 z-50">
              <div className="px-3 pb-2">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Period</div>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-2">
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full px-3 py-2 border border-transparent rounded-md text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                  >
                    <option value="">All Periods</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-700">
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full flex items-center gap-3 px-3 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-md transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">Excel File</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Microsoft Excel format</div>
                  </div>
                  <div className="text-xs text-slate-400">{period ? period.charAt(0).toUpperCase()+period.slice(1) : 'All'}</div>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full flex items-center gap-3 px-3 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-md transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">PDF Document</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Portable document format</div>
                  </div>
                  <div className="text-xs text-slate-400">{period ? period.charAt(0).toUpperCase()+period.slice(1) : 'All'}</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Filters Summary */}
      {(roleFilter !== "All" || search) && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
          <span>Showing:</span>
          {roleFilter !== "All" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-full text-xs">
              {roleFilter}
              <button onClick={() => setRoleFilter("All")} className="ml-1 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">×</button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-full text-xs">
              "{search}"
              <button onClick={() => setSearch("")} className="ml-1 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">×</button>
            </span>
          )}
          <span className="text-gray-400 dark:text-slate-500">({filteredLogs.length} events)</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto overflow-y-auto max-h-[700px]">
          <table className="min-w-full divide-y divide-gray-200 table-fixed w-full">
            <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0 z-10">
              <tr>
                <th style={{width: '220px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  User
                </th>
                <th style={{width: '90px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Role
                </th>
                <th style={{width: '120px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Department
                </th>
                <th style={{width: '120px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  IP Address
                </th>
                <th style={{width: '150px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Date
                </th>
                <th style={{width: '140px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <LogIn className="w-3 h-3" />
                    Audit Event
                  </div>
                </th>
                <th style={{width: '140px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1 text-green-700 dark:text-green-400">
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
                <th style={{width: '100px'}} className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th style={{width: '100px'}} className="px-6 py-3 text-left text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
                    <Clock className="w-3 h-3" />
                    Duration
                  </div>
                </th>
                <th style={{width: '170px'}} className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Details</th>
              </tr>
            </thead>
            {loading ? (
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-400 dark:text-slate-500">
                    <LoadingState message="Loading audit logs" size="sm" className="py-2" />
                  </td>
                </tr>
              </tbody>
            ) : filteredLogs.length === 0 ? (
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-400 dark:text-slate-500">
                    {loadError ? "Unable to load audit logs right now." : "No audit logs found."}
                  </td>
                </tr>
              </tbody>
            ) : (
              filteredLogs.map((entry) => (
                <tbody key={entry.id} className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                  <tr className="bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/60 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 whitespace-nowrap overflow-hidden" style={{width: '220px'}}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center min-w-0">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                              entry.user?.role?.toLowerCase() === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : entry.user?.role?.toLowerCase() === "instructor"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {(entry.user?.fullname || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{entry.user?.fullname || "Unknown"}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{entry.user?.email || "—"}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap overflow-hidden" style={{width: '90px'}}>
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          entry.user?.role?.toLowerCase() === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : entry.user?.role?.toLowerCase() === "instructor"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {entry.user?.role || "—"}
                      </span>
                    </td>
                    <td style={{width: '120px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden text-sm text-gray-600 dark:text-slate-300">{entry.user?.department || "—"}</td>
                    <td style={{width: '120px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden text-sm text-gray-500 dark:text-slate-400 font-mono">{entry.ip_address || "—"}</td>
                    <td style={{width: '150px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden text-sm text-gray-600 dark:text-slate-300">{formatYmd(entry.created_at)}</td>
                    <td style={{width: '140px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.action === 'login' ? 'User signed in' : 'User signed out'}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2">
                        <span className={`inline-block w-12 text-right tabular-nums text-sm font-medium ${entry.action === 'login' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatDateTime(entry.created_at)?.time}</span>
                        <span className="inline-flex w-10 justify-center text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-medium">{formatDateTime(entry.created_at)?.period}</span>
                      </div>
                    </td>
                    <td style={{width: '140px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden">
                      {(() => {
                        const t = resolvedTimeInEntry(entry);
                        const f = formatDateTime(t);
                        return f ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-slate-400">{f.date}</span>
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-12 text-right tabular-nums text-sm font-medium text-green-700 dark:text-green-400">{f.time}</span>
                              <span className="inline-flex w-10 justify-center text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-medium">{f.period}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-slate-500">—</span>
                        );
                      })()}
                    </td>
                    <td style={{width: '140px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden">
                      {(() => {
                        const t = resolvedTimeOutEntry(entry);
                        const f = formatDateTime(t);
                        return f ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-slate-400">{f.date}</span>
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-12 text-right tabular-nums text-sm font-medium text-red-600 dark:text-red-400">{f.time}</span>
                              <span className="inline-flex w-10 justify-center text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-medium">{f.period}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-slate-500">—</span>
                        );
                      })()}
                    </td>
                    <td style={{width: '100px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden">
                      {entry.action === 'login' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/35 dark:text-green-300 dark:border-green-700/60">Successful</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-600">Completed</span>
                      )}
                    </td>
                    <td style={{width: '100px'}} className="px-6 py-4 whitespace-nowrap overflow-hidden text-sm text-gray-600 dark:text-slate-300">
                      {(() => {
                        const tin = resolvedTimeInEntry(entry);
                        const tout = resolvedTimeOutEntry(entry);
                        if (!tin || !tout) return <span className="text-sm text-gray-400 dark:text-slate-500">—</span>;
                        const diff = new Date(tout).getTime() - new Date(tin).getTime();
                        if (isNaN(diff) || diff < 0) return <span className="text-sm text-gray-400 dark:text-slate-500">—</span>;
                        const mins = Math.round(diff / 60000);
                        const h = Math.floor(mins / 60);
                        const m = mins % 60;
                        return (
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
                        );
                      })()}
                    </td>
                    <td style={{width: '170px'}} className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetailsModal(entry)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs border rounded border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-900/50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ))
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
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => fetchLogs(page + 1)}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-800 dark:bg-slate-900 dark:text-slate-200"
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
