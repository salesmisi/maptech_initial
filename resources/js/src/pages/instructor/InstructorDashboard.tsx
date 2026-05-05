import { useEffect, useState } from 'react';
import { useToast } from '../../components/ToastProvider';
import { LoadingState } from '../../components/ui/LoadingState';
// icons removed — not used in this component
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { UserTimeLog } from '../../components/UserTimeLog';

interface CourseStat { name: string; enrolled: number; completed: number }
interface PerformancePoint { name: string; avgScore: number; submissions: number }
interface RecentQuestion { id: number; student: string; question: string; course: string; time: string }

interface InstructorDashboardProps {
  onNavigate?: (page: string) => void;
}

export function InstructorDashboard({ onNavigate }: InstructorDashboardProps) {
  const [courseStats, setCourseStats] = useState<CourseStat[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformancePoint[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<RecentQuestion[]>([]);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [avgPassRate, setAvgPassRate] = useState<number>(0);
  const [newStudentsMonth, setNewStudentsMonth] = useState<number>(0);
  const [passRateDelta, setPassRateDelta] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/instructor/dashboard', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setCourseStats(data.course_stats || []);
        setPerformanceData(data.performance_trend || []);
        setRecentQuestions(data.recent_questions || []);
        setStudentCount(data.stats?.total_students || 0);
        setAvgPassRate(data.stats?.avg_pass_rate || 0);
        setNewStudentsMonth(data.stats?.new_students_month || 0);
        setPassRateDelta(data.stats?.pass_rate_delta || 0); // backend should provide this
      })
      .finally(() => setLoading(false));
  }, []);

  const { pushToast } = useToast();

  // Real-time listener: if Laravel Echo is configured on the page, subscribe
  useEffect(() => {
    let channel: any = null;
    // We need the instructor id to subscribe to private channel
    const setup = async () => {
      try {
        const resp = await fetch('/api/instructor/dashboard', { credentials: 'include' });
        if (!resp.ok) return;
        const info = await resp.json();
        const instructorId = info.user?.id;
        if (!instructorId) return;

        if ((window as any).Echo) {
          try {
            channel = (window as any).Echo.private('instructor.' + instructorId);
            channel.listen('InstructorCoursesAssigned', (payload: any) => {
              // Show a toast and refresh dashboard data when an assignment event arrives
              try {
                const count = Array.isArray(payload.course_ids) ? payload.course_ids.length : 0;
                pushToast('Courses assigned', `You were assigned ${count} new course(s). Refreshing...`, 'info', 6000);
              } catch (e) {
                // ignore toast errors
              }
              fetch('/api/instructor/dashboard', { credentials: 'include' })
                .then(r => r.ok ? r.json() : null)
                .then((d) => {
                  if (!d) return;
                  setCourseStats(d.course_stats || []);
                  setPerformanceData(d.performance_trend || []);
                  setRecentQuestions(d.recent_questions || []);
                  setStudentCount(d.stats?.total_students || 0);
                  setAvgPassRate(d.stats?.avg_pass_rate || 0);
                  setNewStudentsMonth(d.stats?.new_students_month || 0);
                  setPassRateDelta(d.stats?.pass_rate_delta || 0);
                });
            });
          } catch (err) {
            console.warn('Failed to attach Echo listener', err);
          }
        } else {
          // Echo not available; no-op. To enable realtime, install and configure laravel-echo + pusher-js.
          // See README for setup steps.
        }
      } catch (err) {
        // ignore
      }
    };
    setup();

    return () => {
      try {
        if (channel && channel.leave) channel.leave();
      } catch (e) {}
    };
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {loading && <div className="text-center py-8 text-slate-400">Loading dashboard...</div>}
      {!loading && (
        <>
        {/* Page Header */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Instructor Dashboard</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Welcome back</p>
          </div>
          <div className="self-start text-xs text-slate-500 dark:text-slate-400 sm:self-auto sm:text-sm">Last updated: Today</div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6 flex flex-col items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs mb-1">Student Questions</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{recentQuestions.length}</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 mt-1">Recent Q&A activity</span>
          </div>
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6 flex flex-col items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs mb-1">My Courses</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{courseStats.length}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">Active courses assigned</span>
          </div>
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6 flex flex-col items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs mb-1">Total Students</span>
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{studentCount}</span>
            <span className="text-xs text-green-600 dark:text-green-400 mt-1">+{newStudentsMonth} this month</span>
          </div>
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6 flex flex-col items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs mb-1">Avg. Pass Rate</span>
            <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{avgPassRate}%</span>
            <span className={`text-xs mt-1 ${passRateDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{passRateDelta >= 0 ? '+' : ''}{passRateDelta}% from last month</span>
          </div>
        </div>

        {/* Trends and Course Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
          {/* Student Performance Trends */}
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Student Performance Trends</h3>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="avgScore" stroke="#22c55e" strokeWidth={2} name="Avg Score (%)" />
                  <Line type="monotone" dataKey="submissions" stroke="#3b82f6" strokeWidth={2} name="Submissions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Course Enrollment vs Completion */}
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Course Enrollment vs Completion</h3>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="enrolled" fill="#22c55e" name="Enrolled" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" fill="#3b82f6" name="Completed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Student Questions */}
        <div className="rounded-lg bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-700 p-4 sm:p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Student Questions</h3>
            <button
              onClick={() => onNavigate?.('qa-discussion')}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-md shadow-sm transition-colors"
            >
              View All Q&A
            </button>
          </div>
          <ul>
            {recentQuestions.map((q) => (
              <li key={q.id} className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-700 py-3 last:border-b-0 sm:flex-row sm:items-center">
                <span className="bg-slate-200 dark:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 mr-3">
                  {q.student?.[0] || '?'}
                </span>
                <div className="flex-1">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{q.student}</span> <span className="text-slate-500 dark:text-slate-400">in</span> <span className="text-slate-500 dark:text-slate-400">{q.course}</span>
                  <div className="text-slate-600 dark:text-slate-300 text-sm mt-0.5">{q.question}</div>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 sm:ml-2">{q.time}</span>
              </li>
            ))}
          </ul>
        </div>
        </>
      )}

      {/* My Time Log */}
      <UserTimeLog />
    </div>
  );
}

