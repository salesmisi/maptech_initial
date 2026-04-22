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
  Menu,
  Video,
  MessageCircle,
  Settings,
  ClipboardList,
  ImagePlus,
  Moon,
  Sun,
  Blocks,
  Clipboard,
  Calendar,
  FileText,
  Briefcase,
  FolderOpen,
  Target,
  CheckSquare,
  Database,
  TrendingUp,
  Activity,
  Package,
  ShoppingCart,
  DollarSign,
  PieChart,
  BarChart2,
  Clock,
  AlertCircle,
  Info,
  HelpCircle,
  Star,
  Tag,
  Filter,
  Grid,
  List,
  Layout,
  Layers,
  Home,
  Folder,
  File,
  Upload,
  Download,
  Share2,
  Link2,
  Cake,
  Gift,
  PartyPopper,
  Heart,
  Award,
  Trophy,
  Medal,
  Smile,
  ThumbsUp,
  Coffee,
  Utensils,
  Car,
  Plane,
  Map,
  MapPin,
  Phone,
  Mail,
  Send,
  Inbox,
  Archive,
  Trash2,
  Edit,
  Eye,
  Lock,
  Unlock,
  Key,
  Shield,
  Zap,
  Lightbulb,
  Rocket,
  Flag,
  Bookmark,
  Hash,
  AtSign,
  Percent,
  DollarSign as Dollar,
  CreditCard,
  Wallet,
  Receipt,
  FileCheck,
  FilePlus,
  FileWarning,
  Megaphone,
  Volume2,
  Music,
  Image,
  Camera,
  Film,
  Mic,
  Headphones,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Printer,
  Wifi,
  Globe,
  Cloud,
  Sun as SunIcon,
  CloudRain,
  Snowflake,
  Thermometer,
  Droplet,
  Wind,
  Umbrella,
  LucideIcon
} from 'lucide-react';
import { NotificationBell } from '../NotificationBell';
import { useBusinessDetails } from '../../hooks/useBusinessDetails';

// Icon mapping for dynamic icon rendering
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  BookOpen,
  Building2,
  UserPlus,
  BarChart3,
  Bell,
  MessageCircle,
  Settings,
  ClipboardList,
  ImagePlus,
  Blocks,
  Clipboard,
  Calendar,
  FileText,
  Briefcase,
  FolderOpen,
  Target,
  CheckSquare,
  Database,
  TrendingUp,
  Activity,
  Package,
  ShoppingCart,
  DollarSign,
  PieChart,
  BarChart2,
  Clock,
  AlertCircle,
  Info,
  HelpCircle,
  Star,
  Tag,
  Filter,
  Grid,
  List,
  Layout,
  Layers,
  Home,
  Folder,
  File,
  Upload,
  Download,
  Share2,
  Link2,
  // Celebration & Events
  Cake,
  Gift,
  PartyPopper,
  Heart,
  Award,
  Trophy,
  Medal,
  Smile,
  ThumbsUp,
  // Food & Lifestyle
  Coffee,
  Utensils,
  // Travel
  Car,
  Plane,
  Map,
  MapPin,
  // Communication
  Phone,
  Mail,
  Send,
  Inbox,
  Archive,
  // Actions
  Trash2,
  Edit,
  Eye,
  Lock,
  Unlock,
  Key,
  Shield,
  // Ideas & Progress
  Zap,
  Lightbulb,
  Rocket,
  Flag,
  Bookmark,
  // Symbols
  Hash,
  AtSign,
  Percent,
  // Finance
  CreditCard,
  Wallet,
  Receipt,
  // Files
  FileCheck,
  FilePlus,
  FileWarning,
  // Media
  Megaphone,
  Volume2,
  Music,
  Image,
  Camera,
  Film,
  Mic,
  Headphones,
  // Devices
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Printer,
  Wifi,
  Globe,
  Cloud,
  // Weather
  Umbrella,
};

// Helper to get icon by name
const getIconByName = (name: string): LucideIcon => {
  return iconMap[name] || Blocks;
};

const toTitleCase = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getAdminPageTitle = (page: string) => {
  const titles: Record<string, string> = {
    dashboard: 'Dashboard Overview',
    departments: 'Department Management',
    users: 'User Management',
    courses: 'Courses and Content',
    'course-detail': 'Course Details',
    enrollments: 'Enrollment Management',
    reports: 'Reports and Analytics',
    notifications: 'Notifications',
    qa: 'Q&A Discussion',
    'audit-logs': 'Audit Logs',
    'business-details': 'Business Details',
    feedbacks: 'Feedbacks',
    'product-logos': 'Product Logo Manager',
    'custom-field': 'Custom Field Builder',
    settings: 'Settings',
  };

  return titles[page] || toTitleCase(page);
};

