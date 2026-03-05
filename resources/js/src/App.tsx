import { useState, useEffect } from 'react';
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

// Instructor Pages
import { InstructorDashboard } from './pages/instructor/InstructorDashboard';
import { LessonVideoUpload } from './pages/instructor/LessonVideoUpload';
import { QuizAssessmentManagement } from './pages/instructor/QuizAssessmentManagement';
import { QuizEvaluation } from './pages/instructor/QuizEvaluation';

// Employee Pages
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { MyCourses } from './pages/employee/MyCourses';
import { CourseViewer } from './pages/employee/CourseViewer';
import { MyProgress } from './pages/employee/MyProgress';
import { MyCertificates } from './pages/employee/MyCertificates';
import { QAModule } from './pages/employee/QAModule';
import { MyFeedback } from './pages/employee/MyFeedback';

// Shared Pages
import { ProfileSettings } from './pages/shared/ProfileSettings';

interface User {
  role: 'admin' | 'instructor' | 'employee';
  name: string;
  email: string;
  department?: string;
  profile_picture?: string | null;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // =========================
  // CHECK AUTH ON MOUNT
  // =========================
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
          const role = data.role?.toLowerCase();
          setUser({
            role,
            name: data.name,
            email: data.email,
            department: data.department,
            profile_picture: data.profile_picture,
          });

          // Restore saved page for this role
          const savedPage = localStorage.getItem(`maptech_page_${role}`);
          const savedCourseId = localStorage.getItem(`maptech_courseId_${role}`);
          if (savedPage) setCurrentPage(savedPage);
          if (savedCourseId) setSelectedCourseId(savedCourseId);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
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
    setUser({ role, name, email, department, profile_picture });
    setCurrentPage('dashboard');
    localStorage.setItem(`maptech_page_${role}`, 'dashboard');
    localStorage.removeItem(`maptech_courseId_${role}`);
  };

  // ✅ Function to get cookie value
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
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

  const handleNavigate = (page: string, courseId?: string) => {
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
  };

  // =========================
  // LOADING STATE
  // =========================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  // =========================
  // NOT AUTHENTICATED
  // =========================
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // =========================
  // ADMIN
  // =========================
  if (user.role === 'admin') {
    return (
      <AdminLayout
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={user}
      >
        {currentPage === 'dashboard' && <AdminDashboard />}
        {currentPage === 'departments' && <DepartmentManagement />}
        {currentPage === 'users' && <UserManagement />}
        {currentPage === 'courses' && <CoursesAndContent />}
        {currentPage === 'enrollments' && <EnrollmentManagement />}
        {currentPage === 'reports' && <ReportsAnalytics />}
        {currentPage === 'notifications' && <NotificationManagement />}
        {currentPage === 'qa' && <AdminQADiscussion />}
        {currentPage === 'settings' && <ProfileSettings />}
      </AdminLayout>
    );
  }

  // =========================
  // INSTRUCTOR
  // =========================
  if (user.role === 'instructor') {
    return (
      <InstructorLayout
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={user}
      >
        {currentPage === 'dashboard' && <InstructorDashboard />}
        {currentPage === 'lessons' && <LessonVideoUpload />}
        {currentPage === 'quizzes' && <QuizAssessmentManagement />}
        {currentPage === 'evaluation' && <QuizEvaluation />}
        {currentPage === 'qa-discussion' && <InstructorQADiscussion />}
        {currentPage === 'settings' && <ProfileSettings />}
      </InstructorLayout>
    );
  }

  // =========================
  // EMPLOYEE
  // =========================
  if (user.role === 'employee') {
    return (
      <EmployeeLayout
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={user}
      >
        {currentPage === 'dashboard' && <EmployeeDashboard onNavigate={handleNavigate} />}
        {currentPage === 'my-courses' && (
          <MyCourses onNavigate={handleNavigate} />
        )}
        {currentPage === 'course-viewer' && (
          <CourseViewer
            courseId={selectedCourseId || undefined}
            onBack={() => handleNavigate('my-courses')}
          />
        )}
        {currentPage === 'progress' && <MyProgress />}
        {currentPage === 'certificates' && <MyCertificates />}
        {currentPage === 'qa' && <QAModule />}
        {currentPage === 'feedback' && <MyFeedback />}
        {currentPage === 'settings' && <ProfileSettings />}
      </EmployeeLayout>
    );
  }

  return <LoginPage onLogin={handleLogin} />;
}

export default App;
