import React, { useState } from 'react';
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
  Settings } from
'lucide-react';
interface EmployeeLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  user: {
    name: string;
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
  user,
  globalSearch = '',
  onGlobalSearch,
}: EmployeeLayoutProps) {
  const [showPicPreview, setShowPicPreview] = useState(false);
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
    id: 'settings',
    label: 'Settings',
    icon: Settings
  }];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col fixed inset-y-0 z-10 bg-slate-900 text-white">
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
                  {user.name.charAt(0)}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-white">{user.name}</p>
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
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow-sm border-b border-slate-200">
          <button
            type="button"
            className="px-4 border-r border-slate-200 text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 md:hidden">

            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <form className="w-full flex md:ml-0" onSubmit={(e) => e.preventDefault()}>
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
                    placeholder="Search all courses..."
                    type="search"
                    name="search"
                    value={globalSearch}
                    onChange={(e) => onGlobalSearch?.(e.target.value)} />

                </div>
              </form>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <button className="bg-white p-1 rounded-full text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                <span className="sr-only">View notifications</span>
                <Bell className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
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
