// REPLACED — real backend integration below
// Original static mock data removed.
import { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  BookOpen,
  HelpCircle,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const getXsrfToken = async (): Promise<string> => {
  await fetch('http://127.0.0.1:8000/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
};

interface QuizSummary {
  id: number;
  title: string;
  description: string | null;
  course_id: string;
  course_title: string;
  course_dept: string;
  question_count: number;
  created_at: string;
}

const DEPT_COLORS: Record<string, string> = {
  IT: 'bg-blue-100 text-blue-700',
  HR: 'bg-purple-100 text-purple-700',
  Operations: 'bg-green-100 text-green-700',
  Finance: 'bg-yellow-100 text-yellow-700',
  Marketing: 'bg-orange-100 text-orange-700',
};

interface Props {
  onOpenQuiz: (quizId: number) => void;
}

export function QuizAssessmentManagement({ onOpenQuiz }: Props) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/instructor/quizzes`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load quizzes.');
      const data = await res.json();
      setQuizzes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuizzes(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this quiz and all its questions permanently?')) return;
    setDeletingId(id);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/instructor/quizzes/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Delete failed.');
      await loadQuizzes();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = quizzes.filter((q) =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    q.course_title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quiz Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            View and manage quizzes across all your courses.
            To create a new quiz, open a course via <strong>Courses &amp; Content</strong>.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by quiz or course..."
          className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-full focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-slate-500">
            {quizzes.length === 0
              ? 'No quizzes yet. Create one inside a course from Courses & Content.'
              : 'No quizzes match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {filtered.map((quiz) => (
            <div
              key={quiz.id}
              className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 truncate">{quiz.title}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DEPT_COLORS[quiz.course_dept] || 'bg-slate-100 text-slate-600'}`}>
                    {quiz.course_dept}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="truncate">{quiz.course_title}</span>
                  <span>&middot;</span>
                  <span>{quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenQuiz(quiz.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 border border-green-200 rounded-md hover:bg-green-50 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Manage
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(quiz.id)}
                  disabled={deletingId === quiz.id}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                >
                  {deletingId === quiz.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
