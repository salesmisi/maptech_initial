import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  CalendarDays,
  CalendarX2,
  CheckCircle,
  PlayCircle,
  Layers,
  User,
} from 'lucide-react';

const API_BASE = '/api';

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : '';
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  department: string;
  status: string;
  deadline: string | null;
  created_at: string;
  instructor?: { fullname: string } | null;
  modules: Array<{ id: string; title: string }>;
}

interface CourseEnrollDetailProps {
  courseId: string;
  onNavigate: (page: string, courseId?: string) => void;
  onBack: () => void;
}

const DEPT_COLORS: Record<string, string> = {
  IT: 'from-blue-500 to-blue-700',
  HR: 'from-purple-500 to-purple-700',
  Operations: 'from-green-500 to-green-700',
  Finance: 'from-yellow-500 to-yellow-700',
  Marketing: 'from-orange-500 to-orange-700',
};

export function CourseEnrollDetail({ courseId, onNavigate, onBack }: CourseEnrollDetailProps) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/employee/courses/${courseId}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Course not found.');
        return res.json();
      })
      .then((data) => setCourse(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleEnroll = async () => {
    if (!course) return;
    setEnrolling(true);
    setError(null);
    try {
      await fetch(`${API_BASE.replace('/api', '')}/sanctum/csrf-cookie`, { credentials: 'include' });
      const res = await fetch(`${API_BASE}/employee/courses/${course.id}/enroll`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Enrollment failed.');
      setSuccess(true);
      // Brief pause so user sees the success state, then navigate to viewer
      setTimeout(() => onNavigate('course-viewer', course.id), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnrolling(false);
    }
  };

  const gradientClass = course ? (DEPT_COLORS[course.department] || 'from-slate-500 to-slate-700') : 'from-slate-500 to-slate-700';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        <span className="ml-3 text-slate-600">Loading course details...</span>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-16">
        <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
        <p className="mt-3 text-slate-600">{error || 'Course not found.'}</p>
        <button onClick={onBack} className="mt-4 text-sm text-indigo-600 hover:underline">
          &larr; Back to My Courses
        </button>
      </div>
    );
  }

  const startDate = new Date(course.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const deadlineDate = course.deadline
    ? new Date(course.deadline).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Courses
      </button>

      {/* Hero banner */}
      <div className={`rounded-xl bg-gradient-to-br ${gradientClass} p-8 text-white relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <BookOpen className="absolute bottom-2 right-4 h-32 w-32" />
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/20 rounded-full px-3 py-1 mb-3">
          {course.department}
        </span>
        <h1 className="text-2xl font-bold leading-snug mb-2">{course.title}</h1>
        {course.instructor?.fullname && (
          <p className="text-sm text-white/80 flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {course.instructor.fullname}
          </p>
        )}
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        {/* Self-paced + modules row */}
        <div className="grid grid-cols-2 divide-x divide-slate-100">
          <div className="flex flex-col items-center justify-center py-5 gap-1">
            <Clock className="h-5 w-5 text-indigo-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Pace</span>
            <span className="text-sm font-semibold text-slate-800">Self Pace</span>
          </div>
          <div className="flex flex-col items-center justify-center py-5 gap-1">
            <Layers className="h-5 w-5 text-indigo-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Modules</span>
            <span className="text-sm font-semibold text-slate-800">{safeArray(course?.modules).length}</span>
          </div>
        </div>

        {/* Dates row */}
        <div className="grid grid-cols-2 divide-x divide-slate-100">
          <div className="flex flex-col items-center justify-center py-5 gap-1">
            <CalendarDays className="h-5 w-5 text-green-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Available Since</span>
            <span className="text-sm font-semibold text-slate-800">{startDate}</span>
          </div>
          <div className="flex flex-col items-center justify-center py-5 gap-1">
            <CalendarX2 className="h-5 w-5 text-red-400" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Deadline / Locks On</span>
            <span className={`text-sm font-semibold ${deadlineDate ? 'text-red-600' : 'text-slate-400'}`}>
              {deadlineDate ?? 'No deadline'}
            </span>
          </div>
        </div>

        {/* Description */}
        {course.description && (
          <div className="px-6 py-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">About this Course</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{course.description}</p>
          </div>
        )}

        {/* Module list preview */}
        {course.modules.length > 0 && (
          <div className="px-6 py-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Course Modules</h3>
            <ul className="space-y-2">
              {safeArray(course?.modules).map((mod, idx) => (
                <li key={mod.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  {mod.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* CTA Button */}
      <div className="pb-6">
        {success ? (
          <div className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-green-50 border border-green-200 text-green-700 font-medium">
            <CheckCircle className="h-5 w-5" />
            Enrolled! Redirecting to course viewer...
          </div>
        ) : (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="w-full flex justify-center items-center gap-2 py-3.5 px-6 rounded-xl text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 shadow-md hover:shadow-lg transition-all"
          >
            {enrolling ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Enrolling...
              </>
            ) : (
              <>
                <PlayCircle className="h-5 w-5" />
                Enroll this Course
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
