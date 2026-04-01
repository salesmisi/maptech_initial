import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { QADiscussion as InstructorQADiscussion } from './pages/instructor/QADiscussion';
import { QADiscussion as AdminQADiscussion } from './pages/admin/QADiscussion';
import { AdminLayout } from './components/layout/AdminLayout';
import { InstructorLayout } from './components/layout/InstructorLayout';
import { EmployeeLayout } from './components/layout/EmployeeLayout';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import DepartmentManagement from './pages/admin/DepartmentManagement.tsx';
import { UserManagement } from './pages/admin/UserManagement';
import { CoursesAndContent } from './pages/admin/CoursesAndContent';
import { CourseContentEditor } from './pages/admin/CourseContentEditor';
import { EnrollmentManagement } from './pages/admin/EnrollmentManagement';
import { ReportsAnalytics } from './pages/admin/ReportsAnalytics';
import { NotificationManagement } from './pages/admin/NotificationManagement';
import { AuditLogs } from './pages/admin/AuditLogs';
import { AdminFeedback } from './pages/admin/AdminFeedback';
import { BusinessDetails } from './pages/admin/BusinessDetails';
import { ProductLogoManager } from './pages/admin/ProductLogoManager';
import { CustomFieldBuilder } from './pages/admin/CustomFieldBuilder';

// Instructor Pages
import { InstructorDashboard } from './pages/instructor/InstructorDashboard';
import { InstructorCourseManagement } from './pages/instructor/CourseManagement';
import { InstructorCourseDetail } from './pages/instructor/CourseDetail';
// InstructorQuizBuilder was unused and removed to fix TS warning
import { QuizAssessmentManagement } from './pages/instructor/QuizAssessmentManagement';
import { LessonVideoUpload } from './pages/instructor/LessonVideoUpload';
import { QuizEvaluation } from './pages/instructor/QuizEvaluation';
import { InstructorNotifications } from './pages/instructor/InstructorNotifications';
import { InstructorFeedback } from './pages/instructor/InstructorFeedback';

// Employee Pages
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { MyCourses } from './pages/employee/MyCourses';
import { CourseEnrollDetail } from './pages/employee/CourseEnrollDetail';
import { CourseViewer } from './pages/employee/CourseViewer';
import { CustomModuleViewer } from './pages/employee/CustomModuleViewer';
import { MyProgress } from './pages/employee/MyProgress';
import { MyCertificates } from './pages/employee/MyCertificates';
import { QAModule } from './pages/employee/QAModule';
import { MyFeedback } from './pages/employee/MyFeedback';
import { EmployeeNotifications } from './pages/employee/EmployeeNotifications';

