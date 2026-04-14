// Quiz Management — grouped by Department → Subdepartment → Quizzes
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useConfirm from '../../hooks/useConfirm';
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

const API_BASE = '/api';

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const getXsrfToken = async (): Promise<string> => {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
};

interface QuizSummary {
  id: number;
  title: string;
  description: string | null;
  pass_percentage: number;
  course_id: string;
  course_title: string;
  course_dept: string;
  subdepartment_id: number | null;
  subdepartment_name: string | null;
  question_count: number;
  created_at: string;
}

interface QuizQuestionOptionItem {
  id: number;
  option_text: string;
  is_correct: boolean;
}

interface QuizQuestionItem {
  id: number;
  question_text: string;
  options: QuizQuestionOptionItem[];
}

const DEPT_HEADER_COLORS: Record<string, string> = {
  IT: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700/60 dark:text-blue-200',
  HR: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/30 dark:border-purple-700/60 dark:text-purple-200',
  Operations: 'bg-green-50 border-green-200 text-green-800 dark:bg-emerald-900/30 dark:border-emerald-700/60 dark:text-emerald-200',
  Finance: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-amber-900/30 dark:border-amber-700/60 dark:text-amber-200',
  Marketing: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/30 dark:border-orange-700/60 dark:text-orange-200',
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
  const [editingQuiz, setEditingQuiz] = useState<QuizSummary | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPassPercentage, setEditPassPercentage] = useState(70);
  const [savingEdit, setSavingEdit] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['', '', '', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [questionMessage, setQuestionMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionItem[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editQuestionOptions, setEditQuestionOptions] = useState<string[]>(['', '', '', '']);
  const [editCorrectOptionIndex, setEditCorrectOptionIndex] = useState(0);
  const [savingQuestionEdit, setSavingQuestionEdit] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<number | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedSubdepts, setExpandedSubdepts] = useState<Set<string>>(new Set());
  const confirm = useConfirm();
  const { showConfirm } = confirm;

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

  const loadQuizQuestions = async (quizId: number) => {
    setLoadingQuestions(true);
    try {
      const res = await fetch(`${API_BASE}/instructor/quizzes/${quizId}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load quiz questions.');
      const data = await res.json();
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (e: any) {
      setQuestionMessage(e.message || 'Failed to load quiz questions.');
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const startEdit = (quiz: QuizSummary) => {
    setEditingQuiz(quiz);
    setEditTitle(quiz.title || '');
    setEditDescription(quiz.description || '');
    setEditPassPercentage(quiz.pass_percentage || 70);
    setNewQuestionText('');
    setNewOptions(['', '', '', '']);
    setCorrectOptionIndex(0);
    setQuestionMessage(null);
    setEditingQuestionId(null);
    setEditQuestionText('');
    setEditQuestionOptions(['', '', '', '']);
    setEditCorrectOptionIndex(0);
    loadQuizQuestions(quiz.id);
  };

  const handleSaveEdit = async () => {
    if (!editingQuiz) return;
    if (!editTitle.trim()) {
      alert('Quiz title is required.');
      return;
    }

    setSavingEdit(true);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/instructor/quizzes/${editingQuiz.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': token,
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          pass_percentage: editPassPercentage,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to update quiz.');

      setEditingQuiz(null);
      await loadQuizzes();
    } catch (e: any) {
      alert(e.message || 'Failed to update quiz.');
    } finally {
      setSavingEdit(false);
    }
  };

  const updateOption = (index: number, value: string) => {
    setNewOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  };

  const handleAddQuestion = async () => {
    if (!editingQuiz) return;
    if (!newQuestionText.trim()) {
      setQuestionMessage('Question text is required.');
      return;
    }
    if (newOptions.some((opt) => !opt.trim())) {
      setQuestionMessage('All options are required.');
      return;
    }

    setAddingQuestion(true);
    setQuestionMessage(null);

    try {
      const token = await getXsrfToken();
      const payload = {
        question_text: newQuestionText.trim(),
        options: newOptions.map((opt, idx) => ({
          text: opt.trim(),
          is_correct: idx === correctOptionIndex,
        })),
      };

      const res = await fetch(`${API_BASE}/instructor/quizzes/${editingQuiz.id}/questions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': token,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to add question.');

      setNewQuestionText('');
      setNewOptions(['', '', '', '']);
      setCorrectOptionIndex(0);
      setQuestionMessage('Question added successfully.');
      await loadQuizQuestions(editingQuiz.id);
      await loadQuizzes();
    } catch (e: any) {
      setQuestionMessage(e.message || 'Failed to add question.');
    } finally {
      setAddingQuestion(false);
    }
  };

  const startEditQuestion = (question: QuizQuestionItem) => {
    setEditingQuestionId(question.id);
    setEditQuestionText(question.question_text || '');
    const opts = (question.options || []).map((o) => o.option_text);
    while (opts.length < 4) opts.push('');
    setEditQuestionOptions(opts.slice(0, 4));
    const correctIndex = question.options?.findIndex((o) => o.is_correct) ?? 0;
    setEditCorrectOptionIndex(correctIndex >= 0 ? correctIndex : 0);
    setQuestionMessage(null);
  };

  const updateEditOption = (index: number, value: string) => {
    setEditQuestionOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  };

  const handleSaveQuestionEdit = async () => {
    if (!editingQuiz || !editingQuestionId) return;
    if (!editQuestionText.trim()) {
      setQuestionMessage('Question text is required.');
      return;
    }
    if (editQuestionOptions.some((opt) => !opt.trim())) {
      setQuestionMessage('All question options are required.');
      return;
    }

    setSavingQuestionEdit(true);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/instructor/quizzes/${editingQuiz.id}/questions/${editingQuestionId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': token,
        },
        body: JSON.stringify({
          question_text: editQuestionText.trim(),
          options: editQuestionOptions.map((opt, idx) => ({
            text: opt.trim(),
            is_correct: idx === editCorrectOptionIndex,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to update question.');

      setQuestionMessage('Question updated successfully.');
      setEditingQuestionId(null);
      await loadQuizQuestions(editingQuiz.id);
      await loadQuizzes();
    } catch (e: any) {
      setQuestionMessage(e.message || 'Failed to update question.');
    } finally {
      setSavingQuestionEdit(false);
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (!editingQuiz) return;

    showConfirm('Delete this question permanently?', async () => {
      setDeletingQuestionId(questionId);
      try {
        const token = await getXsrfToken();
        const res = await fetch(`${API_BASE}/instructor/quizzes/${editingQuiz.id}/questions/${questionId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to delete question.');

        setQuestionMessage('Question deleted successfully.');
        if (editingQuestionId === questionId) {
          setEditingQuestionId(null);
        }
        await loadQuizQuestions(editingQuiz.id);
        await loadQuizzes();
      } catch (e: any) {
        setQuestionMessage(e.message || 'Failed to delete question.');
      } finally {
        setDeletingQuestionId(null);
      }
    });
  };

  const handleDelete = async (id: number) => {
    showConfirm('Delete this quiz and all its questions permanently?', async () => {
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
    });
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Quiz Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
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
          className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg text-sm w-full focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-500" />
          <p className="mt-3 text-slate-500 dark:text-slate-300">
            {quizzes.length === 0
              ? 'No quizzes yet. Create one inside a course from Courses & Content.'
              : 'No quizzes match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((dept) => {
            const isDeptExpanded = expandedDepts.has(dept.name);
            const headerColor = DEPT_HEADER_COLORS[dept.name] || 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200';

            return (
              <div key={dept.name} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                {/* Department header */}
                <button
                  onClick={() => toggleDept(dept.name)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 text-left font-semibold border-b transition-colors hover:brightness-95 ${headerColor}`}
                >
                  <Building2 className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1">{dept.name}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 dark:bg-slate-900/60">
                    {dept.totalQuizzes} quiz{dept.totalQuizzes !== 1 ? 'zes' : ''}
                  </span>
                  {isDeptExpanded
                    ? <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                </button>

                {/* Subdepartments */}
                {isDeptExpanded && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {dept.subdepartments.map((subdept) => {
                      const subdeptKey = `${dept.name}__${subdept.id ?? 'none'}`;
                      const isSubdeptExpanded = expandedSubdepts.has(subdeptKey);

                      return (
                        <div key={subdeptKey}>
                          {/* Subdepartment header */}
                          <button
                            onClick={() => toggleSubdept(subdeptKey)}
                            className="w-full flex items-center gap-3 px-5 py-3 pl-10 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <FolderOpen className="h-4 w-4 text-slate-400 dark:text-slate-400 flex-shrink-0" />
                            <span className="flex-1">{subdept.name}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-400">
                              {subdept.quizzes.length} quiz{subdept.quizzes.length !== 1 ? 'zes' : ''}
                            </span>
                            {isSubdeptExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                              : <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                          </button>

                          {/* Quiz list */}
                          {isSubdeptExpanded && (
                            <div className="bg-slate-50/50 dark:bg-slate-800/35 divide-y divide-slate-100 dark:divide-slate-700">
                              {subdept.quizzes.map((quiz) => (
                                <div
                                  key={quiz.id}
                                  className="flex items-center gap-4 px-6 py-3 pl-16 hover:bg-slate-100/60 dark:hover:bg-slate-700/55 transition-colors"
                                >
                                  <div className="flex-shrink-0 h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900/45 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                                    <HelpCircle className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{quiz.title}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-300">
                                      <BookOpen className="h-3.5 w-3.5" />
                                      <span className="truncate">{quiz.course_title}</span>
                                      <span>&middot;</span>
                                      <span>{quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => startEdit(quiz)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                      Edit
                                    </button>
                                    {onOpenQuiz && (
                                      <button
                                        onClick={() => onOpenQuiz(quiz.id)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-emerald-300 border border-green-200 dark:border-emerald-700 rounded-md hover:bg-green-50 dark:hover:bg-emerald-900/25 transition-colors"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                        Manage
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDelete(quiz.id)}
                                      disabled={deletingId === quiz.id}
                                      className="p-1.5 text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/25 rounded disabled:opacity-40"
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

      {editingQuiz && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Quiz</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Update quiz details as instructor.</p>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* Left Side - Edit Quiz Form */}
              <div className="w-1/2 px-5 py-4 space-y-4 overflow-y-auto border-r border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Title</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-green-500 focus:border-green-500"
                    placeholder="Quiz title"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-green-500 focus:border-green-500 resize-none"
                    placeholder="Optional description"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Pass Percentage</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={editPassPercentage}
                    onChange={(e) => setEditPassPercentage(Number(e.target.value || 70))}
                    className="w-28 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Add Question</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Question Text</label>
                      <textarea
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        rows={2}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-green-500 focus:border-green-500 resize-none"
                        placeholder="Type your question"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {newOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="correctOption"
                            checked={correctOptionIndex === idx}
                            onChange={() => setCorrectOptionIndex(idx)}
                            className="h-4 w-4 text-green-600"
                          />
                          <input
                            value={opt}
                            onChange={(e) => updateOption(idx, e.target.value)}
                            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-green-500 focus:border-green-500"
                            placeholder={`Option ${idx + 1}`}
                          />
                        </div>
                      ))}
                    </div>

                    {questionMessage && (
                      <p className={`text-xs ${questionMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                        {questionMessage}
                      </p>
                    )}

                    <button
                      onClick={handleAddQuestion}
                      disabled={addingQuestion}
                      className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {addingQuestion ? 'Adding...' : 'Add Question'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side - Questionnaires Created */}
              <div className="w-1/2 px-5 py-4 overflow-y-auto bg-slate-50 dark:bg-slate-900/40">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Questionnaires Created</h4>

                {loadingQuestions ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading questions...
                  </div>
                ) : questions.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No questions yet for this quiz.</p>
                ) : (
                  <div className="space-y-4 pr-1">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="border-2 border-slate-200 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-700 shadow-sm">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-indigo-600 dark:bg-indigo-500 text-white text-xs font-bold rounded-full">
                              {idx + 1}
                            </span>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 pt-1">{q.question_text}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => startEditQuestion(q)}
                              className="px-2 py-1 text-[11px] border border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              disabled={deletingQuestionId === q.id}
                              className="px-2 py-1 text-[11px] border border-red-200 dark:border-red-600 text-red-700 dark:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                            >
                              {deletingQuestionId === q.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                        <div className="ml-9 space-y-1.5 border-l-2 border-slate-200 dark:border-slate-500 pl-3">
                          {q.options.map((opt, optIdx) => (
                            <div key={opt.id} className={`flex items-center gap-2 text-xs ${opt.is_correct ? 'text-green-700 dark:text-emerald-300 font-semibold bg-green-50 dark:bg-emerald-900/30 rounded px-2 py-1' : 'text-slate-600 dark:text-slate-300'}`}>
                              <span className="w-5 h-5 flex items-center justify-center rounded-full border text-[10px] font-medium ${opt.is_correct ? 'border-green-500 bg-green-100' : 'border-slate-300 bg-slate-100'}">
                                {String.fromCharCode(97 + optIdx)}
                              </span>
                              <span>{opt.option_text}</span>
                              {opt.is_correct && <span className="ml-auto text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">Correct</span>}
                            </div>
                          ))}
                        </div>

                        {editingQuestionId === q.id && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-2">
                            <textarea
                              value={editQuestionText}
                              onChange={(e) => setEditQuestionText(e.target.value)}
                              rows={2}
                              className="w-full border border-slate-300 dark:border-slate-500 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 focus:ring-green-500 focus:border-green-500"
                            />
                            {editQuestionOptions.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`edit-correct-${q.id}`}
                                  checked={editCorrectOptionIndex === optIdx}
                                  onChange={() => setEditCorrectOptionIndex(optIdx)}
                                  className="h-3.5 w-3.5"
                                />
                                <input
                                  value={opt}
                                  onChange={(e) => updateEditOption(optIdx, e.target.value)}
                                  className="flex-1 border border-slate-300 dark:border-slate-500 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 focus:ring-green-500 focus:border-green-500"
                                />
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveQuestionEdit}
                                disabled={savingQuestionEdit}
                                className="px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {savingQuestionEdit ? 'Saving...' : 'Save Question'}
                              </button>
                              <button
                                onClick={() => setEditingQuestionId(null)}
                                className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-500 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-50 dark:hover:bg-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingQuiz(null)}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
      {confirm.ConfirmModalRenderer()}
    </div>
  );
}
