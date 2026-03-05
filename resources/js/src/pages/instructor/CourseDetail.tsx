import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Plus,
  Trash2,
  Upload,
  FileText,
  Video,
  File,
  Loader2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
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

interface Module {
  id: number;
  title: string;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  created_at: string;
}

interface QuizSummary {
  id: number;
  title: string;
  description: string | null;
  question_count: number;
  created_at: string;
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  department: string;
  status: string;
  deadline: string | null;
  modules: Module[];
}

interface Props {
  courseId: string;
  onBack: () => void;
  onManageQuiz: (quizId: number, courseId: string) => void;
}

const fileTypeIcon = (fileType: string | null) => {
  if (fileType === 'video')    return <Video className="h-4 w-4 text-blue-500" />;
  if (fileType === 'pdf')      return <FileText className="h-4 w-4 text-red-500" />;
  if (fileType === 'document') return <FileText className="h-4 w-4 text-slate-500" />;
  return <File className="h-4 w-4 text-slate-400" />;
};

const DEPT_COLORS: Record<string, string> = {
  IT: 'bg-blue-600',
  HR: 'bg-purple-600',
  Operations: 'bg-green-600',
  Finance: 'bg-yellow-600',
  Marketing: 'bg-orange-600',
};

export function InstructorCourseDetail({ courseId, onBack, onManageQuiz }: Props) {
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Module upload state
  const [addingModule, setAddingModule] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleFile, setModuleFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleSuccess, setModuleSuccess] = useState<string | null>(null);
  const [deletingModuleId, setDeletingModuleId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quiz state
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDesc, setNewQuizDesc] = useState('');
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<number | null>(null);

  const loadCourse = async () => {
    try {
      const res = await fetch(`${API_BASE}/instructor/courses/${courseId}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Course not found.');
      const data = await res.json();
      setCourse(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizzes = async () => {
    setQuizzesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/instructor/courses/${courseId}/quizzes`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data);
      }
    } catch (_) {
      // non-critical
    } finally {
      setQuizzesLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      loadCourse();
      loadQuizzes();
    }
  }, [courseId]);

  const handleAddModule = async () => {
    if (!moduleTitle.trim()) {
      setModuleError('Module title is required.');
      return;
    }
    setUploading(true);
    setModuleError(null);
    setModuleSuccess(null);
    try {
      const token = await getXsrfToken();
      const formData = new FormData();
      formData.append('title', moduleTitle.trim());
      if (moduleFile) formData.append('content', moduleFile);

      const res = await fetch(`${API_BASE}/instructor/courses/${courseId}/modules`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add module.');

      setModuleSuccess('Module added successfully!');
      setModuleTitle('');
      setModuleFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAddingModule(false);
      await loadCourse();
      setTimeout(() => setModuleSuccess(null), 3000);
    } catch (e: any) {
      setModuleError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteModule = async (moduleId: number) => {
    if (!confirm('Delete this module?')) return;
    setDeletingModuleId(moduleId);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/instructor/courses/${courseId}/modules/${moduleId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Failed to delete module.');
      await loadCourse();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingModuleId(null);
    }
  };

  const handleCreateQuiz = async () => {
    if (!newQuizTitle.trim()) {
      setQuizError('Quiz title is required.');
      return;
    }
    setSavingQuiz(true);
    setQuizError(null);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/instructor/courses/${courseId}/quizzes`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': token,
        },
        body: JSON.stringify({ title: newQuizTitle.trim(), description: newQuizDesc.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create quiz.');

      setCreatingQuiz(false);
      setNewQuizTitle('');
      setNewQuizDesc('');
      // Navigate to quiz builder
      onManageQuiz(data.id, courseId);
    } catch (e: any) {
      setQuizError(e.message);
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('Delete this quiz and all its questions?')) return;
    setDeletingQuizId(quizId);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/instructor/quizzes/${quizId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Failed to delete quiz.');
      await loadQuizzes();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingQuizId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-3 text-slate-600">Loading course...</span>
      </div>
    );
  }

  if (!course || error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-3 text-slate-600">{error || 'Course not found.'}</p>
        <button onClick={onBack} className="mt-4 text-sm text-green-600 hover:underline">
          &larr; Back to Courses
        </button>
      </div>
    );
  }

  const headerColor = DEPT_COLORS[course.department] || 'bg-slate-600';

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Courses &amp; Content
      </button>

      {/* Course Header */}
      <div className={`${headerColor} rounded-xl p-6 text-white`}>
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full mb-2 inline-block">
              {course.department}
            </span>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-white/80 mt-1 max-w-xl">{course.description}</p>
            )}
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            course.status === 'Active' ? 'bg-green-200 text-green-900' :
            course.status === 'Draft'  ? 'bg-yellow-200 text-yellow-900' :
            'bg-white/20 text-white'
          }`}>
            {course.status}
          </span>
        </div>
        {course.deadline && (
          <p className="mt-3 text-xs text-white/70">
            Deadline: {new Date(course.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* Modules Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Modules &amp; Content
              <span className="ml-2 text-sm font-normal text-slate-400">({course.modules.length})</span>
            </h2>
          </div>
          <button
            onClick={() => { setAddingModule(true); setModuleError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Module
          </button>
        </div>

        {/* Add module form */}
        {addingModule && (
          <div className="mx-6 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3">New Module</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Module title"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500"
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-100 text-sm text-slate-600">
                  <Upload className="h-4 w-4" />
                  {moduleFile ? moduleFile.name : 'Upload file (optional)'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                    className="sr-only"
                    onChange={(e) => setModuleFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              {moduleError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{moduleError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAddModule}
                  disabled={uploading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {uploading ? 'Saving...' : 'Save Module'}
                </button>
                <button
                  onClick={() => { setAddingModule(false); setModuleTitle(''); setModuleFile(null); setModuleError(null); }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {moduleSuccess && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm">
            <CheckCircle className="h-4 w-4" />{moduleSuccess}
          </div>
        )}

        {/* Module list */}
        <div className="divide-y divide-slate-100 mt-2">
          {course.modules.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 text-sm">
              No modules yet. Click <strong>Add Module</strong> to upload content.
            </div>
          ) : (
            course.modules.map((mod, idx) => (
              <div key={mod.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50">
                <span className="flex-shrink-0 h-7 w-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{mod.title}</p>
                  {mod.content_path && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      {fileTypeIcon(mod.file_type)}
                      {mod.content_path.split('/').pop()}
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(mod.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleDeleteModule(mod.id)}
                  disabled={deletingModuleId === mod.id}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                >
                  {deletingModuleId === mod.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Quizzes Panel ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Quizzes
              <span className="ml-2 text-sm font-normal text-slate-400">({quizzes.length})</span>
            </h2>
          </div>
          <button
            onClick={() => { setCreatingQuiz(true); setQuizError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            Quiz
          </button>
        </div>

        {/* Create quiz form */}
        {creatingQuiz && (
          <div className="mx-6 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3">New Quiz</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Quiz title (e.g. Module 1 Assessment)"
                value={newQuizTitle}
                onChange={(e) => setNewQuizTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500"
              />
              <textarea
                rows={2}
                placeholder="Description (optional)"
                value={newQuizDesc}
                onChange={(e) => setNewQuizDesc(e.target.value)}
                className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500 resize-none"
              />
              {quizError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{quizError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateQuiz}
                  disabled={savingQuiz}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingQuiz ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {savingQuiz ? 'Creating...' : 'Create & Add Questions'}
                </button>
                <button
                  onClick={() => { setCreatingQuiz(false); setNewQuizTitle(''); setNewQuizDesc(''); setQuizError(null); }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz list */}
        <div className="divide-y divide-slate-100 mt-2">
          {quizzesLoading ? (
            <div className="px-6 py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : quizzes.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 text-sm">
              No quizzes yet. Click <strong>+ Quiz</strong> to create one.
            </div>
          ) : (
            quizzes.map((quiz) => (
              <div key={quiz.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50">
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{quiz.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => onManageQuiz(quiz.id, courseId)}
                  className="text-xs font-medium text-green-600 hover:text-green-800 px-3 py-1.5 border border-green-200 rounded-md hover:bg-green-50 transition-colors"
                >
                  Manage Quiz
                </button>
                <button
                  onClick={() => handleDeleteQuiz(quiz.id)}
                  disabled={deletingQuizId === quiz.id}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                >
                  {deletingQuizId === quiz.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
