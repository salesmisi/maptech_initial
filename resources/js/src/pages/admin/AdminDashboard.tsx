import React, { useState, useEffect } from 'react';
import {
  Users,
  BookOpen,
  Award,
  TrendingUp,
  Plus,
  Bell,
  UserPlus,
  Calendar,
  X } from
'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend } from
'recharts';

const ANALYTICS_COLORS = ['#22c55e', '#eab308', '#94a3b8'];
const RANGE_OPTIONS = [
  { label: 'Last 3 Months', months: 3 },
  { label: 'Last 6 Months', months: 6 },
  { label: 'Last 12 Months', months: 12 },
];

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '';
}

interface DashboardStats {
  total_employees: number;
  active_employees?: number;
  active_courses: number;
  completion_rate: number;
  avg_quiz_score: number;
  completion_trends: { name: string; rate: number }[];
  department_performance: { name: string; completed: number; assigned: number }[];
  recent_activity: { id: number; user: string; action: string; target: string; time: string }[];
}

interface ReportData {
  completion_status: { name: string; value: number }[];
  monthly_trends: { name: string; enrollments: number; completions: number }[];
  popular_courses: { name: string; students: number }[];
}

interface ActivityItem {
  id: number;
  user: string;
  action: string;
  target: string;
  time: string;
}

interface Props {
  onNavigate?: (page: string) => void;
}

