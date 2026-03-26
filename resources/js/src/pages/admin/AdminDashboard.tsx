import React, { useState, useEffect } from 'react';
import { safeArray } from '../../utils/safe';
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
      .then((data: ActivityItem[]) => setAllActivity(safeArray(data)))
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

  const completionStatus = reportData?.completion_status ?? [];
  const monthlyTrends = reportData?.monthly_trends ?? [];
  const popularCourses = reportData?.popular_courses ?? [];
  const recentActivity = stats?.recent_activity ?? [];
  const currentRangeLabel = RANGE_OPTIONS.find((o) => o.months === analyticsRange)?.label ?? 'Last 6 Months';

  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard Overview
        </h1>
        <div className="text-sm text-slate-500">
          {lastUpdated ? `Last updated: Today, ${lastUpdated}` : 'Loading…'}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
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

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
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

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
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

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Overall Completion Status
            </h3>
            <div className="relative">
              <button
                onClick={() => setShowRangeMenu((v) => !v)}
                className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
                <Calendar className="h-4 w-4 mr-2" />
                {currentRangeLabel}
              </button>
              {showRangeMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-md shadow-lg z-20">
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
          <div className="h-80">
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

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Enrollment vs Completion Trends
          </h3>
          <div className="h-80">
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

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Most Popular Courses
        </h3>
        {reportsLoading ? (
          <div className="h-80 flex items-center justify-center text-slate-400">Loading…</div>
        ) : popularCourses.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-slate-400">No course enrollment data yet</div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularCourses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={160}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + '…' : v}
                />
                <Tooltip formatter={(value) => [value, 'Enrolled Students']} />
                <Bar dataKey="students" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={28}>
                  {popularCourses.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#16a34a' : i === 1 ? '#22c55e' : '#4ade80'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom Section: Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">
              Recent Activity
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400">
                      No activity yet
                    </td>
                  </tr>
                ) : (
                  safeArray(recentActivity).map((activity) =>
                    <tr
                      key={activity.id}
                      className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {activity.user}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {activity.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {activity.target}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {activity.time}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-100 text-center">
            <button
              onClick={openAllActivity}
              className="text-sm text-green-600 font-medium hover:text-green-700">
              View All Activity
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => onNavigate?.('courses')}
              className="w-full flex items-center p-3 text-left rounded-lg border border-slate-200 hover:border-green-500 hover:bg-green-50 transition-all group">
              <div className="p-2 bg-green-100 rounded-md group-hover:bg-green-200">
                <BookOpen className="h-5 w-5 text-green-700" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900">
                  Create New Course
                </p>
                <p className="text-xs text-slate-500">
                  Add a new training module
                </p>
              </div>
            </button>

            <button
              onClick={() => onNavigate?.('users')}
              className="w-full flex items-center p-3 text-left rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group">
              <div className="p-2 bg-blue-100 rounded-md group-hover:bg-blue-200">
                <UserPlus className="h-5 w-5 text-blue-700" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900">
                  Add Employee
                </p>
                <p className="text-xs text-slate-500">Register a new user</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate?.('notifications')}
              className="w-full flex items-center p-3 text-left rounded-lg border border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition-all group">
              <div className="p-2 bg-purple-100 rounded-md group-hover:bg-purple-200">
                <Bell className="h-5 w-5 text-purple-700" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900">
                  Send Notification
                </p>
                <p className="text-xs text-slate-500">Alert all employees</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* View All Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">All Activity</h2>
              <button
                onClick={() => setShowActivityModal(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {activityLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400">Loading…</td>
                    </tr>
                  ) : allActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400">No activity found</td>
                    </tr>
                  ) : (
                    safeArray(allActivity).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.user}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.action}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.target}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{item.time}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowActivityModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

}
