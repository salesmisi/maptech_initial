import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Users,
  Plus,
  Trash2,
  Upload,
  FileText,
  Video,
  File,
  UserMinus,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  HelpCircle,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  X,
  GripVertical,
} from 'lucide-react';
import { RichTextEditor, sanitizeHtml, RICH_CONTENT_STYLES } from '../../components/RichTextEditor';
import UnlockModuleModal from '../../components/UnlockModuleModal';
import ConfirmModal from '../../components/ConfirmModal';

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

interface Lesson {
  id: number;
  title: string;
  text_content: string | null;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  order: number;
}

interface Module {
  id: number;
  title: string;
  description: string | null;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  lessons: Lesson[];
  created_at: string;
}

interface EnrolledUser {
  id: number;
  fullname: string;
  email: string;
  department: string | null;
  role: string;
  status: string;
  enrolled_at: string;
  progress: number;
  enrollment_status: string;
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  department: string;
  status: string;
  instructor: { id: number; fullname: string; email: string } | null;
  modules: Module[];
  enrolled_users: EnrolledUser[];
}

interface AllUser {
  id: number;
  fullname: string;
  email: string;
  role: string;
  department: string | null;
  status: string;
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

  // Unlock modal renderer (reused from instructor flows)
  function UnlockModalRenderer({
    course,
    open,
    userId,
    onConfirm,
    onCancel,
  }: {
    course: CourseData | null;
    open: boolean;
    userId: number | null;
    onConfirm: (userId: number, moduleId: number) => void;
    onCancel: () => void;
  }) {
    if (!course) return null;
    return (
      <UnlockModuleModal
        open={open}
        modules={course.modules.map(m => ({ id: m.id, title: m.title }))}
        onConfirm={(moduleId) => {
          if (userId) onConfirm(userId, Number(moduleId));
        }}
        onCancel={onCancel}
      />
    );
  }

interface CourseDetailProps {
  courseId: string;
  onBack: () => void;
  onManageQuiz?: (quizId: number, courseId: string) => void;
}

const fileTypeIcon = (fileType: string | null) => {
  if (fileType === 'video') return <Video className="h-4 w-4 text-blue-500" />;
  if (fileType === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (fileType === 'document') return <FileText className="h-4 w-4 text-slate-500" />;
  return <File className="h-4 w-4 text-slate-400" />;
};

export function CourseDetail({ courseId, onBack, onManageQuiz }: CourseDetailProps) {
  const [activeTab, setActiveTab] = useState<'modules' | 'students'>('modules');
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Module upload state
  const [addingModule, setAddingModule] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleSuccess, setModuleSuccess] = useState<string | null>(null);

  // Lesson state
  const [addingLessonForModule, setAddingLessonForModule] = useState<number | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [lessonTextContent, setLessonTextContent] = useState('');
  const [uploadingLesson, setUploadingLesson] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const lessonFileRef = useRef<HTMLInputElement>(null);

  // Enrollment state
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  // Quiz state — keyed by module_id
  const [quizByModule, setQuizByModule] = useState<Record<number, QuizSummary>>({});
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [addingQuizForModule, setAddingQuizForModule] = useState<number | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [deletingQuizId, setDeletingQuizId] = useState<number | null>(null);
  const [deletingModuleId, setDeletingModuleId] = useState<number | null>(null);

  // Edit module state
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');
  const [savingModule, setSavingModule] = useState(false);

  // Edit lesson state
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonTextContent, setEditLessonTextContent] = useState('');
  const [editLessonFile, setEditLessonFile] = useState<File | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const editLessonFileRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Unlock modal state for admin -> unlock module for a user
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockModalUserId, setUnlockModalUserId] = useState<number | null>(null);

  // Generic confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const confirmActionRef = useRef<(() => Promise<void> | void) | null>(null);
  const showConfirm = (message: string, action: () => Promise<void> | void) => {
    confirmActionRef.current = action;
    setConfirmMessage(message);
    setConfirmOpen(true);
  };
  const handleConfirm = async () => {
    setConfirmOpen(false);
    const act = confirmActionRef.current;
    confirmActionRef.current = null;
    if (act) await act();
  };
  const handleCancelConfirm = () => { confirmActionRef.current = null; setConfirmOpen(false); };

  const handleUnlockModuleForUser = async (userId: number) => {
    if (!course || !course.modules || course.modules.length === 0) {
      alert('No modules available for this course.');
      return;
    }
    setUnlockModalUserId(userId);
    setUnlockModalOpen(true);
  };

  const performUnlockModuleForUser = async (userId: number, moduleId: number) => {
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/admin/courses/${courseId}/modules/${moduleId}/enrollments/${userId}/unlock`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
      });
      if (!res.ok) throw new Error('Failed to unlock module');
      await loadCourse();
      alert('Module unlocked for user');
    } catch (e: any) {
      alert(e.message || 'Failed to unlock module');
    } finally {
      setUnlockModalOpen(false);
      setUnlockModalUserId(null);
    }
  };

  const loadCourse = async () => {
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
        modules: data.modules ?? [],
        enrolled_users: (data.enrolled_users ?? []).map((u: any) => ({
          id: u.id,
          fullname: u.fullname,
          email: u.email,
          department: u.department,
          role: u.role,
          status: u.status,
          enrolled_at: u.pivot?.enrolled_at ?? u.enrolled_at,
          progress: u.pivot?.progress ?? u.progress ?? 0,
          enrollment_status: u.pivot?.status ?? u.enrollment_status ?? 'Active',
        })),
      });
    } catch (e: any) {
      setError(e.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data: AllUser[] = await res.json();
      setAllUsers(data.filter(u => u.status === 'Active'));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCourse();
    loadAllUsers();
    loadQuizzes();
  }, [courseId]);

  // ─── MODULE HANDLERS ─────────────────────────────────────────────────────────

  const loadQuizzes = async () => {
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
  };

  const handleDeleteQuiz = (quizId: number) => {
    showConfirm('Delete this quiz and all its questions?', async () => {
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
    });
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim()) {
      setModuleError('Module title is required');
      return;
    }
    setUploading(true);
    setModuleError(null);
    setModuleSuccess(null);
    try {
      const xsrf = await getXsrfToken();
      const fd = new FormData();
      fd.append('title', moduleTitle.trim());

      const res = await fetch(`${API_BASE}/admin/courses/${courseId}/modules`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to add module');
      }
      setModuleTitle('');
      setModuleSuccess('Module added successfully');
      setAddingModule(false);
      await loadCourse();
      setTimeout(() => setModuleSuccess(null), 3000);
    } catch (e: any) {
      setModuleError(e.message || 'Failed to add module');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteModule = (moduleId: number) => {
    showConfirm('Delete this module and all its lessons?', async () => {
      setDeletingModuleId(moduleId);
      try {
        const xsrf = await getXsrfToken();
        const res = await fetch(`${API_BASE}/admin/courses/${courseId}/modules/${moduleId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
        });
        if (!res.ok) throw new Error('Failed to delete module');
        await loadCourse();
      } catch (e: any) {
        alert(e.message || 'Failed to delete module');
      } finally {
        setDeletingModuleId(null);
      }
    });
  };

  const handleAddLesson = async (moduleId: number) => {
    if (!lessonTitle.trim()) {
      setLessonError('Lesson title is required');
      return;
    }
    setUploadingLesson(true);
    setLessonError(null);
    try {
      const xsrf = await getXsrfToken();
      const fd = new FormData();
      fd.append('title', lessonTitle.trim());
      if (lessonTextContent.trim()) fd.append('text_content', lessonTextContent.trim());
      if (lessonFile) fd.append('content', lessonFile);

      const res = await fetch(`${API_BASE}/admin/modules/${moduleId}/lessons`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to add lesson');
      }
      setLessonTitle('');
      setLessonTextContent('');
      setLessonFile(null);
      if (lessonFileRef.current) lessonFileRef.current.value = '';
      setAddingLessonForModule(null);
      await loadCourse();
    } catch (e: any) {
      setLessonError(e.message || 'Failed to add lesson');
    } finally {
      setUploadingLesson(false);
    }
  };

  const handleDeleteLesson = (moduleId: number, lessonId: number) => {
    showConfirm('Delete this lesson?', async () => {
      try {
        const xsrf = await getXsrfToken();
        const res = await fetch(`${API_BASE}/admin/modules/${moduleId}/lessons/${lessonId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
        });
        if (!res.ok) throw new Error('Failed to delete lesson');
        await loadCourse();
      } catch (e: any) {
        alert(e.message || 'Failed to delete lesson');
      }
    });
  };

  // ─── EDIT MODULE/LESSON HANDLERS ──────────────────────────────────

  const startEditModule = (mod: Module) => {
    setEditingModuleId(mod.id);
    setEditModuleTitle(mod.title);
  };
  const cancelEditModule = () => { setEditingModuleId(null); setEditModuleTitle(''); };

  const handleSaveModule = async (moduleId: number) => {
    if (!editModuleTitle.trim()) return;
    setSavingModule(true);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/admin/courses/${courseId}/modules/${moduleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ title: editModuleTitle.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update module');
      cancelEditModule();
      await loadCourse();
    } catch (e: any) {
      alert(e.message);
    } finally { setSavingModule(false); }
  };

  const startEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setEditLessonTitle(lesson.title);
    setEditLessonTextContent(lesson.text_content || '');
    setEditLessonFile(null);
  };
  const cancelEditLesson = () => { setEditingLessonId(null); setEditLessonTitle(''); setEditLessonTextContent(''); setEditLessonFile(null); };

  const handleSaveLesson = async (moduleId: number, lessonId: number) => {
    if (!editLessonTitle.trim()) return;
    setSavingLesson(true);
    try {
      const xsrf = await getXsrfToken();
      const fd = new FormData();
      fd.append('title', editLessonTitle.trim());
      fd.append('text_content', editLessonTextContent);
      if (editLessonFile) fd.append('content', editLessonFile);
      const res = await fetch(`${API_BASE}/admin/modules/${moduleId}/lessons/${lessonId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: fd,
      });
      if (!res.ok) throw new Error('Failed to update lesson');
      cancelEditLesson();
      await loadCourse();
    } catch (e: any) {
      alert(e.message);
    } finally { setSavingLesson(false); }
  };

  // ─── DRAG & DROP HANDLERS ─────────────────────────────────────────

  const handleDragStart = useCallback((idx: number) => setDragIdx(idx), []);
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); }, []);
  const handleDragEnd = useCallback(() => { setDragIdx(null); setDragOverIdx(null); }, []);

  const handleDrop = useCallback(async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx || !course) { handleDragEnd(); return; }
    const mods = [...course.modules];
    const [moved] = mods.splice(dragIdx, 1);
    mods.splice(targetIdx, 0, moved);
    setCourse({ ...course, modules: mods });
    handleDragEnd();
    try {
      const xsrf = await getXsrfToken();
      await fetch(`${API_BASE}/admin/courses/${courseId}/modules/reorder`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ order: mods.map(m => m.id) }),
      });
    } catch {
      await loadCourse();
    }
  }, [dragIdx, course, courseId]);

  // ─── ENROLLMENT HANDLERS ─────────────────────────────────────────────────────

  const enrolledIds = new Set(course?.enrolled_users.map(u => u.id) ?? []);

  const availableUsers = allUsers.filter(u => !enrolledIds.has(u.id));

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setEnrolling(true);
    setEnrollError(null);
    setEnrollSuccess(null);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/admin/courses/${courseId}/enrollments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify({ user_id: Number(selectedUserId) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to enroll user');
      }
      setSelectedUserId('');
      setEnrollSuccess('User enrolled successfully');
      await loadCourse();
      setTimeout(() => setEnrollSuccess(null), 3000);
    } catch (e: any) {
      setEnrollError(e.message || 'Failed to enroll user');
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = (userId: number, name: string) => {
    showConfirm(`Remove ${name} from this course?`, async () => {
      try {
        const xsrf = await getXsrfToken();
        const res = await fetch(`${API_BASE}/admin/courses/${courseId}/enrollments/${userId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
        });
        if (!res.ok) throw new Error('Failed to unenroll user');
        await loadCourse();
      } catch (e: any) {
        alert(e.message || 'Failed to unenroll user');
      }
    });
  };

  // ─── LOADING / ERROR ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-2 text-slate-600">Loading course...</span>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error || 'Course not found'}</span>
          <button onClick={onBack} className="ml-auto text-red-600 hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span
            className="hover:text-green-600 cursor-pointer"
            onClick={onBack}
          >
            Courses &amp; Content
          </span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-slate-900 font-medium">{course.title}</span>
        </div>
      </div>

      {/* ── Course Info Card ── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{course.title}</h1>
              {course.description && (
                <p className="text-sm text-slate-500 mt-1 max-w-xl">{course.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{course.department}</span>
                <span>·</span>
                <span>Instructor: <span className="text-slate-700">{course.instructor?.fullname ?? 'Unassigned'}</span></span>
                <span>·</span>
                <span>{course.modules.length} module{course.modules.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{course.enrolled_users.length} enrolled</span>
              </div>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium self-start ${
              course.status === 'Active'
                ? 'bg-green-100 text-green-800'
                : course.status === 'Draft'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {course.status}
          </span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {(['modules', 'students'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'modules' ? (
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Modules ({course.modules.length})
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Enrolled Students ({course.enrolled_users.length})
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ══ MODULES TAB ══ */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          {/* Success / Error banners */}
          {moduleSuccess && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
              <CheckCircle className="h-4 w-4" />
              {moduleSuccess}
            </div>
          )}

          {/* Module cards with lessons and quiz */}
          <div className="space-y-3">
            {course.modules.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
                <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No modules yet. Add the first one below.</p>
              </div>
            ) : (
              course.modules.map((mod, idx) => {
                const quiz = quizByModule[mod.id];
                const isExpanded = expandedModules.has(mod.id);
                const isEditingMod = editingModuleId === mod.id;
                return (
                  <div
                    key={mod.id}
                    draggable={!isExpanded}
                    onDragStart={() => { if (!isExpanded) handleDragStart(idx); }}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDrop={() => handleDrop(idx)}
                    className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all ${dragOverIdx === idx ? 'border-t-2 border-t-green-400' : ''} ${dragIdx === idx ? 'opacity-50' : ''}`}
                  >
                    {/* Module header */}
                    <div
                      className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50"
                      onClick={() => setExpandedModules(prev => {
                        const next = new Set(prev);
                        next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id);
                        return next;
                      })}
                    >
                      <div className="flex-shrink-0 cursor-grab text-slate-300 hover:text-slate-500" onMouseDown={e => e.stopPropagation()}>
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <span className="flex-shrink-0 h-7 w-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        {isEditingMod ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editModuleTitle}
                              onChange={e => setEditModuleTitle(e.target.value)}
                              className="flex-1 border border-green-300 rounded-md py-1 px-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveModule(mod.id); if (e.key === 'Escape') cancelEditModule(); }}
                            />
                            <button onClick={() => handleSaveModule(mod.id)} disabled={savingModule}
                              className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded">
                              {savingModule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </button>
                            <button onClick={cancelEditModule} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-slate-900">{mod.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {mod.lessons?.length || 0} lesson{(mod.lessons?.length || 0) !== 1 ? 's' : ''}
                              {quiz ? ` · Quiz: ${quiz.pass_percentage}% to pass` : ''}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Quiz badge */}
                      {quizzesLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400 flex-shrink-0" />
                      ) : quiz ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium flex-shrink-0">
                          <HelpCircle className="h-3.5 w-3.5" />
                          Quiz
                        </span>
                      ) : null}

                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}

                      {!isEditingMod && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditModule(mod); }}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded flex-shrink-0"
                          title="Edit module"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteModule(mod.id); }}
                        disabled={deletingModuleId === mod.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40 flex-shrink-0"
                        title="Delete module"
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
                        <div className="px-5 py-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Lessons</p>
                          {(mod.lessons?.length || 0) === 0 ? (
                            <p className="text-xs text-slate-400 italic">No lessons yet. Add one below.</p>
                          ) : (
                            <div className="space-y-2">
                              {mod.lessons.map((lesson, li) => {
                                const isEditingThisLesson = editingLessonId === lesson.id;
                                return (
                                  <div key={lesson.id} className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                                    {isEditingThisLesson ? (
                                      /* Edit Lesson Form */
                                      <div className="p-3 space-y-2 bg-amber-50 border-amber-200">
                                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Edit Lesson</p>
                                        <input
                                          type="text" value={editLessonTitle}
                                          onChange={e => setEditLessonTitle(e.target.value)}
                                          className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                          placeholder="Lesson title"
                                        />
                                        <RichTextEditor
                                          value={editLessonTextContent}
                                          onChange={setEditLessonTextContent}
                                          placeholder="Lesson content..."
                                          minHeight="120px"
                                        />
                                        <div className="flex items-center gap-2">
                                          <label className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-md cursor-pointer hover:bg-white text-xs text-slate-600">
                                            <Upload className="h-3.5 w-3.5" />
                                            {editLessonFile ? editLessonFile.name : 'Replace file (optional)'}
                                            <input ref={editLessonFileRef} type="file" accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                                              className="sr-only" onChange={e => setEditLessonFile(e.target.files?.[0] || null)} />
                                          </label>
                                          {editLessonFile && (
                                            <button onClick={() => { setEditLessonFile(null); if (editLessonFileRef.current) editLessonFileRef.current.value = ''; }}
                                              className="text-xs text-red-500 hover:text-red-700">Remove</button>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
                                          <button onClick={() => handleSaveLesson(mod.id, lesson.id)} disabled={savingLesson}
                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md disabled:opacity-50 flex items-center gap-1">
                                            {savingLesson ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                            {savingLesson ? 'Saving...' : 'Save Changes'}
                                          </button>
                                          <button onClick={cancelEditLesson}
                                            className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-md hover:bg-white">
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      /* Display Lesson */
                                      <>
                                        <div className="flex items-center gap-3 py-2 px-3 hover:bg-slate-100">
                                          <span className="text-xs text-slate-400 font-medium w-5">{li + 1}.</span>
                                          {fileTypeIcon(lesson.file_type)}
                                          <span className="flex-1 text-sm font-medium text-slate-700 truncate">{lesson.title}</span>
                                          {lesson.content_url && (
                                            <a href={lesson.content_url} target="_blank" rel="noreferrer"
                                              className="text-xs text-green-600 hover:underline flex-shrink-0">View file</a>
                                          )}
                                          <button onClick={() => startEditLesson(lesson)}
                                            className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded flex-shrink-0" title="Edit lesson">
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                          <button onClick={() => handleDeleteLesson(mod.id, lesson.id)}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0" title="Delete lesson">
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                        {lesson.text_content && (
                                          <div className="px-4 pb-3 pt-1 border-t border-slate-200">
                                            <div className={RICH_CONTENT_STYLES}
                                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.text_content) }} />
                                          </div>
                                        )}
                                        {lesson.content_url && lesson.file_type === 'video' && (
                                          <div className="px-4 pb-3 pt-1 border-t border-slate-200">
                                            <video controls className="w-full max-h-80 rounded-md bg-black">
                                              <source src={lesson.content_url} />
                                            </video>
                                          </div>
                                        )}
                                        {lesson.content_url && lesson.file_type === 'pdf' && (
                                          <div className="px-4 pb-3 pt-1 border-t border-slate-200">
                                            <iframe src={lesson.content_url} className="w-full h-96 rounded-md border border-slate-300" title={lesson.title} />
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
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
                              <RichTextEditor
                                value={lessonTextContent}
                                onChange={setLessonTextContent}
                                placeholder="Type the lesson content here — use the toolbar for bold, headings, lists..."
                                minHeight="120px"
                              />
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-md cursor-pointer hover:bg-white text-xs text-slate-600">
                                  <Upload className="h-3.5 w-3.5" />
                                  {lessonFile ? lessonFile.name : 'Upload document or video (optional)'}
                                  <input
                                    ref={lessonFileRef}
                                    type="file"
                                    accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                                    className="sr-only"
                                    onChange={e => setLessonFile(e.target.files?.[0] || null)}
                                  />
                                </label>
                                {lessonFile && (
                                  <button
                                    onClick={() => { setLessonFile(null); if (lessonFileRef.current) lessonFileRef.current.value = ''; }}
                                    className="text-xs text-red-500 hover:text-red-700"
                                  >
                                    Remove
                                  </button>
                                )}
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
                                  onClick={() => { setAddingLessonForModule(null); setLessonTitle(''); setLessonTextContent(''); setLessonFile(null); setLessonError(null); }}
                                  className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-md hover:bg-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingLessonForModule(mod.id); setLessonTitle(''); setLessonTextContent(''); setLessonFile(null); setLessonError(null); }}
                              className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Lesson
                            </button>
                          )}
                        </div>

                        {/* Quiz section */}
                        <div className="border-t border-slate-100 px-5 py-3">
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
                                  {onManageQuiz && (
                                    <button
                                      onClick={() => onManageQuiz(quiz.id, courseId)}
                                      className="text-xs font-medium text-green-600 hover:text-green-800 px-3 py-1.5 border border-green-200 rounded-md hover:bg-green-50 transition-colors"
                                    >
                                      Manage Quiz
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteQuiz(quiz.id)}
                                    disabled={deletingQuizId === quiz.id}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded disabled:opacity-40"
                                    title="Delete quiz"
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
            <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
              <Lock className="h-3.5 w-3.5 text-amber-500" />
              Modules with a quiz gate the next module — employees must pass before proceeding.
            </div>
          )}

          {/* Add Module Form */}
          {addingModule ? (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Add New Module</h3>
              <form onSubmit={handleAddModule} className="space-y-4">
                {moduleError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {moduleError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Module Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={moduleTitle}
                    onChange={e => setModuleTitle(e.target.value)}
                    placeholder="e.g. Introduction to Networking"
                    className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setAddingModule(false); setModuleTitle(''); setModuleError(null); }}
                    className="flex-1 py-2 px-4 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 py-2 px-4 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Plus className="h-4 w-4" /> Add Module</>}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setAddingModule(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              Add Module
            </button>
          )}
        </div>
      )}

      {/* ══ STUDENTS TAB ══ */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          {/* Enroll User Form */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              Enroll a User
            </h3>
            {enrollError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-red-600 text-sm mb-3">
                <AlertCircle className="h-4 w-4" />
                {enrollError}
              </div>
            )}
            {enrollSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-3 py-2 text-green-700 text-sm mb-3">
                <CheckCircle className="h-4 w-4" />
                {enrollSuccess}
              </div>
            )}
            <form onSubmit={handleEnroll} className="flex gap-3">
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="flex-1 border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">— Select a user to enroll —</option>
                {availableUsers.length === 0 && (
                  <option disabled>All active users are already enrolled</option>
                )}
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullname} ({u.email}) · {u.role}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!selectedUserId || enrolling}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Enroll
              </button>
            </form>
          </div>

          {/* Enrolled Students Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {course.enrolled_users.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No students enrolled yet.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Enrolled</th>
                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {course.enrolled_users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
                            {(user.fullname || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{user.fullname}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{user.department || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full max-w-[80px]">
                            <div
                              className={`h-2 rounded-full ${
                                user.progress >= 100
                                  ? 'bg-green-500'
                                  : user.progress > 0
                                  ? 'bg-blue-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${Math.min(user.progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{user.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.enrollment_status === 'Completed'
                            ? 'bg-green-100 text-green-800'
                            : user.enrollment_status === 'In Progress'
                            ? 'bg-blue-100 text-blue-700'
                            : user.enrollment_status === 'Dropped'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {user.enrollment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {user.enrolled_at
                          ? new Date(user.enrolled_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => handleUnlockModuleForUser(user.id)}
                            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded mr-2"
                            title="Unlock module for user"
                          >
                            <Unlock className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleUnenroll(user.id, user.fullname)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Remove from course"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}


      {/* Unlock modal for admin actions */}
      <UnlockModalRenderer
        course={course}
        open={unlockModalOpen}
        userId={unlockModalUserId}
        onConfirm={performUnlockModuleForUser}
        onCancel={() => { setUnlockModalOpen(false); setUnlockModalUserId(null); }}
      />

      <ConfirmModal
        open={confirmOpen}
        message={confirmMessage}
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
      />

    </div>
  );
}
