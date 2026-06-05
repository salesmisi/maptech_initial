import React, { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Clock, Award, CheckCircle, Loader } from 'lucide-react';

const API_BASE = '/api';
const COLORS = ['#22c55e', '#eab308', '#94a3b8'];

interface ProgressData {
  summary: {
    total_learning_time: string;
    avg_quiz_score: number;
    modules_completed: number;
  };
  course_status: { name: string; value: number }[];
  weekly_activity: { name: string; count: number }[];
  quiz_history: { name: string; score: number; date: string }[];
}

export function MyProgress() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/employee/progress`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to load progress');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <p className="text-red-500 font-medium">{error ?? 'Failed to load progress'}</p>
        <button
          onClick={() => { setError(null); setLoading(true); }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, course_status, weekly_activity, quiz_history } = data;
  const hasQuizHistory = quiz_history.length > 0;
  const hasCourseData  = course_status.some(s => s.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Learning Progress</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex items-center">
          <div className="p-3 bg-green-50 rounded-full">
            <Clock className="h-6 w-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-500">Total Learning Time</p>
            <p className="text-2xl font-bold text-slate-900">{summary.total_learning_time}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex items-center">
          <div className="p-3 bg-blue-50 rounded-full">
            <Award className="h-6 w-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-500">Avg. Quiz Score</p>
            <p className="text-2xl font-bold text-slate-900">
              {summary.avg_quiz_score > 0 ? `${summary.avg_quiz_score}%` : '—'}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex items-center">
          <div className="p-3 bg-purple-50 rounded-full">
            <CheckCircle className="h-6 w-6 text-purple-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-500">Modules Completed</p>
            <p className="text-2xl font-bold text-slate-900">{summary.modules_completed}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Course Status Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Course Status Overview</h3>
          {hasCourseData ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={course_status}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {course_status.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => [val, 'Courses']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {course_status.map((entry, index) => (
                  <div key={entry.name} className="flex items-center text-sm text-slate-600">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index] }} />
                    {entry.name} ({entry.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              No courses enrolled yet
            </div>
          )}
        </div>

        {/* Weekly Learning Activity */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Weekly Learning Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly_activity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(val: number) => [val, 'Activity']} />
                <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} name="Activity" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quiz Performance History */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quiz Performance History</h3>
          {hasQuizHistory ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quiz_history} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={180}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(val: number) => [`${val}%`, 'Score']} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20} name="Score (%)">
                    {quiz_history.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.score >= 90 ? '#22c55e' : entry.score >= 75 ? '#3b82f6' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Award className="h-10 w-10 opacity-30" />
              <p className="text-sm">No quiz attempts yet. Take a pre-assessment in a course to see your scores here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

