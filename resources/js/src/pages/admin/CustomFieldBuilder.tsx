import { useState, useEffect, useCallback } from 'react';
import useConfirm from '../../hooks/useConfirm';
import { useToast } from '../../components/ToastProvider';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  VideoCameraIcon,
  LinkIcon,
  DocumentArrowUpIcon,
  AcademicCapIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowsUpDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TagIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';

// Types
interface CustomLesson {
  id: number;
  title: string;
  description: string | null;
  content_type: 'text' | 'video' | 'file' | 'link' | 'quiz';
  text_content: string | null;
  content_path: string | null;
  content_url: string | null;
  content_full_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  formatted_file_size: string | null;
  duration: number | null;
  formatted_duration: string | null;
  quiz_id: number | null;
  order: number;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

interface CustomModule {
  id: number;
  title: string;
  module_type: 'learning' | 'ui_component';
  route_path?: string | null;
  icon_name?: string | null;
  component_config?: Record<string, any> | null;
  description: string | null;
  category: string | null;
  tags: string[];
  thumbnail_path: string | null;
  thumbnail_url: string | null;
  status: 'draft' | 'published' | 'unpublished';
  order: number;
  version: number;
  lessons_count: number;
  lessons: CustomLesson[];
  creator: {
    id: number;
    fullname: string;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface ModuleVersion {
  id: number;
  version_number: number;
  title: string;
  description: string | null;
  lessons_snapshot: any[];
  changes: Record<string, { old: any; new: any }>;
  created_at: string;
  creator: {
    id: number;
    fullname: string;
  } | null;
}

interface TargetUser {
  id: number;
  fullname: string;
  email: string;
  role: string;
  department: string | null;
  is_pushed: boolean;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    unpublished: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Content type icon component
function ContentTypeIcon({ type, className = 'w-5 h-5' }: { type: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    text: <DocumentTextIcon className={className} />,
    video: <VideoCameraIcon className={className} />,
    file: <DocumentArrowUpIcon className={className} />,
    link: <LinkIcon className={className} />,
    quiz: <AcademicCapIcon className={className} />,
  };

  return <>{icons[type] || <DocumentTextIcon className={className} />}</>;
}

// Props interface
interface CustomFieldBuilderProps {
  onNavigate?: (page: string, courseId?: string) => void;
  initialExpandedModuleId?: number | null;
}

// XSRF token helpers
const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const getXsrfToken = async (): Promise<string> => {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
};

export function CustomFieldBuilder({ onNavigate, initialExpandedModuleId }: CustomFieldBuilderProps) {
  const { showConfirm, ConfirmModalRenderer } = useConfirm();
  const { pushToast } = useToast();

  // State
  const [modules, setModules] = useState<CustomModule[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');

  // Module modal state
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<CustomModule | null>(null);
  const [moduleForm, setModuleForm] = useState({
    title: '',
    module_type: 'learning' as 'learning' | 'ui_component',
    route_path: '',
    icon_name: '',
    component_config: {} as Record<string, any>,
    description: '',
    category: '',
    tags: [] as string[],
    status: 'draft' as 'draft' | 'published' | 'unpublished',
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [savingModule, setSavingModule] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isCustomModule, setIsCustomModule] = useState(false);

  // Lesson modal state
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CustomLesson | null>(null);
  const [targetModuleId, setTargetModuleId] = useState<number | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    content_type: 'text' as 'text' | 'video' | 'file' | 'link' | 'quiz',
    text_content: '',
    content_url: '',
    status: 'draft' as 'draft' | 'published',
  });
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);

  // Version history modal
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versions, setVersions] = useState<ModuleVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Push to users modal (Instructors & Employees)
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushModuleId, setPushModuleId] = useState<number | null>(null);
  const [availableUsers, setAvailableUsers] = useState<TargetUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [pushing, setPushing] = useState(false);

  // Expanded modules for lessons view
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());

