import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronRight,
  HelpCircle,
  Plus,
  Trash2,
  Lock,
} from 'lucide-react';
import { ModuleLessonManager, Module } from '../../components/ModuleLessonManager';
import useConfirm from '../../hooks/useConfirm';

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseData {
  id: string;
  title: string;
  description: string;
  department: string;
  status: string;
  instructor: { id: number; fullname: string; email: string } | null;
  modules: Module[];
}

interface QuizSummary {
  id: number;
  title: string;
  description: string | null;
  pass_percentage: number;
  module_id: number | null;
  question_count: number;
  created_at: string;
}

interface CourseContentEditorProps {
  courseId: string;
  onBack: () => void;
  onManageQuiz?: (quizId: number, courseId: string) => void;
}

// ─── Quiz Form ────────────────────────────────────────────────────────────────

interface AddQuizFormProps {
  moduleId: number;
  courseId: string;
  onCreated: (quiz: QuizSummary) => void;
  onCancel: () => void;
  onManageQuiz?: (quizId: number, courseId: string) => void;
}

function AddQuizForm({ moduleId, courseId, onCreated, onCancel, onManageQuiz }: AddQuizFormProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [passPercent, setPassPercent] = useState(70);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) { setErr('Quiz title is required.'); return; }
    setSaving(true); setErr(null);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/admin/modules/${moduleId}/quizzes`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ title: title.trim(), description: desc.trim() || null, pass_percentage: passPercent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create quiz.');
      onCreated(data);
      if (onManageQuiz) onManageQuiz(data.id, courseId);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Add Quiz to Module</p>
      {err && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{err}</p>}
      <input
        type="text"
        placeholder="Quiz title (e.g. Module Assessment)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <textarea
        rows={2}
        placeholder="Description (optional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
      />
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Pass Percentage</label>
        <input
          type="number"
          min={1} max={100}
          value={passPercent}
          onChange={e => setPassPercent(Number(e.target.value))}
          className="w-20 border border-slate-300 rounded-lg py-2 px-2 text-sm text-center focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-500">% to unlock next module</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {saving ? 'Creating...' : 'Create Quiz'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Quiz Card ────────────────────────────────────────────────────────────────

interface QuizCardProps {
  quiz: QuizSummary;
  courseId: string;
  onManageQuiz?: (quizId: number, courseId: string) => void;
  onDelete: (quizId: number) => void;
  deleting: boolean;
}

function QuizCard({ quiz, courseId, onManageQuiz, onDelete, deleting }: QuizCardProps) {
  return (
    <div className="bg-indigo-50 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{quiz.title}</p>
            {quiz.description && <p className="text-xs text-slate-500 mt-0.5">{quiz.description}</p>}
            <div className="flex gap-3 mt-1.5 text-xs text-slate-500">
              <span>{quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-amber-500" />
                Must score <strong className="text-amber-700 mx-0.5">{quiz.pass_percentage}%</strong> to proceed
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onManageQuiz && (
            <button
              onClick={() => onManageQuiz(quiz.id, courseId)}
              className="text-xs font-medium text-green-600 hover:text-green-800 px-3 py-2 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
            >
              Manage Quiz
            </button>
          )}
          <button
            onClick={() => onDelete(quiz.id)}
            disabled={deleting}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-40 transition-colors"
            title="Delete quiz"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CourseContentEditor({ courseId, onBack, onManageQuiz }: CourseContentEditorProps) {
  const { showConfirm, ConfirmModalRenderer } = useConfirm();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quiz state
  const [quizByModule, setQuizByModule] = useState<Record<number, QuizSummary>>({});
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [addingQuizForModule, setAddingQuizForModule] = useState<number | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<number | null>(null);

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const loadCourse = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/courses/${courseId}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load course');
      const data = await res.json();
      setCourse({
        id: data.id,
        title: data.title,
        description: data.description || '',
        department: data.department,
        status: data.status,
        instructor: data.instructor ?? null,
        modules: (data.modules ?? []).map((m: any) => ({
          ...m,
          lessons: m.lessons ?? [],
          order: m.order ?? 0,
        })),
      });
    } catch (e: any) {
      setError(e.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const loadQuizzes = useCallback(async () => {
    setQuizzesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/courses/${courseId}/quizzes`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const quizzes: QuizSummary[] = await res.json();
        const byModule: Record<number, QuizSummary> = {};
        quizzes.forEach(q => { if (q.module_id !== null) byModule[q.module_id] = q; });
        setQuizByModule(byModule);
      }
    } catch (_) {
      // non-critical
    } finally {
      setQuizzesLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCourse();
    loadQuizzes();
  }, [loadCourse, loadQuizzes]);

  // ─── Quiz Handlers ──────────────────────────────────────────────────────────

  const handleDeleteQuiz = (quizId: number) => {
    showConfirm(
      'Delete this quiz and all its questions?',
      async () => {
        setDeletingQuizId(quizId);
        try {
          const xsrf = await getXsrfToken();
          const res = await fetch(`${API_BASE}/admin/quizzes/${quizId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
          });
          if (!res.ok) throw new Error('Failed to delete quiz.');
          await loadQuizzes();
        } catch (e: any) {
          alert(e.message);
        } finally {
          setDeletingQuizId(null);
        }
      },
      {
        title: 'Delete Quiz',
        confirmText: 'Delete',
        variant: 'danger',
      }
    );
  };

  // ─── Module State Updates ───────────────────────────────────────────────────

  const handleModulesChange = (newModules: Module[]) => {
    if (course) {
      setCourse({ ...course, modules: newModules });
    }
  };

  // ─── Loading / Error States ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-3 text-slate-600">Loading course content...</span>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error || 'Course not found'}</span>
          <button onClick={onBack} className="ml-auto text-red-600 hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header with Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="hover:text-green-600 cursor-pointer" onClick={onBack}>
            Courses
          </span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-slate-900 font-medium">{course.title}</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-green-600 font-medium">Content Editor</span>
        </div>
      </div>

      {/* Course Info Banner */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/20">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">{course.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="px-2 py-1 bg-white rounded-full border border-slate-200">{course.department}</span>
              <span className="px-2 py-1 bg-white rounded-full border border-slate-200">
                Instructor: {course.instructor?.fullname ?? 'Unassigned'}
              </span>
              <span
                className={`px-2 py-1 rounded-full ${
                  course.status === 'Active'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : course.status === 'Draft'
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {course.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Module/Lesson Manager */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <ModuleLessonManager
          courseId={courseId}
          modules={course.modules}
          onModulesChange={handleModulesChange}
          onRefresh={loadCourse}
        />
      </div>

      {/* Quiz Management Section */}
      {course.modules.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Module Quizzes</h3>
              <p className="text-xs text-slate-500">
                Quizzes unlock the next module when employees pass
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {course.modules.map((mod, idx) => {
              const quiz = quizByModule[mod.id];
              return (
                <div key={mod.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{mod.title}</span>
                      {quiz && (
                        <span className="ml-auto flex items-center gap-1 text-xs text-indigo-600">
                          <HelpCircle className="h-3 w-3" /> Quiz attached
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    {quizzesLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : quiz ? (
                      <QuizCard
                        quiz={quiz}
                        courseId={courseId}
                        onManageQuiz={onManageQuiz}
                        onDelete={handleDeleteQuiz}
                        deleting={deletingQuizId === quiz.id}
                      />
                    ) : addingQuizForModule === mod.id ? (
                      <AddQuizForm
                        moduleId={mod.id}
                        courseId={courseId}
                        onCreated={(q) => {
                          setQuizByModule(prev => ({ ...prev, [mod.id]: q }));
                          setAddingQuizForModule(null);
                        }}
                        onCancel={() => setAddingQuizForModule(null)}
                        onManageQuiz={onManageQuiz}
                      />
                    ) : (
                      <button
                        onClick={() => setAddingQuizForModule(mod.id)}
                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Quiz to this Module
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {course.modules.length > 1 && (
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 px-1">
              <Lock className="h-3.5 w-3.5 text-amber-500" />
              Quizzes act as gates — employees must pass to unlock the next module
            </div>
          )}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmModalRenderer />
    </div>
  );
}

export default CourseContentEditor;
