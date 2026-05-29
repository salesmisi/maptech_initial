import { useEffect, useState } from 'react';
import { useToast } from '../../components/ToastProvider';
import { LoadingState } from '../../components/ui/LoadingState';
import { MessageSquare, BookOpen, Users, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { UserTimeLog } from '../../components/UserTimeLog';
import { actionButtonClasses, statIconContainerClasses, statIconGlyphClasses } from '../../utils/uiPalette';

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
  const [lastUpdated, setLastUpdated] = useState('');
  const [instructorName, setInstructorName] = useState('');

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
        setPassRateDelta(data.stats?.pass_rate_delta || 0);
        if (data.user?.fullname) setInstructorName(data.user.fullname);
        else if (data.user?.name) setInstructorName(data.user.name);
      })
      .finally(() => {
        setLoading(false);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      });
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
              void loadDashboard(false);
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
    <div className="space-y-6">
      {loading && <div className="py-6"><LoadingState message="Loading dashboard" /></div>}
      {!loading && (
        <>
        {/* Page Header */}
        <div className="flex flex-col gap-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              Welcome back, {instructorName || 'Instructor'}! 👋
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {lastUpdated ? `Last updated: Today, ${lastUpdated}` : 'Last updated: Today'}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Student Questions</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{recentQuestions.length}</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-4 text-xs text-blue-600 dark:text-blue-400">Recent Q&A activity</div>
          </div>
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">My Courses</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{courseStats.length}</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-full">
                <BookOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-400 dark:text-slate-500">Active courses assigned</div>
          </div>
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Students</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{studentCount}</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-full">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="mt-4 text-xs text-green-600 dark:text-green-400">+{newStudentsMonth} this month</div>
          </div>
          <div className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Avg. Pass Rate</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{avgPassRate}%</p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-full">
                <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className={`mt-4 text-xs ${passRateDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{passRateDelta >= 0 ? '+' : ''}{passRateDelta}% from last month</div>
          </div>
        </div>

        {/* Trends and Course Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
          {/* Student Performance Trends */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Student Performance Trends</h3>
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
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Course Enrollment vs Completion</h3>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseStats} margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" strokeOpacity={0.25} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#cbd5e1', fontSize: 13 }}
                    height={40}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#cbd5e1', fontSize: 13 }}
                    allowDecimals={false}
                    width={50}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(59, 130, 246, 0.2)' }}
                    contentStyle={{
                      background: '#1a2332',
                      border: '2px solid #64748b',
                      borderRadius: '12px',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                      padding: '16px 20px',
                    }}
                    labelStyle={{ color: '#fef08a', fontWeight: 800, marginBottom: 10, fontSize: 14 }}
                    itemStyle={{ color: '#84cc16', fontSize: 14, padding: '5px 0', fontWeight: 600 }}
                    separator=" : "
                    wrapperStyle={{ outline: 'none', backgroundColor: '#0f172a' }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 16, fontSize: 14, color: '#cbd5e1' }}
                  />
                  <Bar dataKey="enrolled" fill="#10b981" name="Enrolled" radius={[6, 6, 0, 0]} maxBarSize={80} />
                  <Bar dataKey="completed" fill="#0084ff" name="Completed" radius={[6, 6, 0, 0]} maxBarSize={80} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Student Questions */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="border-b border-slate-100 p-4 dark:border-slate-700 sm:p-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Student Questions</h3>
            <button
              onClick={() => onNavigate?.('qa-discussion')}
              className={`inline-flex items-center px-5 py-2.5 text-sm font-semibold rounded-md shadow-sm transition-colors ${actionButtonClasses.primary}`}
            >
              View All Q&A
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">Student</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">Question</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">Course</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:px-6">Time</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900/40 divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500 sm:px-6">
                      <LoadingState message="Loading questions" size="sm" className="py-2" />
                    </td>
                  </tr>
                ) : recentQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500 sm:px-6">
                      No questions yet
                    </td>
                  </tr>
                ) : (
                  recentQuestions.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors">
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 sm:px-6">{q.student || 'Unknown'}</td>
                      <td className="px-3 py-4 text-sm text-slate-500 dark:text-slate-300 sm:px-6">{q.question}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-slate-300 sm:px-6">{q.course}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 dark:text-slate-400 sm:px-6">{q.time}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* My Time Log */}
      <UserTimeLog />
    </div>
  );
}

