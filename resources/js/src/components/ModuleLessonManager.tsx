import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  FileText,
  Video,
  File,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  GripVertical,
  BookOpen,
  Layers,
  FolderOpen,
} from 'lucide-react';
import { RichTextEditor, sanitizeHtml, RICH_CONTENT_STYLES } from './RichTextEditor';
import useConfirm from '../hooks/useConfirm';

const API_BASE = '/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Lesson {
  id: number;
  title: string;
  text_content: string | null;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  order: number;
}

export interface Module {
  id: number;
  title: string;
  description: string | null;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  lessons: Lesson[];
  order: number;
  created_at: string;
}

interface ModuleLessonManagerProps {
  courseId: string;
  modules: Module[];
  onModulesChange: (modules: Module[]) => void;
  onRefresh: () => Promise<void>;
  readOnly?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const getXsrfToken = async (): Promise<string> => {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
};

const fileTypeIcon = (fileType: string | null) => {
  if (fileType === 'video') return <Video className="h-4 w-4 text-blue-500" />;
  if (fileType === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (fileType === 'document') return <FileText className="h-4 w-4 text-slate-500" />;
  return <File className="h-4 w-4 text-slate-400" />;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModuleLessonManager({
  courseId,
  modules,
  onModulesChange,
  onRefresh,
  readOnly = false,
}: ModuleLessonManagerProps) {
  const { showConfirm, ConfirmModalRenderer } = useConfirm();

  // Module state
  const [addingModule, setAddingModule] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleSuccess, setModuleSuccess] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [deletingModuleId, setDeletingModuleId] = useState<number | null>(null);

  // Edit module state
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');
  const [editModuleDescription, setEditModuleDescription] = useState('');
  const [savingModule, setSavingModule] = useState(false);

  // Lesson state
  const [addingLessonForModule, setAddingLessonForModule] = useState<number | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [lessonTextContent, setLessonTextContent] = useState('');
  const [uploadingLesson, setUploadingLesson] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const lessonFileRef = useRef<HTMLInputElement>(null);

  // Edit lesson state
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonTextContent, setEditLessonTextContent] = useState('');
  const [editLessonFile, setEditLessonFile] = useState<File | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const editLessonFileRef = useRef<HTMLInputElement>(null);

  // Module drag-and-drop
  const [moduleDragIdx, setModuleDragIdx] = useState<number | null>(null);
  const [moduleDragOverIdx, setModuleDragOverIdx] = useState<number | null>(null);

  // Lesson drag-and-drop (keyed by module id)
  const [lessonDragIdx, setLessonDragIdx] = useState<{ moduleId: number; idx: number } | null>(null);
  const [lessonDragOverIdx, setLessonDragOverIdx] = useState<{ moduleId: number; idx: number } | null>(null);

  // Auto-expand newly created modules
  const prevModulesRef = useRef<Module[]>(modules);
  useEffect(() => {
    if (modules.length > prevModulesRef.current.length) {
      const existingIds = new Set(prevModulesRef.current.map(m => m.id));
      const newModule = modules.find(m => !existingIds.has(m.id));
      if (newModule) {
        setExpandedModules(prev => new Set([...prev, newModule.id]));
      }
    }
    prevModulesRef.current = modules;
  }, [modules]);

  // ─── MODULE HANDLERS ────────────────────────────────────────────────────────

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
      if (moduleDescription.trim()) {
        fd.append('description', moduleDescription.trim());
      }

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
      setModuleDescription('');
      setModuleSuccess('Module added successfully');
      setAddingModule(false);
      await onRefresh();
      setTimeout(() => setModuleSuccess(null), 3000);
    } catch (e: any) {
      setModuleError(e.message || 'Failed to add module');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteModule = (moduleId: number) => {
    showConfirm(
      'Delete this module and all its lessons?',
      async () => {
        setDeletingModuleId(moduleId);
        try {
          const xsrf = await getXsrfToken();
          const res = await fetch(`${API_BASE}/admin/courses/${courseId}/modules/${moduleId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
          });
          if (!res.ok) throw new Error('Failed to delete module');
          await onRefresh();
        } catch (e: any) {
          alert(e.message || 'Failed to delete module');
        } finally {
          setDeletingModuleId(null);
        }
      },
      {
        title: 'Delete Module',
        confirmText: 'Delete',
        variant: 'danger',
      }
    );
  };

  const startEditModule = (mod: Module) => {
    setEditingModuleId(mod.id);
    setEditModuleTitle(mod.title);
    setEditModuleDescription(mod.description || '');
  };

  const cancelEditModule = () => {
    setEditingModuleId(null);
    setEditModuleTitle('');
    setEditModuleDescription('');
  };

  const handleSaveModule = async (moduleId: number) => {
    if (!editModuleTitle.trim()) return;
    setSavingModule(true);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/admin/courses/${courseId}/modules/${moduleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ title: editModuleTitle.trim(), description: editModuleDescription.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update module');
      cancelEditModule();
      await onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingModule(false);
    }
  };

  // ─── MODULE DRAG & DROP ─────────────────────────────────────────────────────

  const handleModuleDragStart = useCallback((idx: number) => setModuleDragIdx(idx), []);
  const handleModuleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setModuleDragOverIdx(idx);
  }, []);
  const handleModuleDragEnd = useCallback(() => {
    setModuleDragIdx(null);
    setModuleDragOverIdx(null);
  }, []);

  const handleModuleDrop = useCallback(async (targetIdx: number) => {
    if (moduleDragIdx === null || moduleDragIdx === targetIdx) {
      handleModuleDragEnd();
      return;
    }
    const mods = [...modules];
    const [moved] = mods.splice(moduleDragIdx, 1);
    mods.splice(targetIdx, 0, moved);
    onModulesChange(mods);
    handleModuleDragEnd();
    try {
      const xsrf = await getXsrfToken();
      await fetch(`${API_BASE}/admin/courses/${courseId}/modules/reorder`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ order: mods.map(m => m.id) }),
      });
    } catch {
      await onRefresh();
    }
  }, [moduleDragIdx, modules, courseId, onModulesChange, onRefresh]);

  // ─── LESSON HANDLERS ────────────────────────────────────────────────────────

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
      await onRefresh();
    } catch (e: any) {
      setLessonError(e.message || 'Failed to add lesson');
    } finally {
      setUploadingLesson(false);
    }
  };

  const handleDeleteLesson = (moduleId: number, lessonId: number) => {
    showConfirm(
      'Delete this lesson?',
      async () => {
        try {
          const xsrf = await getXsrfToken();
          const res = await fetch(`${API_BASE}/admin/modules/${moduleId}/lessons/${lessonId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
          });
          if (!res.ok) throw new Error('Failed to delete lesson');
          await onRefresh();
        } catch (e: any) {
          alert(e.message || 'Failed to delete lesson');
        }
      },
      {
        title: 'Delete Lesson',
        confirmText: 'Delete',
        variant: 'danger',
      }
    );
  };

  const startEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setEditLessonTitle(lesson.title);
    setEditLessonTextContent(lesson.text_content || '');
    setEditLessonFile(null);
  };