  // Fetch modules
  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);
      if (filterTag) params.set('tag', filterTag);

      const response = await fetch(`/api/admin/custom-modules?${params}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setModules(data);
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterStatus, filterCategory, filterTag]);

  // Fetch categories and tags
  const fetchFilters = useCallback(async () => {
    try {
      const [catRes, tagRes] = await Promise.all([
        fetch('/api/admin/custom-modules/categories', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
        fetch('/api/admin/custom-modules/tags', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
      ]);

      if (catRes.ok) {
        setCategories(await catRes.json());
      }
      if (tagRes.ok) {
        setAllTags(await tagRes.json());
      }
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  }, []);

  useEffect(() => {
    fetchModules();
    fetchFilters();
  }, [fetchModules, fetchFilters]);

  // Auto-expand module when navigating from Courses and Content
  useEffect(() => {
    if (initialExpandedModuleId && modules.length > 0) {
      setExpandedModules((prev) => {
        const newSet = new Set(prev);
        newSet.add(initialExpandedModuleId);
        return newSet;
      });
      // Scroll to the module after a short delay
      setTimeout(() => {
        const moduleElement = document.getElementById(`custom-module-${initialExpandedModuleId}`);
        if (moduleElement) {
          moduleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [initialExpandedModuleId, modules]);

  // Toggle module expansion
  const toggleModuleExpand = (moduleId: number) => {
    setExpandedModules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  // Open create module modal
  const openCreateModule = (type: 'learning' | 'ui_component' = 'learning') => {
    setEditingModule(null);
    setIsCustomModule(false);
    setModuleForm({
      title: '',
      module_type: type,
      route_path: '',
      icon_name: '',
      component_config: {},
      description: '',
      category: '',
      tags: [],
      status: 'draft',
    });
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setShowModuleModal(true);
  };

  // Open edit module modal
  const openEditModule = (module: CustomModule) => {
    setEditingModule(module);

    // Check if it's a custom UI component (not matching any template)
    const isCustom = module.module_type === 'ui_component' &&
                     !['ClipboardCheck', 'BarChart3', 'Calendar', 'Bell'].includes(module.icon_name || '');
    setIsCustomModule(isCustom);

    setModuleForm({
      title: module.title,
      module_type: module.module_type || 'learning',
      route_path: module.route_path || '',
      icon_name: module.icon_name || '',
      component_config: module.component_config || {},
      description: module.description || '',
      category: module.category || '',
      tags: module.tags || [],
      status: module.status,
    });
    setThumbnailFile(null);
    setThumbnailPreview(module.thumbnail_url);
    setShowModuleModal(true);
  };

  // Handle thumbnail change
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add tag
  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !moduleForm.tags.includes(tag)) {
      setModuleForm((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
    }
    setTagInput('');
  };

  // Remove tag
  const removeTag = (tag: string) => {
    setModuleForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  // Auto-suggest icon based on title keywords
  const suggestIconFromTitle = (title: string): string => {
    const lowerTitle = title.toLowerCase();

    // Icon suggestions based on keywords
    const iconKeywords: Record<string, string[]> = {
      // Celebrations & Events
      'Cake': ['birthday', 'bday', 'anniversary', 'celebration', 'party'],
      'Gift': ['gift', 'present', 'reward', 'bonus', 'prize'],
      'PartyPopper': ['party', 'celebrate', 'celebration', 'event', 'fest'],
      'Heart': ['love', 'favorite', 'like', 'heart', 'wellness', 'health'],
      'Award': ['award', 'achievement', 'recognition', 'honor'],
      'Trophy': ['trophy', 'winner', 'champion', 'competition', 'contest'],
      'Medal': ['medal', 'badge', 'certificate', 'honor'],
      'Star': ['star', 'rating', 'review', 'featured', 'top', 'best'],
      'Smile': ['employee', 'staff', 'team', 'people', 'happy', 'satisfaction'],

      // Work & Business
      'Briefcase': ['work', 'job', 'career', 'business', 'professional'],
      'Building2': ['office', 'company', 'organization', 'corporate', 'department'],
      'Users': ['team', 'group', 'members', 'staff', 'employees'],
      'Target': ['goal', 'target', 'objective', 'kpi', 'performance'],
      'TrendingUp': ['growth', 'progress', 'trend', 'increase', 'sales'],
      'BarChart3': ['report', 'analytics', 'statistics', 'data', 'chart'],
      'PieChart': ['breakdown', 'distribution', 'percentage', 'share'],

      // Time & Schedule
      'Calendar': ['calendar', 'schedule', 'date', 'event', 'meeting', 'appointment'],
      'Clock': ['time', 'hours', 'schedule', 'deadline', 'timer', 'attendance'],

      // Communication
      'Bell': ['notification', 'alert', 'reminder', 'announce'],
      'Megaphone': ['announcement', 'news', 'broadcast', 'memo'],
      'MessageCircle': ['message', 'chat', 'comment', 'feedback', 'communication'],
      'Mail': ['email', 'mail', 'letter', 'inbox', 'correspondence'],
      'Phone': ['phone', 'call', 'contact', 'telephone'],

      // Documents & Files
      'FileText': ['document', 'file', 'report', 'form', 'paper'],
      'Clipboard': ['checklist', 'list', 'task', 'todo', 'form'],
      'ClipboardList': ['inventory', 'checklist', 'audit', 'inspection'],
      'FolderOpen': ['folder', 'directory', 'archive', 'records'],
      'BookOpen': ['book', 'manual', 'guide', 'training', 'learning', 'course'],

      // Finance & Money
      'DollarSign': ['salary', 'payment', 'money', 'finance', 'budget', 'cost'],
      'CreditCard': ['payment', 'card', 'billing', 'transaction'],
      'Wallet': ['expense', 'reimbursement', 'allowance', 'wallet'],
      'Receipt': ['receipt', 'invoice', 'bill', 'expense'],

      // Travel & Location
      'Car': ['vehicle', 'car', 'transport', 'travel', 'parking'],
      'Plane': ['travel', 'flight', 'trip', 'vacation', 'leave'],
      'MapPin': ['location', 'address', 'place', 'branch', 'site'],
      'Map': ['map', 'direction', 'route', 'navigation'],

      // Food & Breaks
      'Coffee': ['break', 'coffee', '休憩', 'lunch', 'snack'],
      'Utensils': ['food', 'meal', 'lunch', 'canteen', 'cafeteria', 'dining'],

      // Security & Access
      'Shield': ['security', 'safety', 'protection', 'compliance'],
      'Lock': ['password', 'access', 'private', 'confidential', 'secure'],
      'Key': ['key', 'access', 'permission', 'credential'],

      // Ideas & Innovation
      'Lightbulb': ['idea', 'suggestion', 'innovation', 'creative'],
      'Rocket': ['launch', 'startup', 'initiative', 'project'],
      'Zap': ['quick', 'fast', 'urgent', 'priority', 'action'],

      // Media & Content
      'Image': ['photo', 'image', 'picture', 'gallery'],
      'Camera': ['camera', 'photo', 'snapshot', 'picture'],
      'Video': ['video', 'recording', 'movie', 'media'],
      'Music': ['music', 'audio', 'sound', 'podcast'],

      // Technology
      'Monitor': ['computer', 'desktop', 'workstation', 'it'],
      'Laptop': ['laptop', 'notebook', 'portable'],
      'Smartphone': ['mobile', 'phone', 'app'],
      'Globe': ['website', 'web', 'internet', 'online', 'global'],
      'Cloud': ['cloud', 'storage', 'backup', 'sync'],
      'Wifi': ['wifi', 'network', 'internet', 'connection'],

      // Weather & Environment
      'Umbrella': ['weather', 'rain', 'umbrella', 'outdoor'],

      // Status & Info
      'Info': ['info', 'information', 'about', 'help', 'faq'],
      'AlertCircle': ['warning', 'alert', 'urgent', 'important', 'critical'],
      'HelpCircle': ['help', 'support', 'faq', 'question'],
      'CheckSquare': ['complete', 'done', 'approved', 'verified', 'check'],
      'ThumbsUp': ['approve', 'like', 'feedback', 'positive'],

      // Misc
      'Home': ['home', 'dashboard', 'main', 'welcome'],
      'Settings': ['setting', 'config', 'preference', 'option'],
      'Tag': ['tag', 'label', 'category', 'type'],
      'Flag': ['flag', 'milestone', 'important', 'mark'],
      'Bookmark': ['bookmark', 'save', 'favorite', 'saved'],
      'Activity': ['activity', 'log', 'history', 'action'],
      'Database': ['database', 'data', 'storage', 'repository'],
      'Package': ['package', 'product', 'item', 'inventory'],
      'ShoppingCart': ['shop', 'purchase', 'order', 'buy'],
    };

    // Search for matching keywords
    for (const [iconName, keywords] of Object.entries(iconKeywords)) {
      for (const keyword of keywords) {
        if (lowerTitle.includes(keyword)) {
          return iconName;
        }
      }
    }

    // Default icon if no match found
    return 'Blocks';
  };

  // Save module
  // Auto-generate page content HTML for custom UI components
  const generatePageContent = (title: string, description: string, iconName: string) => {
    const safeTitle = title || 'Custom Module';
    const safeDescription = description || 'This is your custom module page.';

    return `<div class="space-y-6">
  <div class="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 rounded-lg text-white">
    <h2 class="text-2xl font-bold mb-2">${safeTitle}</h2>
    <p class="text-purple-100">${safeDescription}</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Quick Stats</h3>
        <span class="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-medium">New</span>
      </div>
      <p class="text-gray-600 dark:text-gray-400">View your module statistics here</p>
    </div>

    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        <span class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium">Live</span>
      </div>
      <p class="text-gray-600 dark:text-gray-400">Track recent activities and updates</p>
    </div>

    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Actions</h3>
        <span class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">Ready</span>
      </div>
      <p class="text-gray-600 dark:text-gray-400">Perform quick actions from here</p>
    </div>
  </div>

  <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
    <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">${safeTitle} Content</h3>
    <p class="text-gray-600 dark:text-gray-400 mb-4">
      Welcome to your custom ${safeTitle.toLowerCase()} module. You can customize this page by editing the module in the Custom Field Builder.
    </p>
    <!-- BUTTONS_PLACEHOLDER -->
  </div>
</div>`;
  };

  const saveModule = async () => {
    // Validation based on module type
    if (moduleForm.module_type === 'learning' && !moduleForm.title.trim()) {
      pushToast('Error', 'Title is required for learning modules', 'error');
      return;
    }

    // Validation for UI component modules
    if (moduleForm.module_type === 'ui_component') {
      // For custom modules, require both title and icon_name
      if (isCustomModule) {
        if (!moduleForm.title || !moduleForm.title.trim()) {
          pushToast('Error', 'Title is required for custom UI components', 'error');
          return;
        }
        if (!moduleForm.icon_name || !moduleForm.icon_name.trim()) {
          pushToast('Error', 'Icon name is required for custom UI components', 'error');
          return;
        }
      } else if (!moduleForm.icon_name || !moduleForm.icon_name.trim()) {
        pushToast('Error', 'Please select a module type or enter an icon name', 'error');
        return;
      }

      // Create a mutable copy of the form data for submission
      const submissionData = { ...moduleForm };

      // Auto-generate route_path from icon_name (convert to kebab-case)
      const autoRoutePath = submissionData.icon_name
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase();
      submissionData.route_path = `custom-${autoRoutePath}`;

      // Auto-generate title from icon_name if title is empty
      if (!submissionData.title || !submissionData.title.trim()) {
        submissionData.title = submissionData.icon_name
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .trim();
      }

      // Final validation to ensure title is not empty after auto-generation
      if (!submissionData.title || !submissionData.title.trim()) {
        pushToast('Error', 'Title is required. Please provide a valid icon name or title.', 'error');
        return;
      }

      // Auto-generate page content if it's a custom module (isCustomModule) and no content exists
      if (isCustomModule && (!submissionData.component_config.pageContent || !submissionData.component_config.pageContent.trim())) {
        // Set default buttons if not already set
        if (!submissionData.component_config.buttons) {
          submissionData.component_config.buttons = [
            { label: 'Get Started', url: '', style: 'primary', visible: true },
            { label: 'Learn More', url: '', style: 'secondary', visible: true }
          ];
        }
        submissionData.component_config = {
          ...submissionData.component_config,
          pageContent: generatePageContent(submissionData.title, submissionData.description, submissionData.icon_name)
        };
      }

      // Use submission data for the rest of the function
      return await submitModuleData(submissionData);
    }

    // For learning modules, use the form data as-is
    return await submitModuleData(moduleForm);
  };

  // Helper function to submit module data
  const submitModuleData = async (moduleData: typeof moduleForm) => {

    try {
      setSavingModule(true);
      const xsrf = await getXsrfToken();
      const formData = new FormData();
      formData.append('title', moduleData.title);
      formData.append('module_type', moduleData.module_type);
      formData.append('description', moduleData.description);
      formData.append('category', moduleData.category);
      formData.append('status', moduleData.status);

      // Add UI component specific fields
      if (moduleData.module_type === 'ui_component') {
        formData.append('route_path', moduleData.route_path);
        formData.append('icon_name', moduleData.icon_name);
        if (Object.keys(moduleData.component_config).length > 0) {
          formData.append('component_config', JSON.stringify(moduleData.component_config));
        }
      }

      moduleData.tags.forEach((tag, i) => {
        formData.append(`tags[${i}]`, tag);
      });
      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile);
      }
      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile);
      }

      const url = editingModule
        ? `/api/admin/custom-modules/${editingModule.id}`
        : '/api/admin/custom-modules';

      // For PUT requests with FormData, we need to use POST with _method
      if (editingModule) {
        formData.append('_method', 'PUT');
      }

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-XSRF-TOKEN': xsrf },
        body: formData,
      });

      if (response.ok) {
        setShowModuleModal(false);
        fetchModules();
        fetchFilters();

        // Dispatch event to refresh sidebar if this is a UI component
        if (moduleData.module_type === 'ui_component') {
          window.dispatchEvent(new CustomEvent('ui-component-changed'));
        }

        if (!editingModule) {
          pushToast('Success', 'Custom field successfully created.', 'success');
        } else {
          pushToast('Success', 'Module updated successfully', 'success');
          // Also dispatch for updates
          if (moduleData.module_type === 'ui_component') {
            window.dispatchEvent(new CustomEvent('ui-component-changed'));
          }
        }
      } else {
        const data = await response.json();
        pushToast('Error', data.message || 'Failed to create custom field. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error saving module:', error);
      pushToast('Error', 'Error saving module', 'error');
    } finally {
      setSavingModule(false);
    }
  };

  // Delete module
  const deleteModule = (module: CustomModule) => {
    showConfirm(
      `This will permanently delete "${module.title}" and all its lessons. This action cannot be undone.`,
      async () => {
        try {
          const xsrf = await getXsrfToken();
          const response = await fetch(`/api/admin/custom-modules/${module.id}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
          });

          if (response.ok) {
            fetchModules();
            pushToast('Deleted', 'Module deleted successfully', 'info');
            // Dispatch event to refresh sidebar if this was a UI component
            if (module.module_type === 'ui_component') {
              window.dispatchEvent(new CustomEvent('ui-component-changed'));
            }
          } else {
            const data = await response.json();
            pushToast('Error', data.message || 'Error deleting module', 'error');
          }
        } catch (error) {
          console.error('Error deleting module:', error);
          pushToast('Error', 'Error deleting module', 'error');
        }
      },
      {
        title: 'Delete Module',
        confirmText: 'Yes, Delete',
        cancelText: 'Cancel',
        variant: 'danger',
      }
    );
  };

  // Toggle publish
  const togglePublish = async (module: CustomModule) => {
    try {
      const xsrf = await getXsrfToken();
      const response = await fetch(`/api/admin/custom-modules/${module.id}/toggle-publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
      });

      if (response.ok) {
        fetchModules();
        // Dispatch event to refresh sidebar if this is a UI component
        if (module.module_type === 'ui_component') {
          window.dispatchEvent(new CustomEvent('ui-component-changed'));
        }
      }
    } catch (error) {
      console.error('Error toggling publish:', error);
    }
  };

  // Open create lesson modal
  const openCreateLesson = (moduleId: number) => {
    setTargetModuleId(moduleId);
    setEditingLesson(null);
    setLessonForm({
      title: '',
      description: '',
      content_type: 'text',
      text_content: '',
      content_url: '',
      status: 'draft',
    });
    setContentFile(null);
    setShowLessonModal(true);
  };

  // Open edit lesson modal
  const openEditLesson = (moduleId: number, lesson: CustomLesson) => {
    setTargetModuleId(moduleId);
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title,
      description: lesson.description || '',
      content_type: lesson.content_type,
      text_content: lesson.text_content || '',
      content_url: lesson.content_url || '',
      status: lesson.status,
    });
    setContentFile(null);
    setShowLessonModal(true);
  };

  // Save lesson
  const saveLesson = async (keepModalOpen = false) => {
    if (!lessonForm.title.trim() || !targetModuleId) return;

    try {
      setSavingLesson(true);
      const xsrf = await getXsrfToken();
      const formData = new FormData();
      formData.append('title', lessonForm.title);
      formData.append('description', lessonForm.description);
      formData.append('content_type', lessonForm.content_type);
      formData.append('status', lessonForm.status);

      if (lessonForm.content_type === 'text') {
        formData.append('text_content', lessonForm.text_content);
      } else if (lessonForm.content_type === 'link' || lessonForm.content_type === 'video') {
        formData.append('content_url', lessonForm.content_url);
      }

      if (contentFile && (lessonForm.content_type === 'file' || lessonForm.content_type === 'video')) {
        formData.append('content_file', contentFile);
      }

      const url = editingLesson
        ? `/api/admin/custom-modules/${targetModuleId}/lessons/${editingLesson.id}`
        : `/api/admin/custom-modules/${targetModuleId}/lessons`;

      if (editingLesson) {
        formData.append('_method', 'PUT');
      }

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-XSRF-TOKEN': xsrf },
        body: formData,
      });

      if (response.ok) {
        fetchModules();
        pushToast('Success', editingLesson ? 'Lesson updated successfully' : 'Lesson created successfully', 'success');

        if (keepModalOpen && !editingLesson) {
          // Reset form for adding another lesson
          setLessonForm({
            title: '',
            description: '',
            content_type: 'text',
            text_content: '',
            content_url: '',
            status: 'draft',
          });
          setContentFile(null);
        } else {
          setShowLessonModal(false);
        }
      } else {
        const data = await response.json();
        pushToast('Error', data.message || 'Error saving lesson', 'error');
      }
    } catch (error) {
      console.error('Error saving lesson:', error);
      pushToast('Error', 'Error saving lesson', 'error');
    } finally {
      setSavingLesson(false);
    }
  };

  // Delete lesson
  const deleteLesson = (moduleId: number, lesson: CustomLesson) => {
    showConfirm(
      `This will permanently delete the lesson "${lesson.title}". This action cannot be undone.`,
      async () => {
        try {
          const xsrf = await getXsrfToken();
          const response = await fetch(`/api/admin/custom-modules/${moduleId}/lessons/${lesson.id}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
          });

          if (response.ok) {
            fetchModules();
            pushToast('Deleted', 'Lesson deleted successfully', 'info');
          }
        } catch (error) {
          console.error('Error deleting lesson:', error);
          pushToast('Error', 'Error deleting lesson', 'error');
        }
      },
      {
        title: 'Delete Lesson',
        confirmText: 'Yes, Delete',
        cancelText: 'Cancel',
        variant: 'danger',
      }
    );
  };

  // View version history
  const viewVersionHistory = async (module: CustomModule) => {
    setShowVersionModal(true);
    setLoadingVersions(true);
    try {
      const response = await fetch(`/api/admin/custom-modules/${module.id}/versions`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        setVersions(await response.json());
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Open push to users modal (Instructors & Employees)
  const openPushToUsers = async (module: CustomModule) => {
    setPushModuleId(module.id);
    setShowPushModal(true);
    setLoadingUsers(true);
    setSelectedUserIds([]);

    try {
      const response = await fetch(`/api/admin/custom-modules/${module.id}/available-users`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        setAvailableUsers(await response.json());
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Push module to selected users
  const pushToUsers = async () => {
    if (!pushModuleId || selectedUserIds.length === 0) return;

    try {
      setPushing(true);
      const xsrf = await getXsrfToken();
      const response = await fetch(`/api/admin/custom-modules/${pushModuleId}/push-to-users`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify({ user_ids: selectedUserIds }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowPushModal(false);
        pushToast('Pushed!', data.message || `Successfully pushed to ${selectedUserIds.length} user(s)`, 'success');
        fetchModules();
      } else {
        const data = await response.json();
        pushToast('Error', data.message || 'Error pushing to users', 'error');
      }
    } catch (error) {
      console.error('Error pushing to users:', error);
      pushToast('Error', 'Error pushing to users', 'error');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6">
      <ConfirmModalRenderer />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Custom Field Builder</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Create and manage custom learning modules. All published modules are automatically synced to Courses and Content.
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>

        {/* Category Filter */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Tag Filter */}
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        {/* Create Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => openCreateModule('learning')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            title="Create a learning module with lessons (visible to instructors and employees when published)"
          >
            <PlusIcon className="w-5 h-5" />
            New Learning Module
          </button>
          <button
            onClick={() => openCreateModule('ui_component')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            title="Create a custom sidebar navigation item (admin-only, not visible to instructors or employees)"
          >
            <PlusIcon className="w-5 h-5" />
            New UI Component
          </button>
        </div>
      </div>

      {/* Modules Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : modules.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No modules yet</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Get started by creating your first custom module.</p>
          <div className="mt-4 flex gap-2 justify-center">
            <button
              onClick={() => openCreateModule('learning')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              title="Create a learning module with lessons (visible to instructors and employees when published)"
            >
              <PlusIcon className="w-5 h-5" />
              Learning Module
            </button>
            <button
              onClick={() => openCreateModule('ui_component')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              title="Create a custom sidebar navigation item (admin-only, not visible to instructors or employees)"
            >
              <PlusIcon className="w-5 h-5" />
              UI Component
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((module) => (
            <div
              key={module.id}
              id={`custom-module-${module.id}`}
              className={`bg-white dark:bg-slate-800 rounded-xl border overflow-hidden transition-all ${
                initialExpandedModuleId === module.id
                  ? 'border-purple-500 dark:border-purple-400 ring-2 ring-purple-200 dark:ring-purple-800'
                  : 'border-gray-200 dark:border-slate-700'
              }`}
            >
              {/* Module Header */}
              <div className="p-4 flex items-start gap-4">
                {/* Thumbnail / Icon */}
                <div className="flex-shrink-0">
                  {module.module_type === 'ui_component' ? (
                    <div className="w-24 h-16 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="9" y1="21" x2="9" y2="9"></line>
                      </svg>
                    </div>
                  ) : module.thumbnail_url ? (
                    <img
                      src={module.thumbnail_url}
                      alt={module.title}
                      className="w-24 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-24 h-16 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                      <FolderIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Module Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{module.title}</h3>
                      {module.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {module.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={module.status} />
                        {module.module_type === 'ui_component' ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              Sidebar Navigation
                            </span>
                            {module.route_path && (
                              <span className="text-sm text-gray-500 dark:text-gray-400">• /{module.route_path}</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {module.lessons_count} lesson{module.lessons_count !== 1 ? 's' : ''}
                            </span>
                            {module.category && (
                              <span className="text-sm text-gray-500 dark:text-gray-400">• {module.category}</span>
                            )}
                          </>
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">• v{module.version}</span>
                      </div>
                      {module.tags && module.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {module.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              <TagIcon className="w-3 h-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePublish(module)}
                        className={`p-2 rounded-lg transition-colors ${
                          module.status === 'published'
                            ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                            : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                        title={module.status === 'published' ? 'Unpublish' : 'Publish'}
                      >
                        {module.status === 'published' ? (
                          <XCircleIcon className="w-5 h-5" />
                        ) : (
                          <CheckCircleIcon className="w-5 h-5" />
                        )}
                      </button>
                      {/* Push to Instructor - Only for learning modules */}
                      {module.module_type === 'learning' && (
                        <button
                          onClick={() => openPushToUsers(module)}
                          className="p-2 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                          title="Push to Instructor"
                        >
                          <ArrowsUpDownIcon className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => viewVersionHistory(module)}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700 transition-colors"
                        title="Version History"
                      >
                        <ClockIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openEditModule(module)}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Edit Module"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteModule(module)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete Module"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleModuleExpand(module.id)}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700 transition-colors"
                      >
                        {expandedModules.has(module.id) ? (
                          <ChevronDownIcon className="w-5 h-5" />
                        ) : (
                          <ChevronRightIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lessons List (Expandable) - Only for learning modules */}
              {expandedModules.has(module.id) && module.module_type === 'learning' && (
                <div className="border-t border-gray-200 dark:border-slate-700">
                  <div className="p-4 bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">Lessons</h4>
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                          {module.lessons?.length || 0}
                        </span>
                      </div>
                      <button
                        onClick={() => openCreateLesson(module.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        <PlusIcon className="w-4 h-4" />
                        Add Lesson
                      </button>
                    </div>

                    {module.lessons && module.lessons.length > 0 ? (
                      <div className="space-y-2">
                        {module.lessons.map((lesson, index) => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700"
                          >
                            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-sm font-medium text-gray-600 dark:text-gray-400">
                              {index + 1}
                            </span>
                            <ContentTypeIcon type={lesson.content_type} className="w-5 h-5 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{lesson.title}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <span className="capitalize">{lesson.content_type}</span>
                                {lesson.formatted_duration && <span>• {lesson.formatted_duration}</span>}
                                {lesson.formatted_file_size && <span>• {lesson.formatted_file_size}</span>}
                              </div>
                            </div>
                            <StatusBadge status={lesson.status} />
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditLesson(module.id, lesson)}
                                className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteLesson(module.id, lesson)}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <AcademicCapIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="font-medium mb-1">No lessons yet</p>
                        <p className="text-sm">Click "Add Lesson" above to create your first lesson. You can add as many lessons as you need!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* UI Component Info (Expandable) - Only for ui_component modules */}
              {expandedModules.has(module.id) && module.module_type === 'ui_component' && (
                <div className="border-t border-gray-200 dark:border-slate-700">
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-800/50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="3" y1="9" x2="21" y2="9"></line>
                          <line x1="9" y1="21" x2="9" y2="9"></line>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-purple-900 dark:text-purple-100">System Navigation Module</h4>
                        <p className="text-sm text-purple-600 dark:text-purple-300">This module appears as a navigation item in the admin sidebar</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                        <p className="text-gray-500 dark:text-gray-400 mb-1">Route Path</p>
                        <p className="font-medium text-gray-900 dark:text-white font-mono">/{module.route_path || 'not-set'}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                        <p className="text-gray-500 dark:text-gray-400 mb-1">Icon</p>
                        <p className="font-medium text-gray-900 dark:text-white">{module.icon_name || 'Default'}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-purple-600 dark:text-purple-400">
                      ✓ When published, this module will appear in the sidebar navigation for all admins.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingModule
                    ? `Edit ${editingModule.module_type === 'ui_component' ? 'UI Component' : 'Learning Module'}`
                    : `Create ${moduleForm.module_type === 'ui_component' ? 'UI Component' : 'Learning Module'}`
                  }
                </h2>
                <button
                  onClick={() => setShowModuleModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title - For learning modules OR editing UI components */}
                {(moduleForm.module_type === 'learning' || (moduleForm.module_type === 'ui_component' && editingModule)) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={moduleForm.title}
                      onChange={(e) => setModuleForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder={moduleForm.module_type === 'ui_component' ? "Sidebar navigation title" : "Module title"}
                    />
                    {moduleForm.module_type === 'ui_component' && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        This name will appear in the sidebar navigation
                      </p>
                    )}
                  </div>
                )}

                {/* Icon Name - Only for editing UI components */}
                {moduleForm.module_type === 'ui_component' && editingModule && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Icon Name *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={moduleForm.icon_name}
                        onChange={(e) => setModuleForm((prev) => ({ ...prev, icon_name: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Cake, Gift, Calendar, Bell"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const suggested = suggestIconFromTitle(moduleForm.title);
                          setModuleForm((prev) => ({ ...prev, icon_name: suggested }));
                        }}
                        className="px-3 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium transition-colors"
                        title="Auto-suggest icon from title"
                      >
                        Auto
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Click "Auto" to suggest an icon based on the title, or enter manually (e.g., Cake, Gift, Calendar)
                    </p>
                  </div>
                )}

                {/* Button Configuration - Only for editing UI components */}
                {moduleForm.module_type === 'ui_component' && editingModule && (
                  <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Page Buttons
                    </label>
                    <div className="space-y-3">
                      {(moduleForm.component_config?.buttons || [
                        { label: 'Get Started', url: '', style: 'primary', visible: true },
                        { label: 'Learn More', url: '', style: 'secondary', visible: true }
                      ]).map((btn: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={btn.visible !== false}
                              onChange={(e) => {
                                const buttons = [...(moduleForm.component_config?.buttons || [
                                  { label: 'Get Started', url: '', style: 'primary', visible: true },
                                  { label: 'Learn More', url: '', style: 'secondary', visible: true }
                                ])];
                                buttons[idx] = { ...buttons[idx], visible: e.target.checked };
                                setModuleForm((prev) => ({
                                  ...prev,
                                  component_config: { ...prev.component_config, buttons }
                                }));
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Button {idx + 1} {idx === 0 ? '(Primary)' : '(Secondary)'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={btn.label || ''}
                              onChange={(e) => {
                                const buttons = [...(moduleForm.component_config?.buttons || [
                                  { label: 'Get Started', url: '', style: 'primary', visible: true },
                                  { label: 'Learn More', url: '', style: 'secondary', visible: true }
                                ])];
                                buttons[idx] = { ...buttons[idx], label: e.target.value };
                                setModuleForm((prev) => ({
                                  ...prev,
                                  component_config: { ...prev.component_config, buttons }
                                }));
                              }}
                              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                              placeholder="Button text"
                            />
                            <input
                              type="text"
                              value={btn.url || ''}
                              onChange={(e) => {
                                const buttons = [...(moduleForm.component_config?.buttons || [
                                  { label: 'Get Started', url: '', style: 'primary', visible: true },
                                  { label: 'Learn More', url: '', style: 'secondary', visible: true }
                                ])];
                                buttons[idx] = { ...buttons[idx], url: e.target.value };
                                setModuleForm((prev) => ({
                                  ...prev,
                                  component_config: { ...prev.component_config, buttons }
                                }));
                              }}
                              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                              placeholder="URL (optional)"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Customize the buttons shown on the module page. Uncheck to hide a button.
                    </p>
                  </div>
                )}

                {/* Module Type - Only show when editing */}
                {editingModule && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Module Type
                    </label>
                    <div className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300">
                      {moduleForm.module_type === 'ui_component' ? 'UI Component (sidebar navigation)' : 'Learning Module (with lessons)'}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Module type cannot be changed after creation
                    </p>
                  </div>
                )}

                {/* UI Component specific fields - Template selector only when creating */}
                {moduleForm.module_type === 'ui_component' && !editingModule && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Module Type *
                      </label>
                      <select
                        value={
                          isCustomModule ? 'custom' :
                          moduleForm.icon_name === 'ClipboardCheck' ? 'task-management' :
                          moduleForm.icon_name === 'BarChart3' ? 'reports-dashboard' :
                          moduleForm.icon_name === 'Calendar' ? 'calendar-events' :
                          moduleForm.icon_name === 'Bell' ? 'notifications' :
                          ''
                        }
                        onChange={(e) => {
                          const selectedValue = e.target.value;
                          if (selectedValue === 'custom') {
                            setIsCustomModule(true);
                            setModuleForm((prev) => ({
                              ...prev,
                              icon_name: '',
                              description: '',
                              component_config: { ...prev.component_config, pageContent: '' }
                            }));
                            return;
                          }
                          setIsCustomModule(false);
                          const templates: Record<string, { icon: string; description: string; content: string }> = {
                            'task-management': {
                              icon: 'ClipboardCheck',
                              description: 'Manage and track tasks across your organization',
                              content: `<div class="space-y-6">
  <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-lg text-white">
    <h2 class="text-2xl font-bold mb-2">Task Management</h2>
    <p class="text-blue-100">Track and manage all your tasks in one place</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Pending</h3>
        <span class="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 px-3 py-1 rounded-full text-sm font-medium">12</span>
      </div>
      <p class="text-gray-600 dark:text-gray-400">Tasks awaiting action</p>
    </div>

    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">In Progress</h3>
        <span class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium">8</span>
      </div>
      <p class="text-gray-600 dark:text-gray-400">Currently being worked on</p>
    </div>

    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Completed</h3>
        <span class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">45</span>
      </div>
      <p class="text-gray-600 dark:text-gray-400">Successfully finished</p>
    </div>
  </div>

  <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
    <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Tasks</h3>
    <div class="space-y-3">
      <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-700">
        <input type="checkbox" class="w-5 h-5 rounded border-gray-300" />
        <div class="flex-1">
          <p class="text-gray-900 dark:text-white font-medium">Review quarterly reports</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Due: April 15, 2026</p>
        </div>
        <span class="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 px-2 py-1 rounded text-xs">High Priority</span>
      </div>
    </div>
  </div>
</div>`
                            },
                            'reports-dashboard': {
                              icon: 'BarChart3',
                              description: 'View analytics and generate reports',
                              content: `<div class="space-y-6">
  <div class="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-lg text-white">
    <h2 class="text-2xl font-bold mb-2">Reports & Analytics</h2>
    <p class="text-purple-100">Comprehensive insights into your organization</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Users</p>
      <p class="text-3xl font-bold text-gray-900 dark:text-white">1,234</p>
      <p class="text-sm text-green-600 mt-2">↑ 12% from last month</p>
    </div>
    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Active Courses</p>
      <p class="text-3xl font-bold text-gray-900 dark:text-white">48</p>
      <p class="text-sm text-green-600 mt-2">↑ 8% from last month</p>
    </div>
    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Completion Rate</p>
      <p class="text-3xl font-bold text-gray-900 dark:text-white">87%</p>
      <p class="text-sm text-green-600 mt-2">↑ 5% from last month</p>
    </div>
    <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Avg. Score</p>
      <p class="text-3xl font-bold text-gray-900 dark:text-white">92%</p>
      <p class="text-sm text-green-600 mt-2">↑ 3% from last month</p>
    </div>
  </div>

  <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
    <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Reports</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <button class="p-4 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-left">
        <p class="font-medium text-gray-900 dark:text-white">User Activity Report</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Export user engagement data</p>
      </button>
      <button class="p-4 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-left">
        <p class="font-medium text-gray-900 dark:text-white">Course Completion Report</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Track completion rates</p>
      </button>
    </div>
  </div>
</div>`
                            },
                            'calendar-events': {
                              icon: 'Calendar',
                              description: 'View and manage upcoming events and schedules',
                              content: `<div class="space-y-6">
  <div class="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-lg text-white">
    <h2 class="text-2xl font-bold mb-2">Calendar & Events</h2>
    <p class="text-green-100">Stay on top of important dates and events</p>
  </div>

  <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
    <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Upcoming Events</h3>
    <div class="space-y-3">
      <div class="flex gap-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div class="text-center">
          <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">15</p>
          <p class="text-sm text-blue-600 dark:text-blue-400">APR</p>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-gray-900 dark:text-white">Team Training Session</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">10:00 AM - 12:00 PM</p>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">Conference Room A</p>
        </div>
      </div>
      <div class="flex gap-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <div class="text-center">
          <p class="text-2xl font-bold text-green-600 dark:text-green-400">20</p>
          <p class="text-sm text-green-600 dark:text-green-400">APR</p>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-gray-900 dark:text-white">Department Meeting</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">2:00 PM - 3:30 PM</p>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">Virtual Meeting</p>
        </div>
      </div>
    </div>
  </div>
</div>`
                            },
                            'notifications': {
                              icon: 'Bell',
                              description: 'View system notifications and announcements',
                              content: `<div class="space-y-6">
  <div class="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-lg text-white">
    <h2 class="text-2xl font-bold mb-2">Notifications</h2>
    <p class="text-orange-100">Stay updated with important announcements</p>
  </div>

  <div class="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
    <div class="space-y-4">
      <div class="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <div class="flex items-start gap-3">
          <span class="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 p-2 rounded-lg">⚠️</span>
          <div class="flex-1">
            <p class="font-semibold text-gray-900 dark:text-white">System Maintenance</p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Scheduled maintenance on April 15, 2026 from 2:00 AM - 4:00 AM</p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">2 hours ago</p>
          </div>
        </div>
      </div>
      <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div class="flex items-start gap-3">
          <span class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 p-2 rounded-lg">ℹ️</span>
          <div class="flex-1">
            <p class="font-semibold text-gray-900 dark:text-white">New Course Available</p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Advanced Safety Training is now available for enrollment</p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">5 hours ago</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`
                            }
                          };
                          const template = templates[e.target.value];
                          if (template) {
                            // Auto-generate title from icon name
                            const autoTitle = template.icon
                              .replace(/([a-z])([A-Z])/g, '$1 $2')
                              .trim();

                            setModuleForm((prev) => ({
                              ...prev,
                              title: autoTitle,
                              icon_name: template.icon,
                              description: template.description,
                              component_config: { ...prev.component_config, pageContent: template.content }
                            }));
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        disabled={!!editingModule}
                      >
                        <option value="">-- Select a Module Type --</option>
                        <option value="task-management">Task Management</option>
                        <option value="reports-dashboard">Reports & Analytics</option>
                        <option value="calendar-events">Calendar & Events</option>
                        <option value="notifications">Notifications Center</option>
                        <option value="custom">Custom (Create your own)</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {isCustomModule ? 'Create a custom module with your own configuration' : 'Select a pre-built module template'}
                      </p>
                    </div>

                    {/* Custom Module Fields */}
                    {isCustomModule && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Title *
                          </label>
                          <input
                            type="text"
                            value={moduleForm.title}
                            onChange={(e) => {
                              const newTitle = e.target.value;
                              const suggestedIcon = suggestIconFromTitle(newTitle);
                              setModuleForm((prev) => ({
                                ...prev,
                                title: newTitle,
                                icon_name: suggestedIcon // Auto-suggest icon based on title
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Birthday, Task Dashboard, Calendar"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            The display name - icon will be auto-suggested based on this
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Icon Name * <span className="text-purple-600 dark:text-purple-400 font-normal">(auto-suggested)</span>
                          </label>
                          <input
                            type="text"
                            value={moduleForm.icon_name}
                            onChange={(e) => setModuleForm((prev) => ({ ...prev, icon_name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Cake, Gift, Calendar, Bell"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Icon is auto-suggested from title. You can change it manually if needed.
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Page Description
                          </label>
                          <textarea
                            value={moduleForm.description}
                            onChange={(e) => setModuleForm((prev) => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Brief description of what this module does"
                          />
                        </div>

                        {/* Auto-generated page content preview */}
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                          <p className="text-sm text-purple-800 dark:text-purple-200">
                            <span className="font-medium">✓ Page content will be auto-generated</span>
                            <br />
                            <span className="text-xs text-purple-600 dark:text-purple-400">
                              A professional page layout will be created based on your title and description.
                            </span>
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Description - Only for learning modules */}
                {moduleForm.module_type === 'learning' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={moduleForm.description}
                      onChange={(e) => setModuleForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Module description"
                    />
                  </div>
                )}

                {/* Category - Only for learning modules */}
                {moduleForm.module_type === 'learning' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={moduleForm.category}
                      onChange={(e) => setModuleForm((prev) => ({ ...prev, category: e.target.value }))}
                      list="categories-list"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Safety, Compliance"
                    />
                    <datalist id="categories-list">
                      {categories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                )}

                {/* Tags - Only for learning modules */}
                {moduleForm.module_type === 'learning' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tags
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Add a tag"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                      >
                        Add
                      </button>
                    </div>
                    {moduleForm.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {moduleForm.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="hover:text-blue-900 dark:hover:text-blue-200"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Thumbnail - Only for learning modules */}
                {moduleForm.module_type === 'learning' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Thumbnail
                    </label>
                    <div className="flex items-center gap-4">
                      {thumbnailPreview && (
                        <img
                          src={thumbnailPreview}
                          alt="Preview"
                          className="w-20 h-14 rounded-lg object-cover"
                        />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                        className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status *
                  </label>
                  <select
                    value={moduleForm.status}
                    onChange={(e) =>
                      setModuleForm((prev) => ({
                        ...prev,
                        status: e.target.value as 'draft' | 'published' | 'unpublished',
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="unpublished">Unpublished</option>
                  </select>
                  {moduleForm.module_type === 'ui_component' && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      UI components must be published to appear in the sidebar
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowModuleModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveModule}
                  disabled={
                    savingModule ||
                    (moduleForm.module_type === 'learning' && !moduleForm.title.trim()) ||
                    (moduleForm.module_type === 'ui_component' && !moduleForm.icon_name.trim())
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                >
                  {savingModule ? 'Saving...' : editingModule ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingLesson ? 'Edit Lesson' : 'Add New Lesson'}
                </h2>
                <button
                  onClick={() => setShowLessonModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {!editingLesson && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  💡 You can add multiple lessons to this module. Click "Save & Add Another" to add more lessons quickly.
                </p>
              )}

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={lessonForm.title}
                    onChange={(e) => setLessonForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Lesson title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={lessonForm.description}
                    onChange={(e) => setLessonForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Lesson description"
                  />
                </div>

                {/* Content Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Content Type
                  </label>
                  <select
                    value={lessonForm.content_type}
                    onChange={(e) =>
                      setLessonForm((prev) => ({
                        ...prev,
                        content_type: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="text">Text</option>
                    <option value="video">Video</option>
                    <option value="file">File</option>
                    <option value="link">Link</option>
                    <option value="quiz">Quiz</option>
                  </select>
                </div>

                {/* Content based on type */}
                {lessonForm.content_type === 'text' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Text Content
                    </label>
                    <textarea
                      value={lessonForm.text_content}
                      onChange={(e) => setLessonForm((prev) => ({ ...prev, text_content: e.target.value }))}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter lesson content..."
                    />
                  </div>
                )}

                {(lessonForm.content_type === 'link' || lessonForm.content_type === 'video') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {lessonForm.content_type === 'video' ? 'Video URL (Optional)' : 'Link URL'}
                    </label>
                    <input
                      type="url"
                      value={lessonForm.content_url}
                      onChange={(e) => setLessonForm((prev) => ({ ...prev, content_url: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder={lessonForm.content_type === 'video' ? 'https://youtube.com/... or upload below' : 'https://...'}
                    />
                    {lessonForm.content_type === 'video' && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Provide a video URL (YouTube, Vimeo, etc.) or upload a video file below
                      </p>
                    )}
                  </div>
                )}

                {(lessonForm.content_type === 'file' || lessonForm.content_type === 'video') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {lessonForm.content_type === 'video' ? 'Upload Video File (Optional)' : 'Upload File'}
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setContentFile(e.target.files?.[0] || null)}
                      accept={lessonForm.content_type === 'video' ? 'video/*' : '*'}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {lessonForm.content_type === 'video' && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Supported formats: MP4, AVI, MOV, etc. Maximum file size: 5GB. No video length limit.
                      </p>
                    )}
                    {editingLesson?.file_name && (
                      <p className="mt-1 text-sm text-gray-500">Current: {editingLesson.file_name}</p>
                    )}
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={lessonForm.status}
                    onChange={(e) =>
                      setLessonForm((prev) => ({
                        ...prev,
                        status: e.target.value as 'draft' | 'published',
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowLessonModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {!editingLesson && (
                  <button
                    onClick={() => saveLesson(true)}
                    disabled={savingLesson || !lessonForm.title.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors"
                  >
                    {savingLesson ? 'Saving...' : 'Save & Add Another'}
                  </button>
                )}
                <button
                  onClick={() => saveLesson(false)}
                  disabled={savingLesson || !lessonForm.title.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                >
                  {savingLesson ? 'Saving...' : editingLesson ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Version History</h2>
                <button
                  onClick={() => setShowVersionModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {loadingVersions ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : versions.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">No version history available.</p>
              ) : (
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          Version {version.version_number}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(version.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{version.title}</p>
                      {version.changes && Object.keys(version.changes).length > 0 && (
                        <div className="mt-2 text-sm">
                          <p className="font-medium text-gray-700 dark:text-gray-300">Changes:</p>
                          <ul className="mt-1 space-y-1">
                            {Object.entries(version.changes).map(([field, change]) => (
                              <li key={field} className="text-gray-500 dark:text-gray-400">
                                <span className="capitalize">{field}</span>: {String(change.old || '(empty)')} →{' '}
                                {String(change.new || '(empty)')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {version.creator && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          By {version.creator.fullname}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Push to Instructor Modal */}
      {showPushModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Push to Instructor</h2>
                <button
                  onClick={() => setShowPushModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select instructors to push this module to. They will receive a notification. Note: Published modules automatically appear in Instructor and Employee "Courses and Content" dashboards.
                  </p>

                  {selectedUserIds.length > 0 && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                      {selectedUserIds.length} user{selectedUserIds.length > 1 ? 's' : ''} selected
                    </p>
                  )}

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableUsers.map((user) => (
                      <label
                        key={user.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedUserIds.includes(user.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          value={user.id}
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-slate-500 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{user.fullname}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user.department || 'No department'}
                          </p>
                        </div>
                        {user.is_pushed && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                            Pushed
                          </span>
                        )}
                      </label>
                    ))}

                    {availableUsers.length === 0 && (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                        No instructors found.
                      </p>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => setShowPushModal(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={pushToUsers}
                      disabled={pushing || selectedUserIds.length === 0}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                    >
                      {pushing ? 'Pushing...' : `Push to ${selectedUserIds.length > 0 ? selectedUserIds.length : ''} Instructor${selectedUserIds.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomFieldBuilder;
