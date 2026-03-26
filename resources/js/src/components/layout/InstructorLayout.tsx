import React, { useState } from 'react';
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
  Moon,
  Sun } from
'lucide-react';
import { NotificationBell } from '../NotificationBell';
import { useBusinessDetails } from '../../hooks/useBusinessDetails';
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
  const isDark = theme === 'dark';
  const businessDetails = useBusinessDetails();
  const displayName = user?.fullName ?? user?.fullname ?? user?.name ?? 'Unknown';
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
    <div className={`app-theme-scope min-h-screen flex ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100' : 'bg-slate-50 dark:bg-slate-900 text-slate-900'}`}>
      <div className="hidden md:flex md:w-64 md:flex-col fixed inset-y-0 z-10 bg-slate-900 text-white">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col items-center pt-8 pb-6 px-4 bg-slate-950">
            <img
              className="h-16 w-auto mb-3 brightness-110 contrast-110"
              src={businessDetails.logo_url}
              alt="Maptech"
            />

            <p className="text-center text-sm font-medium text-slate-300 leading-tight">
              {businessDetails.company_name}
            </p>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id ||
                  (item.id === 'courses' && currentPage === 'instructor-course-detail') ||
                  (item.id === 'quiz-management' && currentPage === 'instructor-quiz-builder');
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full transition-colors ${isActive ? 'bg-green-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>

                    <Icon
                      className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`} />

                    {item.label}
                  </button>);

              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-slate-800 p-4">
            <div className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                {user.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt={user.name}
                    className="h-9 w-9 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-amber-400 transition"
                    onClick={() => setShowPicPreview(true)}
                  />
                ) : (
                  <div className="inline-block h-9 w-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold">
                    {(displayName?.charAt(0) ?? 'U').toUpperCase()}
                  </div>
                )}
                <div className="ml-3">
                  <p className="text-sm font-medium text-white">{displayName}</p>
                  <p className="text-xs font-medium text-slate-400">
                    Instructor
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  className="ml-auto text-slate-400 hover:text-white"
                  title="Logout">

                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full md:pl-64">
        <div className={`sticky top-0 z-10 flex-shrink-0 flex h-16 items-center border-b ${isDark ? 'bg-slate-900/75 backdrop-blur-md border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <button
            type="button"
            className={`px-4 border-r focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 md:hidden ${isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-500'}`}>

            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center">
              <form
                className="w-full max-w-4xl md:ml-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  onGlobalSearchSubmit?.(globalSearch);
                }}
              >
                <div className={`relative w-full h-10 text-slate-400 ${isDark ? 'focus-within:text-slate-300' : 'focus-within:text-slate-600'}`}>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    className={`block w-full h-10 rounded-xl pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/40 sm:text-sm ${isDark ? 'bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-400' : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-500'}`}
                    placeholder="Search courses, quizzes..."
                    type="search"
                    value={globalSearch}
                    onChange={(e) => onGlobalSearch?.(e.target.value)} />

                </div>
              </form>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <button
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="mr-2 inline-flex items-center"
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
            </div>
          </div>
        </div>
        <main className={`flex-1 overflow-y-auto p-6 ${isDark ? 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900' : 'bg-slate-50 dark:bg-slate-900'}`}>
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

