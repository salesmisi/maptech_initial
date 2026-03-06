import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Video,
  FileText,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Upload,
  GripVertical,
  File,
  X,
  Loader2,
  AlertCircle,
  Check,
  Eye,
} from 'lucide-react';

const API = '/api';

// ─── helpers ────────────────────────────────────────────────────────────

function getCookie(name: string) {
  const v = `; ${document.cookie}`;
  const parts = v.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  const xsrf = getCookie('XSRF-TOKEN');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
  };

  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...opts,
    headers: { ...headers, ...(opts.headers as Record<string, string>) },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed (${res.status})`);
  }

  return res.json();
}

// ─── types ──────────────────────────────────────────────────────────────

interface LessonData {
  id: number;
  title: string;
  type: 'Video' | 'Document' | 'Text';
  duration: string | null;
  status: 'Published' | 'Draft';
  file_size: string | null;
  content_path: string | null;
  text_content: string | null;
  content_url: string | null;
}

interface ModuleData {
  id: number;
  title: string;
  lessons: LessonData[];
  order: number;
}

interface CourseOption {
  id: string;
  title: string;
}

// ─── component ──────────────────────────────────────────────────────────

export function LessonVideoUpload() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [openModules, setOpenModules] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Module modal
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [addingModule, setAddingModule] = useState(false);

  // Edit Module
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');

  // Upload Content modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<'Video' | 'Document' | 'Text'>('Video');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadModuleId, setUploadModuleId] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'Published' | 'Draft'>('Draft');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadText, setUploadText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview modal
  const [previewLesson, setPreviewLesson] = useState<LessonData | null>(null);

  // ── fetch courses ──
  useEffect(() => {
    (async () => {
      try {
        let data: any[];
        try {
          data = await apiFetch('/admin/courses');
        } catch {
          data = await apiFetch('/instructor/courses');
        }
        const list = data.map((c: any) => ({ id: c.id, title: c.title }));
        setCourses(list);
        if (list.length > 0) {
          setSelectedCourseId(list[0].id);
        }
      } catch (e: any) {
        setError('Failed to load courses');
      }
    })();
  }, []);

  // ── fetch modules when course changes ──
  const fetchModules = useCallback(async () => {
    if (!selectedCourseId) return;
    setLoading(true);
    setError(null);
    try {
      const data: ModuleData[] = await apiFetch(`/courses/${selectedCourseId}/modules`);
      setModules(data);
      if (data.length > 0) {
        setOpenModules(new Set([data[0].id]));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // ── auto-dismiss success ──
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const toggleModule = (id: number) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── add module ──
  const handleAddModule = async () => {
    if (!newModuleTitle.trim() || !selectedCourseId) return;
    setAddingModule(true);
    try {
      const mod: ModuleData = await apiFetch(`/courses/${selectedCourseId}/modules`, {
        method: 'POST',
        body: JSON.stringify({ title: newModuleTitle.trim() }),
      });
      setModules((prev) => [...prev, mod]);
      setOpenModules((prev) => new Set(prev).add(mod.id));
      setNewModuleTitle('');
      setShowAddModule(false);
      setSuccessMsg('Module added successfully!');
    } catch (e: any) {
      setError(e.message || 'Failed to add module');
    } finally {
      setAddingModule(false);
    }
  };

  // ── edit module ──
  const handleEditModule = async (moduleId: number) => {
    if (!editModuleTitle.trim()) return;
    try {
      const updated: ModuleData = await apiFetch(`/modules/${moduleId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: editModuleTitle.trim() }),
      });
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, title: updated.title } : m))
      );
      setEditingModuleId(null);
      setSuccessMsg('Module updated!');
    } catch (e: any) {
      setError(e.message || 'Failed to update module');
    }
  };

  // ── delete module ──
  const handleDeleteModule = async (moduleId: number) => {
    if (!window.confirm('Delete this module and all its lessons?')) return;
    try {
      await apiFetch(`/modules/${moduleId}`, { method: 'DELETE' });
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
      setSuccessMsg('Module deleted');
    } catch (e: any) {
      setError(e.message || 'Failed to delete module');
    }
  };

  // ── upload content ──
  const handleUploadContent = async () => {
    if (!uploadTitle.trim() || uploadModuleId === null) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Ensure CSRF cookie is set before upload
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });

      const formData = new FormData();
      formData.append('title', uploadTitle.trim());
      formData.append('type', uploadType);
      formData.append('status', uploadStatus);

      if (uploadType === 'Text') {
        formData.append('text_content', uploadText);
      } else if (uploadFile) {
        formData.append('content', uploadFile);
      } else {
        setError('Please select a file to upload');
        setUploading(false);
        return;
      }

      // Use XMLHttpRequest for upload progress
      const lesson: LessonData = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API}/modules/${uploadModuleId}/lessons`);
        xhr.withCredentials = true;

        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        const xsrf = getCookie('XSRF-TOKEN');
        if (xsrf) {
          xhr.setRequestHeader('X-XSRF-TOKEN', decodeURIComponent(xsrf));
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            const err = JSON.parse(xhr.responseText || '{}');
            reject(new Error(err.message || `Upload failed (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      setModules((prev) =>
        prev.map((m) =>
          m.id === uploadModuleId
            ? { ...m, lessons: [...m.lessons, lesson] }
            : m
        )
      );

      resetUploadForm();
      setShowUpload(false);
      setSuccessMsg('Content uploaded successfully!');
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ── delete lesson ──
  const handleDeleteLesson = async (moduleId: number, lessonId: number) => {
    if (!window.confirm('Delete this lesson?')) return;
    try {
      await apiFetch(`/lessons/${lessonId}`, { method: 'DELETE' });
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
            : m
        )
      );
      setSuccessMsg('Lesson deleted');
    } catch (e: any) {
      setError(e.message || 'Failed to delete lesson');
    }
  };

  const resetUploadForm = () => {
    setUploadTitle('');
    setUploadType('Video');
    setUploadFile(null);
    setUploadText('');
    setUploadStatus('Draft');
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openUploadModal = () => {
    resetUploadForm();
    if (modules.length > 0) setUploadModuleId(modules[0].id);
    setShowUpload(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      setUploadFile(e.dataTransfer.files[0]);
    }
  };

  // ═════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lessons &amp; Video Upload</h1>
          <p className="text-sm text-slate-500 mt-1">Manage learning content for your courses</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setNewModuleTitle('');
              setShowAddModule(true);
            }}
            disabled={!selectedCourseId}
            className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Module
          </button>
          <button
            onClick={openUploadModal}
            disabled={modules.length === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Content
          </button>
        </div>
      </div>

      {/* Success / Error toasts */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg">
          <Check className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-lg">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Course Selector */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">Select Course</label>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md border"
        >
          {courses.length === 0 && <option value="">No courses available</option>}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-green-600 mr-2" />
          <span className="text-slate-500">Loading modules…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && modules.length === 0 && selectedCourseId && (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-sm font-semibold text-slate-900">No modules yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Get started by adding a module to this course.
          </p>
          <button
            onClick={() => {
              setNewModuleTitle('');
              setShowAddModule(true);
            }}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add First Module
          </button>
        </div>
      )}

      {/* Modules List */}
      {!loading && (
        <div className="space-y-4">
          {modules.map((module) => (
            <div
              key={module.id}
              className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm"
            >
              {/* Module Header */}
              <div
                className="bg-slate-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => toggleModule(module.id)}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <GripVertical className="h-4 w-4 text-slate-300 mr-2 shrink-0" />
                  {openModules.has(module.id) ? (
                    <ChevronDown className="h-5 w-5 text-slate-400 mr-2 shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400 mr-2 shrink-0" />
                  )}

                  {editingModuleId === module.id ? (
                    <div
                      className="flex items-center gap-2 flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={editModuleTitle}
                        onChange={(e) => setEditModuleTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditModule(module.id);
                          if (e.key === 'Escape') setEditingModuleId(null);
                        }}
                        className="text-sm font-medium text-slate-900 border border-green-400 rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <button
                        onClick={() => handleEditModule(module.id)}
                        className="text-green-600 hover:text-green-700 text-xs font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingModuleId(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-medium text-slate-900 truncate">
                        {module.title}
                      </h3>
                      <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700 shrink-0">
                        {module.lessons.length} Lesson{module.lessons.length !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </div>

                {editingModuleId !== module.id && (
                  <div className="flex space-x-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditingModuleId(module.id);
                        setEditModuleTitle(module.title);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      title="Edit module"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteModule(module.id)}
                      className="p-1 text-slate-400 hover:text-red-600"
                      title="Delete module"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Lessons List */}
              {openModules.has(module.id) && (
                <div className="border-t border-slate-200 divide-y divide-slate-100">
                  {module.lessons.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No lessons yet. Click "Upload Content" to add lessons to this module.
                    </div>
                  ) : (
                    module.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setPreviewLesson(lesson)}
                      >
                        <div className="flex items-center min-w-0">
                          <GripVertical className="h-4 w-4 text-slate-300 mr-3 shrink-0" />
                          <div
                            className={`p-2 rounded-lg mr-3 shrink-0 ${
                              lesson.type === 'Video'
                                ? 'bg-blue-100 text-blue-600'
                                : lesson.type === 'Document'
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {lesson.type === 'Video' && <Video className="h-4 w-4" />}
                            {lesson.type === 'Document' && <File className="h-4 w-4" />}
                            {lesson.type === 'Text' && <FileText className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {lesson.title}
                            </p>
                            <div className="flex items-center text-xs text-slate-500 mt-0.5 gap-2">
                              <span>{lesson.type}</span>
                              {lesson.duration && (
                                <>
                                  <span>•</span>
                                  <span>{lesson.duration}</span>
                                </>
                              )}
                              {lesson.file_size && (
                                <>
                                  <span>•</span>
                                  <span>{lesson.file_size}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 shrink-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              lesson.status === 'Published'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {lesson.status}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewLesson(lesson); }}
                            className="text-slate-400 hover:text-blue-600"
                            title="Preview lesson"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteLesson(module.id, lesson.id); }}
                            className="text-slate-400 hover:text-red-600"
                            title="Delete lesson"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════ ADD MODULE MODAL ═══════════════════ */}
      {showAddModule && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-500 opacity-75" onClick={() => setShowAddModule(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 z-10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Add New Module</h3>
                <button onClick={() => setShowAddModule(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Module Title</label>
                  <input
                    autoFocus
                    type="text"
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddModule();
                    }}
                    className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="e.g. Module 1: Introduction"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowAddModule(false)}
                    className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddModule}
                    disabled={!newModuleTitle.trim() || addingModule}
                    className="inline-flex items-center px-4 py-2 rounded-md border border-transparent text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {addingModule && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Module
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ UPLOAD CONTENT MODAL ═══════════════════ */}
      {showUpload && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-500 opacity-75" onClick={() => !uploading && setShowUpload(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 z-10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Upload Learning Content</h3>
                <button
                  onClick={() => !uploading && setShowUpload(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Lesson Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lesson Title</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="e.g. Introduction to Encryption"
                  />
                </div>

                {/* Target Module */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Module</label>
                  <select
                    value={uploadModuleId ?? ''}
                    onChange={(e) => setUploadModuleId(Number(e.target.value))}
                    className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  >
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Content Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Content Type</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Video', 'Document', 'Text'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setUploadType(type);
                          setUploadFile(null);
                          setUploadText('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className={`p-3 rounded-lg border-2 text-center transition-colors ${
                          uploadType === type
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {type === 'Video' && <Video className="h-5 w-5 mx-auto mb-1" />}
                        {type === 'Document' && <File className="h-5 w-5 mx-auto mb-1" />}
                        {type === 'Text' && <FileText className="h-5 w-5 mx-auto mb-1" />}
                        <span className="text-xs font-medium">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={uploadStatus}
                    onChange={(e) => setUploadStatus(e.target.value as 'Published' | 'Draft')}
                    className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                  </select>
                </div>

                {/* File upload or Text area */}
                {uploadType !== 'Text' ? (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors cursor-pointer"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept={
                        uploadType === 'Video'
                          ? 'video/mp4,video/webm,video/quicktime'
                          : '.pdf,.doc,.docx,.ppt,.pptx'
                      }
                      onChange={(e) => {
                        if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
                      }}
                    />
                    {uploadFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <Check className="h-5 w-5" />
                        <span className="text-sm font-medium">{uploadFile.name}</span>
                        <span className="text-xs text-slate-500">
                          ({(uploadFile.size / 1048576).toFixed(1)} MB)
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-12 w-12 text-slate-400" />
                        <p className="mt-1 text-sm text-slate-600">Click to upload or drag and drop</p>
                        <p className="text-xs text-slate-500">
                          {uploadType === 'Video'
                            ? 'MP4, WebM up to 500MB'
                            : 'PDF, DOCX, PPTX up to 50MB'}
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Lesson Content
                    </label>
                    <textarea
                      rows={6}
                      value={uploadText}
                      onChange={(e) => setUploadText(e.target.value)}
                      className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      placeholder="Write your lesson content here..."
                    />
                  </div>
                )}

                {/* Upload progress */}
                {uploading && uploadProgress > 0 && (
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => !uploading && setShowUpload(false)}
                    disabled={uploading}
                    className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUploadContent}
                    disabled={
                      uploading ||
                      !uploadTitle.trim() ||
                      uploadModuleId === null ||
                      (uploadType !== 'Text' && !uploadFile) ||
                      (uploadType === 'Text' && !uploadText.trim())
                    }
                    className="inline-flex items-center px-4 py-2 rounded-md border border-transparent text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading {uploadProgress}%
                      </>
                    ) : (
                      'Upload & Save'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ PREVIEW LESSON MODAL ═══════════════════ */}
      {previewLesson && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-500 opacity-75" onClick={() => setPreviewLesson(null)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full z-10 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-6 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{previewLesson.title}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      previewLesson.type === 'Video' ? 'bg-blue-100 text-blue-700' :
                      previewLesson.type === 'Document' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{previewLesson.type}</span>
                    {previewLesson.duration && <span className="text-xs text-slate-500">{previewLesson.duration}</span>}
                    {previewLesson.file_size && <span className="text-xs text-slate-500">{previewLesson.file_size}</span>}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      previewLesson.status === 'Published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>{previewLesson.status}</span>
                  </div>
                </div>
                <button onClick={() => setPreviewLesson(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                {previewLesson.type === 'Video' && previewLesson.content_url && (
                  <video
                    controls
                    className="w-full rounded-lg bg-black"
                    src={previewLesson.content_url}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                {previewLesson.type === 'Document' && previewLesson.content_url && (
                  <div className="space-y-4">
                    {previewLesson.content_url.match(/\.pdf$/i) ? (
                      <iframe
                        src={previewLesson.content_url}
                        className="w-full rounded-lg border border-slate-200"
                        style={{ height: '70vh' }}
                        title={previewLesson.title}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <File className="mx-auto h-16 w-16 text-slate-300 mb-4" />
                        <p className="text-sm text-slate-600 mb-4">{previewLesson.title}</p>
                        <a
                          href={previewLesson.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                        >
                          Download File
                        </a>
                      </div>
                    )}
                  </div>
                )}
                {previewLesson.type === 'Text' && (
                  <div className="prose prose-sm max-w-none bg-slate-50 rounded-lg p-6 border border-slate-200 whitespace-pre-wrap">
                    {previewLesson.text_content || 'No content available.'}
                  </div>
                )}
                {!previewLesson.content_url && previewLesson.type !== 'Text' && (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <p className="text-sm text-slate-500">No file uploaded for this lesson.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
