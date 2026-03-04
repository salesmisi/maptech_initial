import React, { useState, useEffect } from 'react';
import {
  Play,
  FileText,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Download,
  File,
  Video,
  Music,
  BookOpen,
  Loader } from
'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

interface ModuleData {
  id: number;
  title: string;
  content_path: string;
  content_url: string;
  file_type: string;
  isOpen?: boolean;
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  department: string;
  instructor: {
    id: number;
    fullName: string;
    email: string;
  } | null;
  modules: ModuleData[];
}

interface CourseViewerProps {
  courseId?: string;
  onBack?: () => void;
}

export function CourseViewer({ courseId, onBack }: CourseViewerProps) {
  const [course, setCourse] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [currentModule, setCurrentModule] = useState<ModuleData | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{score:number,total:number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (courseId) {
      loadCourse();
    } else {
      // Load first course from dashboard for demo
      loadFirstCourse();
    }
  }, [courseId]);

  const loadCourse = async () => {
    try {
      const response = await fetch(`${API_BASE}/employee/courses/${courseId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load course');
      }

      const data = await response.json();
      setCourse(data);
      const modulesWithState = data.modules?.map((m: ModuleData, idx: number) => ({
        ...m,
        isOpen: idx === 0,
      })) || [];
      setModules(modulesWithState);
      if (modulesWithState.length > 0) {
        setCurrentModule(modulesWithState[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFirstCourse = async () => {
    try {
      const response = await fetch(`${API_BASE}/employee/courses`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load courses');
      }

      const data = await response.json();
      if (data.length > 0) {
        setCourse(data[0]);
        const modulesWithState = data[0].modules?.map((m: ModuleData, idx: number) => ({
          ...m,
          isOpen: idx === 0,
        })) || [];
        setModules(modulesWithState);
        if (modulesWithState.length > 0) {
          setCurrentModule(modulesWithState[0]);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (id: number) => {
    setModules(
      modules.map((m) =>
        m.id === id ? { ...m, isOpen: !m.isOpen } : m
      )
    );
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
      case 'document':
        return <FileText className="h-5 w-5" />;
      case 'video':
        return <Video className="h-5 w-5" />;
      case 'audio':
        return <Music className="h-5 w-5" />;
      case 'presentation':
        return <File className="h-5 w-5" />;
      default:
        return <File className="h-5 w-5" />;
    }
  };

  const renderContentViewer = () => {
    if (!currentModule) {
      return (
        <div className="text-center text-slate-500 py-12">
          <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Select a module to view its content</p>
        </div>
      );
    }

    const { file_type, content_url, title } = currentModule;

    if (file_type === 'video') {
      return (
        <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden">
          <video
            controls
            className="w-full h-full"
            src={content_url}
            onEnded={() => {
              // when video ends, show pre-assessment if present
              if ((currentModule as any)?.pre_assessment) {
                setShowQuiz(true);
              }
            }}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (file_type === 'audio') {
      return (
        <div className="bg-slate-100 rounded-xl p-8 flex flex-col items-center justify-center">
          <Music className="h-20 w-20 text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-4">{title}</h3>
          <audio controls className="w-full max-w-md">
            <source src={content_url} />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    if (file_type === 'pdf') {
      return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: '70vh' }}>
          <iframe
            src={content_url}
            className="w-full h-full"
            title={title}
          />
        </div>
      );
    }

    // For documents, presentations, text files - show download option
    return (
      <div className="bg-slate-50 rounded-xl p-12 flex flex-col items-center justify-center border border-slate-200">
        {getFileIcon(file_type)}
        <h3 className="text-xl font-medium text-slate-700 mt-4 mb-2">{title}</h3>
        <p className="text-slate-500 mb-6 text-center">
          This file type is best viewed by downloading it.
        </p>
        <a
          href={content_url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-md"
        >
          <Download className="h-5 w-5 mr-2" />
          Download File
        </a>
        <a
          href={content_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-sm text-green-600 hover:text-green-700"
        >
          Or open in new tab
        </a>
      </div>
    );
  };

  const currentModuleIndex = currentModule ? modules.findIndex(m => m.id === currentModule.id) : -1;

  const goToPreviousModule = () => {
    if (currentModuleIndex > 0) {
      setCurrentModule(modules[currentModuleIndex - 1]);
    }
  };

  const goToNextModule = () => {
    if (currentModuleIndex < modules.length - 1) {
      setCurrentModule(modules[currentModuleIndex + 1]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <Loader className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-3 text-slate-600">Loading course...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)]">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={onBack}
          className="text-green-600 hover:text-green-700 font-medium"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)]">
        <BookOpen className="h-16 w-16 text-slate-400 mb-4" />
        <p className="text-slate-500 mb-4">No course available</p>
        <button
          onClick={onBack}
          className="text-green-600 hover:text-green-700 font-medium"
        >
          Go Back
        </button>
      </div>
    );
  }

  const progress = modules.length > 0 ? Math.round(((currentModuleIndex + 1) / modules.length) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-6">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-lg font-bold">{course.title}</h1>
          <p className="text-sm text-slate-400">
            {currentModule ? currentModule.title : 'Select a module'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Course Progress</p>
            <div className="w-32 bg-slate-700 rounded-full h-1.5 mt-1">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={onBack}
            className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-sm transition-colors"
          >
            Exit Course
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Module List */}
        <div className="w-80 bg-slate-50 border-r border-slate-200 overflow-y-auto hidden md:block">
          <div className="p-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              Course Modules ({modules.length})
            </h2>
            {modules.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No modules available for this course.</p>
            ) : (
              <div className="space-y-2">
                {modules.map((module, index) => (
                  <button
                    key={module.id}
                    onClick={() => setCurrentModule(module)}
                    className={`w-full px-4 py-3 flex items-center text-left rounded-lg transition-colors border ${
                      currentModule?.id === module.id
                        ? 'bg-green-50 border-green-200 text-green-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="mr-3 flex-shrink-0">
                      {currentModule?.id === module.id ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{module.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center">
                        {getFileIcon(module.file_type)}
                        <span className="ml-1 capitalize">{module.file_type}</span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-4xl mx-auto">
            {currentModule && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {currentModule.title}
                </h2>
                <p className="text-slate-500 mt-1 capitalize">
                  {currentModule.file_type} content
                </p>
              </div>
            )}

            {/* Content Viewer */}
            <div className="mb-8">
              {renderContentViewer()}
            </div>

            {/* Course Description */}
            {course.description && (
              <div className="prose max-w-none text-slate-600 mb-8">
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  About this course
                </h3>
                <p>{course.description}</p>
                {course.instructor && (
                  <p className="text-sm text-slate-500 mt-2">
                    Instructor: {course.instructor.fullName}
                  </p>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            {modules.length > 0 && (
              <div className="flex justify-between mt-12 pt-6 border-t border-slate-200">
                <button
                  onClick={goToPreviousModule}
                  disabled={currentModuleIndex <= 0}
                  className="flex items-center px-4 py-2 text-slate-600 hover:text-slate-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous Module
                </button>
                <button
                  onClick={goToNextModule}
                  disabled={currentModuleIndex >= modules.length - 1}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next Module
                  <ArrowRight className="h-4 w-4 ml-2" />
                </button>
              </div>
            )}
            {/* Quiz Panel */}
            {showQuiz && currentModule && (function renderQuiz() {
              // pre_assessment may be stored as JSON string or object
              let quiz = (currentModule as any).pre_assessment || null;
              try {
                if (typeof quiz === 'string') quiz = JSON.parse(quiz);
              } catch (e) {
                quiz = null;
              }

              if (!quiz || !Array.isArray(quiz) || quiz.length === 0) {
                return (
                  <div className="mt-8 p-6 bg-yellow-50 rounded">No assessment available.</div>
                );
              }

              const total = quiz.length;

              const submitQuiz = () => {
                let correct = 0;
                for (const q of quiz) {
                  const selected = quizAnswers[q.id];
                  if (selected !== undefined && selected === q.answer) correct++;
                }
                setQuizResult({ score: correct, total });
              };

              return (
                <div className="mt-8 p-6 bg-white border rounded-lg">
                  <h3 className="text-lg font-bold mb-4">Pre-assessment</h3>
                  {quiz.map((q: any) => (
                    <div key={q.id} className="mb-4">
                      <p className="font-medium">{q.id}. {q.question}</p>
                      <div className="mt-2 space-y-2">
                        {q.options.map((opt: string, idx: number) => (
                          <label key={idx} className={`flex items-center space-x-3 cursor-pointer ${quizResult ? 'opacity-70' : ''}`}>
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              value={idx}
                              checked={quizAnswers[q.id] === idx}
                              disabled={!!quizResult}
                              onChange={() => setQuizAnswers(prev => ({ ...prev, [q.id]: idx }))}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  {!quizResult ? (
                    <div className="flex items-center space-x-3">
                      <button onClick={submitQuiz} className="px-4 py-2 bg-green-600 text-white rounded">Submit Assessment</button>
                      <button onClick={() => { setShowQuiz(false); setQuizAnswers({}); }} className="px-4 py-2 border rounded">Close</button>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="font-semibold">Result: {quizResult.score} / {quizResult.total}</p>
                      <button onClick={() => { setQuizResult(null); setQuizAnswers({}); }} className="mt-2 px-3 py-1 border rounded">Retry</button>
                      <button onClick={() => setShowQuiz(false)} className="mt-2 ml-2 px-3 py-1 bg-green-600 text-white rounded">Close</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
