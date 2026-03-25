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
import DepartmentManagement from './pages/admin/DepartmentManagement';
import { UserManagement } from './pages/admin/UserManagement';
import { CoursesAndContent } from './pages/admin/CoursesAndContent';
import { EnrollmentManagement } from './pages/admin/EnrollmentManagement';
import { ReportsAnalytics } from './pages/admin/ReportsAnalytics';
import { NotificationManagement } from './pages/admin/NotificationManagement';
import { AuditLogs } from './pages/admin/AuditLogs';
import { AdminFeedback } from './pages/admin/AdminFeedback';
import { ProductLogoManager } from './pages/admin/ProductLogoManager';

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
import { MyProgress } from './pages/employee/MyProgress';
import { MyCertificates } from './pages/employee/MyCertificates';
import { QAModule } from './pages/employee/QAModule';
import { MyFeedback } from './pages/employee/MyFeedback';
import { EmployeeNotifications } from './pages/employee/EmployeeNotifications';

// Shared Pages
import { ProfileSettings } from './pages/shared/ProfileSettings';
import { YTDebug } from './pages/debug/YTDebug';

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
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

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
      className="fixed bottom-5 right-5 z-[100] inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg transition hover:bg-slate-100"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
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
            profile_picture: data.profile_picture,
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
    role: 'admin' | 'instructor' | 'employee',
    name: string,
    email: string,
    department?: string,
    profile_picture?: string | null
  ) => {
    setUser({ role, name, fullName: name, email, department, profile_picture });
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

    setUser(null);
    setCurrentPage('dashboard');
  };

  const handleNavigate = (page: string, courseId?: string, quizId?: number) => {
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

    if (typeof quizId !== 'undefined') {
      if (user) {
        try { localStorage.setItem(`maptech_quizId_${user.role}`, String(quizId ?? '')); } catch (e) { /* ignore */ }
      }
    }
  };

  // =========================
  // LOADING STATE
  // =========================
  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-slate-600">Loading...</div>
        </div>
        {renderThemeToggle()}
      </>
    );
  }

  // Unauthenticated debug route for YouTube player preview
  if (typeof window !== 'undefined' && window.location.pathname === '/yt-debug') {
    return (
      <>
        <YTDebug />
        {renderThemeToggle()}
      </>
    );
  }

  // =========================
  // NOT AUTHENTICATED
  // =========================
  if (!user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        {renderThemeToggle()}
      </>
    );
  }

  // =========================
  // ADMIN
  // =========================
  if (user.role === 'admin') {
    return (
      <>
        <AdminLayout
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={user}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        >
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
          {currentPage === 'feedbacks' && <AdminFeedback />}
          {currentPage === 'product-logos' && <ProductLogoManager />}
          {currentPage === 'settings' && <ProfileSettings />}
        </AdminLayout>
      </>
    );
  }

  // =========================
  // INSTRUCTOR
  // =========================
  if (user.role === 'instructor') {
    return (
      <>
        <InstructorLayout
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={user}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        >
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
        </InstructorLayout>
      </>
    );
  }

  // =========================
  // EMPLOYEE
  // =========================
  if (user.role === 'employee') {
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
          onGlobalSearch={(term) => { setGlobalSearch(term); setCurrentPage('my-courses'); }}
        >
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
        </EmployeeLayout>
      </>
    );
  }

  return (
    <>
      <LoginPage onLogin={handleLogin} />
      {renderThemeToggle()}
    </>
  );
}

export default App;
