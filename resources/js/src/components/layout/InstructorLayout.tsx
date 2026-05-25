import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  MessageCircle,
  LogOut,
  Search,
  Menu,
  Bell,
  Settings,
  FileText,
  Star,
  Moon,
  Sun } from
'lucide-react';
import { NotificationBell } from '../NotificationBell';
import { useBusinessDetails } from '../../hooks/useBusinessDetails';
import { safeArray } from '../../utils/safe';

const toTitleCase = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getInstructorPageTitle = (page: string) => {
  const titles: Record<string, string> = {
    dashboard: 'Dashboard Overview',
    courses: 'Courses and Content',
    'course-detail': 'Course Details',
    'custom-module-detail': 'Custom Module',
    'quiz-management': 'Quiz Management',
    lessons: 'Lessons',
    quizzes: 'Quizzes',
    evaluation: 'Quiz Evaluation',
    'qa-discussion': 'Q&A Discussion',
    notifications: 'Notifications',
    feedbacks: 'Feedbacks',
    settings: 'Settings',
  };

  return titles[page] || toTitleCase(page);
};

const getInstructorPageDescription = (page: string) => {
  const descriptions: Record<string, string> = {
    dashboard: 'See your teaching activity and latest course updates.',
    courses: 'Manage your course materials, modules, and lessons.',
    'course-detail': 'Review course structure and learner progress.',
    'custom-module-detail': 'View and edit the selected custom module.',
    'quiz-management': 'Create, edit, and organize quiz assessments.',
    lessons: 'Upload and maintain lesson videos and resources.',
    quizzes: 'Maintain question sets and quiz content.',
    evaluation: 'Check learner quiz results and performance.',
    'qa-discussion': 'Answer learner questions and moderate discussions.',
    notifications: 'Send announcements and review message history.',
    feedbacks: 'Review feedback from learners and improve delivery.',
    settings: 'Manage your profile and personal preferences.',
  };

  return descriptions[page] || 'Manage this section and keep your content up to date.';
};
interface InstructorLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  globalSearch?: string;
  onGlobalSearch?: (term: string) => void;
  onGlobalSearchSubmit?: (term: string) => void | Promise<void>;
  user: {
    name?: string;
    fullName?: string;
    fullname?: string;
    email: string;
    profile_picture?: string | null;
  };
}
export function InstructorLayout({
  children,
  currentPage,
  onNavigate,
  onLogout,
  theme,
  onToggleTheme,
  globalSearch = '',
  onGlobalSearch,
  onGlobalSearchSubmit,
  user
}: InstructorLayoutProps) {
  const [showPicPreview, setShowPicPreview] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : true));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isDark = theme === 'dark';
  const businessDetails = useBusinessDetails();
  const displayName = user?.fullName ?? user?.fullname ?? user?.name ?? 'Unknown';
  const pageTitle = getInstructorPageTitle(currentPage);
  const pageDescription = getInstructorPageDescription(currentPage);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (desktop) setIsMobileSidebarOpen(false);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isSidebarCompact = isDesktop && !isSidebarHovered;
  const sidebarWidthClass = isDesktop ? (isSidebarHovered ? 'w-64' : 'w-20') : 'w-[86vw] max-w-xs';
  const sidebarTranslateClass = isDesktop || isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full';
  const handleSidebarNavigate = (page: string) => {
    onNavigate(page);
    if (!isDesktop) setIsMobileSidebarOpen(false);
  };
  const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    id: 'courses',
    label: 'Courses & Content',
    icon: BookOpen
  },
  {
    id: 'quiz-management',
    label: 'Quiz Management',
    icon: ClipboardList
  },
  {
    id: 'qa-discussion',
    label: 'Q&A',
    icon: MessageCircle
  },
  {
    id: 'feedbacks',
    label: 'Feedbacks',
    icon: Star
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings
  }];

  return (
    <div className={`app-theme-scope min-h-screen flex w-full min-w-0 overflow-x-clip ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100' : 'bg-slate-50 dark:bg-slate-900 text-slate-900'}`}>
      {!isDesktop && isMobileSidebarOpen && <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-20 bg-slate-950/60" onClick={() => setIsMobileSidebarOpen(false)} />}
      <div
        className={`fixed inset-y-0 left-0 z-30 flex ${sidebarWidthClass} flex-col border-r transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarTranslateClass} ${isDark ? 'border-slate-800/80 bg-slate-950/95 text-white' : 'border-slate-200 bg-white text-slate-800'}`}
        onMouseEnter={() => { if (isDesktop) setIsSidebarHovered(true); }}
        onMouseLeave={() => { if (isDesktop) setIsSidebarHovered(false); }}
      >
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`flex flex-col items-center border-b transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isDark ? 'bg-slate-950 border-transparent' : 'bg-slate-50 border-slate-200'} ${isSidebarCompact ? 'px-2 pt-4 pb-3' : 'px-4 pt-5 pb-4'}`}>
            <img
              className={`w-auto transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isDark ? 'brightness-110 contrast-110' : ''} ${isSidebarCompact ? 'mb-0 h-9' : 'mb-2 h-12'}`}
              src={businessDetails.logo_url}
              alt="Maptech"
            />
            {/* Company name intentionally hidden under the logo */}
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
            <nav className={`mt-5 flex-1 space-y-1 ${isSidebarCompact ? 'px-3' : 'px-2'}`}>
              {safeArray(navItems).map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id ||
                  (item.id === 'courses' && currentPage === 'instructor-course-detail') ||
                  (item.id === 'quiz-management' && currentPage === 'instructor-quiz-builder');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSidebarNavigate(item.id)}
                    title={isSidebarCompact ? item.label : undefined}
                    aria-label={item.label}
                    className={`sidebar-nav-item group flex w-full items-center justify-start rounded-lg text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCompact ? 'px-2 py-3' : 'px-3 py-2.5'} ${isActive ? (isDark ? 'is-active bg-blue-500/20 text-blue-200 ring-1 ring-blue-500/50' : 'is-active bg-blue-600 text-white') : isDark ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}>

                    <Icon
                      className={`h-5 w-5 flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCompact ? 'mx-auto' : 'mr-3'} ${isActive ? (isDark ? 'text-blue-300' : 'text-white') : isDark ? 'text-slate-400 group-hover:text-slate-200' : 'text-slate-500 group-hover:text-slate-900'}`} />

                    <span
                      className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCompact ? 'max-w-0 opacity-0 -translate-x-2' : 'max-w-[170px] opacity-100 translate-x-0'}`}
                    >
                      {item.label}
                    </span>
                  </button>);

              })}
            </nav>
          </div>
          <div className={`flex-shrink-0 flex border-t p-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex-shrink-0 w-full group block">
              <div className="flex items-center gap-3">
                <button
                  onClick={onLogout}
                  className={`flex-shrink-0 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} transition-colors duration-300`}
                  title="Logout">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex w-full min-w-0 flex-col overflow-x-hidden transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={isDesktop ? { paddingLeft: isSidebarHovered ? '16rem' : '5rem' } : undefined}
      >
        <div className={`sticky top-0 z-10 flex min-h-16 flex-wrap items-center border-b ${isDark ? 'bg-slate-900/75 backdrop-blur-md border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          {!isDesktop && (
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
              className={`inline-flex min-h-16 items-center justify-center self-stretch px-4 focus:outline-none ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              <span className="sr-only">{isMobileSidebarOpen ? 'Close sidebar' : 'Open sidebar'}</span>
              <Menu className="h-6 w-6" />
            </button>
          )}
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 overflow-x-hidden px-3 py-3 sm:px-4">
            <div className="order-1 ml-2 md:ml-3 w-full min-w-0 md:w-auto">
              <h1 className={`truncate text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {pageTitle}
              </h1>
              <p className={`truncate text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {pageDescription}
              </p>
            </div>

            <div className="order-2 ml-auto flex items-center gap-3 md:order-3 md:ml-6">
              <button
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="inline-flex items-center"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-300/60 bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors dark:border-slate-600/70 dark:bg-slate-900/85 dark:text-slate-100">
                  <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200 p-0.5 dark:from-slate-700 dark:via-slate-600 dark:to-slate-500">
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-all duration-300 dark:bg-slate-900 dark:ring-white/10 ${
                        theme === 'dark' ? 'left-[22px]' : 'left-0.5'
                      }`}
                    >
                      {theme === 'dark' ? (
                        <Moon className="m-0.5 h-4 w-4 text-cyan-300" />
                      ) : (
                        <Sun className="m-0.5 h-4 w-4 text-amber-500" />
                      )}
                    </span>
                  </span>
                  <span className="tracking-wide">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                </span>
              </button>
              <NotificationBell role="Instructor" onOpenAll={() => onNavigate('notifications')} />

              {/* Profile block */}
              <div className="hidden sm:flex items-center gap-3 mr-2">
                {user.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt={user.name}
                    className="h-9 w-9 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                    onClick={() => setShowPicPreview(true)}
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                    {(displayName?.charAt(0) ?? 'U').toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{displayName}</p>
                  <p className="text-xs font-medium text-slate-400">Instructor</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <main className={`flex-1 min-w-0 overflow-x-auto overflow-y-auto p-4 sm:p-6 ${isDark ? 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900' : 'bg-slate-50 dark:bg-slate-900'}`}>
          {children}
        </main>
      </div>

      {/* Profile Picture Preview Modal */}
      {showPicPreview && user.profile_picture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowPicPreview(false)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={user.profile_picture}
              alt={user.name}
              className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
            />
            <button
              onClick={() => setShowPicPreview(false)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-md hover:bg-slate-100 text-lg font-bold"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>);

}

