import { lazy, Suspense, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { LoadingState } from './components/ui/LoadingState';
import { FullscreenLoader } from './components/ui/FullscreenLoader';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { VerifyOTPPage } from './pages/VerifyOTPPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { resolveImageUrl } from './utils/safe';

interface User {
  id?: number;
  role: 'admin' | 'instructor' | 'employee';
  name?: string;
  fullName?: string;
  fullname?: string;
  email: string;
  department?: string;
  profile_picture?: string | null;
}

const AdminLayout = lazy(() => import('./components/layout/AdminLayout').then((module) => ({ default: module.AdminLayout })));
const InstructorLayout = lazy(() => import('./components/layout/InstructorLayout').then((module) => ({ default: module.InstructorLayout })));
const EmployeeLayout = lazy(() => import('./components/layout/EmployeeLayout').then((module) => ({ default: module.EmployeeLayout })));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const DepartmentManagement = lazy(() => import('./pages/admin/DepartmentManagement.tsx'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement').then((module) => ({ default: module.UserManagement })));
const CoursesAndContent = lazy(() => import('./pages/admin/CoursesAndContent').then((module) => ({ default: module.CoursesAndContent })));
const EnrollmentManagement = lazy(() => import('./pages/admin/EnrollmentManagement').then((module) => ({ default: module.EnrollmentManagement })));
const ReportsAnalytics = lazy(() => import('./pages/admin/ReportsAnalytics').then((module) => ({ default: module.ReportsAnalytics })));
const NotificationManagement = lazy(() => import('./pages/admin/NotificationManagement').then((module) => ({ default: module.NotificationManagement })));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs').then((module) => ({ default: module.AuditLogs })));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback').then((module) => ({ default: module.AdminFeedback })));
const ArchivesPage = lazy(() => import('./pages/admin/ArchivesPage'));
const BusinessDetails = lazy(() => import('./pages/admin/BusinessDetails').then((module) => ({ default: module.BusinessDetails })));
const ProductLogoManager = lazy(() => import('./pages/admin/ProductLogoManager').then((module) => ({ default: module.ProductLogoManager })));
const CustomFieldBuilder = lazy(() => import('./pages/admin/CustomFieldBuilder').then((module) => ({ default: module.CustomFieldBuilder })));
const CustomModulePage = lazy(() => import('./pages/admin/CustomModulePage').then((module) => ({ default: module.CustomModulePage })));
const AdminQADiscussion = lazy(() => import('./pages/admin/QADiscussion').then((module) => ({ default: module.QADiscussion })));

const InstructorDashboard = lazy(() => import('./pages/instructor/InstructorDashboard').then((module) => ({ default: module.InstructorDashboard })));
const InstructorCourseManagement = lazy(() => import('./pages/instructor/CourseManagement').then((module) => ({ default: module.InstructorCourseManagement })));
const InstructorCourseDetail = lazy(() => import('./pages/instructor/CourseDetail').then((module) => ({ default: module.InstructorCourseDetail })));
const LessonVideoUpload = lazy(() => import('./pages/instructor/LessonVideoUpload').then((module) => ({ default: module.LessonVideoUpload })));
const QuizAssessmentManagement = lazy(() => import('./pages/instructor/QuizAssessmentManagement').then((module) => ({ default: module.QuizAssessmentManagement })));
const QuizEvaluation = lazy(() => import('./pages/instructor/QuizEvaluation').then((module) => ({ default: module.QuizEvaluation })));
const InstructorNotifications = lazy(() => import('./pages/instructor/InstructorNotifications').then((module) => ({ default: module.InstructorNotifications })));
const InstructorFeedback = lazy(() => import('./pages/instructor/InstructorFeedback').then((module) => ({ default: module.InstructorFeedback })));
const InstructorQADiscussion = lazy(() => import('./pages/instructor/QADiscussion').then((module) => ({ default: module.QADiscussion })));

const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard').then((module) => ({ default: module.EmployeeDashboard })));
const MyCourses = lazy(() => import('./pages/employee/MyCourses').then((module) => ({ default: module.MyCourses })));
const CourseEnrollDetail = lazy(() => import('./pages/employee/CourseEnrollDetail').then((module) => ({ default: module.CourseEnrollDetail })));
const CourseViewer = lazy(() => import('./pages/employee/CourseViewer').then((module) => ({ default: module.CourseViewer })));
const CustomModuleViewer = lazy(() => import('./pages/employee/CustomModuleViewer').then((module) => ({ default: module.CustomModuleViewer })));
const MyProgress = lazy(() => import('./pages/employee/MyProgress').then((module) => ({ default: module.MyProgress })));
const MyCertificates = lazy(() => import('./pages/employee/MyCertificates').then((module) => ({ default: module.MyCertificates })));
const QAModule = lazy(() => import('./pages/employee/QAModule').then((module) => ({ default: module.QAModule })));
const MyFeedback = lazy(() => import('./pages/employee/MyFeedback').then((module) => ({ default: module.MyFeedback })));
const EmployeeNotifications = lazy(() => import('./pages/employee/EmployeeNotifications').then((module) => ({ default: module.EmployeeNotifications })));

const ProfileSettings = lazy(() => import('./pages/shared/ProfileSettings').then((module) => ({ default: module.ProfileSettings })));
const YTDebug = lazy(() => import('./pages/debug/YTDebug').then((module) => ({ default: module.YTDebug })));

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('maptech_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [logoutPhase, setLogoutPhase] = useState<'idle' | 'covering' | 'revealing'>('idle');
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCustomModuleId, setSelectedCustomModuleId] = useState<number | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  // Password reset flow state
  const [authPage, setAuthPage] = useState<'login' | 'forgotPassword' | 'verifyOTP' | 'resetPassword'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetMaskedEmail, setResetMaskedEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  const matches = (value: string | null | undefined, query: string) =>
    (value ?? '').toLowerCase().includes(query);

  const findPageByKeywords = (query: string, pages: Array<{ page: string; keywords: string[] }>) => {
    const hit = pages.find((item) => item.keywords.some((keyword) => query.includes(keyword)));
    return hit?.page ?? null;
  };

  const handleGlobalSearchSubmit = async (term: string) => {
    const query = term.trim().toLowerCase();
    setGlobalSearch(term);
    if (!query || !user) return;

    if (user.role === 'employee') {
      handleNavigate('my-courses');
      return;
    }

    if (user.role === 'admin') {
      const page = findPageByKeywords(query, [
        { page: 'dashboard', keywords: ['dashboard', 'home'] },
        { page: 'courses', keywords: ['course', 'courses', 'module', 'lesson', 'quiz'] },
        { page: 'users', keywords: ['user', 'users', 'employee', 'instructor', 'admin'] },
        { page: 'departments', keywords: ['department', 'departments', 'team'] },
        { page: 'enrollments', keywords: ['enrollment', 'enroll', 'student', 'students'] },
        { page: 'reports', keywords: ['report', 'reports', 'analytics', 'trend', 'completion'] },
        { page: 'notifications', keywords: ['notification', 'notifications', 'alert'] },
        { page: 'feedbacks', keywords: ['feedback', 'feedbacks', 'review', 'reviews', 'rating', 'ratings'] },
        { page: 'audit-logs', keywords: ['audit', 'log', 'logs'] },
        { page: 'business-details', keywords: ['business', 'company', 'details', 'vat'] },
        { page: 'product-logos', keywords: ['logo', 'logos', 'branding', 'brand'] },
        { page: 'qa', keywords: ['q&a', 'qa', 'question', 'questions'] },
        { page: 'settings', keywords: ['setting', 'settings', 'profile'] },
      ]);
      if (page) {
        handleNavigate(page);
        return;
      }

      try {
        const [coursesRes, usersRes] = await Promise.all([
          fetch('/api/admin/courses', { credentials: 'include', headers: { Accept: 'application/json' } }),
          fetch('/api/admin/users', { credentials: 'include', headers: { Accept: 'application/json' } }),
        ]);

        if (coursesRes.ok) {
          const courses: any[] = await coursesRes.json();
          if (courses.some((c) => matches(c?.title, query) || matches(c?.description, query))) {
            handleNavigate('courses');
            return;
          }
        }

        if (usersRes.ok) {
          const users: any[] = await usersRes.json();
          if (users.some((u) => matches(u?.fullname, query) || matches(u?.email, query))) {
            handleNavigate('users');
            return;
          }
        }
      } catch {
        // Ignore search fetch errors and fall back to dashboard.
      }

      handleNavigate('dashboard');
      return;
    }

    if (user.role === 'instructor') {
      const page = findPageByKeywords(query, [
        { page: 'dashboard', keywords: ['dashboard', 'home'] },
        { page: 'courses', keywords: ['course', 'courses', 'module', 'lesson', 'content', 'quiz'] },
        { page: 'notifications', keywords: ['notification', 'notifications', 'alert'] },
        { page: 'qa-discussion', keywords: ['q&a', 'qa', 'discussion'] },
        { page: 'feedbacks', keywords: ['feedback', 'review'] },
        { page: 'settings', keywords: ['setting', 'settings', 'profile'] },
      ]);
      if (page) {
        handleNavigate(page);
        return;
      }

      try {
        const coursesRes = await fetch('/api/instructor/courses', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (coursesRes.ok) {
          const courses: any[] = await coursesRes.json();
          if (courses.some((c) => matches(c?.title, query) || matches(c?.description, query))) {
            handleNavigate('courses');
            return;
          }
        }
      } catch {
        // Ignore search fetch errors and fall back to dashboard.
      }

      handleNavigate('dashboard');
    }
  };

  const getRouteStateFromUrl = () => {
    if (typeof window === 'undefined') {
      return { page: null as string | null, courseId: null as string | null };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      page: params.get('page'),
      courseId: params.get('courseId'),
    };
  };

  const updateUrlRouteState = (page: string, courseId?: string) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    params.set('page', page);

    if (courseId) {
      params.set('courseId', courseId);
    } else {
      params.delete('courseId');
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', nextUrl);
  };

  // =========================
  // CHECK AUTH ON MOUNT
  // =========================
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('maptech_theme', theme);
  }, [theme]);

  const renderThemeToggle = () => (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      className="fixed bottom-5 right-5 z-[100] group"
    >
      <span className="sr-only">Toggle dark mode</span>
      <span className="inline-flex items-center gap-3 rounded-full border border-slate-300/70 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-xl backdrop-blur-md transition-all duration-300 group-hover:shadow-2xl dark:border-slate-600/70 dark:bg-slate-900/85 dark:text-slate-100">
        <span className="relative inline-flex h-8 w-[62px] items-center rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200 p-1 transition-colors duration-300 dark:from-slate-700 dark:via-slate-600 dark:to-slate-500">
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-all duration-300 dark:bg-slate-900 dark:ring-white/10 ${
              theme === 'dark' ? 'left-[33px]' : 'left-1'
            }`}
          >
            {theme === 'dark' ? (
              <Moon className="m-1 h-4 w-4 text-cyan-300" />
            ) : (
              <Sun className="m-1 h-4 w-4 text-amber-500" />
            )}
          </span>
        </span>
        <span className="tracking-wide">{theme === 'dark' ? 'Dark' : 'Light'}</span>
      </span>
    </button>
  );

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/user', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const rawRole = (data.role ?? '').toLowerCase();
          const role: User['role'] = rawRole === 'admin' || rawRole === 'instructor' || rawRole === 'employee' ? rawRole : 'employee';
          setUser({
            id: data.id,
            role,
            name: data.fullName ?? data.fullname ?? data.name,
            fullName: data.fullName ?? data.fullname ?? data.name,
            email: data.email,
            department: data.department,
            profile_picture: resolveImageUrl(data.profile_picture || null) || null,
          });
          // persist display name as a quick fallback for UI components
          try { localStorage.setItem('maptech_user_name', (data.fullName ?? data.fullname ?? data.name) || ''); } catch (e) { /* ignore */ }

          // Restore saved page for this role
          const routeState = getRouteStateFromUrl();
          const savedPage = localStorage.getItem(`maptech_page_${role}`);
          const savedCourseId = localStorage.getItem(`maptech_courseId_${role}`);
          if (routeState.page) {
            setCurrentPage(routeState.page);
          } else if (savedPage) {
            setCurrentPage(savedPage);
          }

          if (routeState.courseId) {
            setSelectedCourseId(routeState.courseId);
          } else if (savedCourseId) {
            setSelectedCourseId(savedCourseId);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const routeState = getRouteStateFromUrl();
      if (routeState.page) {
        setCurrentPage(routeState.page);
      }
      setSelectedCourseId(routeState.courseId);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onPicUpdated = (e: Event) => {
      const { profile_picture } = (e as CustomEvent<{ profile_picture: string }>).detail;
      setUser((prev) => prev ? { ...prev, profile_picture } : prev);
    };
    window.addEventListener('profile-picture-updated', onPicUpdated);
    return () => window.removeEventListener('profile-picture-updated', onPicUpdated);
  }, []);

  // =========================
  // HANDLE LOGIN
  // =========================
  const handleLogin = async (
    id: number | undefined,
    role: 'admin' | 'instructor' | 'employee',
    name: string,
    email: string,
    department?: string,
    profile_picture?: string | null
  ) => {
    setUser({
      id,
      role,
      name,
      fullName: name,
      email,
      department,
      profile_picture: resolveImageUrl(profile_picture || null) || null,
    });
    try { localStorage.setItem('maptech_user_name', name || ''); } catch (e) { /* ignore */ }
    setCurrentPage('dashboard');
    localStorage.setItem(`maptech_page_${role}`, 'dashboard');
    localStorage.removeItem(`maptech_courseId_${role}`);
  };

  // ✅ Function to get cookie value
  const getCookie = (name: string): string | undefined => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
  };

  // =========================
  // HANDLE LOGOUT
  // =========================
  const performLogout = async () => {
    if (logoutPhase !== 'idle') return;

    setIsLogoutConfirmOpen(false);

    setLogoutPhase('covering');

    try {
      // Get CSRF token
      await fetch('/sanctum/csrf-cookie', {
        credentials: 'include',
      });

      const xsrfToken = getCookie('XSRF-TOKEN');

      await fetch('/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
        },
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }

    // Always clear client-side auth/session artifacts, even if server logout fails.
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('maptech_user_name');
      ['admin', 'instructor', 'employee'].forEach((role) => {
        localStorage.removeItem(`maptech_courseId_${role}`);
        localStorage.removeItem(`maptech_quizId_${role}`);
      });
      sessionStorage.removeItem('last_time_log');

      // Remove deep-link state so a fresh login starts from default page.
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      // Ignore storage errors (private mode, quota, etc.).
    }

    // Let the cover animation complete before switching to login.
    await new Promise((resolve) => window.setTimeout(resolve, 260));

    setUser(null);
    setCurrentPage('dashboard');
    setSelectedCourseId(null);
    setGlobalSearch('');

    // Reveal login screen smoothly.
    setLogoutPhase('revealing');
    window.setTimeout(() => {
      setLogoutPhase('idle');
    }, 180);
  };

  const handleLogout = () => {
    if (logoutPhase !== 'idle') return;
    setIsLogoutConfirmOpen(true);
  };

  const logoutOverlay = (
    <div
      className={`ui-screen-wipe ui-screen-wipe--logout ${theme === 'dark' ? 'is-dark' : 'is-light'} ${logoutPhase === 'covering' ? 'is-covering' : ''} ${logoutPhase === 'revealing' ? 'is-revealing' : ''}`}
      aria-hidden="true"
    >
      <div className="ui-screen-wipe__panel">
        <span className="ui-screen-wipe__spinner" />
        <span className="ui-screen-wipe__text">Signing out</span>
      </div>
    </div>
  );

  const logoutConfirmModal = isLogoutConfirmOpen ? (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4"
      onClick={() => {
        if (logoutPhase === 'idle') {
          setIsLogoutConfirmOpen(false);
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
    >
      <div
        className={`w-full max-w-sm rounded-xl border p-5 shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="logout-confirm-title" className="text-base font-semibold">Confirm Sign Out</h3>
        <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
          Are you sure you want to sign out?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(false)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${theme === 'dark' ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={performLogout}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const handleNavigate = (page: string, courseId?: string, quizIdOrModuleId?: number) => {
    setCurrentPage(page);
    if (user) {
      localStorage.setItem(`maptech_page_${user.role}`, page);
    }
    if (courseId) {
      setSelectedCourseId(courseId);
      if (user) {
        localStorage.setItem(`maptech_courseId_${user.role}`, courseId);
      }
    }
    if (!courseId) {
      setSelectedCourseId(null);
      if (user) {
        localStorage.removeItem(`maptech_courseId_${user.role}`);
      }
    }

    updateUrlRouteState(page, courseId);

    // Handle custom module ID for custom-field page, custom-module-viewer, and custom-module-detail
    if ((page === 'custom-field' || page === 'custom-module-viewer' || page === 'custom-module-detail') && typeof quizIdOrModuleId === 'number') {
      setSelectedCustomModuleId(quizIdOrModuleId);
    } else if (page !== 'custom-field' && page !== 'custom-module-viewer' && page !== 'custom-module-detail') {
      setSelectedCustomModuleId(null);
    }

    if (typeof quizIdOrModuleId !== 'undefined' && page !== 'custom-field') {
      if (user) {
        try { localStorage.setItem(`maptech_quizId_${user.role}`, String(quizIdOrModuleId ?? '')); } catch (e) { /* ignore */ }
      }
    }
  };

  // =========================
  // LOADING STATE
  // =========================
  if (isLoading) {
    return (
      <>
        <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-slate-950">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-80"
            style={{
              background:
                'radial-gradient(circle at 20% 20%, rgba(34, 197, 94, 0.24), transparent 28%), radial-gradient(circle at 80% 18%, rgba(16, 185, 129, 0.2), transparent 24%), linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(2, 6, 23, 0.84))',
            }}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-slate-950/65" />

          <div className="relative z-10 w-full max-w-5xl px-6 transition-opacity duration-500 opacity-100">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <img
                    className="h-16 w-auto"
                    src="/assets/Maptech-Official-Logo.png"
                    alt="Maptech LearnHub"
                  />
                  <div className="space-y-3">
                    <div className="h-3 w-40 rounded-full bg-white/20 animate-pulse" />
                    <div className="h-2.5 w-28 rounded-full bg-emerald-300/30 animate-pulse" />
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="h-4 w-52 rounded-full bg-white/15 animate-pulse" />
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[0, 1, 2].map((card) => (
                      <div key={card} className="rounded-2xl border border-white/8 bg-slate-900/35 p-4">
                        <div className="h-10 w-10 rounded-2xl bg-white/10 animate-pulse" />
                        <div className="mt-4 h-3 w-20 rounded-full bg-white/15 animate-pulse" />
                        <div className="mt-2 h-2.5 w-14 rounded-full bg-emerald-300/30 animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
                <div className="h-3 w-32 rounded-full bg-white/15 animate-pulse" />
                <div className="mt-6 space-y-4">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                      <div className="h-2.5 w-24 rounded-full bg-white/15 animate-pulse" />
                      <div className="mt-3 h-2.5 w-full rounded-full bg-white/10 animate-pulse" />
                      <div className="mt-2 h-2.5 w-4/5 rounded-full bg-emerald-300/20 animate-pulse" />
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs font-medium uppercase tracking-[0.28em] text-slate-300/80">
                  Preparing LearnHub
                </p>
              </div>
            </div>
          </div>
        </div>
        {renderThemeToggle()}
        {logoutOverlay}
        {logoutConfirmModal}
      </>
    );
  }

  // Unauthenticated debug route for YouTube player preview
  if (typeof window !== 'undefined' && window.location.pathname === '/yt-debug') {
    return (
      <>
        <YTDebug />
        {renderThemeToggle()}
        {logoutOverlay}
        {logoutConfirmModal}
      </>
    );
  }

  // =========================
  // NOT AUTHENTICATED
  // =========================
  if (!user) {
    // Password reset flow handlers
    const handleForgotPassword = () => setAuthPage('forgotPassword');
    const handleBackToLogin = () => {
      setAuthPage('login');
      setResetEmail('');
      setResetMaskedEmail('');
      setResetToken('');
    };
    const handleOTPSent = (email: string, maskedEmail?: string) => {
      setResetEmail(email);
      setResetMaskedEmail(maskedEmail || '');
      setAuthPage('verifyOTP');
    };
    const handleOTPVerified = (email: string, token: string) => {
      setResetEmail(email);
      setResetToken(token);
      setAuthPage('resetPassword');
    };
    const handlePasswordResetSuccess = () => {
      setAuthPage('login');
      setResetEmail('');
      setResetMaskedEmail('');
      setResetToken('');
    };

    return (
      <>
        {authPage === 'login' && (
          <LoginPage onLogin={handleLogin} onForgotPassword={handleForgotPassword} theme={theme} />
        )}
        {authPage === 'forgotPassword' && (
          <ForgotPasswordPage
            onBackToLogin={handleBackToLogin}
            onOTPSent={handleOTPSent}
            theme={theme}
          />
        )}
        {authPage === 'verifyOTP' && (
          <VerifyOTPPage
            email={resetEmail}
            maskedEmail={resetMaskedEmail}
            onBack={() => setAuthPage('forgotPassword')}
            onVerified={handleOTPVerified}
            theme={theme}
          />
        )}
        {authPage === 'resetPassword' && (
          <ResetPasswordPage
            email={resetEmail}
            resetToken={resetToken}
            onSuccess={handlePasswordResetSuccess}
            onBackToLogin={handleBackToLogin}
            theme={theme}
          />
        )}
        {renderThemeToggle()}
        {logoutOverlay}
        {logoutConfirmModal}
      </>
    );
  }

  // =========================
  // ADMIN
  // =========================
  if (user.role === 'admin') {
    const transitionKey = `${currentPage}:${selectedCourseId ?? ''}`;

    return (
      <>
        <Suspense fallback={<FullscreenLoader message="Loading admin..." />}>
        <AdminLayout
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={user}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        >
          <div key={transitionKey} className="page-open-transition">
            {currentPage === 'dashboard' && <AdminDashboard onNavigate={handleNavigate} />}
            {currentPage === 'departments' && <DepartmentManagement />}
            {currentPage === 'users' && <UserManagement currentUserEmail={user?.email} onLogout={async () => handleLogout()} onNavigate={handleNavigate} />}
            {currentPage === 'archives' && <ArchivesPage currentUserEmail={user?.email} onLogout={async () => handleLogout()} onNavigate={handleNavigate} />}
            {currentPage === 'courses' && <CoursesAndContent onNavigate={handleNavigate} />}
            {currentPage === 'course-detail' && <InstructorCourseDetail courseId={selectedCourseId || ''} onBack={() => handleNavigate('courses')} onManageQuiz={(quizId, courseId) => { setSelectedCourseId(courseId); handleNavigate('course-detail', courseId, quizId); }} apiPrefix="admin" />}
            {currentPage === 'evaluation' && <QuizEvaluation apiPrefix="admin" />}
            {currentPage === 'lessons' && <LessonVideoUpload apiPrefix="admin" />}
            {currentPage === 'enrollments' && <EnrollmentManagement />}
            {currentPage === 'reports' && <ReportsAnalytics />}
            {currentPage === 'notifications' && <NotificationManagement />}
            {currentPage === 'qa' && <AdminQADiscussion userId={user.id} />}
            {currentPage === 'audit-logs' && <AuditLogs />}
            {currentPage === 'business-details' && <BusinessDetails />}
            {currentPage === 'feedbacks' && <AdminFeedback onNavigate={handleNavigate} />}
            {currentPage === 'product-logos' && <ProductLogoManager />}
            {currentPage === 'custom-field' && (
              <CustomFieldBuilder
                onNavigate={handleNavigate}
                initialExpandedModuleId={selectedCustomModuleId}
              />
            )}
            {currentPage === 'settings' && <ProfileSettings />}
          {/* Fallback to custom module page for any unmatched route */}
          {!['dashboard', 'departments', 'users', 'archives', 'courses', 'custom-field', 'course-detail', 'evaluation', 'lessons', 'course-content-editor', 'enrollments', 'reports', 'notifications', 'qa', 'audit-logs', 'business-details', 'feedbacks', 'product-logos', 'settings'].includes(currentPage) && (
            <CustomModulePage routePath={currentPage} />
          )}
          </div>
        </AdminLayout>
        </Suspense>
        {logoutOverlay}
        {logoutConfirmModal}
      </>
    );
  }

  // =========================
  // INSTRUCTOR
  // =========================
  if (user.role === 'instructor') {
    const transitionKey = `${currentPage}:${selectedCourseId ?? ''}`;

    return (
      <>
        <Suspense fallback={<FullscreenLoader message="Loading instructor..." />}>
        <InstructorLayout
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={user}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          globalSearch={globalSearch}
          onGlobalSearch={setGlobalSearch}
          onGlobalSearchSubmit={handleGlobalSearchSubmit}
        >
          <div key={transitionKey} className="page-open-transition">
            {currentPage === 'dashboard' && <InstructorDashboard onNavigate={handleNavigate} />}
            {currentPage === 'courses' && <InstructorCourseManagement onNavigate={handleNavigate} />}
            {currentPage === 'course-detail' && <InstructorCourseDetail courseId={selectedCourseId || ''} onBack={() => handleNavigate('courses')} onManageQuiz={(quizId, courseId) => { setSelectedCourseId(courseId); handleNavigate('course-detail', courseId, quizId); }} />}
            {currentPage === 'custom-module-detail' && selectedCustomModuleId && <CustomModuleViewer moduleId={selectedCustomModuleId} apiPath="instructor/custom-modules" editApiPath="instructor/custom-modules" allowEdit={true} onBack={() => handleNavigate('courses')} />}
            {currentPage === 'lessons' && <LessonVideoUpload />}
            {currentPage === 'quizzes' && <QuizAssessmentManagement />}
            {currentPage === 'evaluation' && <QuizEvaluation />}
            {currentPage === 'qa-discussion' && <InstructorQADiscussion userId={user.id} />}
            {currentPage === 'notifications' && <InstructorNotifications />}
            {currentPage === 'feedbacks' && <InstructorFeedback />}
            {currentPage === 'settings' && <ProfileSettings />}
          </div>
        </InstructorLayout>
        </Suspense>
        {logoutOverlay}
        {logoutConfirmModal}
      </>
    );
  }

  // =========================
  // EMPLOYEE
  // =========================
  if (user.role === 'employee') {
    const transitionKey = `${currentPage}:${selectedCourseId ?? ''}`;

    return (
      <>
        <Suspense fallback={<FullscreenLoader message="Loading learner..." />}>
        <EmployeeLayout
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={user}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          globalSearch={globalSearch}
          onGlobalSearch={setGlobalSearch}
          onGlobalSearchSubmit={handleGlobalSearchSubmit}
        >
          <div key={transitionKey} className="page-open-transition">
            {currentPage === 'dashboard' && <EmployeeDashboard onNavigate={handleNavigate} />}
            {currentPage === 'my-courses' && (
              <MyCourses onNavigate={handleNavigate} globalSearch={globalSearch} />
            )}
            {currentPage === 'course-enroll' && (
              <CourseEnrollDetail
                courseId={selectedCourseId || ''}
                onNavigate={handleNavigate}
                onBack={() => handleNavigate('my-courses')}
              />
            )}
            {currentPage === 'course-viewer' && (
              <CourseViewer
                courseId={selectedCourseId || undefined}
                onBack={() => handleNavigate('my-courses')}
              />
            )}
            {currentPage === 'custom-module-viewer' && selectedCustomModuleId && (
              <CustomModuleViewer
                moduleId={selectedCustomModuleId}
                onBack={() => handleNavigate('dashboard')}
              />
            )}
            {currentPage === 'progress' && <MyProgress />}
            {currentPage === 'certificates' && <MyCertificates />}
            {currentPage === 'qa' && <QAModule userId={user.id} />}
            {currentPage === 'feedback' && <MyFeedback />}
            {currentPage === 'notifications' && <EmployeeNotifications />}
            {currentPage === 'settings' && <ProfileSettings />}
          </div>
        </EmployeeLayout>
        </Suspense>
        {logoutOverlay}
        {logoutConfirmModal}
      </>
    );
  }

  return (
    <>
      <LoginPage onLogin={handleLogin} onForgotPassword={() => setAuthPage('forgotPassword')} theme={theme} />
      {renderThemeToggle()}
      {logoutOverlay}
      {logoutConfirmModal}
    </>
  );
}

export default App;
