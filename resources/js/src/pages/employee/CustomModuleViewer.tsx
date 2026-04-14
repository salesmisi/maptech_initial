import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  Link as LinkIcon,
  Download,
  Loader,
} from 'lucide-react';
import { sanitizeHtml } from '../../components/RichTextEditor';
import YouTubePlayer from '../../components/YouTubePlayer';

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

interface Props {
  moduleId: number;
  onBack: () => void;
}

export function CustomModuleViewer({ moduleId, onBack }: Props) {
  const [module, setModule] = useState<CustomModule | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentLesson = module?.lessons?.[currentLessonIndex] || null;

  useEffect(() => {
    loadModule();
  }, [moduleId]);

  const loadModule = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/employee/custom-modules/${moduleId}`, {
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
      setModule(data.module);
    } catch (err: any) {
      console.error('Error loading custom module:', err);
      setError(err.message || 'Failed to load module');
    } finally {
      setLoading(false);
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

    // Document/PDF Content
    if (contentType === 'document') {
      const docUrl = currentLesson.content_full_url || currentLesson.content_url;

      if (docUrl) {
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

            {currentLesson.file_type === 'application/pdf' && (
              <div className="aspect-[8.5/11] w-full border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <iframe
                  src={`${docUrl}#view=FitH`}
                  className="w-full h-full"
                  title={currentLesson.title}
                />
              </div>
            )}
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
                  <button
                    key={lesson.id}
                    onClick={() => setCurrentLessonIndex(index)}
                    className={`w-full text-left p-3 rounded-md mb-1 transition-colors ${
                      index === currentLessonIndex
                        ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
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
                      <div className="flex-1 min-w-0">
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
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