export function AdminDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [analyticsRange, setAnalyticsRange] = useState(6);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [allActivity, setAllActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));

  const openAllActivity = () => {
    setShowActivityModal(true);
    setActivityLoading(true);
    fetch('/api/admin/activity', {
      headers: {
        'Accept': 'application/json',
        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
      },
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data: ActivityItem[]) => setAllActivity(data))
      .finally(() => setActivityLoading(false));
  };

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch('/api/admin/dashboard', {
          headers: {
            'Accept': 'application/json',
            'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
          },
          credentials: 'include',
        });
        const data: DashboardStats = await res.json();
        if (!isMounted) return;
        setStats(data);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } finally {
        if (showSpinner && isMounted) setLoading(false);
      }
    };

    loadDashboard(true);
    const intervalId = window.setInterval(() => {
      loadDashboard(false);
    }, 20000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadReports = async (showSpinner = false) => {
      if (showSpinner) setReportsLoading(true);
      try {
        const res = await fetch(`/api/admin/reports?months=${analyticsRange}`, {
          headers: {
            'Accept': 'application/json',
            'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
          },
          credentials: 'include',
        });
        const data: ReportData = await res.json();
        if (!isMounted) return;
        setReportData(data);
      } finally {
        if (showSpinner && isMounted) setReportsLoading(false);
      }
    };

    loadReports(true);
    const intervalId = window.setInterval(() => {
      loadReports(false);
    }, 20000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [analyticsRange]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const completionStatus = reportData?.completion_status ?? [];
  const monthlyTrends = reportData?.monthly_trends ?? [];
  const popularCourses = reportData?.popular_courses ?? [];
  const cleanedPopularCourses = popularCourses.map((course) => ({
    ...course,
    name: (course.name ?? '')
      .replace(/(ΓÇª|Γçª|â€¦|…|Ã¢â‚¬Â¦|çª|Çª)/g, ' ')
      .replace(/[\u0000-\u001F\u007F\u0080-\u009F\u2028\u2029\uFFFD]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  }));
  const recentActivity = stats?.recent_activity ?? [];
  const currentRangeLabel = RANGE_OPTIONS.find((o) => o.months === analyticsRange)?.label ?? 'Last 6 Months';
  const popularCourseLabelWidth = Math.min(
    isMobile ? 120 : 520,
    Math.max(
      isMobile ? 100 : 240,
      cleanedPopularCourses.reduce((max, course) => Math.max(max, (course.name ?? '').length), 0) * (isMobile ? 6 : 10)
    )
  );

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Dashboard Overview
        </h1>
        <div className="self-start text-xs text-slate-500 sm:self-auto sm:text-sm">
          {lastUpdated ? `Last updated: Today, ${lastUpdated}` : 'Loading…'}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Employees
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '—' : stats?.total_employees ?? 0}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-slate-400">
              {loading ? 'Active employees' : `${stats?.active_employees ?? 0} active employees`}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Active Courses
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '—' : stats?.active_courses ?? 0}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-full">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-slate-400">Published &amp; active</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Completion Rate
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '—' : `${stats?.completion_rate ?? 0}%`}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-full">
              <Award className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-slate-400">Across all enrollments</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Avg Quiz Score
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '—' : `${stats?.avg_quiz_score ?? 0}%`}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-full">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-slate-400">Average progress score</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Overall Completion Status
            </h3>
            <div className="relative">
              <button
                onClick={() => setShowRangeMenu((v) => !v)}
                className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto sm:justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                {currentRangeLabel}
              </button>
              {showRangeMenu && (
                <div className="absolute right-0 z-20 mt-1 w-full min-w-44 rounded-md border border-slate-200 bg-white shadow-lg sm:w-44">
                  {RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.months}
                      onClick={() => {
                        setAnalyticsRange(opt.months);
                        setShowRangeMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${analyticsRange === opt.months ? 'text-green-600 font-medium' : 'text-slate-700'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="h-72 sm:h-80">
            {reportsLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400">Loading…</div>
            ) : completionStatus.every((d) => d.value === 0) ? (
              <div className="h-full flex items-center justify-center text-slate-400">No enrollment data yet</div>
            ) : (
              <div className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={completionStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value">
                      {completionStatus.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={ANALYTICS_COLORS[index % ANALYTICS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Enrollment vs Completion Trends
          </h3>
          <div className="h-72 sm:h-80">
            {reportsLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400">Loading…</div>
            ) : monthlyTrends.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">No trend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="enrollments" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="completions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Most Popular Courses
        </h3>
        {reportsLoading ? (
          <div className="h-80 flex items-center justify-center text-slate-400">Loading…</div>
        ) : popularCourses.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-slate-400">No course enrollment data yet</div>
        ) : (
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cleanedPopularCourses} layout="vertical" margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={popularCourseLabelWidth}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={{ fontSize: 13 }}
                />
                <Tooltip formatter={(value) => [value, 'Enrolled Students']} />
                <Bar dataKey="students" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={28}>
                  {cleanedPopularCourses.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#16a34a' : i === 1 ? '#22c55e' : '#4ade80'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom Section: Activity & Quick Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 sm:gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="border-b border-slate-100 p-4 dark:border-slate-700 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Recent Activity
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">
                    User
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">
                    Action
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">
                    Target
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-300 sm:px-6">
                      Loading…
                    </td>
                  </tr>
                ) : recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-300 sm:px-6">
                      No activity yet
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((activity) =>
                    <tr
                      key={activity.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 sm:px-6">
                        {activity.user}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600 dark:text-slate-200 sm:px-6">
                        {activity.action}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600 dark:text-slate-200 sm:px-6">
                        {activity.target}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-slate-300 sm:px-6">
                        {activity.time}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-center">
            <button
              onClick={openAllActivity}
              className="text-sm text-green-600 dark:text-emerald-300 font-medium hover:text-green-700 dark:hover:text-emerald-200">
              View All Activity
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => onNavigate?.('courses')}
              className="w-full flex items-center p-3 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:border-green-500 dark:hover:border-emerald-500 hover:bg-green-50 dark:hover:bg-emerald-900/25 transition-all group">
              <div className="p-2 bg-green-100 dark:bg-emerald-900/40 rounded-md group-hover:bg-green-200 dark:group-hover:bg-emerald-900/70 transition-colors">
                <BookOpen className="h-5 w-5 text-green-700 dark:text-emerald-300" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Create New Course
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Add a new training module
                </p>
              </div>
            </button>

            <button
              onClick={() => onNavigate?.('users')}
              className="w-full flex items-center p-3 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/25 transition-all group">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-md group-hover:bg-blue-200 dark:group-hover:bg-blue-900/70 transition-colors">
                <UserPlus className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Add Employee
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300">Register a new user</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate?.('notifications')}
              className="w-full flex items-center p-3 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/25 transition-all group">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-md group-hover:bg-purple-200 dark:group-hover:bg-purple-900/70 transition-colors">
                <Bell className="h-5 w-5 text-purple-700 dark:text-purple-300" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Send Notification
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300">Alert all employees</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* View All Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-2 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:mx-4">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-700 sm:px-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">All Activity</h2>
              <button
                onClick={() => setShowActivityModal(false)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">User</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">Action</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">Target</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                  {activityLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-sm text-slate-400 dark:text-slate-300 sm:px-6">Loading…</td>
                    </tr>
                  ) : allActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-sm text-slate-400 dark:text-slate-300 sm:px-6">No activity found</td>
                    </tr>
                  ) : (
                    allActivity.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 sm:px-6">{item.user}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600 dark:text-slate-200 sm:px-6">{item.action}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600 dark:text-slate-200 sm:px-6">{item.target}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-slate-300 sm:px-6">{item.time}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-right dark:border-slate-700 sm:px-6">
              <button
                onClick={() => setShowActivityModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

}
