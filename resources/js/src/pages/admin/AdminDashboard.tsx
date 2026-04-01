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
  Sector,
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
import { LoadingState } from '../../components/ui/LoadingState';

const ANALYTICS_COLORS = ['#34b46c', '#c8a73a', '#7f90ab'];
const POPULAR_COURSE_COLORS = ['#2ea85f', '#3abf6f', '#60ca88'];
const CHART_CARD_CLASS = 'rounded-xl border border-slate-200/70 bg-white/95 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70';
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
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [completionHoverIndex, setCompletionHoverIndex] = useState<number | undefined>(undefined);
  const [analyticsRange, setAnalyticsRange] = useState(6);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [allActivity, setAllActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkMode(root.classList.contains('dark'));
    });

    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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
  const chartGridColor = isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.28)';
  const chartAxisTickColor = isDarkMode ? '#a7b0c0' : '#64748b';
  const chartLegendColor = isDarkMode ? '#b8c2d1' : '#475569';
  const completionSliceStroke = isDarkMode ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.45)';
  const activeRingFill = isDarkMode ? 'rgba(226, 232, 240, 0.42)' : 'rgba(71, 85, 105, 0.28)';
  const trendActiveDotStroke = isDarkMode ? '#0b1220' : '#ffffff';
  const chartTooltipClass = isDarkMode
    ? 'rounded-lg border border-slate-700/60 bg-slate-900/88 px-3 py-2 shadow-md backdrop-blur-sm'
    : 'rounded-lg border border-slate-200/90 bg-white/96 px-3 py-2 shadow-sm backdrop-blur-sm';
  const chartTooltipLabelClass = isDarkMode ? 'text-xs font-medium text-slate-300' : 'text-xs font-medium text-slate-600';

  const renderCompletionTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const entry = payload[0];
    const segmentName = entry?.name ?? entry?.payload?.name ?? 'Status';
    const value = Number(entry?.value ?? 0);
    const segmentColor = entry?.color ?? '#7f90ab';

    return (
      <div className={chartTooltipClass}>
        <p className={chartTooltipLabelClass}>{segmentName}</p>
        <p className="text-sm font-semibold" style={{ color: segmentColor }}>
          {value} learner{value === 1 ? '' : 's'}
        </p>
      </div>
    );
  };

  const renderActiveCompletionSlice = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
    } = props;

    const expansion = Math.max(4, Math.min(8, outerRadius * 0.07));
    const ringGap = Math.max(2, Math.min(4, outerRadius * 0.03));
    const ringThickness = Math.max(2, Math.min(4, outerRadius * 0.035));

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + expansion}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={outerRadius + expansion + ringGap}
          outerRadius={outerRadius + expansion + ringGap + ringThickness}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={activeRingFill}
        />
      </g>
    );
  };

  const renderTrendsTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className={chartTooltipClass}>
        <p className={`mb-1 ${chartTooltipLabelClass}`}>{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  };

  const renderPopularCoursesTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const value = Number(payload[0]?.value ?? 0);
    const color = payload[0]?.color ?? POPULAR_COURSE_COLORS[0];

    return (
      <div className={chartTooltipClass}>
        <p className={chartTooltipLabelClass}>{label}</p>
        <p className="text-sm font-semibold" style={{ color }}>
          Enrolled Students: {value}
        </p>
      </div>
    );
  };

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
        <div className={CHART_CARD_CLASS}>
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
              <LoadingState message="Loading analytics" className="h-full" />
            ) : completionStatus.every((d) => d.value === 0) ? (
              <div className="h-full flex items-center justify-center text-slate-400">No enrollment data yet</div>
            ) : (
              <div className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={completionStatus}
                      cx="50%"
                      cy="48%"
                      activeIndex={completionHoverIndex}
                      activeShape={renderActiveCompletionSlice}
                      onMouseEnter={(_, index) => setCompletionHoverIndex(index)}
                      onMouseLeave={() => setCompletionHoverIndex(undefined)}
                      onClick={(_, index) => setCompletionHoverIndex((prev) => (prev === index ? undefined : index))}
                      innerRadius="56%"
                      outerRadius="78%"
                      paddingAngle={3}
                      stroke={completionSliceStroke}
                      strokeWidth={2}
                      dataKey="value">
                      {completionStatus.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={ANALYTICS_COLORS[index % ANALYTICS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={renderCompletionTooltip}
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      wrapperStyle={{ zIndex: 25 }}
                    />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ color: chartLegendColor, fontSize: '12px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className={CHART_CARD_CLASS}>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Enrollment vs Completion Trends
          </h3>
          <div className="h-80">
            {reportsLoading ? (
              <LoadingState message="Loading trends" className="h-full" />
            ) : monthlyTrends.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">No trend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="2 6" vertical={false} stroke={chartGridColor} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartAxisTickColor, fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: chartAxisTickColor, fontSize: 12 }} />
                  <Tooltip
                    content={renderTrendsTooltip}
                    cursor={false}
                  />
                  <Legend wrapperStyle={{ color: chartLegendColor, fontSize: '12px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="enrollments" stroke="#2db768" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5, stroke: trendActiveDotStroke, strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="completions" stroke="#5b8def" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5, stroke: trendActiveDotStroke, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className={CHART_CARD_CLASS}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Most Popular Courses
        </h3>
        {reportsLoading ? (
          <LoadingState message="Loading courses" className="h-80" />
        ) : popularCourses.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-slate-400">No course enrollment data yet</div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularCourses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={chartGridColor} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: chartAxisTickColor, fontSize: 12 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={160}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: chartAxisTickColor }}
                  tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + '…' : v}
                />
                <Tooltip content={renderPopularCoursesTooltip} cursor={{ fill: 'rgba(46, 168, 95, 0.08)' }} />
                <Bar
                  dataKey="students"
                  fill="#22c55e"
                  radius={[0, 4, 4, 0]}
                  barSize={28}
                  animationDuration={520}
                  activeBar={{
                    fillOpacity: 1,
                    stroke: 'rgba(167, 243, 208, 0.72)',
                    strokeWidth: 1.3,
                    filter: 'drop-shadow(0 0 8px rgba(46, 168, 95, 0.28))',
                  }}
                >
                  {popularCourses.map((_, i) => (
                    <Cell key={i} fill={POPULAR_COURSE_COLORS[i % POPULAR_COURSE_COLORS.length]} />
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
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900/40 divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                      <LoadingState message="Loading activity" size="sm" className="py-2" />
                    </td>
                  </tr>
                ) : recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                      No activity yet
                    </td>
                  </tr>
                ) : (
                  safeArray(recentActivity).map((activity) =>
                    <tr
                      key={activity.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                        {activity.user}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                        {activity.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                        {activity.target}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 dark:text-slate-400">
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
              className="w-full flex items-center p-3 text-left rounded-lg border border-slate-200 hover:border-green-500 hover:bg-green-50 dark:border-slate-700/70 dark:bg-slate-900/45 dark:hover:border-emerald-500/55 dark:hover:bg-emerald-500/10 transition-all group">
              <div className="p-2 bg-green-100 rounded-md group-hover:bg-green-200 dark:bg-emerald-500/20 dark:group-hover:bg-emerald-500/30">
                <BookOpen className="h-5 w-5 text-green-700 dark:text-emerald-300" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Create New Course
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add a new training module
                </p>
              </div>
            </button>

            <button
              onClick={() => onNavigate?.('users')}
              className="w-full flex items-center p-3 text-left rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700/70 dark:bg-slate-900/45 dark:hover:border-sky-500/55 dark:hover:bg-sky-500/10 transition-all group">
              <div className="p-2 bg-blue-100 rounded-md group-hover:bg-blue-200 dark:bg-sky-500/20 dark:group-hover:bg-sky-500/30">
                <UserPlus className="h-5 w-5 text-blue-700 dark:text-sky-300" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Add Employee
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Register a new user</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate?.('notifications')}
              className="w-full flex items-center p-3 text-left rounded-lg border border-slate-200 hover:border-purple-500 hover:bg-purple-50 dark:border-slate-700/70 dark:bg-slate-900/45 dark:hover:border-violet-500/55 dark:hover:bg-violet-500/10 transition-all group">
              <div className="p-2 bg-purple-100 rounded-md group-hover:bg-purple-200 dark:bg-violet-500/20 dark:group-hover:bg-violet-500/30">
                <Bell className="h-5 w-5 text-purple-700 dark:text-violet-300" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Send Notification
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Alert all employees</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* View All Activity Modal */}
      {showActivityModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[1px] ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-900/12'}`}>
          <div className={`w-full max-w-3xl mx-4 flex max-h-[80vh] flex-col rounded-xl border ${isDarkMode ? 'border-slate-700/70 bg-slate-900/95 shadow-2xl' : 'border-slate-200 bg-white shadow-[0_18px_46px_rgba(15,23,42,0.14)]'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-slate-700/70' : 'border-slate-200 bg-slate-50/70'}`}>
              <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>All Activity</h2>
              <button
                onClick={() => setShowActivityModal(false)}
                className={`p-1 rounded-md ${isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className={`min-w-full divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
                <thead className={`sticky top-0 ${isDarkMode ? 'bg-slate-800/95' : 'bg-slate-50/95 backdrop-blur-sm'}`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>User</th>
                    <th className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Action</th>
                    <th className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Target</th>
                    <th className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Time</th>
                  </tr>
                </thead>
                <tbody className={`${isDarkMode ? 'bg-slate-900/75 divide-slate-700' : 'bg-white divide-slate-200'} divide-y`}>
                  {activityLoading ? (
                    <tr>
                      <td colSpan={4} className={`px-6 py-10 text-center text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}><LoadingState message="Loading activity" size="sm" className="py-2" /></td>
                    </tr>
                  ) : allActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`px-6 py-10 text-center text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>No activity found</td>
                    </tr>
                  ) : (
                    safeArray(allActivity).map((item, index) => (
                      <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/65' : index % 2 === 0 ? 'bg-white hover:bg-emerald-50/35' : 'bg-slate-50/45 hover:bg-emerald-50/45'}`}>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{item.user}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.action}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.target}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.time}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className={`px-6 py-3 border-t text-right ${isDarkMode ? 'border-slate-700/70' : 'border-slate-200 bg-slate-50/60'}`}>
              <button
                onClick={() => setShowActivityModal(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${isDarkMode ? 'text-slate-200 bg-slate-800 hover:bg-slate-700' : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-100'}`}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

}
