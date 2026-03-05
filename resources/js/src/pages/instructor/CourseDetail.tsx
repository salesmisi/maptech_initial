import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
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
  Lock,
  ChevronDown,
  ChevronUp,
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

interface Lesson {
  id: number;
  title: string;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  order: number;
}

interface Module {
  id: number;
  title: string;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  lessons: Lesson[];
  created_at: string;
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

// ── Inline form for attaching a quiz to a module ──────────────────────────────
interface AddQuizFormProps {
  moduleId: number;
  courseId: string;
  onCreated: (quiz: QuizSummary) => void;
  onCancel: () => void;
  onManageQuiz: (quizId: number, courseId: string) => void;
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
      const res = await fetch(`${API_BASE}/instructor/modules/${moduleId}/quizzes`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ title: title.trim(), description: desc.trim() || null, pass_percentage: passPercent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create quiz.');
      onCreated(data);
      onManageQuiz(data.id, courseId);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Attach Quiz to this Module</p>
      {err && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{err}</p>}
      <input
        type="text"
        placeholder="Quiz title (e.g. Module 1 Assessment)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <textarea
        rows={2}
        placeholder="Description (optional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
      />
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Pass Percentage</label>
        <input
          type="number"
          min={1} max={100}
          value={passPercent}
          onChange={e => setPassPercent(Number(e.target.value))}
          className="w-20 border border-slate-300 rounded-md py-1.5 px-2 text-sm text-center focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-500">% to unlock next module</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {saving ? 'Creating...' : 'Create & Add Questions'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
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
  const [uploading, setUploading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleSuccess, setModuleSuccess] = useState<string | null>(null);
  const [deletingModuleId, setDeletingModuleId] = useState<number | null>(null);

  // Lesson state
  const [addingLessonForModule, setAddingLessonForModule] = useState<number | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [uploadingLesson, setUploadingLesson] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const lessonFileRef = useRef<HTMLInputElement>(null);

  // Quiz state — keyed by module_id
  const [quizByModule, setQuizByModule] = useState<Record<number, QuizSummary>>({});
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [addingQuizForModule, setAddingQuizForModule] = useState<number | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
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
    if (!confirm('Delete this module and all its lessons?')) return;
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

  const handleAddLesson = async (moduleId: number) => {
    if (!lessonTitle.trim()) {
      setLessonError('Lesson title is required.');
      return;
    }
    setUploadingLesson(true);
    setLessonError(null);
    try {
      const token = await getXsrfToken();
      const fd = new FormData();
      fd.append('title', lessonTitle.trim());
      if (lessonFile) fd.append('content', lessonFile);

      const res = await fetch(`${API_BASE}/instructor/modules/${moduleId}/lessons`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to add lesson.');
      }
      setLessonTitle('');
      setLessonFile(null);
      if (lessonFileRef.current) lessonFileRef.current.value = '';
      setAddingLessonForModule(null);
      await loadCourse();
    } catch (e: any) {
      setLessonError(e.message);
    } finally {
      setUploadingLesson(false);
    }
  };

  const handleDeleteLesson = async (moduleId: number, lessonId: number) => {
    if (!confirm('Delete this lesson?')) return;
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/instructor/modules/${moduleId}/lessons/${lessonId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Failed to delete lesson.');
      await loadCourse();
    } catch (e: any) {
      alert(e.message);
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
                  onClick={() => { setAddingModule(false); setModuleTitle(''); setModuleError(null); }}
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

        {/* Module list with lessons and quiz */}
        <div className="divide-y divide-slate-100 mt-2">
          {course.modules.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 text-sm">
              No modules yet. Click <strong>Add Module</strong> to get started.
            </div>
          ) : (
            course.modules.map((mod, idx) => {
              const quiz = quizByModule[mod.id];
              const isExpanded = expandedModules.has(mod.id);
              return (
                <div key={mod.id}>
                  {/* Module header */}
                  <div
                    className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setExpandedModules(prev => {
                      const next = new Set(prev);
                      next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id);
                      return next;
                    })}
                  >
                    <span className="flex-shrink-0 h-7 w-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{mod.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {mod.lessons?.length || 0} lesson{(mod.lessons?.length || 0) !== 1 ? 's' : ''}
                        {quiz ? ` · Quiz: ${quiz.pass_percentage}% to pass` : ''}
                      </p>
                    </div>

                    {quizzesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400 flex-shrink-0" />
                    ) : quiz ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium flex-shrink-0">
                        <HelpCircle className="h-3.5 w-3.5" />
                        Quiz
                      </span>
                    ) : null}

                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteModule(mod.id); }}
                      disabled={deletingModuleId === mod.id}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40 flex-shrink-0"
                    >
                      {deletingModuleId === mod.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Expanded body: Lessons + Quiz */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {/* Lessons list */}
                      <div className="px-6 py-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Lessons</p>
                        {(mod.lessons?.length || 0) === 0 ? (
                          <p className="text-xs text-slate-400 italic">No lessons yet. Add one below.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {mod.lessons.map((lesson, li) => (
                              <div key={lesson.id} className="flex items-center gap-3 py-1.5 px-3 rounded-md bg-slate-50 hover:bg-slate-100">
                                <span className="text-xs text-slate-400 font-medium w-5">{li + 1}.</span>
                                {fileTypeIcon(lesson.file_type)}
                                <span className="flex-1 text-sm text-slate-700 truncate">{lesson.title}</span>
                                {lesson.content_url ? (
                                  <a href={lesson.content_url} target="_blank" rel="noreferrer"
                                    className="text-xs text-green-600 hover:underline flex-shrink-0">
                                    View file
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400 italic flex-shrink-0">No file</span>
                                )}
                                <button
                                  onClick={() => handleDeleteLesson(mod.id, lesson.id)}
                                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                                  title="Delete lesson"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Lesson form */}
                        {addingLessonForModule === mod.id ? (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
                            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Add Lesson</p>
                            {lessonError && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{lessonError}</p>}
                            <input
                              type="text"
                              placeholder="Lesson title"
                              value={lessonTitle}
                              onChange={e => setLessonTitle(e.target.value)}
                              className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-md cursor-pointer hover:bg-white text-xs text-slate-600">
                                <Upload className="h-3.5 w-3.5" />
                                {lessonFile ? lessonFile.name : 'Upload file (optional)'}
                                <input
                                  ref={lessonFileRef}
                                  type="file"
                                  accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                                  className="sr-only"
                                  onChange={e => setLessonFile(e.target.files?.[0] || null)}
                                />
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddLesson(mod.id)}
                                disabled={uploadingLesson}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md disabled:opacity-50 flex items-center gap-1"
                              >
                                {uploadingLesson ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                {uploadingLesson ? 'Saving...' : 'Save Lesson'}
                              </button>
                              <button
                                onClick={() => { setAddingLessonForModule(null); setLessonTitle(''); setLessonFile(null); setLessonError(null); }}
                                className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-md hover:bg-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingLessonForModule(mod.id); setLessonTitle(''); setLessonFile(null); setLessonError(null); }}
                            className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Lesson
                          </button>
                        )}
                      </div>

                      {/* Quiz section */}
                      <div className="border-t border-slate-100 px-6 py-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quiz</p>
                        {quiz ? (
                          <div className="bg-indigo-50 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                  <HelpCircle className="h-4 w-4 text-indigo-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{quiz.title}</p>
                                  {quiz.description && <p className="text-xs text-slate-500 mt-0.5">{quiz.description}</p>}
                                  <div className="flex gap-3 mt-1 text-xs text-slate-500">
                                    <span>{quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}</span>
                                    <span>·</span>
                                    <span className="flex items-center gap-1">
                                      <Lock className="h-3 w-3 text-amber-500" />
                                      Must score <strong className="text-amber-700 mx-0.5">{quiz.pass_percentage}%</strong> to unlock next module
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => onManageQuiz(quiz.id, courseId)}
                                  className="text-xs font-medium text-green-600 hover:text-green-800 px-3 py-1.5 border border-green-200 rounded-md hover:bg-green-50 transition-colors"
                                >
                                  Manage Quiz
                                </button>
                                <button
                                  onClick={() => handleDeleteQuiz(quiz.id)}
                                  disabled={deletingQuizId === quiz.id}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded disabled:opacity-40"
                                >
                                  {deletingQuizId === quiz.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Trash2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          addingQuizForModule === mod.id ? (
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
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Quiz
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {course.modules.length > 1 && (
          <div className="px-6 pb-4 flex items-center gap-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            Modules with a quiz gate the next module — employees must pass before proceeding.
          </div>
        )}
      </div>

    </div>
  );
}
