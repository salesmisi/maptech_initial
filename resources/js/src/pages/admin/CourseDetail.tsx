import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
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
  question_count: number;
  created_at: string;
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
  const [moduleFile, setModuleFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleSuccess, setModuleSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enrollment state
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

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
      if (res.ok) setQuizzes(await res.json());
    } catch (_) {
      // non-critical
    } finally {
      setQuizzesLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!newQuizTitle.trim()) { setQuizError('Quiz title is required.'); return; }
    setSavingQuiz(true);
    setQuizError(null);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/admin/courses/${courseId}/quizzes`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ title: newQuizTitle.trim(), description: newQuizDesc.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create quiz.');
      setCreatingQuiz(false);
      setNewQuizTitle('');
      setNewQuizDesc('');
      if (onManageQuiz) onManageQuiz(data.id, courseId);
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
      if (moduleFile) fd.append('content', moduleFile);

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
      setModuleFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handleDeleteModule = async (moduleId: number) => {
    if (!confirm('Delete this module?')) return;
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
    }
  };

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

  const handleUnenroll = async (userId: number, name: string) => {
    if (!confirm(`Remove ${name} from this course?`)) return;
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

          {/* Module list */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {course.modules.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No modules yet. Add the first one below.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">File</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {course.modules.map((mod, idx) => (
                    <tr key={mod.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-500">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{mod.title}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {mod.content_url ? (
                          <a
                            href={mod.content_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-green-600 hover:text-green-700 hover:underline flex items-center gap-1"
                          >
                            {fileTypeIcon(mod.file_type)}
                            View file
                          </a>
                        ) : (
                          <span className="italic text-slate-400">No file</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {mod.file_type ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 capitalize">
                            {mod.file_type}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteModule(mod.id)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete module"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

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
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Content File <span className="text-slate-400 text-xs">(optional — video, PDF, document)</span></label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx"
                    onChange={e => setModuleFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                  {moduleFile && (
                    <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                      <Upload className="h-3 w-3" />
                      {moduleFile.name} ({(moduleFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setAddingModule(false); setModuleTitle(''); setModuleFile(null); setModuleError(null); }}
                    className="flex-1 py-2 px-4 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 py-2 px-4 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> Add Module</>}
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
                              className="h-2 bg-green-500 rounded-full"
                              style={{ width: `${user.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{user.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.enrollment_status === 'Completed'
                            ? 'bg-green-100 text-green-800'
                            : user.enrollment_status === 'Dropped'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
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
                        <button
                          onClick={() => handleUnenroll(user.id, user.fullname)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Remove from course"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ QUIZZES PANEL ══ */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              Quizzes
              <span className="ml-2 text-xs font-normal text-slate-400">({quizzes.length})</span>
            </h3>
          </div>
          <button
            onClick={() => { setCreatingQuiz(true); setQuizError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            Quiz
          </button>
        </div>

        {/* Create quiz inline form */}
        {creatingQuiz && (
          <div className="mx-6 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 mb-2">
            <h4 className="text-sm font-medium text-slate-700 mb-3">New Quiz</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Quiz title (e.g. Module 1 Assessment)"
                value={newQuizTitle}
                onChange={e => setNewQuizTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <textarea
                rows={2}
                placeholder="Description (optional)"
                value={newQuizDesc}
                onChange={e => setNewQuizDesc(e.target.value)}
                className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
              />
              {quizError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />{quizError}
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
                >Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz list */}
        {quizzesLoading ? (
          <div className="px-6 py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : quizzes.length === 0 && !creatingQuiz ? (
          <div className="p-8 text-center text-slate-500">
            <HelpCircle className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No quizzes yet. Click <strong>+ Quiz</strong> to create one.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quiz</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Questions</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {quizzes.map(quiz => (
                <tr key={quiz.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <HelpCircle className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{quiz.title}</p>
                        {quiz.description && <p className="text-xs text-slate-500">{quiz.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
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
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                      title="Delete quiz"
                    >
                      {deletingQuizId === quiz.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
