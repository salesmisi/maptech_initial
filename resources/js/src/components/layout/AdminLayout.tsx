import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Building2,
  UserPlus,
  BarChart3,
  Bell,
  LogOut,
  Search,
  Menu,
  Video,
  MessageCircle,
  Settings,
  ClipboardList,
  ImagePlus,
  Moon,
  Sun
} from 'lucide-react';
import { NotificationBell } from '../NotificationBell';
interface AdminLayoutProps {
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
}
export function AdminLayout({
  children,
  currentPage,
  onNavigate,
  onLogout,
  theme,
  onToggleTheme,
  user
}: AdminLayoutProps) {
  const [showPicPreview, setShowPicPreview] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(user?.fullName ?? user?.fullname ?? user?.name ?? null);

  // If user prop lacks a name, try fetching profile as a fallback (helps when time-in event updates profile separately)
  useEffect(() => {
    if (displayName) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/profile', { credentials: 'include', headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && (data?.fullName || data?.fullname || data?.name)) {
          setDisplayName(data.fullName ?? data.fullname ?? data.name);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [displayName]);
  const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    id: 'departments',
    label: 'Departments',
    icon: Building2
  },
  {
    id: 'users',
    label: 'User Management',
    icon: Users
  },
  {
    id: 'courses',
    label: 'Courses and Content',
    icon: BookOpen
  },
  {
    id: 'qa',
    label: 'Q&A',
    icon: MessageCircle
  },
  {
    id: 'enrollments',
    label: 'Enrollments',
    icon: UserPlus
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    icon: BarChart3
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    icon: ClipboardList
  },
  {
    id: 'product-logos',
    label: 'Product Logo Manager',
    icon: ImagePlus
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings
  }];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Sidebar (fixed on all viewports to avoid layout shift when zooming) */}
      <div className="flex w-64 flex-col fixed inset-y-0 z-10 bg-slate-900 text-white">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col items-center pt-8 pb-6 px-4 bg-slate-950">
            <img
              className="h-16 w-auto mb-3 brightness-110 contrast-110"
              src="/assets/Maptech-Official-Logo.png"
              alt="Maptech"
            />

            <p className="text-center text-sm font-medium text-slate-300 leading-tight">
              Maptech Information Solutions<br />
              Inc.
            </p>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id || (item.id === 'courses' && currentPage === 'course-detail');
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
                    className="h-9 w-9 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-green-400 transition"
                    onClick={() => setShowPicPreview(true)}
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                    {(displayName?.charAt(0) ?? 'U').toUpperCase()}
                  </div>
                )}
                <div className="ml-3">
                  <p className="text-sm font-medium text-white">{displayName ?? 'Unknown'}</p>
                  <p className="text-xs font-medium text-slate-400">
                    Administrator
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

      {/* Main content */}
      <div className="flex flex-col w-full pl-64">
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            className="px-4 border-r border-slate-200 text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 md:hidden">

            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <form className="w-full flex md:ml-0" action="#" method="GET">
                <label htmlFor="search-field" className="sr-only">
                  Search
                </label>
                <div className="relative w-full text-slate-400 focus-within:text-slate-600">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    id="search-field"
                    className="block w-full h-full pl-8 pr-3 py-2 border-transparent text-slate-900 placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-0 focus:border-transparent sm:text-sm"
                    placeholder="Search courses, users, or reports..."
                    type="search"
                    name="search" />

                </div>
              </form>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <button
                onClick={onToggleTheme}
                className="mr-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <NotificationBell role="Admin" onOpenAll={() => onNavigate('notifications')} />
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6">
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

