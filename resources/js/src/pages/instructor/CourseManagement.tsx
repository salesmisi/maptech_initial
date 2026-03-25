import React, { useState, useEffect } from 'react';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../components/ToastProvider';
import { createPortal } from 'react-dom';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  FileText,
  X,
  Trash,
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

interface ModuleInput {
  id: number;
  title: string;
  file: File | null;
}

interface Course {
  id: string;
  title: string;
  description: string;
  department: string;
  status: 'Active' | 'Draft' | 'Archived' | 'Inactive';
  start_date?: string | null;
  deadline?: string | null;
  modules: Array<{ id?: number; title: string; content_path?: string }>;
  // set by instructor action in UI to reflect immediate availability
  availableByInstructor?: boolean;
}

interface Props {
  onNavigate?: (page: string, courseId?: string) => void;
}

const DEPT_COLORS: Record<string, string> = {
  IT: 'bg-blue-500',
  HR: 'bg-purple-500',
  Operations: 'bg-green-500',
  Finance: 'bg-yellow-500',
  Marketing: 'bg-orange-500',
};

const STATUS_COLORS: Record<string, string> = {
  Active:   'bg-green-100 text-green-800',
  Draft:    'bg-yellow-100 text-yellow-800',
  Archived: 'bg-slate-100 text-slate-600',
  Inactive: 'bg-red-100 text-red-700',
};

let moduleCounter = 0;

