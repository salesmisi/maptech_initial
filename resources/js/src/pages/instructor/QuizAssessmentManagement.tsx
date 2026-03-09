// Quiz Management — grouped by Department → Subdepartment → Quizzes
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
  ChevronDown,
  Building2,
  FolderOpen,
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
  subdepartment_id: number | null;
  subdepartment_name: string | null;
  question_count: number;
  created_at: string;
}

const DEPT_COLORS: Record<string, string> = {
  IT: 'bg-blue-100 text-blue-700 border-blue-200',
  HR: 'bg-purple-100 text-purple-700 border-purple-200',
  Operations: 'bg-green-100 text-green-700 border-green-200',
  Finance: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Marketing: 'bg-orange-100 text-orange-700 border-orange-200',
};

const DEPT_HEADER_COLORS: Record<string, string> = {
  IT: 'bg-blue-50 border-blue-200 text-blue-800',
  HR: 'bg-purple-50 border-purple-200 text-purple-800',
  Operations: 'bg-green-50 border-green-200 text-green-800',
  Finance: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  Marketing: 'bg-orange-50 border-orange-200 text-orange-800',
};

interface Props {
  onOpenQuiz?: (quizId: number) => void;
}

interface SubdeptGroup {
  id: number | null;
  name: string;
  quizzes: QuizSummary[];
}

interface DeptGroup {
  name: string;
  subdepartments: SubdeptGroup[];
  totalQuizzes: number;
}

export function QuizAssessmentManagement({ onOpenQuiz }: Props) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedSubdepts, setExpandedSubdepts] = useState<Set<string>>(new Set());

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
      // Auto-expand all departments on first load
      const depts = new Set<string>(data.map((q: QuizSummary) => q.course_dept));
      setExpandedDepts(depts);
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

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  const toggleSubdept = (key: string) => {
    setExpandedSubdepts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Filter quizzes by search
  const filtered = quizzes.filter((q) =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    q.course_title.toLowerCase().includes(search.toLowerCase()) ||
    (q.subdepartment_name || '').toLowerCase().includes(search.toLowerCase())
  );

  // Group quizzes: Department → Subdepartment → Quizzes
  const grouped: DeptGroup[] = (() => {
    const deptMap = new Map<string, Map<string, SubdeptGroup>>();

    for (const quiz of filtered) {
      const dept = quiz.course_dept || 'Unassigned';
      const subdeptKey = quiz.subdepartment_id != null
        ? `${quiz.subdepartment_id}`
        : '__none__';
      const subdeptName = quiz.subdepartment_name || 'General (No Subdepartment)';

      if (!deptMap.has(dept)) deptMap.set(dept, new Map());
      const subdeptMap = deptMap.get(dept)!;

      if (!subdeptMap.has(subdeptKey)) {
        subdeptMap.set(subdeptKey, { id: quiz.subdepartment_id, name: subdeptName, quizzes: [] });
      }
      subdeptMap.get(subdeptKey)!.quizzes.push(quiz);
    }

    const result: DeptGroup[] = [];
    for (const [dept, subdeptMap] of deptMap) {
      const subdepartments = Array.from(subdeptMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      result.push({
        name: dept,
        subdepartments,
        totalQuizzes: subdepartments.reduce((sum, s) => sum + s.quizzes.length, 0),
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quiz Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Quizzes organized by department and subdepartment.
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
          placeholder="Search by quiz, course, or subdepartment..."
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
      ) : grouped.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-slate-500">
            {quizzes.length === 0
              ? 'No quizzes yet. Create one inside a course from Courses & Content.'
              : 'No quizzes match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((dept) => {
            const isDeptExpanded = expandedDepts.has(dept.name);
            const headerColor = DEPT_HEADER_COLORS[dept.name] || 'bg-slate-50 border-slate-200 text-slate-800';

            return (
              <div key={dept.name} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Department header */}
                <button
                  onClick={() => toggleDept(dept.name)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 text-left font-semibold border-b transition-colors hover:brightness-95 ${headerColor}`}
                >
                  <Building2 className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1">{dept.name}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/60">
                    {dept.totalQuizzes} quiz{dept.totalQuizzes !== 1 ? 'zes' : ''}
                  </span>
                  {isDeptExpanded
                    ? <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                </button>

                {/* Subdepartments */}
                {isDeptExpanded && (
                  <div className="divide-y divide-slate-100">
                    {dept.subdepartments.map((subdept) => {
                      const subdeptKey = `${dept.name}__${subdept.id ?? 'none'}`;
                      const isSubdeptExpanded = expandedSubdepts.has(subdeptKey);

                      return (
                        <div key={subdeptKey}>
                          {/* Subdepartment header */}
                          <button
                            onClick={() => toggleSubdept(subdeptKey)}
                            className="w-full flex items-center gap-3 px-5 py-3 pl-10 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <FolderOpen className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <span className="flex-1">{subdept.name}</span>
                            <span className="text-xs text-slate-400">
                              {subdept.quizzes.length} quiz{subdept.quizzes.length !== 1 ? 'zes' : ''}
                            </span>
                            {isSubdeptExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                              : <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                          </button>

                          {/* Quiz list */}
                          {isSubdeptExpanded && (
                            <div className="bg-slate-50/50 divide-y divide-slate-100">
                              {subdept.quizzes.map((quiz) => (
                                <div
                                  key={quiz.id}
                                  className="flex items-center gap-4 px-6 py-3 pl-16 hover:bg-slate-100/60 transition-colors"
                                >
                                  <div className="flex-shrink-0 h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                    <HelpCircle className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">{quiz.title}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                                      <BookOpen className="h-3.5 w-3.5" />
                                      <span className="truncate">{quiz.course_title}</span>
                                      <span>&middot;</span>
                                      <span>{quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {onOpenQuiz && (
                                      <button
                                        onClick={() => onOpenQuiz(quiz.id)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 border border-green-200 rounded-md hover:bg-green-50 transition-colors"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                        Manage
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      </button>
                                    )}
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
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
