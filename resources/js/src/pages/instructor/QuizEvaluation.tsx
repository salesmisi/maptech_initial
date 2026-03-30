import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Search, XCircle } from 'lucide-react';

const API_BASE = '/api';

interface QuizAttemptItem {
  id: number;
  user_id: number;
  employee_name: string | null;
  employee_email: string | null;
  employee_department: string | null;
  quiz_id: number;
  quiz_title: string | null;
  module_id: number | null;
  module_title: string | null;
  course_id: string;
  course_title: string | null;
  pass_percentage: number | null;
  score: number;
  total_questions: number;
  percentage: number;
  passed: boolean;
  submitted_at: string | null;
}

export function QuizEvaluation() {
  const [items, setItems] = useState<QuizAttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadResults = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/instructor/quiz-attempts`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Failed to load quiz results.');
      }

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load quiz results.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((row) => {
      return (
        (row.employee_name || '').toLowerCase().includes(q) ||
        (row.employee_email || '').toLowerCase().includes(q) ||
        (row.employee_department || '').toLowerCase().includes(q) ||
        (row.quiz_title || '').toLowerCase().includes(q) ||
        (row.course_title || '').toLowerCase().includes(q) ||
        (row.module_title || '').toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const stats = useMemo(() => {
    const total = items.length;
    const passed = items.filter((x) => x.passed).length;
    const failed = total - passed;
    const avg = total > 0 ? (items.reduce((sum, x) => sum + x.percentage, 0) / total) : 0;

    return { total, passed, failed, avg };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quiz Evaluation</h1>
          <p className="text-sm text-slate-500">Live employee quiz results from your assigned courses.</p>
        </div>
        <button
          onClick={loadResults}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Total Attempts</div>
          <div className="text-xl font-bold text-slate-900">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-xs text-green-700">Passed</div>
          <div className="text-xl font-bold text-green-800">{stats.passed}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-xs text-red-700">Failed</div>
          <div className="text-xl font-bold text-red-800">{stats.failed}</div>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <div className="text-xs text-indigo-700">Average</div>
          <div className="text-xl font-bold text-indigo-800">{stats.avg.toFixed(1)}%</div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee, quiz, course, module..."
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-green-500"
        />
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">Loading results...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">No quiz attempts found yet.</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Employee</th>
                  <th className="text-left px-4 py-3 font-semibold">Quiz</th>
                  <th className="text-left px-4 py-3 font-semibold">Course / Module</th>
                  <th className="text-left px-4 py-3 font-semibold">Score</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">{row.employee_name || 'Unknown'}</div>
                      <div className="text-xs text-slate-500">{row.employee_email || '-'}</div>
                      <div className="text-xs text-slate-500">{row.employee_department || '-'}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">{row.quiz_title || 'Quiz'}</div>
                      <div className="text-xs text-slate-500">Quiz ID: {row.quiz_id}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-slate-800">{row.course_title || '-'}</div>
                      <div className="text-xs text-slate-500">{row.module_title || 'No module'}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-slate-900">{row.score} / {row.total_questions}</div>
                      <div className="text-xs text-slate-500">{row.percentage.toFixed(1)}% (Pass: {row.pass_percentage ?? '-'}%)</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.passed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                          <XCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      <div className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
