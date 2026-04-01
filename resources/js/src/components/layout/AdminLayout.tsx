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
  X,
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
interface AdminLayoutProps {
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
export function AdminLayout({
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
}: AdminLayoutProps) {
  const [showPicPreview, setShowPicPreview] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : true));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('maptech_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [displayName, setDisplayName] = useState<string | null>(user?.fullName ?? user?.fullname ?? user?.name ?? null);
  const [customNavItems, setCustomNavItems] = useState<any[]>([]);
  const isDark = theme === 'dark';
  const businessDetails = useBusinessDetails();

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
    try {
      localStorage.setItem('maptech_admin_sidebar_collapsed', String(isSidebarCollapsed));
    } catch {
      // ignore persistence errors
    }
  }, [isSidebarCollapsed]);
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
  const isSidebarCompact = isDesktop && isSidebarCollapsed;
  const isSidebarVisible = isDesktop ? !isSidebarCollapsed : isMobileSidebarOpen;
  const sidebarWidthClass = isDesktop ? (isSidebarCollapsed ? 'w-20' : 'w-64') : 'w-[86vw] max-w-xs';
  const sidebarTranslateClass = isDesktop || isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full';
  const toggleSidebar = () => {
    if (isDesktop) {
      setIsSidebarCollapsed((prev) => !prev);
      return;
    }
    setIsMobileSidebarOpen((prev) => !prev);
  };
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
      <div className={`fixed inset-y-0 left-0 z-30 flex ${sidebarWidthClass} flex-col border-r transition-all duration-300 ${sidebarTranslateClass} ${isDark ? 'border-slate-800/80 bg-slate-950/95 text-white' : 'border-slate-200 bg-slate-900 text-white'}`}>
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`flex flex-col items-center bg-slate-950 transition-all duration-300 ${isSidebarCompact ? 'px-2 pt-6 pb-4' : 'px-4 pt-8 pb-6'}`}>
            <img
              className={`w-auto brightness-110 contrast-110 transition-all duration-300 ${isSidebarCompact ? 'mb-0 h-10' : 'mb-3 h-16'}`}
              src={businessDetails.logo_url}
              alt="Maptech"
            />

            {!isSidebarCompact && (
              <p className={`text-center text-sm font-medium leading-tight ${isDark ? 'text-slate-400' : 'text-slate-300'}`}>
                {businessDetails.company_name}
              </p>
            )}
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
            <nav className={`mt-5 flex-1 space-y-1 ${isSidebarCompact ? 'px-3' : 'px-2'}`}>
              {allNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id || (item.id === 'courses' && currentPage === 'course-detail');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSidebarNavigate(item.id)}
                    title={isSidebarCompact ? item.label : undefined}
                    aria-label={item.label}
                    className={`group flex w-full items-center rounded-lg text-sm font-medium transition-colors ${isSidebarCompact ? 'justify-center px-2 py-3' : 'px-3 py-2.5'} ${isActive ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/50' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}>

                    <Icon
                      className={`h-5 w-5 flex-shrink-0 ${isSidebarCompact ? '' : 'mr-3'} ${isActive ? 'text-emerald-300' : 'text-slate-400 group-hover:text-slate-200'}`} />

                    {!isSidebarCompact && item.label}
                  </button>);

              })}
            </nav>
          </div>
          <div className={`flex-shrink-0 flex border-t p-4 ${isDark ? 'border-slate-800/80' : 'border-slate-800'}`}>
            <div className="flex-shrink-0 w-full group block">
              <div className={isSidebarCompact ? 'flex flex-col items-center gap-3' : 'flex items-center'}>
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
                {!isSidebarCompact && (
                  <div className="ml-3 min-w-0">
                    <p className={`truncate text-sm font-medium ${isDark ? 'text-slate-100' : 'text-white'}`}>{displayName ?? 'Unknown'}</p>
                    <p className="text-xs font-medium text-slate-400">
                      Administrator
                    </p>
                  </div>
                )}
                <button
                  onClick={onLogout}
                  className={`${isSidebarCompact ? '' : 'ml-auto'} text-slate-400 hover:text-white`}
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
        className="flex w-full flex-col transition-[padding] duration-300"
        style={isDesktop ? { paddingLeft: isSidebarCollapsed ? '5rem' : '16rem' } : undefined}
      >
        <div className={`sticky top-0 z-10 flex min-h-16 flex-wrap items-center border-b ${isDark ? 'bg-slate-900/75 backdrop-blur-md border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <button
            type="button"
            onClick={toggleSidebar}
            className={`inline-flex min-h-16 items-center justify-center self-stretch px-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 ${isSidebarVisible ? isDark ? 'bg-slate-800/80 text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>

            <span className="sr-only">{isDesktop ? (isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar') : isMobileSidebarOpen ? 'Close sidebar' : 'Open sidebar'}</span>
            {isSidebarVisible ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="order-2 flex w-full items-center md:order-1 md:flex-1">
              <form
                className="w-full max-w-4xl md:ml-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  onGlobalSearchSubmit?.(globalSearch);
                }}
              >
                <label htmlFor="search-field" className="sr-only">
                  Search
                </label>
                <div className={`relative w-full h-10 text-slate-400 ${isDark ? 'focus-within:text-slate-300' : 'focus-within:text-slate-600'}`}>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    id="search-field"
                    className={`block w-full h-10 rounded-xl pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/40 sm:text-sm ${isDark ? 'bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-400' : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-500'}`}
                    placeholder="Search courses, users, or reports..."
                    type="search"
                    name="search"
                    value={globalSearch}
                    onChange={(e) => onGlobalSearch?.(e.target.value)} />

                </div>
              </form>
            </div>
            <div className="order-1 ml-auto flex items-center gap-2 md:order-2 md:ml-6 md:gap-0">
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

