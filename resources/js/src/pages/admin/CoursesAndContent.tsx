import { useState, useEffect, useRef } from 'react';
import useConfirm from '../../hooks/useConfirm';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DocumentPlusIcon,
  VideoCameraIcon,
  AcademicCapIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import { safeArray } from '../../utils/safe';
import { LoadingState } from '../../components/ui/LoadingState';

interface Course {
  id: string;
  title: string;
  description: string;
  department: string;
  subdepartment_id?: number | null;
  start_date?: string | null;
  deadline?: string | null;
  instructor: string;
  instructor_id: number | null;
  instructor_profile_picture?: string | null;
  status: 'Active' | 'Draft' | 'Inactive';
  modules_count: number;
  enrolled_count: number;
  created_at: string;
}

interface InstructorOption {
  id: number;
  fullname: string;
  email: string;
  department: string | null;
  subdepartment_id?: number | null;
  subdepartments?: { id: number; name: string; department_id?: number | null }[];
  profile_picture?: string | null;
}

interface DepartmentOption {
  id: number;
  name: string;
  subdepartments?: { id: number; name: string; head_id?: number | null }[];
}

function normalizeCourseStatus(status: unknown): 'Active' | 'Draft' | 'Inactive' {
  if (typeof status !== 'string') return 'Draft';
  if (status.toLowerCase() === 'active') return 'Active';
  if (status.toLowerCase() === 'inactive' || status.toLowerCase() === 'archived') return 'Inactive';
  return 'Draft';
}