export function InstructorCourseManagement({ onNavigate }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { pushToast } = useToast();
  // Course unlock modal state
  const [courseUnlockModalOpen, setCourseUnlockModalOpen] = useState(false);
  const [courseUnlockTargetId, setCourseUnlockTargetId] = useState<string | null>(null);
  const [unlockDurationMinutes, setUnlockDurationMinutes] = useState<number>(1440);
  const [unlockPermanent, setUnlockPermanent] = useState<boolean>(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const loadCourses = async () => {
    try {
      const res = await fetch(`${API_BASE}/instructor/courses`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load courses');
      const data = await res.json();
      setCourses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCourseUnlockModal = (courseId: string) => {
    setCourseUnlockTargetId(courseId);
    setUnlockDurationMinutes(1440);
    setUnlockPermanent(false);
    setUnlockError(null);
    setCourseUnlockModalOpen(true);
  };

  const confirm = useConfirm();
  const { showConfirm } = confirm;

  useEffect(() => { loadCourses(); }, []);

  // Refresh courses list when a module is added in the CourseDetail page
  useEffect(() => {
    const handler = (e: any) => {
      // e.detail.courseId may be present; reload to update modules count
      try {
        loadCourses();
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('module:added', handler as EventListener);
    return () => window.removeEventListener('module:added', handler as EventListener);
  }, []);

  const openCreate = () => {
    setEditingCourse(null);
    setModules([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setModules([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingCourse(null);
    setModules([]);
    setFormError(null);
  };

  const addModule = () => {
    setModules((prev) => [...prev, { id: ++moduleCounter, title: '', file: null }]);
  };

  const updateModuleTitle = (id: number, title: string) =>
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, title } : m)));

  const updateModuleFile = (id: number, file: File | null) =>
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, file } : m)));

  const removeModule = (id: number) =>
    setModules((prev) => prev.filter((m) => m.id !== id));

  const handleDelete = async (id: string) => {
    showConfirm('Delete this course? This cannot be undone.', async () => {
      try {
        const token = await getXsrfToken();
        await fetch(`${API_BASE}/instructor/courses/${id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        });
        setCourses((prev) => prev.filter((c) => c.id !== id));
      } catch (e) {
        console.error(e);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);

    modules.forEach((mod, idx) => {
      formData.append(`modules[${idx}][title]`, mod.title);
      if (mod.file) formData.append(`modules[${idx}][content]`, mod.file);
    });

    try {
      const token = await getXsrfToken();
      const url = editingCourse
        ? `${API_BASE}/instructor/courses/${editingCourse.id}`
        : `${API_BASE}/instructor/courses`;

      if (editingCourse) formData.append('_method', 'PUT');

      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save course');

      // Update courses list optimistically from the server response so the
      // newly created/updated course appears immediately without waiting
      // for a full reload.
      const returned = data.course ?? data;
      if (editingCourse) {
        setCourses((prev) => prev.map((c) => (String(c.id) === String(returned.id) ? { ...c, ...returned } : c)));
        pushToast('Course updated', `"${returned.title}" updated successfully.`, 'updated');
      } else {
        setCourses((prev) => [returned, ...prev]);
        pushToast('Course created', `"${returned.title}" created successfully.`, 'created');
      }

      handleCloseModal();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockCourse = async (courseId: string, durationMinutes?: number | null) => {
    showConfirm('Unlock this course for enrolled users?', async () => {
    try {
      setUnlockError(null);
      setUnlocking(true);
      const token = await getXsrfToken();
      // fetch course details to get enrolled users
      const res = await fetch(`${API_BASE}/instructor/courses/${courseId}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load course enrollments');
      const course = await res.json();
      const users = course.enrolledUsers || [];

      // Unlock modules per department for enrolled users (handles mixed departments)
      try {
        const depts = Array.from(new Set((users.map((u: any) => u.department || null).filter(Boolean))));
        // if no per-user departments, fallback to course.department
        if (depts.length === 0 && course.department) depts.push(course.department);
        for (const dept of depts) {
          try {
            const deptOpts: any = {
              method: 'POST',
              credentials: 'include',
              headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token, 'Content-Type': 'application/json' },
              body: JSON.stringify({ department: dept }),
            };
            if (durationMinutes && !isNaN(durationMinutes)) {
              deptOpts.body = JSON.stringify({ department: dept, duration_minutes: Number(durationMinutes) });
            }
            await fetch(`${API_BASE}/instructor/courses/${courseId}/unlock-department-all`, deptOpts);
          } catch (err) {
            console.warn('unlock-department-all failed for', dept, err);
          }
        }
      } catch (err) {
        console.warn('unlock-department-all grouping failed', err);
      }

      for (const u of users) {
        try {
          const opts: any = {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
          };
          if (durationMinutes && !isNaN(durationMinutes)) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify({ duration_minutes: Number(durationMinutes) });
          }
          const r = await fetch(`${API_BASE}/instructor/courses/${courseId}/enrollments/${u.id}/unlock`, opts);
          if (!r.ok) {
            const text = await r.text();
            console.error(`Unlock failed for ${u.id}: ${r.status} ${text}`);
          }
        } catch (e) {
          console.error('Failed to unlock', u.id, e);
        }
      }

      // optimistically mark course as available in the UI so the card updates immediately
      setCourses(prev => prev.map(c => (String(c.id) === String(courseId) ? { ...c, availableByInstructor: true } : c)));
      // notify other open tabs/pages in the same browser to refresh the course
      try { window.dispatchEvent(new CustomEvent('course:unlocked', { detail: { courseId } })); } catch (e) { /* ignore */ }
      pushToast('Course unlocked', 'Course unlocked for enrolled users (where possible).', 'success', 6000);
      setCourseUnlockModalOpen(false);
      setCourseUnlockTargetId(null);
      setUnlockDurationMinutes(1440);
      setUnlockPermanent(false);
      await loadCourses();
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || 'Failed to unlock course enrollments.';
      setUnlockError(msg);
      pushToast('Unlock failed', msg, 'error', 7000);
    } finally {
      setUnlocking(false);
    }
    });
  };

  const filtered = courses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Courses &amp; Content</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Course
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Draft">Draft</option>
          <option value="Archived">Archived</option>
        </select>
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">No courses found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course) => {
            const notStarted = course.start_date && new Date(course.start_date) > new Date();
            const hasManualUnlock = (course as any).has_manual_unlock ?? false;
            const ended = course.deadline && new Date(course.deadline) <= new Date() && !hasManualUnlock;
            const modulesCount = course.modules?.length ?? 0;
            const hasAnyModule = modulesCount > 0;
            const showNotAvailable = !notStarted && !ended && course.status === 'Active' && !hasAnyModule;
            return (
            <div key={course.id} className={`rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow flex flex-col ${notStarted ? 'bg-gray-200 border-gray-300' : ended ? 'bg-white border-red-200' : 'bg-white border-slate-200'}`}>
              <div className={`h-32 ${notStarted ? 'bg-gray-400' : DEPT_COLORS[course.department] || 'bg-slate-500'} relative flex items-center justify-center`}>
                <BookOpen className="h-10 w-10 text-white opacity-60" />
                <span className={`absolute top-3 left-3 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  notStarted
                    ? 'bg-gray-100 text-gray-600'
                    : ended
                      ? 'bg-red-100 text-red-800'
                      : showNotAvailable
                        ? 'bg-gray-100 text-gray-700'
                        : STATUS_COLORS[course.status] || 'bg-slate-100 text-slate-600'
                }`}>
                  {notStarted ? 'Not Started' : ended ? 'Locked' : showNotAvailable ? 'Not available' : course.status}
                </span>
                <div className="absolute top-3 right-3 flex gap-1">
                  <button
                    onClick={() => openEdit(course)}
                    className="p-1.5 bg-white/80 hover:bg-white rounded text-slate-600"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(course.id)}
                    className="p-1.5 bg-white/80 hover:bg-red-50 rounded text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-base font-bold text-slate-900 line-clamp-1 mb-1">{course.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-3">{course.description}</p>

                <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {course.modules?.length ?? 0} Modules
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {(course as any).enrollments_count ?? 0} Enrolled
                  </div>
                </div>
                <div className="mb-4">
                  <span className="text-xs font-medium text-slate-400">{course.department}</span>
                </div>

                {course.deadline && !ended && (
                  <p className="text-xs text-red-500 mb-3">
                    End Date: {new Date(course.deadline).toLocaleDateString()}
                  </p>
                )}
                {notStarted && course.start_date && (
                  <p className="text-xs text-gray-500 mb-3">
                    Course has not started yet — Starts on: {new Date(course.start_date).toLocaleDateString()} {new Date(course.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {ended && (
                  <p className="text-xs text-red-500 font-medium mb-3">Course has ended and is locked</p>
                )}

                <div className="mt-auto pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onNavigate?.('course-detail', String(course.id))}
                      className="text-sm font-medium text-green-600 hover:text-green-700"
                    >
                      Manage Content &rarr;
                    </button>
                    {ended && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onNavigate?.('course-detail', String(course.id))}
                          className="text-sm px-3 py-1 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                        >
                          Manage Enrollments
                        </button>
                        <button
                          onClick={() => openCourseUnlockModal(String(course.id))}
                          className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Unlock
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingCourse ? 'Edit Course' : 'Create New Course'}
              </h3>
              <button type="button" onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  name="title"
                  defaultValue={editingCourse?.title}
                  required
                  className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  name="description"
                  defaultValue={editingCourse?.description || 'Self Pace'}
                  className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <select
                    name="department"
                    defaultValue={editingCourse?.department || 'IT'}
                    required
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingCourse?.status || 'Active'}
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date <span className="text-slate-400 text-xs">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="start_date"
                    defaultValue={editingCourse?.start_date ? new Date(editingCourse.start_date).toISOString().slice(0, 16) : ''}
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date <span className="text-slate-400 text-xs">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="deadline"
                    defaultValue={editingCourse?.deadline ? new Date(editingCourse.deadline).toISOString().slice(0, 16) : ''}
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Course Logo <span className="text-slate-400 text-xs">(for certificate)</span>
                </label>
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  className="w-full text-sm text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                <p className="mt-1 text-xs text-slate-400">This logo will appear on certificates issued for this course.</p>
              </div>

              {/* Module Upload Section */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-slate-700">Add Modules / Content</h4>
                  <button
                    type="button"
                    onClick={addModule}
                    className="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Module
                  </button>
                </div>

                {modules.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No modules added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {modules.map((mod, idx) => (
                      <div key={mod.id} className="p-3 bg-slate-50 rounded-md border border-slate-200">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              placeholder={`Module ${idx + 1} Title`}
                              value={mod.title}
                              onChange={(e) => updateModuleTitle(mod.id, e.target.value)}
                              className="w-full border border-slate-300 rounded-md py-1.5 px-2 text-sm focus:ring-green-500 focus:border-green-500"
                            />
                            <input
                              type="file"
                              accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                              onChange={(e) => updateModuleFile(mod.id, e.target.files?.[0] || null)}
                              className="w-full text-sm text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-green-50 file:text-green-700"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeModule(mod.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-4 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Course'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
        {courseUnlockModalOpen && createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) { setCourseUnlockModalOpen(false); setCourseUnlockTargetId(null); } }}
          >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-3">Unlock Course</h3>
              <p className="text-sm text-slate-600 mb-3">Set a temporary unlock duration (minutes) or make it permanent.</p>
              {unlockError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2 mb-3">{unlockError}</div>}
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  value={unlockDurationMinutes}
                  onChange={(e) => setUnlockDurationMinutes(Number(e.target.value))}
                  disabled={unlockPermanent}
                  className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">Leave as 1440 for 24 hours.</p>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input id="perm" type="checkbox" checked={unlockPermanent} onChange={(e) => setUnlockPermanent(e.target.checked)} className="h-4 w-4" />
                <label htmlFor="perm" className="text-sm text-slate-700">Permanent unlock</label>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setCourseUnlockModalOpen(false); setCourseUnlockTargetId(null); }} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button
                  onClick={() => {
                    if (!courseUnlockTargetId) return;
                    const dur = unlockPermanent ? null : unlockDurationMinutes;
                    handleUnlockCourse(courseUnlockTargetId, dur ?? null);
                  }}
                  disabled={unlocking}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm"
                >
                  {unlocking ? 'Unlocking...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        {confirm.ConfirmModalRenderer()}
    </div>
  );
}