// Shared Pages
import { ProfileSettings } from './pages/shared/ProfileSettings';
import { YTDebug } from './pages/debug/YTDebug';
import { resolveImageUrl } from './utils/safe';
import { LoadingState } from './components/ui/LoadingState';

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
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCustomModuleId, setSelectedCustomModuleId] = useState<number | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

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
        { page: 'courses', keywords: ['course', 'courses', 'module', 'lesson', 'content'] },
        { page: 'quiz-management', keywords: ['quiz', 'assessment', 'question'] },
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
  const handleLogout = async () => {
    if (logoutPhase !== 'idle') return;
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

    // Handle custom module ID for custom-field page and custom-module-viewer
    if ((page === 'custom-field' || page === 'custom-module-viewer') && typeof quizIdOrModuleId === 'number') {
      setSelectedCustomModuleId(quizIdOrModuleId);
    } else if (page !== 'custom-field' && page !== 'custom-module-viewer') {
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
        <LoadingState message="Loading app" size="lg" className="min-h-screen bg-slate-50 dark:bg-slate-900" />
        <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-slate-950">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-80"
            style={{ backgroundImage: "url('/assets/pasted-image.jpg')" }}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-slate-950/65" />

          <div className="relative z-10 flex flex-col items-center px-6 text-center transition-opacity duration-500 opacity-100">
            <img
              className="h-20 w-auto"
              src="/assets/Maptech-Official-Logo.png"
              alt="Maptech LearnHub"
            />
            <p className="mt-5 text-sm font-medium tracking-wide text-slate-200">Preparing LearnHub...</p>
            <div className="mt-4 h-1 w-44 overflow-hidden rounded-full bg-white/20">
              <span className="block h-full w-full rounded-full bg-green-400 animate-pulse" />
            </div>
          </div>
        </div>
        {renderThemeToggle()}
        {logoutOverlay}
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
      </>
    );
  }

  // =========================
  // NOT AUTHENTICATED
  // =========================
  if (!user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} theme={theme} />
        {renderThemeToggle()}
        {logoutOverlay}
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
        <AdminLayout
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
            {currentPage === 'dashboard' && <AdminDashboard onNavigate={handleNavigate} />}
            {currentPage === 'departments' && <DepartmentManagement />}
            {currentPage === 'users' && <UserManagement currentUserEmail={user?.email} onLogout={handleLogout} />}
            {currentPage === 'courses' && <CoursesAndContent onNavigate={handleNavigate} />}
            {currentPage === 'course-detail' && <InstructorCourseDetail courseId={selectedCourseId || ''} onBack={() => handleNavigate('courses')} onManageQuiz={(quizId, courseId) => { setSelectedCourseId(courseId); handleNavigate('quiz-management', courseId, quizId); }} apiPrefix="admin" />}
            {currentPage === 'enrollments' && <EnrollmentManagement />}
            {currentPage === 'reports' && <ReportsAnalytics />}
            {currentPage === 'notifications' && <NotificationManagement />}
            {currentPage === 'qa' && <AdminQADiscussion userId={user.id} />}
            {currentPage === 'audit-logs' && <AuditLogs />}
            {currentPage === 'business-details' && <BusinessDetails />}
            {currentPage === 'feedbacks' && <AdminFeedback />}
            {currentPage === 'product-logos' && <ProductLogoManager />}
            {currentPage === 'custom-field' && (
              <CustomFieldBuilder
                onNavigate={handleNavigate}
                initialExpandedModuleId={selectedCustomModuleId}
              />
            )}
            {currentPage === 'settings' && <ProfileSettings />}
          </div>
        </AdminLayout>
        {logoutOverlay}
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
            {currentPage === 'dashboard' && <InstructorDashboard />}
            {currentPage === 'courses' && <InstructorCourseManagement onNavigate={handleNavigate} />}
            {currentPage === 'course-detail' && <InstructorCourseDetail courseId={selectedCourseId || ''} onBack={() => handleNavigate('courses')} onManageQuiz={(quizId, courseId) => { setSelectedCourseId(courseId); handleNavigate('quiz-management', courseId, quizId); }} />}
            {currentPage === 'quiz-management' && <QuizAssessmentManagement />}
            {currentPage === 'lessons' && <LessonVideoUpload />}
            {currentPage === 'quizzes' && <QuizAssessmentManagement />}
            {currentPage === 'evaluation' && <QuizEvaluation />}
            {currentPage === 'qa-discussion' && <InstructorQADiscussion userId={user.id} />}
            {currentPage === 'notifications' && <InstructorNotifications />}
            {currentPage === 'feedbacks' && <InstructorFeedback />}
            {currentPage === 'settings' && <ProfileSettings />}
          </div>
        </InstructorLayout>
        {logoutOverlay}
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
            {currentPage === 'progress' && <MyProgress />}
            {currentPage === 'certificates' && <MyCertificates />}
            {currentPage === 'qa' && <QAModule userId={user.id} />}
            {currentPage === 'feedback' && <MyFeedback />}
            {currentPage === 'notifications' && <EmployeeNotifications />}
            {currentPage === 'settings' && <ProfileSettings />}
          </div>
        </EmployeeLayout>
        {logoutOverlay}
      </>
    );
  }

  return (
    <>
      <LoginPage onLogin={handleLogin} theme={theme} />
      <LoginPage onLogin={handleLogin} theme={theme} />
      {renderThemeToggle()}
      {logoutOverlay}
    </>
  );
}

export default App;
