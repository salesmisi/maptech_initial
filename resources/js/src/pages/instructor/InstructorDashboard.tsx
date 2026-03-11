import { useEffect, useState } from 'react';
// icons removed — not used in this component
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { UserTimeLog } from '../../components/UserTimeLog';

interface PendingEvaluation { id: number; student: string; quiz?: string; question?: string; course?: string; submitted: string; type: string }
interface CourseStat { name: string; enrolled: number; completed: number }
interface PerformancePoint { name: string; avgScore: number; submissions: number }
interface RecentQuestion { id: number; student: string; question: string; course: string; time: string }


export function InstructorDashboard() {
  const [pendingEvaluations, setPendingEvaluations] = useState<PendingEvaluation[]>([]);
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
        setPendingEvaluations(data.pending_evaluations || []);
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

  return (
    <div className="space-y-6">
      {loading && <div className="text-center py-8 text-slate-400">Loading dashboard...</div>}
      {!loading && (
        <>
        {/* Page Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Instructor Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Welcome back</p>
          </div>
          <div className="text-sm text-slate-500">Last updated: Today</div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded shadow p-4 flex flex-col items-start">
            <span className="text-slate-500 text-xs mb-1">Pending Reviews</span>
            <span className="text-2xl font-bold text-blue-600">{pendingEvaluations.length}</span>
            <span className="text-xs text-yellow-600 mt-1">Requires manual grading</span>
          </div>
          <div className="bg-white rounded shadow p-4 flex flex-col items-start">
            <span className="text-slate-500 text-xs mb-1">My Courses</span>
            <span className="text-2xl font-bold text-green-600">{courseStats.length}</span>
            <span className="text-xs text-slate-400 mt-1">Active courses assigned</span>
          </div>
          <div className="bg-white rounded shadow p-4 flex flex-col items-start">
            <span className="text-slate-500 text-xs mb-1">Total Students</span>
            <span className="text-2xl font-bold text-purple-600">{studentCount}</span>
            <span className="text-xs text-green-600 mt-1">+{newStudentsMonth} this month</span>
          </div>
          <div className="bg-white rounded shadow p-4 flex flex-col items-start">
            <span className="text-slate-500 text-xs mb-1">Avg. Pass Rate</span>
            <span className="text-2xl font-bold text-orange-600">{avgPassRate}%</span>
            <span className={`text-xs mt-1 ${passRateDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{passRateDelta >= 0 ? '+' : ''}{passRateDelta}% from last month</span>
          </div>
        </div>

        {/* Pending Quiz Evaluations */}
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Pending Quiz Evaluations <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded ml-2">{pendingEvaluations.length} pending</span></span>
            <a href="#" className="text-blue-600 text-xs">View All</a>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left py-1 px-2">STUDENT</th>
                  <th className="text-left py-1 px-2">QUIZ</th>
                  <th className="text-left py-1 px-2">TYPE</th>
                  <th className="text-left py-1 px-2">SUBMITTED</th>
                  <th className="text-left py-1 px-2">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pendingEvaluations.map((evalItem) => (
                  <tr key={evalItem.id} className="border-b last:border-b-0">
                    <td className="py-1 px-2 font-medium">{evalItem.student}</td>
                    <td className="py-1 px-2">{evalItem.question || evalItem.quiz}</td>
                    <td className="py-1 px-2">
                      <span className="bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded">{evalItem.type}</span>
                    </td>
                    <td className="py-1 px-2">{evalItem.submitted}</td>
                    <td className="py-1 px-2"><a href="#" className="text-green-600 font-semibold">Grade Now</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trends and Course Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Student Performance Trends */}
          <div className="bg-white rounded shadow p-4">
            <div className="font-semibold mb-2">Student Performance Trends</div>
            <div className="h-48">
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
          <div className="bg-white rounded shadow p-4">
            <div className="font-semibold mb-2">Course Enrollment vs Completion</div>
            <div className="h-48">
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
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Recent Student Questions</span>
            <a href="#" className="text-blue-600 text-xs">View All Q&amp;A</a>
          </div>
          <ul>
            {recentQuestions.map((q) => (
              <li key={q.id} className="py-2 border-b last:border-b-0 flex items-center">
                <span className="bg-slate-200 rounded-full w-7 h-7 flex items-center justify-center font-bold text-slate-600 mr-3">
                  {q.student?.[0] || '?'}
                </span>
                <div className="flex-1">
                  <span className="font-medium">{q.student}</span> in <span className="text-slate-500">{q.course}</span>
                  <div className="text-slate-600 text-sm mt-0.5">{q.question}</div>
                </div>
                <span className="text-xs text-slate-400 ml-2">{q.time}</span>
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