function toUtcIsoString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toLocalDateTimeInputValue(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

interface EnrolledStudent {
  id: number;
  name: string;
  email: string;
  enrolled_at: string;
  status: string;
  enrollment_id?: number;
}

interface Lesson {
  id: number;
  title: string;
  type: string;
  content_path: string | null;
  content_url: string | null;
  duration: string | null;
  file_size: string | null;
  status: string;
}

interface ModuleDetail {
  id: number;
  title: string;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  pre_assessment: any;
  lessons: Lesson[];
  isOpen?: boolean;
}

interface UserOption {
  id: number;
  fullName: string;
  email: string;
  department: string;
  role: string;
}

interface CustomModule {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  status: 'draft' | 'published' | 'unpublished';
  module_type?: 'learning' | 'ui_component';
  lessons_count: number;
  version: number;
  thumbnail_url: string | null;
  creator: {
    id: number;
    fullname: string;
  } | null;
  created_at: string;
}

export function CoursesAndContent({ onNavigate }: { onNavigate?: (page: string, courseId?: string, customModuleId?: number) => void }) {
  const confirm = useConfirm();
  const { showConfirm } = confirm;
  const [courses, setCourses] = useState<Course[]>([]);
  const [customModules, setCustomModules] = useState<CustomModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [showEnrollments, setShowEnrollments] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkInstructorId, setBulkInstructorId] = useState<number | null>(null);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [editInstructorId, setEditInstructorId] = useState<number | null>(null);
  const [createInstructorId, setCreateInstructorId] = useState<number | null>(null);
  const [createDepartment, setCreateDepartment] = useState('');
  const [createSubdepartmentId, setCreateSubdepartmentId] = useState<number | ''>('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editSubdepartmentId, setEditSubdepartmentId] = useState<number | ''>('');
  // Instructor photo upload in edit modal
  const [editInstructorPhotoFile, setEditInstructorPhotoFile] = useState<File | null>(null);
  const [editInstructorPhotoPreview, setEditInstructorPhotoPreview] = useState<string | null>(null);
  const editInstructorPhotoRef = useRef<HTMLInputElement>(null);
  // Module management state
  const [courseModules, setCourseModules] = useState<ModuleDetail[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [activePanel, setActivePanel] = useState<'modules' | 'upload' | 'quiz' | 'enroll'>('modules');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  // Enroll state
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [enrollSearchTerm, setEnrollSearchTerm] = useState('');
  // Add module state
  const [newModuleTitle, setNewModuleTitle] = useState('');
  // Edit module state
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');
  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<'Video' | 'Document' | 'Text'>('Video');
  const [uploadText, setUploadText] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'Published' | 'Draft'>('Draft');
  // Preview state
  const [previewLesson, setPreviewLesson] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<{id: number; question: string; options: string[]; answer: number}[]>([]);
  // Send Quiz state
  const [sendQuizModuleId, setSendQuizModuleId] = useState<number | null>(null);
  const [sendingQuiz, setSendingQuiz] = useState(false);
  // Upload progress
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDuration, setUploadDuration] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom module thumbnail upload
  const [uploadingThumbnailModuleId, setUploadingThumbnailModuleId] = useState<number | null>(null);
  const customModuleThumbnailRef = useRef<HTMLInputElement>(null);

  // Helper to extract actual video duration from file
  const extractVideoDuration = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        const totalSeconds = Math.floor(video.duration);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
          resolve(`${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        } else {
          resolve(`${minutes}:${String(seconds).padStart(2, '0')}`);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      video.src = url;
    });
  };

  // Handle file selection with duration extraction
  const handleFileSelect = async (file: File | null) => {
    setUploadFile(file);
    if (file && uploadType === 'Video' && file.type.startsWith('video/')) {
      const duration = await extractVideoDuration(file);
      setUploadDuration(duration);
    } else {
      setUploadDuration('');
    }
  };

  useEffect(() => {
    let mounted = true;

    const initComponent = async () => {
      console.log('CoursesAndContent: Component mounting');

      try {
        await Promise.all([loadCourses(), loadCustomModules()]);
      } catch (err) {
        console.error('CoursesAndContent: Init error:', err);
        if (mounted) {
          setError('Failed to initialize component');
          setLoading(false);
        }
      }
    };

    initComponent();

    return () => {
      mounted = false;
    };
  }, []);

  // Refresh courses list when a module is added elsewhere (instructor UI)
  useEffect(() => {
    const handler = (e: any) => {
      try {
        loadCourses();
        loadCustomModules();
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('module:added', handler as EventListener);
    return () => window.removeEventListener('module:added', handler as EventListener);
  }, []);

  // Load departments and instructors for edit form
  useEffect(() => {
    fetch('/api/departments')
      .then(res => res.json())
      .then(data => setDepartments(Array.isArray(data) ? data.map((d: any) => ({
        id: d.id,
        name: d.name,
        subdepartments: Array.isArray(d.subdepartments)
          ? d.subdepartments.map((s: any) => ({ id: s.id, name: s.name, head_id: s.head_id ?? null }))
          : [],
      })) : []))
      .catch(err => console.error('Failed to load departments:', err));
    fetch('/api/admin/users?role=Instructor', { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(res => res.json())
      .then(data => setInstructors(safeArray<any>(data).map((u: any) => ({
        id: u.id,
        fullname: u.fullname,
        email: u.email,
        department: u.department,
        subdepartment_id: u.subdepartment_id ?? null,
        subdepartments: Array.isArray(u.subdepartments)
          ? u.subdepartments.map((s: any) => ({ id: s.id, name: s.name, department_id: s.department_id ?? null }))
          : [],
        profile_picture: u.profile_picture ? `/storage/${u.profile_picture}` : null,
      }))))
      .catch(err => console.error('Failed to load instructors:', err));
  }, []);

  const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase();

  const getEligibleInstructors = (departmentName: string, subdepartmentId: number | '') => {
    const dept = normalizeText(departmentName);
    const subId = subdepartmentId ? Number(subdepartmentId) : null;

    return instructors.filter((i) => {
      const deptMatches = !dept || normalizeText(i.department) === dept;
      if (!deptMatches) return false;
      if (!subId) return true;

      const primarySubMatch = Number(i.subdepartment_id) === subId;
      const assignedSubMatch = Array.isArray(i.subdepartments) && i.subdepartments.some((s) => Number(s.id) === subId);
      return primarySubMatch || assignedSubMatch;
    });
  };

  // Fetch current profile to determine role (used for preview actions)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
        const res = await fetch('/api/profile', { credentials: 'include', headers: { Accept: 'application/json' } });
        if (res.ok) {
          const d = await res.json();
          setCurrentUserRole((d.role || '').toLowerCase());
        }
      } catch (e) {
        // ignore
      }
    };
    fetchProfile();
  }, []);

  const loadCourses = async () => {
    try {
      console.log('CoursesAndContent: Starting to load courses');
      setLoading(true);
      setError(null);

      // Get CSRF token first
      console.log('CoursesAndContent: Getting CSRF token');
      const csrfResponse = await fetch('/sanctum/csrf-cookie', {
        credentials: 'include',
      });
      console.log('CoursesAndContent: CSRF response:', csrfResponse.status);

      console.log('CoursesAndContent: Fetching courses');
      const response = await fetch('/api/admin/courses', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }
      });

      console.log('CoursesAndContent: Courses response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('CoursesAndContent: API error:', errorText);
        throw new Error(`Failed to load courses: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('CoursesAndContent: Received courses data:', data);
      const rawCourses = Array.isArray(data) ? data : [];
      setCourses(rawCourses.map((c: any) => ({
        ...c,
        status: normalizeCourseStatus(c.status),
        subdepartment_id: c.subdepartment_id ?? null,
        instructor_id: c.instructor_id ?? (c.instructor?.id ?? null),
        instructor: typeof c.instructor === 'object' && c.instructor !== null
          ? c.instructor.fullname || 'Unassigned'
          : c.instructor || 'Unassigned',
        instructor_profile_picture: typeof c.instructor === 'object' && c.instructor !== null && c.instructor.profile_picture
          ? `/storage/${c.instructor.profile_picture}`
          : null,
        department: typeof c.department === 'object' && c.department !== null
          ? c.department.name || ''
          : c.department || '',
      })));
    } catch (err: any) {
      console.error('CoursesAndContent: Load courses error:', err);
      setError(err.message);
      // Set some default courses if API fails
      setCourses([]);
    } finally {
      setLoading(false);
      console.log('CoursesAndContent: Load courses completed');
    }
  };

  // Load custom modules from Custom Field Builder
  const loadCustomModules = async () => {
    try {
      console.log('CoursesAndContent: Loading custom modules');
      const response = await fetch('/api/admin/custom-modules?status=published', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('CoursesAndContent: Received custom modules:', data);
        setCustomModules(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('CoursesAndContent: Failed to load custom modules:', err);
      // Don't set error - custom modules are optional
    }
  };

  const loadEnrolledStudents = async (courseId: number) => {
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/students`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEnrolledStudents(data);
      }
    } catch (err) {
      console.error('Failed to load enrolled students:', err);
    }
  };

  // Handle custom module thumbnail upload
  const handleCustomModuleThumbnailClick = (moduleId: number) => {
    setUploadingThumbnailModuleId(moduleId);
    customModuleThumbnailRef.current?.click();
  };

  const handleCustomModuleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingThumbnailModuleId) return;

    try {
      const formData = new FormData();
      formData.append('thumbnail', file);

      const response = await fetch(`/api/admin/custom-modules/${uploadingThumbnailModuleId}/thumbnail`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Update the custom module in state with the new thumbnail
        setCustomModules(prev => prev.map(m =>
          m.id === uploadingThumbnailModuleId
            ? { ...m, thumbnail_url: data.thumbnail_url }
            : m
        ));
      } else {
        const errorData = await response.json();
        console.error('Failed to upload thumbnail:', errorData.message);
        alert(errorData.message || 'Failed to upload thumbnail');
      }
    } catch (err) {
      console.error('Error uploading thumbnail:', err);
      alert('An error occurred while uploading the thumbnail');
    } finally {
      setUploadingThumbnailModuleId(null);
      if (customModuleThumbnailRef.current) {
        customModuleThumbnailRef.current.value = '';
      }
    }
  };

  const handleViewEnrollments = async (course: Course) => {
    setSelectedCourse(course);
    setShowEnrollments(true);
    await loadEnrolledStudents(course.id);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setEditInstructorId(course.instructor_id);
    setEditDepartment(course.department);
    setEditSubdepartmentId(course.subdepartment_id ?? '');
    // Pre-load existing instructor photo preview
    const assigned = instructors.find(i => i.id === course.instructor_id);
    setEditInstructorPhotoPreview(assigned?.profile_picture ?? null);
    setEditInstructorPhotoFile(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCourse) return;
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const csrfToken = getXsrfToken();

      const response = await fetch(`/api/admin/courses/${editingCourse.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': csrfToken,
        },
        body: JSON.stringify({
          title: formData.get('title'),
          description: formData.get('description'),
          department: formData.get('department'),
          subdepartment_id: formData.get('subdepartment_id') || null,
          start_date: toUtcIsoString(formData.get('start_date')),
          deadline: toUtcIsoString(formData.get('deadline')),
          instructor_id: formData.get('instructor_id') || null,
          status: formData.get('status'),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update course');
      }

      setShowEditModal(false);
      setEditingCourse(null);

      // Upload instructor photo if one was selected
      if (editInstructorPhotoFile && editInstructorId) {
        try {
          const csrfToken2 = getXsrfToken();
          const photoFd = new FormData();
          photoFd.append('profile_picture', editInstructorPhotoFile);
          const photoRes = await fetch(`/api/admin/users/${editInstructorId}/photo`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': csrfToken2 },
            body: photoFd,
          });
          if (photoRes.ok) {
            const photoData = await photoRes.json();
            // Update instructors list so cards reflect new photo immediately
            setInstructors(prev => prev.map(i =>
              i.id === editInstructorId
                ? { ...i, profile_picture: photoData.profile_picture }
                : i
            ));
          }
        } catch { /* ignore photo upload failure */ }
      }

      setEditInstructorPhotoFile(null);
      setEditInstructorPhotoPreview(null);
      await loadCourses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    showConfirm(`Are you sure you want to delete "${course.title}"? This action cannot be undone.`, async () => {
      try {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
        const csrfToken = getXsrfToken();

        const response = await fetch(`/api/admin/courses/${course.id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'X-XSRF-TOKEN': csrfToken,
          },
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to delete course');
        }

        await loadCourses();
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  // ── Helper: get XSRF token from cookie ──
  const getXsrfToken = () => {
    const v = `; ${document.cookie}`;
    const parts = v.split('; XSRF-TOKEN=');
    if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
    return '';
  };

  const getCsrf = async () => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    return getXsrfToken();
  };

  // ── Load modules for a course ──
  const loadModules = async (courseId: number | string) => {
    setLoadingModules(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/modules`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setCourseModules(safeArray<any>(data).map((m: any) => ({ ...m, isOpen: false })));
      }
    } catch (err) {
      console.error('Failed to load modules:', err);
    } finally {
      setLoadingModules(false);
    }
  };

  // ── Add Module ──
  const handleAddModule = async () => {
    if (!selectedCourse || !newModuleTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const csrf = await getCsrf();
      const res = await fetch(`/api/courses/${selectedCourse.id}/modules`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': csrf,
        },
        body: JSON.stringify({ title: newModuleTitle.trim() }),
      });
      if (!res.ok) throw new Error('Failed to add module');
      setNewModuleTitle('');
      await loadModules(selectedCourse.id);
      await loadCourses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Update Module Title ──
  const handleUpdateModule = async (moduleId: number) => {
    if (!editModuleTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const csrf = await getCsrf();
      const res = await fetch(`/api/modules/${moduleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': csrf,
        },
        body: JSON.stringify({ title: editModuleTitle.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update module');
      setEditingModuleId(null);
      setEditModuleTitle('');
      if (selectedCourse) await loadModules(selectedCourse.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete Module ──
  const handleDeleteModule = async (moduleId: number) => {
    showConfirm('Delete this module and all its lessons?', async () => {
      try {
        const csrf = await getCsrf();
        const res = await fetch(`/api/modules/${moduleId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': csrf },
        });
        if (!res.ok) throw new Error('Failed to delete module');
        if (selectedCourse) {
          await loadModules(selectedCourse.id);
          await loadCourses();
        }
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  // ── Upload Lesson (Video/Document/Text) to Module ──
  const handleUploadLesson = async () => {
    if (!selectedModuleId || !uploadTitle.trim()) {
      alert('Please select a module and enter a title.');
      return;
    }
    if (uploadType !== 'Text' && !uploadFile) {
      alert('Please choose a file to upload.');
      return;
    }
    if (uploadType === 'Text' && !uploadText.trim()) {
      alert('Please enter text content.');
      return;
    }

    const csrf = await getCsrf();
    const formData = new FormData();
    formData.append('title', uploadTitle.trim());
    formData.append('type', uploadType);
    formData.append('status', uploadStatus);

    if (uploadType === 'Text') {
      formData.append('text_content', uploadText);
    } else {
      formData.append('content', uploadFile!);
      if (uploadType === 'Video' && uploadDuration) {
        formData.append('duration', uploadDuration);
      }
    }

    setIsUploading(true);
    setUploadProgress(0);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/modules/${selectedModuleId}/lessons`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('X-XSRF-TOKEN', csrf);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.message || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    }).then(async () => {
      setUploadFile(null);
      setUploadTitle('');
      setUploadText('');
      setUploadStatus('Draft');
      setUploadProgress(0);
      setUploadDuration('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setActivePanel('modules');
      if (selectedCourse) await loadModules(selectedCourse.id);
    }).catch((err: any) => {
      alert(err.message);
    }).finally(() => {
      setIsUploading(false);
    });
  };

  // ── Delete Lesson ──
  const handleDeleteLesson = async (lessonId: number) => {
    showConfirm('Delete this lesson?', async () => {
      try {
        const csrf = await getCsrf();
        const res = await fetch(`/api/lessons/${lessonId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': csrf },
        });
        if (!res.ok) throw new Error('Failed to delete lesson');
        if (selectedCourse) await loadModules(selectedCourse.id);
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  // Delete lesson from preview modal (admin/instructor)
  const handleDeletePreviewLesson = async (lessonId: number) => {
    showConfirm('Delete this lesson?', async () => {
      try {
        const csrf = await getCsrf();
        const res = await fetch(`/api/lessons/${lessonId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': csrf },
        });
        if (!res.ok) throw new Error('Failed to delete lesson');
        setPreviewLesson(null);
        if (selectedCourse) await loadModules(selectedCourse.id);
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  // ── Save Quiz (Pre-Assessment) to Module ──
  const handleSaveQuiz = async () => {
    if (!selectedModuleId) {
      alert('Please select a module first.');
      return;
    }
    if (quizQuestions.length === 0) {
      alert('Please add at least one question.');
      return;
    }
    setIsSubmitting(true);
    try {
      const csrf = await getCsrf();
      const res = await fetch(`/api/modules/${selectedModuleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': csrf,
        },
        body: JSON.stringify({
          title: courseModules.find(m => m.id === selectedModuleId)?.title || 'Module',
          pre_assessment: quizQuestions,
        }),
      });
      if (!res.ok) throw new Error('Failed to save quiz');
      alert('Quiz saved successfully!');
      setQuizQuestions([]);
      setActivePanel('modules');
      if (selectedCourse) await loadModules(selectedCourse.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Add Quiz Question ──
  const addQuizQuestion = () => {
    setQuizQuestions(prev => [...prev, {
      id: prev.length + 1,
      question: '',
      options: ['', '', '', ''],
      answer: 0,
    }]);
  };

  // ── Load Available Users for Enrollment ──
  const loadAvailableUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(safeArray<any>(data));
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  // ── Enroll Student ──
  const handleEnrollStudent = async (userId: number) => {
    if (!selectedCourse) return;
    try {
      const csrf = await getCsrf();
      const res = await fetch(`/api/admin/courses/${selectedCourse.id}/enroll`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': csrf,
        },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to enroll student');
      }
      await loadEnrolledStudents(selectedCourse.id);
      await loadCourses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ── Unenroll Student ──
  const handleUnenrollStudent = async (userId: number) => {
    if (!selectedCourse) return;
    showConfirm('Remove this student from the course?', async () => {
      try {
        const csrf = await getCsrf();
        const res = await fetch(`/api/admin/courses/${selectedCourse.id}/students/${userId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': csrf },
        });
        if (!res.ok) throw new Error('Failed to unenroll student');
        await loadEnrolledStudents(selectedCourse.id);
        await loadCourses();
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  // ── Open Manage Content Modal ──
  const handleManageContent = async (course: Course) => {
    setSelectedCourse(course);
    setShowEnrollments(true);
    setActivePanel('modules');
    setSelectedModuleId(null);
    setNewModuleTitle('');
    setEditingModuleId(null);
    setSendQuizModuleId(null);
    await Promise.all([
      loadModules(course.id),
      loadEnrolledStudents(course.id),
    ]);
  };

  // ── Send Quiz to department-matching students ──
  const handleSendQuiz = async () => {
    if (!selectedCourse || !sendQuizModuleId) return;
    setSendingQuiz(true);
    try {
      const csrf = await getCsrf();
      const res = await fetch(`/api/admin/courses/${selectedCourse.id}/send-quiz`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': csrf,
        },
        body: JSON.stringify({ module_id: sendQuizModuleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send quiz');
      alert(data.message);
      setSendQuizModuleId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSendingQuiz(false);
    }
  };

  const filteredCourses = safeArray<Course>(courses).filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.instructor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || course.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Filter custom modules based on search term and status
  // Only show learning modules here - UI components appear in the sidebar instead
  const filteredCustomModules = customModules.filter(module => {
    // Exclude UI component modules - they should only appear in sidebar
    if (module.module_type === 'ui_component') {
      return false;
    }

    const matchesSearch = module.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (module.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (module.creator?.fullname || '').toLowerCase().includes(searchTerm.toLowerCase());
    // Map custom module status to course status for filtering
    const moduleStatusMap: Record<string, string> = {
      'published': 'active',
      'draft': 'draft',
      'unpublished': 'inactive'
    };
    const mappedStatus = moduleStatusMap[module.status] || 'draft';
    const matchesStatus = statusFilter === 'all' || mappedStatus === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      Active: 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-300',
      Draft: 'bg-yellow-100 text-yellow-800 dark:bg-amber-500/20 dark:text-amber-300',
      Inactive: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'
    };
    return badges[status as keyof typeof badges] || badges.Draft;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <LoadingState message="Loading courses" />
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 border border-transparent dark:border-slate-800">
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && courses.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <h3 className="text-yellow-800 font-medium">Connection Issue</h3>
          <p className="text-yellow-700 mt-1">{error}</p>
          <p className="text-yellow-600 text-sm mt-2">Showing demo course data instead.</p>
        </div>
        {/* Continue with regular interface */}
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Course Management</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-slate-700">
              <div className="h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-t-lg flex items-center justify-center">
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                  <AcademicCapIcon className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium capitalize bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Fundamentals of Networking</h3>
                <div className="flex items-center text-sm text-gray-600 dark:text-slate-300 mb-4 space-x-4">
                  <div className="flex items-center">
                    <UsersIcon className="h-4 w-4 mr-1" />
                    0 Enrolled
                  </div>
                  <div className="flex items-center">
                    <AcademicCapIcon className="h-4 w-4 mr-1" />
                    2 Modules
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300 mb-4">
                  <div className="font-medium">IT</div>
                  <div>Instructor: Admin</div>
                </div>
                <button
                  className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  Manage Content →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Hidden file input for custom module thumbnail upload */}
      <input
        type="file"
        ref={customModuleThumbnailRef}
        className="hidden"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
        onChange={handleCustomModuleThumbnailChange}
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                API Connection Issue: {error}. Showing available data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Course Management</h1>
        <button
          type="button"
          onClick={() => {
            setCreateDepartment('');
            setCreateSubdepartmentId('');
            setCreateInstructorId(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Create Course
        </button>
      </div>

      {/* Search and Filter */}
      <div className="course-toolbar-animate flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search courses..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Draft">Draft</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course, index) => (
          <div
            key={course.id}
            className="course-management-card group relative bg-white border border-slate-200 rounded-xl shadow hover:shadow-lg transition-all dark:bg-slate-900/90 dark:border-slate-700/80 dark:shadow-[0_12px_32px_rgba(2,6,23,0.35)]"
            style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
          >
            {/* Course Icon */}
            <div className="h-28 bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-teal-500 rounded-t-xl flex items-center justify-center">
              <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full overflow-hidden flex items-center justify-center border-4 border-white/80 dark:border-slate-300/40 shadow-md">
                {course.instructor_profile_picture ? (
                  <img src={course.instructor_profile_picture} alt={course.instructor} className="w-full h-full object-cover" />
                ) : course.instructor !== 'Unassigned' ? (
                  <span className="text-2xl font-bold text-green-700 dark:text-emerald-300">
                    {course.instructor.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <AcademicCapIcon className="h-8 w-8 text-green-700 dark:text-emerald-300" />
                )}
              </div>
            </div>

            {/* Course Content */}
            <div className="p-5">
              {/* Status Badge */}
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(course.status)}`}>
                  {course.status}
                </span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => onNavigate?.('course-detail', String(course.id))}
                    className="course-card-icon-btn p-1.5 rounded-md text-gray-600 hover:text-blue-700 hover:bg-blue-50 dark:text-slate-300 dark:hover:text-sky-300 dark:hover:bg-slate-800"
                    title="Manage Content"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onNavigate?.('course-content-editor', String(course.id))}
                    className="p-1.5 rounded-md text-gray-600 hover:text-green-700 hover:bg-green-50 dark:text-slate-300 dark:hover:text-green-300 dark:hover:bg-slate-800"
                    title="Edit Modules & Lessons"
                  >
                    <DocumentPlusIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEditCourse(course)}
                    className="course-card-icon-btn p-1.5 rounded-md text-gray-600 hover:text-amber-700 hover:bg-amber-50 dark:text-slate-300 dark:hover:text-amber-300 dark:hover:bg-slate-800"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCourse(course)}
                    className="course-card-icon-btn p-1.5 rounded-md text-gray-600 hover:text-rose-700 hover:bg-rose-50 dark:text-slate-300 dark:hover:text-rose-300 dark:hover:bg-slate-800"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Course Title */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2 leading-tight">{course.title}</h3>

              {/* Stats */}
              <div className="flex items-center text-sm text-gray-600 dark:text-slate-300 mb-4 space-x-4">
                <div className="flex items-center">
                  <UsersIcon className="h-4 w-4 mr-1" />
                  {course.enrolled_count} Enrolled
                </div>
                <div className="flex items-center">
                  <AcademicCapIcon className="h-4 w-4 mr-1" />
                  {course.modules_count} Modules
                </div>
              </div>

              {/* Department and Instructor */}
              <div className="flex items-center gap-2 mb-4">
                {course.instructor_profile_picture ? (
                  <img
                    src={course.instructor_profile_picture}
                    alt={course.instructor}
                    className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-slate-600 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-emerald-500/20 border border-gray-200 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-green-700 dark:text-emerald-300">
                      {course.instructor !== 'Unassigned'
                        ? course.instructor.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                        : '?'}
                    </span>
                  </div>
                )}
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <div className="font-medium text-gray-700 dark:text-slate-200">{course.department}</div>
                  <div>{course.instructor}</div>
                </div>
              </div>

              {/* Manage Content Button */}
              <button
                onClick={() => onNavigate?.('course-detail', String(course.id))}
                className="course-manage-button w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Manage Content →
              </button>
            </div>
          </div>
        ))}

        {/* Custom Modules Cards */}
        {filteredCustomModules.map((module) => (
          <div key={`custom-${module.id}`} className="relative bg-white border border-slate-200 rounded-xl shadow hover:shadow-lg transition-all dark:bg-slate-900/90 dark:border-slate-700/80 dark:shadow-[0_12px_32px_rgba(2,6,23,0.35)]">
            {/* Custom Module Icon */}
            <div className="h-28 bg-gradient-to-br from-purple-400 to-purple-600 dark:from-purple-500 dark:to-indigo-500 rounded-t-xl flex items-center justify-center relative">
              {/* Custom Module Badge */}
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 dark:bg-slate-800/90 rounded-full text-xs font-medium text-purple-700 dark:text-purple-300">
                Custom Module
              </div>
              {/* Clickable Logo/Thumbnail */}
              <button
                onClick={() => handleCustomModuleThumbnailClick(module.id)}
                className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full overflow-hidden flex items-center justify-center border-4 border-white/80 dark:border-slate-300/40 shadow-md cursor-pointer hover:opacity-90 transition-opacity group relative"
                title="Click to upload logo"
              >
                {module.thumbnail_url ? (
                  <img
                    src={module.thumbnail_url}
                    alt={module.title}
                    className="w-full h-full object-cover"
                  />
                ) : module.creator ? (
                  <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {module.creator.fullname.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <AcademicCapIcon className="h-8 w-8 text-purple-700 dark:text-purple-300" />
                )}
                {/* Camera overlay on hover */}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <CameraIcon className="h-6 w-6 text-white" />
                </div>
              </button>
            </div>

            {/* Custom Module Content */}
            <div className="p-5">
              {/* Status Badge */}
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                  module.status === 'published'
                    ? 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : module.status === 'draft'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-amber-500/20 dark:text-amber-300'
                    : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'
                }`}>
                  {module.status}
                </span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => onNavigate?.('custom-field', undefined, module.id)}
                    className="p-1.5 rounded-md text-gray-600 hover:text-blue-700 hover:bg-blue-50 dark:text-slate-300 dark:hover:text-sky-300 dark:hover:bg-slate-800"
                    title="View Module Details"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onNavigate?.('custom-field', undefined, module.id)}
                    className="p-1.5 rounded-md text-gray-600 hover:text-amber-700 hover:bg-amber-50 dark:text-slate-300 dark:hover:text-amber-300 dark:hover:bg-slate-800"
                    title="Edit Module"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Module Title */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2 leading-tight">{module.title}</h3>

              {/* Stats */}
              <div className="flex items-center text-sm text-gray-600 dark:text-slate-300 mb-4 space-x-4">
                <div className="flex items-center">
                  <AcademicCapIcon className="h-4 w-4 mr-1" />
                  {module.lessons_count} Lessons
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  v{module.version}
                </div>
              </div>

              {/* Category and Creator */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-500/20 border border-gray-200 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                    {module.creator
                      ? module.creator.fullname.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                      : '?'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <div className="font-medium text-gray-700 dark:text-slate-200">{module.category || 'Uncategorized'}</div>
                  <div>{module.creator?.fullname || 'Unknown'}</div>
                </div>
              </div>

              {/* Manage Content Button */}
              <button
                onClick={() => onNavigate?.('custom-field', undefined, module.id)}
                className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Manage Content →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredCourses.length === 0 && filteredCustomModules.length === 0 && (
        <div className="text-center py-12">
          <AcademicCapIcon className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No courses found</h3>
          <p className="text-gray-600 dark:text-slate-300 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by creating your first course'
            }
          </p>
          {/* Create Course removed on admin UI */}
        </div>
      )}

      {/* Manage Content Modal */}
      {showEnrollments && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedCourse.title}</h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{selectedCourse.department}</span>
                    {selectedCourse.instructor && (
                      <span className="text-gray-500">Instructor: <span className="font-medium text-gray-700">{selectedCourse.instructor}</span></span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(selectedCourse.status)}`}>{selectedCourse.status}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setShowEnrollments(false); setActivePanel('modules'); setSelectedModuleId(null); }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex space-x-1 mt-4 bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'modules', label: 'Modules', icon: DocumentPlusIcon, color: 'text-blue-600' },
                  { key: 'upload', label: 'Upload Content', icon: VideoCameraIcon, color: 'text-purple-600' },
                  { key: 'quiz', label: 'Create Quiz', icon: AcademicCapIcon, color: 'text-green-600' },
                  { key: 'enroll', label: 'Enroll Students', icon: UsersIcon, color: 'text-orange-600' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActivePanel(tab.key as any);
                      if (tab.key === 'enroll') loadAvailableUsers();
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      activePanel === tab.key
                        ? 'bg-white shadow text-gray-900 dark:bg-slate-800 dark:text-slate-100'
                        : 'text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-slate-100'
                    }`}
                  >
                    <tab.icon className={`h-4 w-4 ${activePanel === tab.key ? tab.color : ''}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* ── MODULES PANEL ── */}
              {activePanel === 'modules' && (
                <div>
                  {/* Add Module */}
                  <div className="flex gap-2 mb-6">
                    <input
                      type="text"
                      value={newModuleTitle}
                      onChange={e => setNewModuleTitle(e.target.value)}
                      placeholder="New module title..."
                      className="flex-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyDown={e => { if (e.key === 'Enter') handleAddModule(); }}
                    />
                    <button
                      onClick={handleAddModule}
                      disabled={isSubmitting || !newModuleTitle.trim()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <PlusIcon className="h-4 w-4" /> Add Module
                    </button>
                  </div>

                  {loadingModules ? (
                    <LoadingState message="Loading modules" />
                  ) : courseModules.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-slate-300">No modules yet. Add one above.</div>
                  ) : (
                    <div className="space-y-3">
                      {safeArray(courseModules).map((mod) => (
                        <div key={mod.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          {/* Module Header */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => setCourseModules(prev => prev.map(m => m.id === mod.id ? { ...m, isOpen: !m.isOpen } : m))}
                          >
                            <div className="flex items-center gap-2">
                              {mod.isOpen
                                ? <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-slate-300" />
                                : <ChevronRightIcon className="h-5 w-5 text-gray-500 dark:text-slate-300" />
                              }
                              {editingModuleId === mod.id ? (
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                  <input
                                    value={editModuleTitle}
                                    onChange={e => setEditModuleTitle(e.target.value)}
                                    className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded px-2 py-1 text-sm"
                                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateModule(mod.id); }}
                                  />
                                  <button onClick={() => handleUpdateModule(mod.id)} className="text-green-600 text-sm font-medium">Save</button>
                                  <button onClick={() => setEditingModuleId(null)} className="text-gray-500 dark:text-slate-300 text-sm">Cancel</button>
                                </div>
                              ) : (
                                <span className="font-medium text-gray-900 dark:text-slate-100">{mod.title}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <span className="text-xs text-gray-500">{safeArray(mod.lessons).length || 0} lessons</span>
                              <button
                                onClick={() => { setSelectedModuleId(mod.id); setActivePanel('upload'); }}
                                className="p-1 text-gray-400 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300"
                                title="Upload Content to this module"
                              >
                                <PlusIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setEditingModuleId(mod.id); setEditModuleTitle(mod.title); }}
                                className="p-1 text-gray-400 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-amber-300"
                                title="Rename"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteModule(mod.id)}
                                className="p-1 text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-rose-300"
                                title="Delete Module"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {/* Module Lessons */}
                          {mod.isOpen && (
                            <div className="p-4 space-y-2">
                              {safeArray(mod.pre_assessment).length > 0 && (
                                <div className="flex items-center gap-2 p-2 bg-green-50 rounded text-sm text-green-700">
                                  <AcademicCapIcon className="h-4 w-4" />
                                  Quiz: {safeArray(mod.pre_assessment).length} question{safeArray(mod.pre_assessment).length !== 1 ? 's' : ''}
                                </div>
                              )}
                              {safeArray(mod.lessons).length > 0 ? (
                                safeArray(mod.lessons).map((lesson: any) => (
                                  <div key={lesson.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setPreviewLesson(lesson)}>
                                    <div className="flex items-center gap-2">
                                      {lesson.type === 'Video' ? (
                                        <VideoCameraIcon className="h-4 w-4 text-purple-500" />
                                      ) : lesson.type === 'Document' ? (
                                        <DocumentPlusIcon className="h-4 w-4 text-blue-500" />
                                      ) : (
                                        <DocumentPlusIcon className="h-4 w-4 text-gray-500 dark:text-slate-300" />
                                      )}
                                      <span className="text-sm text-gray-800 dark:text-slate-100">{lesson.title}</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                        lesson.status === 'Published' || lesson.status === 'published'
                                          ? 'bg-green-100 text-green-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                          : 'bg-yellow-100 text-yellow-700 dark:bg-amber-900/30 dark:text-amber-300'
                                      }`}>{lesson.status || 'Draft'}</span>
                                      {lesson.duration && <span className="text-xs text-gray-400 dark:text-slate-300">• {lesson.duration}</span>}
                                      {lesson.file_size && <span className="text-xs text-gray-400 dark:text-slate-300">• {lesson.file_size}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setPreviewLesson(lesson); }}
                                        className="p-1 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-sky-300"
                                        title="Preview"
                                      >
                                        <EyeIcon className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteLesson(lesson.id); }}
                                        className="p-1 text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-rose-300"
                                        title="Delete Lesson"
                                      >
                                        <TrashIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-gray-400 py-2 flex items-center justify-between">
                                  <span>No lessons yet.</span>
                                  <button
                                    onClick={e => { e.stopPropagation(); setSelectedModuleId(mod.id); setActivePanel('upload'); }}
                                    className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                                  >
                                    <PlusIcon className="h-3 w-3" /> Add Content
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── UPLOAD CONTENT PANEL ── */}
              {activePanel === 'upload' && (
                <div className="max-w-lg mx-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Learning Content</h3>
                  <div className="space-y-4">
                    {/* Lesson Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Title</label>
                      <input
                        type="text"
                        value={uploadTitle}
                        onChange={e => setUploadTitle(e.target.value)}
                        placeholder="e.g. Introduction to Encryption"
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>

                    {/* Target Module */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Module</label>
                      <select
                        value={selectedModuleId || ''}
                        onChange={e => setSelectedModuleId(Number(e.target.value) || null)}
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">-- Choose a module --</option>
                        {safeArray(courseModules).map(m => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Content Type Buttons */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { key: 'Video', icon: VideoCameraIcon, label: 'Video' },
                          { key: 'Document', icon: DocumentPlusIcon, label: 'Document' },
                          { key: 'Text', icon: AcademicCapIcon, label: 'Text' },
                        ].map(ct => (
                          <button
                            key={ct.key}
                            type="button"
                            onClick={() => { setUploadType(ct.key as any); setUploadFile(null); setUploadText(''); setUploadDuration(''); }}
                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                              uploadType === ct.key
                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                            }`}
                          >
                            <ct.icon className="h-6 w-6" />
                            <span className="text-sm font-medium">{ct.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={uploadStatus}
                        onChange={e => setUploadStatus(e.target.value as any)}
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Published">Published</option>
                      </select>
                    </div>

                    {/* File Upload (Video / Document) */}
                    {uploadType !== 'Text' && (
                      <div
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]); }}
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          uploadFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        {uploadFile ? (
                          <div className="flex items-center justify-center gap-2 text-green-700">
                            <span className="text-green-500">&#10003;</span>
                            <span className="text-sm font-medium">{uploadFile.name}</span>
                            <span className="text-xs text-gray-500">({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                            <button onClick={() => { setUploadFile(null); setUploadDuration(''); }} className="ml-2 text-red-400 hover:text-red-600">
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <VideoCameraIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600 mb-2">Drag & drop your file here, or</p>
                            <label className="cursor-pointer inline-block px-4 py-2 bg-purple-50 text-purple-700 rounded-md text-sm font-semibold hover:bg-purple-100">
                              Browse Files
                              <input
                                type="file"
                                className="hidden"
                                accept={uploadType === 'Video' ? 'video/*' : '.pdf,.doc,.docx,.ppt,.pptx,.txt'}
                                onChange={e => handleFileSelect(e.target.files?.[0] || null)}
                              />
                            </label>
                            <p className="text-xs text-gray-400 mt-2">
                              {uploadType === 'Video' ? 'MP4, WebM, AVI up to 500MB' : 'PDF, DOC, DOCX, PPT, PPTX, TXT up to 500MB'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Input */}
                    {uploadType === 'Text' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Text Content</label>
                        <textarea
                          value={uploadText}
                          onChange={e => setUploadText(e.target.value)}
                          rows={8}
                          placeholder="Enter your text content here..."
                          className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    )}

                    {/* Upload Progress Bar */}
                    {isUploading && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Uploading...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Upload Button */}
                    <button
                      onClick={handleUploadLesson}
                      disabled={
                        isUploading ||
                        !selectedModuleId ||
                        !uploadTitle.trim() ||
                        (uploadType !== 'Text' && !uploadFile) ||
                        (uploadType === 'Text' && !uploadText.trim())
                      }
                      className="w-full bg-green-600 text-white py-2.5 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                    >
                      {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload & Save'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── CREATE QUIZ PANEL ── */}
              {activePanel === 'quiz' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Pre-Assessment Quiz</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Module</label>
                    <select
                      value={selectedModuleId || ''}
                      onChange={e => setSelectedModuleId(Number(e.target.value) || null)}
                      className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">-- Choose a module --</option>
                      {safeArray(courseModules).map(m => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Questions */}
                  <div className="space-y-4 mb-4">
                    {quizQuestions.map((q, qi) => (
                      <div key={qi} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Question {qi + 1}</span>
                          <button
                            onClick={() => setQuizQuestions(prev => prev.filter((_, i) => i !== qi))}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={q.question}
                          onChange={e => {
                            const updated = [...quizQuestions];
                            updated[qi] = { ...updated[qi], question: e.target.value };
                            setQuizQuestions(updated);
                          }}
                          placeholder="Enter question..."
                          className="w-full border border-gray-300 rounded-md py-2 px-3 mb-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <div className="space-y-2">
                          {safeArray(q.options).map((opt: string, oi: number) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`q-${qi}-answer`}
                                checked={q.answer === oi}
                                onChange={() => {
                                  const updated = [...quizQuestions];
                                  updated[qi] = { ...updated[qi], answer: oi };
                                  setQuizQuestions(updated);
                                }}
                                className="text-green-600 focus:ring-green-500"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={e => {
                                  const updated = [...quizQuestions];
                                  const newOpts = [...updated[qi].options];
                                  newOpts[oi] = e.target.value;
                                  updated[qi] = { ...updated[qi], options: newOpts };
                                  setQuizQuestions(updated);
                                }}
                                placeholder={`Option ${oi + 1}`}
                                className="flex-1 border border-gray-300 rounded-md py-1 px-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Select the radio button next to the correct answer.</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={addQuizQuestion}
                      className="flex items-center gap-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                    >
                      <PlusIcon className="h-4 w-4" /> Add Question
                    </button>
                    <button
                      onClick={handleSaveQuiz}
                      disabled={isSubmitting || !selectedModuleId || quizQuestions.length === 0}
                      className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Quiz'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── ENROLL STUDENTS PANEL ── */}
              {activePanel === 'enroll' && (
                <div>
                  {/* Send Quiz Section */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Send Quiz to {selectedCourse.department} Department Students</h4>
                    <p className="text-xs text-blue-700 mb-3">Select a module with a quiz to send it to all enrolled students in the <strong>{selectedCourse.department}</strong> department only.</p>
                    <div className="flex gap-2">
                      <select
                        value={sendQuizModuleId || ''}
                        onChange={e => setSendQuizModuleId(Number(e.target.value) || null)}
                        className="flex-1 border border-blue-300 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">-- Select module with quiz --</option>
                        {courseModules
                          .filter(m => (Array.isArray(m.pre_assessment) ? m.pre_assessment.length > 0 : false))
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.title} ({m.pre_assessment.length} question{m.pre_assessment.length !== 1 ? 's' : ''})
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={handleSendQuiz}
                        disabled={sendingQuiz || !sendQuizModuleId}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap"
                      >
                        {sendingQuiz ? 'Sending...' : 'Send Quiz'}
                      </button>
                    </div>
                    {safeArray<ModuleDetail>(courseModules).filter(m => (Array.isArray(m.pre_assessment) ? m.pre_assessment.length > 0 : false)).length === 0 && (
                      <p className="text-xs text-blue-600 mt-2">No modules have quizzes yet. Create one in the "Create Quiz" tab first.</p>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Enrolled Students ({enrolledStudents.length})
                  </h3>

                  {/* Search & Enroll */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add Student</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={enrollSearchTerm}
                        onChange={e => setEnrollSearchTerm(e.target.value)}
                        placeholder="Search by name or email..."
                        className="flex-1 border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    {enrollSearchTerm.trim() && (
                      <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white">
                        {availableUsers
                          .filter(u => {
                            const term = enrollSearchTerm.toLowerCase();
                            const alreadyEnrolled = enrolledStudents.some(s => s.id === u.id);
                            return !alreadyEnrolled && (
                              (u.fullName || '').toLowerCase().includes(term) ||
                              u.email.toLowerCase().includes(term)
                            );
                          })
                          .slice(0, 10)
                          .map(u => (
                            <button
                              key={u.id}
                              onClick={() => { handleEnrollStudent(u.id); setEnrollSearchTerm(''); }}
                              className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-100 last:border-0"
                            >
                              <div className="text-sm font-medium text-gray-900">{u.fullName}</div>
                              <div className="text-xs text-gray-500">{u.email} &middot; {u.department || 'No Dept'}</div>
                            </button>
                          ))}
                        {safeArray<UserOption>(availableUsers).filter(u => {
                          const term = enrollSearchTerm.toLowerCase();
                          const alreadyEnrolled = enrolledStudents.some(s => s.id === u.id);
                          return !alreadyEnrolled && (
                            (u.fullName || '').toLowerCase().includes(term) ||
                            u.email.toLowerCase().includes(term)
                          );
                        }).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No matching users found.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Enrolled list */}
                  {enrolledStudents.length > 0 ? (
                    <div className="space-y-2">
                      {enrolledStudents.map((student) => (
                        <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{student.name}</div>
                            <div className="text-sm text-gray-600">{student.email}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm text-gray-600">
                                {student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString() : 'N/A'}
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                student.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {student.status}
                              </span>
                            </div>
                            <button
                              onClick={() => handleUnenrollStudent(student.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Unenroll"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No students enrolled in this course yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Bulk Assign Courses</h3>
              <button onClick={() => setShowBulkAssignModal(false)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-5 w-5"/></button>
            </div>

            <p className="text-sm text-gray-600 mb-4">Assign {selectedCourseIds.length} selected course(s) to an instructor. Choose 'Unassigned' to clear assignment.</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
              <select
                value={bulkInstructorId ?? ''}
                onChange={(e) => setBulkInstructorId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-gray-300 rounded-md py-2 px-3"
              >
                <option value="">Unassigned</option>
                {instructors.map(i => (
                  <option key={i.id} value={i.id}>{i.fullname} ({i.email})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBulkAssignModal(false)} className="px-4 py-2 border rounded-md">Cancel</button>
              <button
                onClick={async () => {
                  setIsBulkAssigning(true);
                  try {
                    // Ensure Laravel's CSRF cookie is set for Sanctum stateful auth
                    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
                    const csrf = getXsrfToken();

                    const res = await fetch('/api/admin/courses/bulk-assign', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': csrf },
                      credentials: 'include',
                      body: JSON.stringify({ course_ids: selectedCourseIds, instructor_id: bulkInstructorId }),
                    });
                    if (!res.ok) {
                      const text = await res.text().catch(() => `Status ${res.status}`);
                      throw new Error(text || `Status ${res.status}`);
                    }
                    const data = await res.json();
                    // refresh courses
                    await loadCourses();
                    setSelectedCourseIds([]);
                    setShowBulkAssignModal(false);
                  } catch (err) {
                    console.error('Bulk assign failed', err);
                    alert('Bulk assign failed. See console for details.');
                  } finally {
                    setIsBulkAssigning(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isBulkAssigning}
              >
                {isBulkAssigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="course-editor-modal bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Create New Course</h2>
              <button
                onClick={() => { setShowCreateModal(false); setCreateInstructorId(null); setCreateDepartment(''); setCreateSubdepartmentId(''); }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                const form = e.currentTarget;
                const fd = new FormData(form);
                if (createInstructorId) fd.set('instructor_id', String(createInstructorId));
                const startDateUtc = toUtcIsoString(fd.get('start_date'));
                const deadlineUtc = toUtcIsoString(fd.get('deadline'));
                if (startDateUtc) fd.set('start_date', startDateUtc); else fd.delete('start_date');
                if (deadlineUtc) fd.set('deadline', deadlineUtc); else fd.delete('deadline');
                try {
                  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
                  const csrf = getXsrfToken();
                  const res = await fetch('/api/admin/courses', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                      'Accept': 'application/json',
                      'X-XSRF-TOKEN': csrf,
                    },
                    body: fd,
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || 'Failed to create course');
                  }
                  setShowCreateModal(false);
                  setCreateInstructorId(null);
                  setCreateDepartment('');
                  setCreateSubdepartmentId('');
                  await loadCourses();
                } catch (err: any) {
                  alert(err.message);
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Title <span className="text-red-500">*</span></label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Introduction to Cybersecurity"
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Brief course description..."
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
                  <select
                    name="department"
                    required
                    value={createDepartment}
                    onChange={(e) => {
                      setCreateDepartment(e.target.value);
                      setCreateSubdepartmentId('');
                      setCreateInstructorId(null);
                    }}
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Active Status</label>
                  <select
                    name="status"
                    defaultValue="Active"
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub Department</label>
                <select
                  name="subdepartment_id"
                  required
                  value={createSubdepartmentId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCreateSubdepartmentId(value ? Number(value) : '');
                    setCreateInstructorId(null);
                  }}
                  disabled={!createDepartment}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select Sub Department</option>
                  {(departments.find(d => d.name === createDepartment)?.subdepartments || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                  <input
                    name="start_date"
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date & Time</label>
                  <input
                    name="deadline"
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              {/* Assign Instructor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                {createInstructorId !== null && (() => {
                  const sel = instructors.find(i => i.id === createInstructorId);
                  return sel ? (
                    <div className="flex items-center gap-3 mb-2 p-2 bg-green-50 border border-green-200 rounded-md">
                      {sel.profile_picture ? (
                        <img
                          src={sel.profile_picture}
                          alt={sel.fullname}
                          className="w-12 h-12 rounded-full object-cover border-2 border-green-300 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-green-200 border-2 border-green-300 flex items-center justify-center flex-shrink-0">
                          <span className="text-base font-bold text-green-800">
                            {sel.fullname.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{sel.fullname}</p>
                        <p className="text-xs text-green-600">Assigned Instructor</p>
                      </div>
                    </div>
                  ) : null;
                })()}
                <select
                  value={createInstructorId ?? ''}
                  onChange={(e) => setCreateInstructorId(e.target.value ? Number(e.target.value) : null)}
                  disabled={!createDepartment || !createSubdepartmentId}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">{!createDepartment || !createSubdepartmentId ? 'Select department and sub department first' : 'Select Instructor'}</option>
                  {(!createDepartment || !createSubdepartmentId ? [] : getEligibleInstructors(createDepartment, createSubdepartmentId)).map(i => (
                    <option key={i.id} value={i.id}>{i.fullname}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Course'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateInstructorId(null); setCreateDepartment(''); setCreateSubdepartmentId(''); }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {showEditModal && editingCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="course-editor-modal bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Edit Course</h2>
              <button
                onClick={() => { setShowEditModal(false); setEditingCourse(null); setEditInstructorPhotoFile(null); setEditInstructorPhotoPreview(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Title</label>
                <input
                  name="title"
                  type="text"
                  defaultValue={editingCourse.title}
                  required
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingCourse.description}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    name="department"
                    value={editDepartment}
                    onChange={(e) => {
                      setEditDepartment(e.target.value);
                      setEditSubdepartmentId('');
                      setEditInstructorId(null);
                    }}
                    required
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingCourse.status}
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub Department</label>
                <select
                  name="subdepartment_id"
                  value={editSubdepartmentId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditSubdepartmentId(value ? Number(value) : '');
                    setEditInstructorId(null);
                  }}
                  disabled={!editDepartment}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select Sub Department</option>
                  {(departments.find(d => d.name === editDepartment)?.subdepartments || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                  <input
                    name="start_date"
                    type="datetime-local"
                    defaultValue={toLocalDateTimeInputValue(editingCourse.start_date)}
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date & Time</label>
                  <input
                    name="deadline"
                    type="datetime-local"
                    defaultValue={toLocalDateTimeInputValue(editingCourse.deadline)}
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned to</label>
                {editInstructorId !== null && (() => {
                  const sel = instructors.find(i => i.id === editInstructorId);
                  return sel ? (
                    <div className="flex items-center gap-3 mb-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      {/* Clickable avatar with camera overlay */}
                      <div
                        className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-green-300 cursor-pointer flex-shrink-0 group"
                        onClick={() => editInstructorPhotoRef.current?.click()}
                        title="Click to upload photo"
                      >
                        {editInstructorPhotoPreview || sel.profile_picture ? (
                          <img
                            src={editInstructorPhotoPreview ?? sel.profile_picture!}
                            alt={sel.fullname}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-green-200 flex items-center justify-center">
                            <span className="text-base font-bold text-green-800">
                              {sel.fullname.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {/* Camera overlay on hover */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity rounded-full">
                          <CameraIcon className="h-5 w-5 text-white" />
                          <span className="text-white text-[9px] font-medium mt-0.5">Upload</span>
                        </div>
                      </div>
                      <input
                        ref={editInstructorPhotoRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setEditInstructorPhotoFile(file);
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setEditInstructorPhotoPreview(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{sel.fullname}</p>
                        <p className="text-xs text-green-600">Assigned Instructor</p>
                        {editInstructorPhotoFile && (
                          <p className="text-xs text-blue-600 mt-0.5">📷 New photo ready to save</p>
                        )}
                      </div>
                    </div>
                  ) : null;
                })()}
                <select
                  name="instructor_id"
                  value={editInstructorId ?? ''}
                  onChange={(e) => {
                    const newId = e.target.value ? Number(e.target.value) : null;
                    setEditInstructorId(newId);
                    // Reset photo state to the new instructor's existing photo
                    const newInst = instructors.find(i => i.id === newId);
                    setEditInstructorPhotoPreview(newInst?.profile_picture ?? null);
                    setEditInstructorPhotoFile(null);
                  }}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Unassigned</option>
                  {getEligibleInstructors(editDepartment, editSubdepartmentId).map(i => (
                      <option key={i.id} value={i.id}>{i.fullname} ({i.email})</option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingCourse(null); setEditInstructorPhotoFile(null); setEditInstructorPhotoPreview(null); }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════ PREVIEW LESSON MODAL ═══════════════════ */}
      {previewLesson && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-500 opacity-75" onClick={() => setPreviewLesson(null)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full z-10 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{previewLesson.title}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      previewLesson.type === 'Video' ? 'bg-purple-100 text-purple-700' :
                      previewLesson.type === 'Document' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{previewLesson.type}</span>
                    {previewLesson.duration && <span className="text-xs text-gray-500">{previewLesson.duration}</span>}
                    {previewLesson.file_size && <span className="text-xs text-gray-500">{previewLesson.file_size}</span>}
                    {previewLesson.status && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        previewLesson.status === 'Published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>{previewLesson.status}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(currentUserRole === 'admin' || currentUserRole === 'instructor') && (
                    <button
                      onClick={() => handleDeletePreviewLesson(previewLesson.id)}
                      className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded border border-red-100 bg-red-50"
                      title="Delete Lesson"
                    >
                      Delete
                    </button>
                  )}
                  <button onClick={() => setPreviewLesson(null)} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                {previewLesson.type === 'Video' && previewLesson.content_url && (
                  <video
                    controls
                    className="w-full rounded-lg bg-black"
                    src={previewLesson.content_url}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                {previewLesson.type === 'Document' && previewLesson.content_url && (
                  <div className="space-y-4">
                    {previewLesson.content_url.match(/\.pdf$/i) ? (
                      <iframe
                        src={previewLesson.content_url}
                        className="w-full rounded-lg border border-gray-200"
                        style={{ height: '70vh' }}
                        title={previewLesson.title}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <DocumentPlusIcon className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                        <p className="text-sm text-gray-600 mb-4">{previewLesson.title}</p>
                        <a
                          href={previewLesson.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                        >
                          Download File
                        </a>
                      </div>
                    )}
                  </div>
                )}
                {previewLesson.type === 'Text' && (
                  <div className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-6 border border-gray-200 whitespace-pre-wrap">
                    {previewLesson.text_content || 'No content available.'}
                  </div>
                )}
                {!previewLesson.content_url && previewLesson.type !== 'Text' && (
                  <div className="text-center py-12">
                    <DocumentPlusIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-sm text-gray-500">No file uploaded for this lesson.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {confirm.ConfirmModalRenderer()}
    </div>
  );
}
