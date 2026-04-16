import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  Link as LinkIcon,
  Download,
  Loader,
  Presentation,
  Pencil,
  X,
  Save,
  Loader2,
  Upload,
} from 'lucide-react';
import { sanitizeHtml } from '../../components/RichTextEditor';
import YouTubePlayer from '../../components/YouTubePlayer';
import PresentationViewer from '../../components/PresentationViewer';
import PDFViewer from '../../components/PDFViewer';

const API_BASE = '/api';

interface Lesson {
  id: number;
  title: string;
  description: string | null;
  content_type: string;
  text_content: string | null;
  content_path: string | null;
  content_url: string | null;
  content_full_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  duration: number | null;
  order: number;
  status: string;
  formatted_duration: string | null;
  formatted_file_size: string | null;
}

interface CustomModule {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  thumbnail_url: string | null;
  status: string;
  lessons_count: number;
  lessons: Lesson[];
  creator: {
    id: number;
    fullname: string;
    email: string;
  } | null;
  version: number;
  created_at: string;
  updated_at: string;
}

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const getXsrfToken = async (): Promise<string> => {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
};

interface Props {
  moduleId: number;
  onBack: () => void;
  apiPath?: string;
  allowEdit?: boolean;
  editApiPath?: string;
}

export function CustomModuleViewer({
  moduleId,
  onBack,
  apiPath = 'employee/custom-modules',
  allowEdit = false,
  editApiPath,
}: Props) {
  const [module, setModule] = useState<CustomModule | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit lesson state
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTextContent, setEditTextContent] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const resolvedEditApiPath = editApiPath || apiPath;

  const currentLesson = module?.lessons?.[currentLessonIndex] || null;

  useEffect(() => {
    loadModule();
  }, [moduleId]);

  const loadModule = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/${apiPath}/${moduleId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to load custom module');
      }

      const data = await response.json();
      // Employee API returns { module: ... }, instructor API returns the object directly
      setModule(data.module ?? data);
    } catch (err: any) {
      console.error('Error loading custom module:', err);
      setError(err.message || 'Failed to load module');
    } finally {
      setLoading(false);
    }
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditDescription(lesson.description || '');
    setEditTextContent(lesson.text_content || '');
    setEditFile(null);
    setSaveError(null);
  };

  const closeEditLesson = () => {
    setEditingLesson(null);
    setEditFile(null);
    setSaveError(null);
  };

  const handleSaveLesson = async () => {
    if (!editingLesson || !editTitle.trim()) return;
    setSavingLesson(true);
    setSaveError(null);
    try {
      const token = await getXsrfToken();
      const fd = new FormData();
      fd.append('title', editTitle.trim());
      fd.append('description', editDescription.trim());
      if (editingLesson.content_type === 'text') {
        fd.append('text_content', editTextContent);
      }
      if (editFile) {
        fd.append('content_file', editFile);
      }
      const res = await fetch(
        `${API_BASE}/${resolvedEditApiPath}/${moduleId}/lessons/${editingLesson.id}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
          body: fd,
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save lesson');
      }
      closeEditLesson();
      await loadModule();
    } catch (e: any) {
      setSaveError(e.message || 'Failed to save lesson');
    } finally {
      setSavingLesson(false);
    }
  };

  const goToNextLesson = () => {
    if (module && currentLessonIndex < module.lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    }
  };

  const goToPreviousLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    }
  };

  const renderLessonContent = () => {
    if (!currentLesson) return null;

    const contentType = currentLesson.content_type;

    // Text/HTML Content
    if (contentType === 'text' && currentLesson.text_content) {
      return (
        <div className="prose max-w-none">
          <div
            className="text-slate-700 dark:text-slate-300"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(currentLesson.text_content),
            }}
          />
        </div>
      );
    }

    // Video Content
    if (contentType === 'video') {
      const videoUrl = currentLesson.content_full_url || currentLesson.content_url;

      if (videoUrl) {
        // Check if YouTube
        const youtubeMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?\/\s]+)/);
        if (youtubeMatch) {
          return (
            <div className="aspect-video w-full">
              <YouTubePlayer contentUrl={videoUrl} lessonId={currentLesson.id} />
            </div>
          );
        }

        // Regular video file
        return (
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
            <video
              controls
              className="w-full h-full"
              src={videoUrl}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );
      }
    }

    // Presentation Content (PPT/PPTX)
    if (contentType === 'presentation') {
      const presUrl = currentLesson.content_full_url || currentLesson.content_url;

      if (presUrl) {
        return (
          <PresentationViewer
            url={presUrl}
            title={currentLesson.title}
            fileName={currentLesson.file_name || undefined}
            fileSize={currentLesson.formatted_file_size || undefined}
          />
        );
      }

      return (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4">
            <Presentation className="h-12 w-12 text-orange-500" />
            <div className="flex-1">
              <h4 className="font-medium text-slate-900 dark:text-slate-100">
                {currentLesson.file_name || currentLesson.title}
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Presentation file not available
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Document/PDF Content
    if (contentType === 'document') {
      const docUrl = currentLesson.content_full_url || currentLesson.content_url;
      const isPdf = currentLesson.file_type === 'application/pdf' ||
                    currentLesson.file_name?.toLowerCase().endsWith('.pdf');

      if (docUrl) {
        // Use PDFViewer for PDF files (presentation mode)
        if (isPdf) {
          return (
            <PDFViewer
              url={docUrl}
              title={currentLesson.title}
              fileName={currentLesson.file_name || undefined}
              fileSize={currentLesson.formatted_file_size || undefined}
            />
          );
        }

        // Other document types
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <FileText className="h-12 w-12 text-blue-500" />
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                    {currentLesson.file_name || currentLesson.title}
                  </h4>
                  {currentLesson.formatted_file_size && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Size: {currentLesson.formatted_file_size}
                    </p>
                  )}
                </div>
                <a
                  href={docUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>
            </div>
          </div>
        );
      }
    }

    // Link Content
    if (contentType === 'link' && currentLesson.content_url) {
      return (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-4">
            <LinkIcon className="h-6 w-6 text-blue-500 mt-1" />
            <div className="flex-1">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                External Resource
              </h4>
              {currentLesson.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  {currentLesson.description}
                </p>
              )}
              <a
                href={currentLesson.content_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                Visit Link
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      );
    }

    // File Content (generic file upload)
    if (contentType === 'file') {
      const fileUrl = currentLesson.content_full_url || currentLesson.content_url;
      const fileType = currentLesson.file_type || '';
      const fileName = currentLesson.file_name || '';
      const isImage = fileType.startsWith('image/');
      const isPdf = fileType === 'application/pdf';
      const isAudio = fileType.startsWith('audio/');
      const isVideo = fileType.startsWith('video/');
      const isPpt = fileType.includes('presentation') ||
                    fileType.includes('powerpoint') ||
                    fileName.toLowerCase().endsWith('.ppt') ||
                    fileName.toLowerCase().endsWith('.pptx');

      if (fileUrl) {
        // PowerPoint presentation
        if (isPpt) {
          return (
            <PresentationViewer
              url={fileUrl}
              title={currentLesson.title}
              fileName={currentLesson.file_name || undefined}
              fileSize={currentLesson.formatted_file_size || undefined}
            />
          );
        }

        return (
          <div className="space-y-4">
            {/* Image preview */}
            {isImage && (
              <div className="flex justify-center">
                <img
                  src={fileUrl}
                  alt={currentLesson.file_name || currentLesson.title}
                  className="max-w-full max-h-[70vh] rounded-lg shadow-md"
                />
              </div>
            )}

            {/* PDF preview - presentation mode */}
            {isPdf && (
              <PDFViewer
                url={fileUrl}
                title={currentLesson.title}
                fileName={currentLesson.file_name || undefined}
                fileSize={currentLesson.formatted_file_size || undefined}
              />
            )}

            {/* Audio preview */}
            {isAudio && (
              <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-6">
                <audio controls className="w-full">
                  <source src={fileUrl} type={fileType} />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {/* Video preview */}
            {isVideo && (
              <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                <video controls className="w-full h-full" src={fileUrl}>
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {/* Download section */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <FileText className="h-12 w-12 text-blue-500" />
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                    {currentLesson.file_name || currentLesson.title}
                  </h4>
                  {currentLesson.formatted_file_size && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Size: {currentLesson.formatted_file_size}
                    </p>
                  )}
                  {fileType && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Type: {fileType}
                    </p>
                  )}
                </div>
                <a
                  href={fileUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>
            </div>
          </div>
        );
      }

      // No file URL available
      return (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400">
            File not available for download.
          </p>
        </div>
      );
    }

    // Fallback for unknown content types
    return (
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <p className="text-slate-600 dark:text-slate-400">
          Content type not supported: {contentType}
        </p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto text-purple-600" />
          <p className="mt-4 text-slate-600">Loading module...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Error Loading Module</h3>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!module) {
    return null;
  }

  return (
    <>
    <div className="-m-6 min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-[5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </button>
              <div className="h-8 w-px bg-slate-300 dark:bg-slate-600"></div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {module.title}
                </h1>
                {module.creator && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    by {module.creator.fullname}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <BookOpen className="h-4 w-4" />
              <span>
                Lesson {currentLessonIndex + 1} of {module.lessons.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Lesson Title */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {currentLesson?.title}
              </h2>
              {currentLesson?.description && (
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  {currentLesson.description}
                </p>
              )}
            </div>

            {/* Lesson Content */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              {renderLessonContent()}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={goToPreviousLesson}
                disabled={currentLessonIndex === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous Lesson
              </button>

              <button
                onClick={goToNextLesson}
                disabled={currentLessonIndex >= module.lessons.length - 1}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next Lesson
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sidebar - Lesson List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 sticky top-24">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Lessons</h3>
              </div>

              <div className="p-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {module.lessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className={`relative group rounded-md mb-1 transition-colors ${
                      index === currentLessonIndex
                        ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => setCurrentLessonIndex(index)}
                      className="w-full text-left p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {index === currentLessonIndex ? (
                            <div className="h-5 w-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs">
                              {index + 1}
                            </div>
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                              {index + 1}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          <p
                            className={`text-sm font-medium truncate ${
                              index === currentLessonIndex
                                ? 'text-purple-700 dark:text-purple-300'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {lesson.title}
                          </p>
                          {lesson.formatted_duration && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {lesson.formatted_duration}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                    {allowEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditLesson(lesson); }}
                        className="absolute top-2.5 right-2 p-1 rounded text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit lesson"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── EDIT LESSON MODAL ── */}
    {allowEdit && editingLesson && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-purple-500" />
              Edit Lesson
            </h2>
            <button onClick={closeEditLesson} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {saveError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{saveError}</p>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lesson Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Lesson title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                placeholder="Short description (optional)"
              />
            </div>

            {/* Text content — only for text-type lessons */}
            {editingLesson.content_type === 'text' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content</label>
                <textarea
                  value={editTextContent}
                  onChange={e => setEditTextContent(e.target.value)}
                  rows={6}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                  placeholder="Lesson text content..."
                />
              </div>
            )}

            {/* File replacement — for file/video/document content */}
            {(editingLesson.content_type === 'video' || editingLesson.content_type === 'file' || editingLesson.content_type === 'document') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Replace File (optional)</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 text-sm text-slate-600 dark:text-slate-300">
                    <Upload className="h-4 w-4" />
                    {editFile ? editFile.name : 'Choose file'}
                    <input
                      ref={editFileRef}
                      type="file"
                      className="sr-only"
                      accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                      onChange={e => setEditFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  {editFile && (
                    <button onClick={() => { setEditFile(null); if (editFileRef.current) editFileRef.current.value = ''; }}
                      className="text-xs text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  )}
                </div>
                {editingLesson.file_name && !editFile && (
                  <p className="text-xs text-slate-400 mt-1">Current: {editingLesson.file_name}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={closeEditLesson}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLesson}
              disabled={savingLesson || !editTitle.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {savingLesson ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingLesson ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