  const cancelEditLesson = () => {
    setEditingLessonId(null);
    setEditLessonTitle('');
    setEditLessonTextContent('');
    setEditLessonFile(null);
  };

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
      await onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingLesson(false);
    }
  };

  // ─── LESSON DRAG & DROP ─────────────────────────────────────────────────────

  const handleLessonDragStart = useCallback((moduleId: number, idx: number) => {
    setLessonDragIdx({ moduleId, idx });
  }, []);

  const handleLessonDragOver = useCallback((e: React.DragEvent, moduleId: number, idx: number) => {
    e.preventDefault();
    setLessonDragOverIdx({ moduleId, idx });
  }, []);

  const handleLessonDragEnd = useCallback(() => {
    setLessonDragIdx(null);
    setLessonDragOverIdx(null);
  }, []);

  const handleLessonDrop = useCallback(async (moduleId: number, targetIdx: number) => {
    if (!lessonDragIdx || lessonDragIdx.moduleId !== moduleId || lessonDragIdx.idx === targetIdx) {
      handleLessonDragEnd();
      return;
    }

    const mod = modules.find(m => m.id === moduleId);
    if (!mod) {
      handleLessonDragEnd();
      return;
    }

    const lessons = [...mod.lessons];
    const [moved] = lessons.splice(lessonDragIdx.idx, 1);
    lessons.splice(targetIdx, 0, moved);

    // Update local state optimistically
    const updatedModules = modules.map(m =>
      m.id === moduleId ? { ...m, lessons } : m
    );
    onModulesChange(updatedModules);
    handleLessonDragEnd();

    // Persist to server
    try {
      const xsrf = await getXsrfToken();
      await fetch(`${API_BASE}/admin/modules/${moduleId}/lessons/reorder`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ order: lessons.map(l => l.id) }),
      });
    } catch {
      await onRefresh();
    }
  }, [lessonDragIdx, modules, onModulesChange, onRefresh]);

  // ─── TOGGLE MODULE EXPANSION ────────────────────────────────────────────────

  const toggleModuleExpansion = (moduleId: number) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Course Content</h3>
            <p className="text-xs text-slate-500">
              {modules.length} module{modules.length !== 1 ? 's' : ''} · {modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0)} lessons
            </p>
          </div>
        </div>
        {!readOnly && !addingModule && (
          <button
            onClick={() => setAddingModule(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Module
          </button>
        )}
      </div>

      {/* Success Message */}
      {moduleSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
          <CheckCircle className="h-4 w-4" />
          {moduleSuccess}
        </div>
      )}

      {/* Add Module Form */}
      {addingModule && !readOnly && (
        <div className="bg-white rounded-xl border-2 border-dashed border-green-300 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-green-600" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">Add New Module</h4>
          </div>
          <form onSubmit={handleAddModule} className="space-y-4">
            {moduleError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {moduleError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Module Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={moduleTitle}
                onChange={e => setModuleTitle(e.target.value)}
                placeholder="e.g. Introduction to the Course"
                className="w-full border border-slate-300 rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-shadow"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                value={moduleDescription}
                onChange={e => setModuleDescription(e.target.value)}
                placeholder="Brief description of what this module covers..."
                rows={2}
                className="w-full border border-slate-300 rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-shadow resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setAddingModule(false);
                  setModuleTitle('');
                  setModuleDescription('');
                  setModuleError(null);
                }}
                className="flex-1 py-2.5 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="flex-1 py-2.5 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Create Module
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modules List */}
      {modules.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No modules yet</p>
          <p className="text-sm text-slate-400 mt-1">
            {readOnly ? 'This course has no content.' : 'Click "Add Module" to start building your course content.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, idx) => {
            const isExpanded = expandedModules.has(mod.id);
            const isEditingMod = editingModuleId === mod.id;

            return (
              <div
                key={mod.id}
                draggable={!readOnly && !isExpanded && !isEditingMod}
                onDragStart={() => handleModuleDragStart(idx)}
                onDragOver={e => handleModuleDragOver(e, idx)}
                onDragEnd={handleModuleDragEnd}
                onDrop={() => handleModuleDrop(idx)}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-200 ${
                  moduleDragOverIdx === idx ? 'border-green-400 ring-2 ring-green-100' : 'border-slate-200'
                } ${moduleDragIdx === idx ? 'opacity-50' : ''}`}
              >
                {/* Module Header */}
                <div
                  className={`flex items-center gap-3 px-5 py-4 ${!isEditingMod ? 'cursor-pointer hover:bg-slate-50' : ''} transition-colors`}
                  onClick={() => !isEditingMod && toggleModuleExpansion(mod.id)}
                >
                  {!readOnly && (
                    <div
                      className="flex-shrink-0 cursor-grab text-slate-300 hover:text-slate-500 transition-colors"
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                  )}

                  <span className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 text-green-700 flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    {isEditingMod ? (
                      <div className="space-y-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editModuleTitle}
                          onChange={e => setEditModuleTitle(e.target.value)}
                          className="w-full border border-green-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveModule(mod.id);
                            if (e.key === 'Escape') cancelEditModule();
                          }}
                        />
                        <textarea
                          value={editModuleDescription}
                          onChange={e => setEditModuleDescription(e.target.value)}
                          placeholder="Module description (optional)"
                          rows={2}
                          className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveModule(mod.id)}
                            disabled={savingModule}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1 transition-colors"
                          >
                            {savingModule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            {savingModule ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditModule}
                            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 text-xs font-medium rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-900">{mod.title}</p>
                        {mod.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{mod.description}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          {mod.lessons?.length || 0} lesson{(mod.lessons?.length || 0) !== 1 ? 's' : ''}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Action buttons */}
                  {!isEditingMod && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}

                      {!readOnly && (
                        <>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              startEditModule(mod);
                            }}
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit module"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteModule(mod.id);
                            }}
                            disabled={deletingModuleId === mod.id}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40 transition-colors"
                            title="Delete module"
                          >
                            {deletingModuleId === mod.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded Content: Lessons */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lessons</p>
                        {!readOnly && addingLessonForModule !== mod.id && (
                          <button
                            onClick={() => {
                              setAddingLessonForModule(mod.id);
                              setLessonTitle('');
                              setLessonTextContent('');
                              setLessonFile(null);
                              setLessonError(null);
                            }}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Lesson
                          </button>
                        )}
                      </div>

                      {/* Lessons List */}
                      {(mod.lessons?.length || 0) === 0 && addingLessonForModule !== mod.id ? (
                        <p className="text-xs text-slate-400 italic py-4 text-center">
                          No lessons in this module yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {mod.lessons?.map((lesson, li) => {
                            const isEditingThisLesson = editingLessonId === lesson.id;

                            return (
                              <div
                                key={lesson.id}
                                draggable={!readOnly && !isEditingThisLesson}
                                onDragStart={() => handleLessonDragStart(mod.id, li)}
                                onDragOver={e => handleLessonDragOver(e, mod.id, li)}
                                onDragEnd={handleLessonDragEnd}
                                onDrop={() => handleLessonDrop(mod.id, li)}
                                className={`rounded-lg border bg-white overflow-hidden transition-all ${
                                  lessonDragOverIdx?.moduleId === mod.id && lessonDragOverIdx.idx === li
                                    ? 'border-green-400 ring-2 ring-green-100'
                                    : 'border-slate-200'
                                } ${
                                  lessonDragIdx?.moduleId === mod.id && lessonDragIdx.idx === li
                                    ? 'opacity-50'
                                    : ''
                                }`}
                              >
                                {isEditingThisLesson ? (
                                  /* Edit Lesson Form */
                                  <div className="p-4 space-y-3 bg-amber-50">
                                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Edit Lesson</p>
                                    <input
                                      type="text"
                                      value={editLessonTitle}
                                      onChange={e => setEditLessonTitle(e.target.value)}
                                      className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                      placeholder="Lesson title"
                                    />
                                    <RichTextEditor
                                      value={editLessonTextContent}
                                      onChange={setEditLessonTextContent}
                                      placeholder="Lesson content..."
                                      minHeight="120px"
                                    />
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-white text-xs text-slate-600 transition-colors">
                                        <Upload className="h-3.5 w-3.5" />
                                        {editLessonFile ? editLessonFile.name : 'Replace file (optional)'}
                                        <input
                                          ref={editLessonFileRef}
                                          type="file"
                                          accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                                          className="sr-only"
                                          onChange={e => setEditLessonFile(e.target.files?.[0] || null)}
                                        />
                                      </label>
                                      {editLessonFile && (
                                        <button
                                          onClick={() => {
                                            setEditLessonFile(null);
                                            if (editLessonFileRef.current) editLessonFileRef.current.value = '';
                                          }}
                                          className="text-xs text-red-500 hover:text-red-700"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleSaveLesson(mod.id, lesson.id)}
                                        disabled={savingLesson}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                                      >
                                        {savingLesson ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                        {savingLesson ? 'Saving...' : 'Save Changes'}
                                      </button>
                                      <button
                                        onClick={cancelEditLesson}
                                        className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-medium rounded-lg hover:bg-white transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* Display Lesson */
                                  <>
                                    <div className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50 transition-colors">
                                      {!readOnly && (
                                        <div className="flex-shrink-0 cursor-grab text-slate-300 hover:text-slate-500 transition-colors">
                                          <GripVertical className="h-3.5 w-3.5" />
                                        </div>
                                      )}
                                      <span className="text-xs text-slate-400 font-medium w-5 flex-shrink-0">{li + 1}.</span>
                                      {fileTypeIcon(lesson.file_type)}
                                      <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                                        {lesson.title}
                                      </span>
                                      {lesson.content_url && (
                                        <a
                                          href={lesson.content_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs text-green-600 hover:text-green-800 hover:underline flex-shrink-0"
                                        >
                                          View file
                                        </a>
                                      )}
                                      {!readOnly && (
                                        <>
                                          <button
                                            onClick={() => startEditLesson(lesson)}
                                            className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg flex-shrink-0 transition-colors"
                                            title="Edit lesson"
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteLesson(mod.id, lesson.id)}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0 transition-colors"
                                            title="Delete lesson"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    {lesson.text_content && (
                                      <div className="px-4 pb-3 pt-1 border-t border-slate-100">
                                        <div
                                          className={RICH_CONTENT_STYLES}
                                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.text_content) }}
                                        />
                                      </div>
                                    )}
                                    {lesson.content_url && lesson.file_type === 'video' && (
                                      <div className="px-4 pb-3 pt-1 border-t border-slate-100">
                                        <video controls className="w-full max-h-64 rounded-lg bg-black">
                                          <source src={lesson.content_url} />
                                        </video>
                                      </div>
                                    )}
                                    {lesson.content_url && lesson.file_type === 'pdf' && (
                                      <div className="px-4 pb-3 pt-1 border-t border-slate-100">
                                        <iframe
                                          src={lesson.content_url}
                                          className="w-full h-72 rounded-lg border border-slate-200"
                                          title={lesson.title}
                                        />
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add Lesson Form */}
                      {addingLessonForModule === mod.id && !readOnly && (
                        <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-xl space-y-3">
                          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Add New Lesson</p>
                          {lessonError && (
                            <div className="flex items-center gap-2 text-xs text-red-600">
                              <AlertCircle className="h-3 w-3" />
                              {lessonError}
                            </div>
                          )}
                          <input
                            type="text"
                            placeholder="Lesson title *"
                            value={lessonTitle}
                            onChange={e => setLessonTitle(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            autoFocus
                          />
                          <RichTextEditor
                            value={lessonTextContent}
                            onChange={setLessonTextContent}
                            placeholder="Type the lesson content here..."
                            minHeight="120px"
                          />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-white text-xs text-slate-600 transition-colors">
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
                                onClick={() => {
                                  setLessonFile(null);
                                  if (lessonFileRef.current) lessonFileRef.current.value = '';
                                }}
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
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                            >
                              {uploadingLesson ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              {uploadingLesson ? 'Saving...' : 'Save Lesson'}
                            </button>
                            <button
                              onClick={() => {
                                setAddingLessonForModule(null);
                                setLessonTitle('');
                                setLessonTextContent('');
                                setLessonFile(null);
                                setLessonError(null);
                              }}
                              className="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-medium rounded-lg hover:bg-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Help text */}
      {!readOnly && modules.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
          <GripVertical className="h-3.5 w-3.5 text-slate-400" />
          <span>Drag modules or lessons to reorder them</span>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmModalRenderer />
    </div>
  );
}

export default ModuleLessonManager;
