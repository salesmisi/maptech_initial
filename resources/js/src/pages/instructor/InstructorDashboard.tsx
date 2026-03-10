import React from 'react';
import { ClipboardCheck, Users, TrendingUp, AlertCircle, CheckCircle, Clock, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { UserTimeLog } from '../../components/UserTimeLog';

interface PendingEvaluation { id: number; student: string; quiz: string; course: string; submitted: string; type: string }
interface CourseStat { name: string; enrolled: number; completed: number }
interface PerformancePoint { name: string; avgScore: number; submissions: number }
interface RecentQuestion { id: number; student: string; question: string; course: string; time: string }

const pendingEvaluations: PendingEvaluation[] = [
  { id: 1, student: 'Juan Dela Cruz', quiz: 'Module 1 Quiz', course: 'Intro to Privacy', submitted: '2 hours ago', type: 'MCQ' },
  { id: 2, student: 'Maria Santos', quiz: 'Case Study Analysis', course: 'Leadership Training', submitted: '5 hours ago', type: 'Essay' },
  { id: 3, student: 'Antonio Luna', quiz: 'Module 2 Q&A', course: 'Data Privacy Compliance', submitted: '1 day ago', type: 'Identification' },
];

const courseStats: CourseStat[] = [
  { name: 'Cybersecurity', enrolled: 120, completed: 80 },
  { name: 'Data Privacy', enrolled: 95, completed: 70 },
  { name: 'Leadership', enrolled: 60, completed: 45 },
];

const performanceData: PerformancePoint[] = [
  { name: 'Week 1', avgScore: 72, submissions: 40 },
  { name: 'Week 2', avgScore: 75, submissions: 55 },
  { name: 'Week 3', avgScore: 78, submissions: 64 },
];

const recentQuestions: RecentQuestion[] = [
  { id: 1, student: 'Elena Reyes', question: 'Can you explain the difference between symmetric and asymmetric encryption?', course: 'Cybersecurity', time: '30 min ago' },
  { id: 2, student: 'Andres Bonifacio', question: 'What are the key elements of a data processing agreement?', course: 'Data Privacy', time: '2 hours ago' },
];

export function InstructorDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Instructor Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Welcome back, Prof. Ana Reyes</p>
        </div>
        <div className="text-sm text-slate-500">Last updated: Today, 2:30 PM</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending Reviews</p>
              <p className="text-2xl font-bold text-amber-600">{pendingEvaluations.length}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-full"><AlertCircle className="h-6 w-6 text-amber-600" /></div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Requires manual grading</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">My Courses</p>
              <p className="text-2xl font-bold text-slate-900">{courseStats.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full"><BookOpen className="h-6 w-6 text-blue-600" /></div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Active courses assigned</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Students</p>
              <p className="text-2xl font-bold text-slate-900">252</p>
            </div>
            <div className="p-3 bg-green-50 rounded-full"><Users className="h-6 w-6 text-green-600" /></div>
          </div>
          <p className="mt-2 text-green-600 font-medium">+18 this month</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Avg. Pass Rate</p>
              <p className="text-2xl font-bold text-slate-900">81%</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-full"><TrendingUp className="h-6 w-6 text-purple-600" /></div>
          </div>
          <p className="mt-2 text-green-600 font-medium">+3% from last month</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold text-slate-900">Pending Quiz Evaluations</h3>
            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{pendingEvaluations.length} pending</span>
          </div>
          <button className="text-sm text-green-600 font-medium hover:text-green-700">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quiz</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {pendingEvaluations.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">{item.student.charAt(0)}</div>
                      <span className="ml-3 text-sm font-medium text-slate-900">{item.student}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-slate-900">{item.quiz}</div><div className="text-xs text-slate-500">{item.course}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">{item.type}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.submitted}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><button className="text-sm font-medium text-green-600 hover:text-green-700">Grade Now</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Student Performance Trends</h3>
          <div className="h-72">
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

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Course Enrollment vs Completion</h3>
          <div className="h-72">
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

      <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Recent Student Questions</h3>
          <button className="text-sm text-green-600 font-medium hover:text-green-700">View All Q&A</button>
        </div>
        <div className="space-y-4">
          {recentQuestions.map((q) => (
            <div key={q.id} className="flex items-start p-4 bg-slate-50 rounded-lg border border-slate-100">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">{q.student.charAt(0)}</div>
              <div className="ml-3 flex-1">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-slate-900">{q.student} <span className="text-slate-400 font-normal">in {q.course}</span></p>
                  <span className="text-xs text-slate-400">{q.time}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{q.question}</p>
                <button className="mt-2 text-xs font-medium text-green-600 hover:text-green-700">Reply →</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* My Time Log */}
      <UserTimeLog />
    </div>
  );
}

