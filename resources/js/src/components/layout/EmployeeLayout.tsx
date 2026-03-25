import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Award,
  MessageSquare,
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
interface EmployeeLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  user: {
    name?: string;
    fullName?: string;
    fullname?: string;
    email: string;
    profile_picture?: string | null;
  };
  globalSearch?: string;
  onGlobalSearch?: (term: string) => void;
}
export function EmployeeLayout({
  children,
  currentPage,
  onNavigate,
  onLogout,
  theme,
  onToggleTheme,
  user,
  globalSearch = '',
  onGlobalSearch,
}: EmployeeLayoutProps) {
  const [showPicPreview, setShowPicPreview] = useState(false);
  const isDark = theme === 'dark';
  const businessDetails = useBusinessDetails();
  let storedName: string | null = null;
  try {
    storedName = typeof localStorage !== 'undefined' ? localStorage.getItem('maptech_user_name') : null;
  } catch (e) {
    storedName = null;
  }

  const initialName = user?.fullName || user?.fullname || user?.name || storedName || '';
  const [displayName, setDisplayName] = useState<string>(initialName);

  useEffect(() => {
    // Always fetch the authoritative user record on mount to ensure sidebar shows the correct name.
    let cancelled = false;
    (async () => {
      try {
        // first try localStorage fallback (set by App) to avoid flashing
        try {
          if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('maptech_user_name');
            if (stored) setDisplayName(stored);
          }
        } catch (e) {
          // ignore
        }

        const res = await fetch('/user', { credentials: 'include', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled) return;
        const name = d.fullName || d.fullname || d.name;
        if (name) {
          setDisplayName(name);
          try { localStorage.setItem('maptech_user_name', name); } catch (e) { /* ignore */ }
        }
      } catch {
        // ignore
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Update display name if `user` prop changes after initial mount
  useEffect(() => {
    try {
      const nameFromUser = user?.fullName || user?.fullname || user?.name;
      if (nameFromUser) {
        setDisplayName(nameFromUser);
        try { localStorage.setItem('maptech_user_name', nameFromUser); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      // ignore
    }
  }, [user]);
  const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    id: 'my-courses',
    label: 'My Courses',
    icon: BookOpen
  },
  {
    id: 'progress',
    label: 'My Progress',
    icon: TrendingUp
  },
  {
    id: 'certificates',
    label: 'Certificates',
    icon: Award
  },
  {
    id: 'qa',
    label: 'Q&A',
    icon: MessageCircle
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: MessageSquare
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
      {/* Sidebar */}
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
                  (item.id === 'my-courses' && (currentPage === 'course-viewer' || currentPage === 'course-enroll'));
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
                <div className="h-9 w-9 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                  {(displayName?.charAt(0) ?? 'E').toUpperCase()}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-white">{displayName || ''}</p>
                  <p className="text-xs font-medium text-slate-400">Employee</p>
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

      {/* Main content */}
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
              <form className="w-full flex md:ml-0" onSubmit={(e) => e.preventDefault()}>
                <label htmlFor="search-field" className="sr-only">
                  Search
                </label>
                <div className={`relative w-full max-w-4xl h-10 text-slate-400 ${isDark ? 'focus-within:text-slate-300' : 'focus-within:text-slate-600'}`}>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    id="search-field"
                    className={`block w-full h-10 rounded-xl pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/40 sm:text-sm ${isDark ? 'bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-400' : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-500'}`}
                    placeholder="Search all courses..."
                    type="search"
                    name="search"
                    value={globalSearch}
                    onChange={(e) => onGlobalSearch?.(e.target.value)} />

                </div>
              </form>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <button
                onClick={onToggleTheme}
                className={`mr-3 inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold ${isDark ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <NotificationBell role="Employee" onOpenAll={() => onNavigate('notifications')} />
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