const getAdminPageDescription = (page: string) => {
  const descriptions: Record<string, string> = {
    dashboard: 'Track platform health, activity, and performance trends.',
    departments: 'Organize teams, heads, and subdepartments in one place.',
    users: 'Manage user accounts, roles, and access status.',
    courses: 'Create, update, and maintain course content and structure.',
    'course-detail': 'Review course information, progress, and enrolled members.',
    enrollments: 'Handle course enrollments and participant assignments.',
    reports: 'Analyze completion, engagement, and learning outcomes.',
    notifications: 'Send announcements and review message history.',
    qa: 'Monitor and respond to questions across lessons and modules.',
    'audit-logs': 'Review system actions and user activity trails.',
    'business-details': 'Configure company profile and organization details.',
    feedbacks: 'Review user feedback and improve learning experience.',
    'product-logos': 'Manage product logos and branding assets.',
    'custom-field': 'Create and maintain custom fields and modules.',
    settings: 'Update account preferences and profile settings.',
  };

  return descriptions[page] || 'Manage this section and keep data up to date.';
};
import { safeArray } from '../../utils/safe';
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
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : true));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(user?.fullName ?? user?.fullname ?? user?.name ?? null);
  const [customNavItems, setCustomNavItems] = useState<any[]>([]);
  const isDark = theme === 'dark';
  const businessDetails = useBusinessDetails();
  const pageTitle = getAdminPageTitle(currentPage);
  const pageDescription = getAdminPageDescription(currentPage);

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

  // Load custom UI component modules
  const loadCustomNavItems = async () => {
    try {
      const res = await fetch('/api/admin/custom-modules/ui-components', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) return;
      const data = await res.json();
      setCustomNavItems(data);
    } catch (e) {
      console.error('Failed to load custom navigation items:', e);
    }
  };

  useEffect(() => {
    loadCustomNavItems();
  }, []);

  // Listen for UI component changes (create, update, delete)
  useEffect(() => {
    const handleUIComponentChange = () => {
      loadCustomNavItems();
    };
    window.addEventListener('ui-component-changed', handleUIComponentChange);
    return () => {
      window.removeEventListener('ui-component-changed', handleUIComponentChange);
    };
  }, []);
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
    id: 'custom-field',
    label: 'Custom Field Builder',
    icon: Blocks
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
  },
  {
    id: 'business-details',
    label: 'Business Details',
    icon: Building2
  }];

  // Merge custom UI component modules into navigation
  const allNavItems = [
    ...navItems.slice(0, 5), // Dashboard to Custom Field Builder
    ...customNavItems.map((item: any) => ({
      id: item.route_path,
      label: item.title,
      icon: getIconByName(item.icon_name),
      isCustom: true,
    })),
    ...navItems.slice(5), // Rest of the items (Q&A onwards)
  ];

  return (
    <div className={`app-theme-scope min-h-screen flex ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100' : 'bg-slate-50 dark:bg-slate-900 text-slate-900'}`}>
      {!isDesktop && isMobileSidebarOpen && <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-20 bg-slate-950/60" onClick={() => setIsMobileSidebarOpen(false)} />}
      {/* Sidebar (fixed on all viewports to avoid layout shift when zooming) */}
      <div
        className={`fixed inset-y-0 left-0 z-30 flex ${sidebarWidthClass} flex-col border-r transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarTranslateClass} ${isDark ? 'border-slate-800/80 bg-slate-950/95 text-white' : 'border-slate-200 bg-slate-900 text-white'}`}
        onMouseEnter={() => { if (isDesktop) setIsSidebarHovered(true); }}
        onMouseLeave={() => { if (isDesktop) setIsSidebarHovered(false); }}
      >
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`flex flex-col items-center bg-slate-950 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCompact ? 'px-2 pt-6 pb-4' : 'px-4 pt-8 pb-6'}`}>
            <img
              className={`w-auto brightness-110 contrast-110 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCompact ? 'mb-0 h-10' : 'mb-3 h-16'}`}
              src={businessDetails.logo_url}
              alt="Maptech"
            />
            <p
              className={`overflow-hidden text-center text-sm font-medium leading-tight transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isDark ? 'text-slate-400' : 'text-slate-300'} ${isSidebarCompact ? 'mt-0 max-h-0 opacity-0 -translate-y-1' : 'mt-1 max-h-12 opacity-100 translate-y-0'}`}
            >
              {businessDetails.company_name}
            </p>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
            <nav className={`mt-5 flex-1 space-y-1 ${isSidebarCompact ? 'px-3' : 'px-2'}`}>
              {safeArray(allNavItems).map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id || (item.id === 'courses' && currentPage === 'course-detail');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSidebarNavigate(item.id)}
                    title={isSidebarCompact ? item.label : undefined}
                    aria-label={item.label}
                    className={`sidebar-nav-item group flex w-full items-center justify-start rounded-lg text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCompact ? 'px-2 py-3' : 'px-3 py-2.5'} ${isActive ? 'is-active bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/50' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}>

                    <Icon
                      className={`h-5 w-5 flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCompact ? 'mx-auto' : 'mr-3'} ${isActive ? 'text-emerald-300' : 'text-slate-400 group-hover:text-slate-200'}`} />

                    <span
                      className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCompact ? 'max-w-0 opacity-0 -translate-x-2' : 'max-w-[170px] opacity-100 translate-x-0'}`}
                    >
                      {item.label}
                    </span>
                  </button>);

              })}
            </nav>
          </div>
          <div className={`flex-shrink-0 flex border-t p-4 ${isDark ? 'border-slate-800/80' : 'border-slate-800'}`}>
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
                <div className={`ml-3 min-w-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCompact ? 'max-w-0 opacity-0' : 'max-w-[140px] opacity-100'}`}>
                  <p className={`truncate text-sm font-medium ${isDark ? 'text-slate-100' : 'text-white'}`}>{displayName ?? 'Unknown'}</p>
                  <p className="text-xs font-medium text-slate-400">
                    Administrator
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  className="ml-auto text-slate-400 hover:text-white transition-colors duration-300"
                  title="Logout">

                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className="flex w-full flex-col transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
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
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="ml-2 md:ml-3 min-w-0">
              <h1 className={`truncate text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {pageTitle}
              </h1>
              <p className={`truncate text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {pageDescription}
              </p>
            </div>
            <div className="flex items-center gap-2 md:gap-0">
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
              <NotificationBell role="Admin" onOpenAll={() => onNavigate('notifications')} />
            </div>
          </div>
        </div>

        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${isDark ? 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900' : 'bg-slate-50 dark:bg-slate-900'}`}>
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

