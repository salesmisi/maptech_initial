import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Download,
  File,
  Video,
  Music,
  BookOpen,
  Loader,
  Lock,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { sanitizeHtml } from '../../components/RichTextEditor';

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

interface QuizAttemptSummary {
  score: number;
  percentage: number;
}

interface QuizData {
  id: number;
  title: string;
  description: string | null;
  pass_percentage: number;
  question_count: number;
  has_passed: boolean;
  best_attempt: QuizAttemptSummary | null;
}

interface LessonData {
  id: number;
  title: string;
  text_content: string | null;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  order: number;
}

interface ModuleData {
  id: number;
  title: string;
  content_path: string;
  content_url: string;
  file_type: string;
  lessons: LessonData[];
  is_unlocked: boolean;
  quiz: QuizData | null;
}

interface QuizOption {
  id: number;
  option_text: string;
}

interface QuizQuestion {
  id: number;
  question_text: string;
  options: QuizOption[];
}

interface QuizResult {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  pass_percentage: number;
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
  const [currentLesson, setCurrentLesson] = useState<LessonData | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quiz state
  const [quizState, setQuizState] = useState<null | 'loading' | 'taking' | 'submitted'>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [showResultRevealed, setShowResultRevealed] = useState(false);

  const loadCourse = async () => {
    try {
      const res = await fetch(`${API_BASE}/employee/courses/${courseId}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load course');
      const data = await res.json();
      setCourse(data);
      const mods: ModuleData[] = data.modules ?? [];
      setModules(mods);
      setCurrentModule(prev => {
        if (prev) {
          const updated = mods.find(m => m.id === prev.id);
          if (updated) return updated;
        }
        const firstUnlocked = mods.find(m => m.is_unlocked) ?? mods[0] ?? null;
        if (firstUnlocked) {
          setExpandedModules(new Set([firstUnlocked.id]));
          const lessons = firstUnlocked.lessons ?? [];
          if (lessons.length > 0) setCurrentLesson(lessons[0]);
        }
        return firstUnlocked;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) loadCourse();
  }, [courseId]);

  // Reset quiz state when module changes
  useEffect(() => {
    setQuizState(null);
    setQuizAnswers({});
    setQuizResult(null);
    setShowResultRevealed(false);
    setShowQuiz(false);
  }, [currentModule?.id]);

  const selectModule = (mod: ModuleData) => {
    if (!mod.is_unlocked) return;
    setCurrentModule(mod);
    setExpandedModules(prev => new Set(prev).add(mod.id));
    const lessons = mod.lessons ?? [];
    setCurrentLesson(lessons.length > 0 ? lessons[0] : null);
    setShowQuiz(false);
  };

  const selectLesson = (mod: ModuleData, lesson: LessonData) => {
    if (!mod.is_unlocked) return;
    setCurrentModule(mod);
    setCurrentLesson(lesson);
    setShowQuiz(false);
  };

  const selectQuiz = (mod: ModuleData) => {
    if (!mod.is_unlocked) return;
    setCurrentModule(mod);
    setCurrentLesson(null);
    setShowQuiz(true);
  };

  const startQuiz = async () => {
    if (!currentModule?.quiz) return;
    setQuizState('loading');
    try {
      const res = await fetch(`${API_BASE}/employee/quizzes/${currentModule.quiz.id}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load quiz.');
      const data = await res.json();
      setQuizQuestions(data.questions ?? []);
      setQuizAnswers({});
      setQuizState('taking');
    } catch (e: any) {
      setQuizState(null);
      alert(e.message);
    }
  };

  const submitQuiz = async () => {
    if (!currentModule?.quiz) return;
    setQuizSubmitting(true);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/employee/quizzes/${currentModule.quiz.id}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ answers: quizAnswers }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to submit quiz.');
      }
      const data = await res.json();
      setQuizResult({
        score: data.score,
        total: data.total_questions ?? data.total,
        percentage: data.percentage,
        passed: data.passed,
        pass_percentage: currentModule.quiz.pass_percentage,
      });
      setQuizState('submitted');
      if (data.passed) await loadCourse();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setQuizSubmitting(false);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    switch (fileType) {
      case 'pdf': case 'document': return <FileText className="h-5 w-5" />;
      case 'video': return <Video className="h-5 w-5" />;
      case 'audio': return <Music className="h-5 w-5" />;
      default: return <File className="h-5 w-5" />;
    }
  };

  const getSmallFileIcon = (fileType: string | null) => {
    switch (fileType) {
      case 'pdf': case 'document': return <FileText className="h-3.5 w-3.5" />;
      case 'video': return <Video className="h-3.5 w-3.5" />;
      case 'audio': return <Music className="h-3.5 w-3.5" />;
      default: return <File className="h-3.5 w-3.5" />;
    }
  };

  const renderLessonContent = () => {
    if (!currentLesson) {
      return (
        <div className="text-center text-slate-500 py-12">
          <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Select a lesson to view its content</p>
        </div>
      );
    }

    const hasText = !!currentLesson.text_content;
    const hasFile = !!currentLesson.content_url;

    if (!hasText && !hasFile) {
      return (
        <div className="text-center text-slate-500 py-12 bg-slate-50 rounded-xl border border-slate-200">
          <FileText className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">{currentLesson.title}</h3>
          <p className="text-sm">No content available for this lesson.</p>
        </div>
      );
    }

    // Text-only lesson (no file attached)
    if (hasText && !hasFile) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-5">
            <div
              className="prose prose-base max-w-none text-slate-700 leading-relaxed
                [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5
                [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-2.5 [&_h3]:mb-1
                [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
                [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
                [&_li]:my-1 [&_p]:my-2"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentLesson.text_content!) }}
            />
          </div>
        </div>
      );
    }

    const { file_type, content_url, title } = currentLesson;

    const textBlock = hasText ? (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
        <div className="px-6 py-5">
          <div
            className="prose prose-base max-w-none text-slate-700 leading-relaxed
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
              [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5
              [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-2.5 [&_h3]:mb-1
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
              [&_li]:my-1 [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentLesson.text_content!) }}
          />
        </div>
      </div>
    ) : null;

    if (file_type === 'video') {
      return (
        <div className="space-y-4">
          {textBlock}
          <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden">
            <video controls className="w-full h-full" src={content_url}>
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      );
    }

    if (file_type === 'audio') {
      return (
        <div className="space-y-4">
          {textBlock}
          <div className="bg-slate-100 rounded-xl p-8 flex flex-col items-center justify-center">
            <Music className="h-20 w-20 text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-4">{title}</h3>
            <audio controls className="w-full max-w-md">
              <source src={content_url} />
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      );
    }

    if (file_type === 'pdf') {
      return (
        <div className="space-y-4">
          {textBlock}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: '70vh' }}>
            <iframe src={content_url} className="w-full h-full" title={title} />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {textBlock}
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
      </div>
    );
  };

  const renderQuizSection = () => {
    if (!currentModule?.quiz) return null;
    const quiz = currentModule.quiz;

    if (quizState === 'loading') {
      return (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 flex items-center justify-center gap-2">
          <Loader className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="text-indigo-700">Loading quiz...</span>
        </div>
      );
    }

    if (quizState === 'taking') {
      const allAnswered = quizQuestions.length > 0 && quizQuestions.every(q => quizAnswers[q.id] !== undefined);
      return (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-bold text-indigo-900">{quiz.title}</h3>
            <span className="text-xs text-indigo-600 px-2.5 py-1 bg-indigo-100 rounded-full">
              Pass: {quiz.pass_percentage}%
            </span>
          </div>
          {quizQuestions.map((q, qi) => (
            <div key={q.id} className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-sm font-semibold text-slate-800 mb-3">{qi + 1}. {q.question_text}</p>
              <div className="space-y-2">
                {q.options.map(opt => (
                  <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    quizAnswers[q.id] === opt.id
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt.id}
                      checked={quizAnswers[q.id] === opt.id}
                      onChange={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt.id }))}
                      className="text-indigo-600"
                    />
                    <span className="text-sm">{opt.option_text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={submitQuiz}
            disabled={!allAnswered || quizSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {quizSubmitting ? <><Loader className="h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Quiz'}
          </button>
        </div>
      );
    }

    if (quizState === 'submitted' && quizResult) {
      // Step 1: Ask if user wants to see result
      if (!showResultRevealed) {
        return (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
                <HelpCircle className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-indigo-900">Quiz Submitted!</h3>
              <p className="text-sm text-indigo-700 mt-2">Your answers have been recorded. Would you like to see your result?</p>
            </div>
            <button
              onClick={() => setShowResultRevealed(true)}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-base transition-colors"
            >
              See Quiz Result
            </button>
          </div>
        );
      }

      // Step 2: Show actual result
      return (
        <div className={`rounded-xl border p-8 space-y-6 ${quizResult.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {/* Score circle */}
          <div className="flex flex-col items-center text-center">
            <div className={`h-28 w-28 rounded-full flex items-center justify-center text-3xl font-bold ${
              quizResult.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {quizResult.percentage.toFixed(0)}%
            </div>
            <h3 className={`text-xl font-bold mt-4 ${quizResult.passed ? 'text-green-800' : 'text-red-800'}`}>
              {quizResult.passed ? 'Congratulations! You Passed!' : 'You Did Not Pass'}
            </h3>
            <p className={`text-sm mt-2 ${quizResult.passed ? 'text-green-700' : 'text-red-700'}`}>
              You scored <strong>{quizResult.score}</strong> out of <strong>{quizResult.total}</strong> ({quizResult.percentage.toFixed(1)}%)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Required to pass: {quizResult.pass_percentage}%
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-3">
            {quizResult.passed ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm text-green-700 font-medium">Next module is now unlocked!</p>
                  {currentModuleIndex < modules.length - 1 && modules[currentModuleIndex + 1]?.is_unlocked && (
                    <button
                      onClick={() => selectModule(modules[currentModuleIndex + 1])}
                      className="mt-3 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
                    >
                      Proceed to Next Module <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-sm text-red-700 mb-3">
                  You need at least <strong>{quizResult.pass_percentage}%</strong> to pass. Review the lessons and try again.
                </p>
                <button
                  onClick={() => { setQuizState(null); setQuizResult(null); setShowResultRevealed(false); }}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Retake Quiz
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Idle — show quiz info + start button
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-indigo-900">{quiz.title}</h3>
            <p className="text-sm text-indigo-700 mt-1">
              {quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''} · Pass {quiz.pass_percentage}% to unlock next module
            </p>
            {quiz.has_passed ? (
              <div className="mt-3 flex items-center gap-2 text-green-700 text-sm font-medium">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Passed! {quiz.best_attempt && `(Best score: ${quiz.best_attempt.percentage?.toFixed(1)}%)`}
              </div>
            ) : (
              quiz.best_attempt && (
                <p className="mt-2 text-xs text-red-600">
                  Last attempt: {quiz.best_attempt.percentage?.toFixed(1)}% — needed {quiz.pass_percentage}%
                </p>
              )
            )}
          </div>
          {!quiz.has_passed && (
            <button
              onClick={startQuiz}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex-shrink-0"
            >
              {quiz.best_attempt ? 'Retake Quiz' : 'Start Quiz'}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Navigation helpers
  const currentModuleIndex = currentModule ? modules.findIndex(m => m.id === currentModule.id) : -1;
  const moduleLessons = currentModule?.lessons ?? [];
  const currentLessonIndex = currentLesson ? moduleLessons.findIndex(l => l.id === currentLesson.id) : -1;

  const goToPrevious = () => {
    if (showQuiz) {
      // Go back to last lesson in current module
      if (moduleLessons.length > 0) {
        setCurrentLesson(moduleLessons[moduleLessons.length - 1]);
        setShowQuiz(false);
      }
    } else if (currentLessonIndex > 0) {
      setCurrentLesson(moduleLessons[currentLessonIndex - 1]);
    } else if (currentModuleIndex > 0) {
      // Go to previous module's last item
      const prevMod = modules[currentModuleIndex - 1];
      if (prevMod.is_unlocked) {
        setCurrentModule(prevMod);
        setExpandedModules(prev => new Set(prev).add(prevMod.id));
        const prevLessons = prevMod.lessons ?? [];
        if (prevMod.quiz) {
          setCurrentLesson(null);
          setShowQuiz(true);
        } else if (prevLessons.length > 0) {
          setCurrentLesson(prevLessons[prevLessons.length - 1]);
          setShowQuiz(false);
        }
      }
    }
  };

  const goToNext = () => {
    if (currentLesson && currentLessonIndex < moduleLessons.length - 1) {
      setCurrentLesson(moduleLessons[currentLessonIndex + 1]);
    } else if (currentLesson && currentModule?.quiz && !showQuiz) {
      // Go to quiz
      setCurrentLesson(null);
      setShowQuiz(true);
    } else {
      // Go to next module
      const nextMod = currentModuleIndex < modules.length - 1 ? modules[currentModuleIndex + 1] : null;
      if (nextMod && nextMod.is_unlocked) {
        selectModule(nextMod);
      }
    }
  };

  const canGoPrevious = showQuiz || currentLessonIndex > 0 || currentModuleIndex > 0;
  const canGoNext = (() => {
    if (currentLesson && currentLessonIndex < moduleLessons.length - 1) return true;
    if (currentLesson && currentModule?.quiz && !showQuiz) return true;
    const nextMod = currentModuleIndex < modules.length - 1 ? modules[currentModuleIndex + 1] : null;
    return !!(nextMod && nextMod.is_unlocked);
  })();

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
        <button onClick={onBack} className="text-green-600 hover:text-green-700 font-medium">
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
        <button onClick={onBack} className="text-green-600 hover:text-green-700 font-medium">
          Go Back
        </button>
      </div>
    );
  }

  // Count total lessons across all modules for progress
  const totalItems = modules.reduce((sum, m) => sum + (m.lessons?.length ?? 0) + (m.quiz ? 1 : 0), 0);
  const completedModules = modules.filter(m => m.quiz?.has_passed).length;
  const progress = modules.length > 0 ? Math.round((completedModules / modules.length) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-6">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-lg font-bold">{course.title}</h1>
          <p className="text-sm text-slate-400">
            {showQuiz && currentModule ? `${currentModule.title} — Quiz` : currentLesson ? currentLesson.title : currentModule ? currentModule.title : 'Select a module'}
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
        {/* Sidebar - Module & Lesson List */}
        <div className="w-80 bg-slate-50 border-r border-slate-200 overflow-y-auto hidden md:block">
          <div className="p-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              Course Modules ({modules.length})
            </h2>
            {modules.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No modules available for this course.</p>
            ) : (
              <div className="space-y-1">
                {modules.map((module, index) => {
                  const isLocked = !module.is_unlocked;
                  const isActiveModule = currentModule?.id === module.id;
                  const isModuleExpanded = expandedModules.has(module.id);
                  const lessons = module.lessons ?? [];

                  return (
                    <div key={module.id}>
                      {/* Module header */}
                      <button
                        onClick={() => {
                          if (isLocked) return;
                          setExpandedModules(prev => {
                            const next = new Set(prev);
                            next.has(module.id) ? next.delete(module.id) : next.add(module.id);
                            return next;
                          });
                          if (!isActiveModule) selectModule(module);
                        }}
                        disabled={isLocked}
                        className={`w-full px-3 py-2.5 flex items-center text-left rounded-lg transition-colors ${
                          isActiveModule
                            ? 'bg-green-50 text-green-900'
                            : isLocked
                            ? 'text-slate-400 cursor-not-allowed opacity-60'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="mr-2 flex-shrink-0">
                          {isLocked ? (
                            <Lock className="h-4 w-4 text-slate-400" />
                          ) : module.quiz?.has_passed ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-500">
                              {index + 1}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{module.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {isLocked ? 'Complete previous quiz' : `${lessons.length} lesson${lessons.length !== 1 ? 's' : ''}${module.quiz ? ' + quiz' : ''}`}
                          </p>
                        </div>
                        {!isLocked && (
                          isModuleExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            : <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        )}
                      </button>

                      {/* Expanded lessons + quiz */}
                      {isModuleExpanded && !isLocked && (
                        <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                          {lessons.map((lesson) => {
                            const isActiveLesson = currentLesson?.id === lesson.id && isActiveModule && !showQuiz;
                            return (
                              <button
                                key={lesson.id}
                                onClick={() => selectLesson(module, lesson)}
                                className={`w-full px-3 py-1.5 flex items-center gap-2 text-left rounded-md transition-colors text-sm ${
                                  isActiveLesson
                                    ? 'bg-green-100 text-green-800 font-medium'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {getSmallFileIcon(lesson.file_type)}
                                <span className="truncate">{lesson.title}</span>
                              </button>
                            );
                          })}
                          {module.quiz && (
                            <button
                              onClick={() => selectQuiz(module)}
                              className={`w-full px-3 py-1.5 flex items-center gap-2 text-left rounded-md transition-colors text-sm ${
                                showQuiz && isActiveModule
                                  ? 'bg-indigo-100 text-indigo-800 font-medium'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <HelpCircle className={`h-3.5 w-3.5 ${module.quiz.has_passed ? 'text-green-500' : 'text-indigo-400'}`} />
                              <span className="truncate">Quiz</span>
                              {module.quiz.has_passed && <CheckCircle className="h-3 w-3 text-green-500 ml-auto flex-shrink-0" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-4xl mx-auto">
            {/* Title */}
            {(currentLesson || showQuiz) && currentModule && (
              <div className="mb-6">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">{currentModule.title}</p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {showQuiz ? currentModule.quiz?.title ?? 'Quiz' : currentLesson?.title}
                </h2>
                {currentLesson?.file_type && !showQuiz && (
                  <p className="text-slate-500 mt-1 capitalize">{currentLesson.file_type} content</p>
                )}
              </div>
            )}

            {/* Content */}
            <div className="mb-8">
              {showQuiz ? renderQuizSection() : renderLessonContent()}
            </div>

            {/* Quiz prompt at bottom of lesson content */}
            {!showQuiz && currentLesson && currentModule?.quiz && currentLessonIndex === moduleLessons.length - 1 && (
              <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-medium text-indigo-900">Ready for the quiz?</p>
                    <p className="text-xs text-indigo-600">
                      Pass with {currentModule.quiz.pass_percentage}% to unlock the next module
                    </p>
                  </div>
                </div>
                {currentModule.quiz.has_passed ? (
                  <span className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
                    <CheckCircle className="h-4 w-4" /> Passed
                  </span>
                ) : (
                  <button
                    onClick={() => selectQuiz(currentModule)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg"
                  >
                    Take Quiz
                  </button>
                )}
              </div>
            )}

            {/* Course Description */}
            {!currentLesson && !showQuiz && course.description && (
              <div className="prose max-w-none text-slate-600 mt-8">
                <h3 className="text-lg font-bold text-slate-900 mb-2">About this course</h3>
                <p>{course.description}</p>
                {course.instructor && (
                  <p className="text-sm text-slate-500 mt-2">
                    Instructor: {course.instructor.fullName}
                  </p>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            {(currentLesson || showQuiz) && (
              <div className="flex justify-between mt-12 pt-6 border-t border-slate-200">
                <button
                  onClick={goToPrevious}
                  disabled={!canGoPrevious}
                  className="flex items-center px-4 py-2 text-slate-600 hover:text-slate-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </button>
                <div className="flex flex-col items-end gap-1">
                  {!canGoNext && currentModule?.quiz && !currentModule.quiz.has_passed && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Pass the quiz to unlock the next module
                    </p>
                  )}
                  <button
                    onClick={goToNext}
                    disabled={!canGoNext}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </button>
                </div>
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

              const submitQuiz = async () => {
                let correct = 0;
                for (const q of quiz) {
                  const selected = quizAnswers[q.id];
                  if (selected !== undefined && selected === q.answer) correct++;
                }
                const total = quiz.length;
                const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
                setQuizResult({ score: correct, total });

                // Persist the attempt to the backend
                try {
                  await fetch(`${API_BASE}/employee/modules/${(currentModule as any).id}/quiz`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'X-XSRF-TOKEN': decodeURIComponent(getCookie('XSRF-TOKEN')),
                    },
                    body: JSON.stringify({
                      score: scorePercent,
                      correct_answers: correct,
                      total_questions: total,
                    }),
                  });
                } catch {
                  // silent – progress page will still show 0 until next attempt
                }
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
