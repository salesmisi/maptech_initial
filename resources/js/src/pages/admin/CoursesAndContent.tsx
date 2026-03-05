import { useState, useEffect } from 'react';
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
} from '@heroicons/react/24/outline';

interface Course {
  id: number;
  title: string;
  description: string;
  department: string;
  instructor: string;
  status: 'active' | 'draft' | 'archived';
  modules_count: number;
  enrolled_count: number;
  created_at: string;
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

export function CoursesAndContent() {
  const [courses, setCourses] = useState<Course[]>([]);
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
  const [departments, setDepartments] = useState<{id: number; name: string}[]>([]);
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
  const [uploadType, setUploadType] = useState<'Video' | 'Document'>('Video');
  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<{id: number; question: string; options: string[]; answer: number}[]>([]);
  // Send Quiz state
  const [sendQuizModuleId, setSendQuizModuleId] = useState<number | null>(null);
  const [sendingQuiz, setSendingQuiz] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initComponent = async () => {
      console.log('CoursesAndContent: Component mounting');

      try {
        await loadCourses();
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

  // Load departments for edit form
  useEffect(() => {
    fetch('/api/departments')
      .then(res => res.json())
      .then(data => setDepartments(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load departments:', err));
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
        instructor: typeof c.instructor === 'object' && c.instructor !== null
          ? c.instructor.fullName || 'Unassigned'
          : c.instructor || 'Unassigned',
        department: typeof c.department === 'object' && c.department !== null
          ? c.department.name || ''
          : c.department || '',
      })));
    } catch (err: any) {
      console.error('CoursesAndContent: Load courses error:', err);
      setError(err.message);
      // Set some default courses if API fails
      setCourses([
        {
          id: 1,
          title: 'Fundamentals of Networking',
          description: 'Learn the basics of networking',
          department: 'IT',
          instructor: 'Admin',
          status: 'active' as const,
          modules_count: 2,
          enrolled_count: 0,
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
      console.log('CoursesAndContent: Load courses completed');
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

  const handleViewEnrollments = async (course: Course) => {
    setSelectedCourse(course);
    setShowEnrollments(true);
    await loadEnrolledStudents(course.id);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
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
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

      const response = await fetch(`/api/admin/courses/${editingCourse.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
        },
        body: JSON.stringify({
          title: formData.get('title'),
          description: formData.get('description'),
          department: formData.get('department'),
          status: formData.get('status'),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update course');
      }

      setShowEditModal(false);
      setEditingCourse(null);
      await loadCourses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!window.confirm(`Are you sure you want to delete "${course.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

      const response = await fetch(`/api/admin/courses/${course.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
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
  };

  // ── Helper: get CSRF token ──
  const getCsrf = async () => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
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
        setCourseModules(data.map((m: any) => ({ ...m, isOpen: false })));
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
          'X-CSRF-TOKEN': csrf,
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
          'X-CSRF-TOKEN': csrf,
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
    if (!window.confirm('Delete this module and all its lessons?')) return;
    try {
      const csrf = await getCsrf();
      const res = await fetch(`/api/modules/${moduleId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
      });
      if (!res.ok) throw new Error('Failed to delete module');
      if (selectedCourse) {
        await loadModules(selectedCourse.id);
        await loadCourses();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ── Upload Lesson (Video/Document) to Module ──
  const handleUploadLesson = async () => {
    if (!selectedModuleId || !uploadFile || !uploadTitle.trim()) {
      alert('Please select a module, enter a title, and choose a file.');
      return;
    }
    setIsSubmitting(true);
    try {
      const csrf = await getCsrf();
      const formData = new FormData();
      formData.append('title', uploadTitle.trim());
      formData.append('type', uploadType);
      formData.append('status', 'Published');
      formData.append('content', uploadFile);

      const res = await fetch(`/api/modules/${selectedModuleId}/lessons`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to upload lesson');
      }
      setUploadFile(null);
      setUploadTitle('');
      setActivePanel('modules');
      if (selectedCourse) await loadModules(selectedCourse.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete Lesson ──
  const handleDeleteLesson = async (lessonId: number) => {
    if (!window.confirm('Delete this lesson?')) return;
    try {
      const csrf = await getCsrf();
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
      });
      if (!res.ok) throw new Error('Failed to delete lesson');
      if (selectedCourse) await loadModules(selectedCourse.id);
    } catch (err: any) {
      alert(err.message);
    }
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
          'X-CSRF-TOKEN': csrf,
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
        setAvailableUsers(Array.isArray(data) ? data : []);
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
          'X-CSRF-TOKEN': csrf,
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
    if (!window.confirm('Remove this student from the course?')) return;
    try {
      const csrf = await getCsrf();
      const res = await fetch(`/api/admin/courses/${selectedCourse.id}/students/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
      });
      if (!res.ok) throw new Error('Failed to unenroll student');
      await loadEnrolledStudents(selectedCourse.id);
      await loadCourses();
    } catch (err: any) {
      alert(err.message);
    }
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
          'X-CSRF-TOKEN': csrf,
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

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.instructor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || course.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      draft: 'bg-yellow-100 text-yellow-800',
      archived: 'bg-gray-100 text-gray-800'
    };
    return badges[status as keyof typeof badges] || badges.active;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-blue-800 font-medium">Loading Courses...</h3>
          <p className="text-blue-600 mt-1">Please wait while we fetch your course data.</p>
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
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
            <h1 className="text-2xl font-bold text-gray-900">Course Management</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Create Course
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Fundamentals of Networking</h3>
                <div className="flex items-center text-sm text-gray-600 mb-4 space-x-4">
                  <div className="flex items-center">
                    <UsersIcon className="h-4 w-4 mr-1" />
                    0 Enrolled
                  </div>
                  <div className="flex items-center">
                    <AcademicCapIcon className="h-4 w-4 mr-1" />
                    2 Modules
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-4">
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
        <h1 className="text-2xl font-bold text-gray-900">Course Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Create Course
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => (
          <div key={course.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            {/* Course Icon */}
            <div className="h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-t-lg flex items-center justify-center">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                <AcademicCapIcon className="h-8 w-8 text-green-600" />
              </div>
            </div>

            {/* Course Content */}
            <div className="p-6">
              {/* Status Badge */}
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(course.status)}`}>
                  {course.status}
                </span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleManageContent(course)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Manage Content"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEditCourse(course)}
                    className="p-1 text-gray-400 hover:text-yellow-600"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCourse(course)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Course Title */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>

              {/* Stats */}
              <div className="flex items-center text-sm text-gray-600 mb-4 space-x-4">
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
              <div className="text-sm text-gray-600 mb-4">
                <div className="font-medium">{course.department}</div>
                <div>Instructor: {course.instructor}</div>
              </div>

              {/* Manage Content Button */}
              <button
                onClick={() => handleManageContent(course)}
                className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Manage Content →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredCourses.length === 0 && (
        <div className="text-center py-12">
          <AcademicCapIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by creating your first course'
            }
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Create Course
          </button>
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
                  <p className="text-gray-600">Course Management & Content</p>
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
                        ? 'bg-white shadow text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
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
                      className="flex-1 border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    <div className="text-center py-8 text-gray-500">Loading modules...</div>
                  ) : courseModules.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No modules yet. Add one above.</div>
                  ) : (
                    <div className="space-y-3">
                      {courseModules.map((mod) => (
                        <div key={mod.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          {/* Module Header */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                            onClick={() => setCourseModules(prev => prev.map(m => m.id === mod.id ? { ...m, isOpen: !m.isOpen } : m))}
                          >
                            <div className="flex items-center gap-2">
                              {mod.isOpen
                                ? <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                                : <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                              }
                              {editingModuleId === mod.id ? (
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                  <input
                                    value={editModuleTitle}
                                    onChange={e => setEditModuleTitle(e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateModule(mod.id); }}
                                  />
                                  <button onClick={() => handleUpdateModule(mod.id)} className="text-green-600 text-sm font-medium">Save</button>
                                  <button onClick={() => setEditingModuleId(null)} className="text-gray-500 text-sm">Cancel</button>
                                </div>
                              ) : (
                                <span className="font-medium text-gray-900">{mod.title}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <span className="text-xs text-gray-500">{mod.lessons?.length || 0} lessons</span>
                              <button
                                onClick={() => { setEditingModuleId(mod.id); setEditModuleTitle(mod.title); }}
                                className="p-1 text-gray-400 hover:text-yellow-600"
                                title="Rename"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteModule(mod.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Delete Module"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {/* Module Lessons */}
                          {mod.isOpen && (
                            <div className="p-4 space-y-2">
                              {mod.pre_assessment && mod.pre_assessment.length > 0 && (
                                <div className="flex items-center gap-2 p-2 bg-green-50 rounded text-sm text-green-700">
                                  <AcademicCapIcon className="h-4 w-4" />
                                  Quiz: {mod.pre_assessment.length} question{mod.pre_assessment.length !== 1 ? 's' : ''}
                                </div>
                              )}
                              {mod.lessons && mod.lessons.length > 0 ? (
                                mod.lessons.map((lesson: any) => (
                                  <div key={lesson.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded">
                                    <div className="flex items-center gap-2">
                                      {lesson.type === 'Video' ? (
                                        <VideoCameraIcon className="h-4 w-4 text-purple-500" />
                                      ) : (
                                        <DocumentPlusIcon className="h-4 w-4 text-blue-500" />
                                      )}
                                      <span className="text-sm text-gray-800">{lesson.title}</span>
                                      <span className="text-xs text-gray-400">({lesson.type})</span>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteLesson(lesson.id)}
                                      className="p-1 text-gray-400 hover:text-red-600"
                                      title="Delete Lesson"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-gray-400 py-2">No lessons yet. Use "Upload Content" tab to add.</div>
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Video or Document</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Module</label>
                      <select
                        value={selectedModuleId || ''}
                        onChange={e => setSelectedModuleId(Number(e.target.value) || null)}
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">-- Choose a module --</option>
                        {courseModules.map(m => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Title</label>
                      <input
                        type="text"
                        value={uploadTitle}
                        onChange={e => setUploadTitle(e.target.value)}
                        placeholder="e.g. Introduction to Safety Protocols"
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                      <select
                        value={uploadType}
                        onChange={e => setUploadType(e.target.value)}
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="Video">Video</option>
                        <option value="Document">Document</option>
                        <option value="Presentation">Presentation</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                      <input
                        type="file"
                        accept={uploadType === 'Video' ? 'video/*' : '.pdf,.doc,.docx,.ppt,.pptx'}
                        onChange={e => setUploadFile(e.target.files?.[0] || null)}
                        className="w-full border border-gray-300 rounded-md py-2 px-3 file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      />
                    </div>
                    <button
                      onClick={handleUploadLesson}
                      disabled={isSubmitting || !selectedModuleId || !uploadFile || !uploadTitle.trim()}
                      className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      {isSubmitting ? 'Uploading...' : 'Upload Content'}
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
                      {courseModules.map(m => (
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
                          {q.options.map((opt: string, oi: number) => (
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
                          .filter(m => m.pre_assessment && m.pre_assessment.length > 0)
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
                    {courseModules.filter(m => m.pre_assessment && m.pre_assessment.length > 0).length === 0 && (
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
                              (u.fullName || u.name || '').toLowerCase().includes(term) ||
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
                              <div className="text-sm font-medium text-gray-900">{u.fullName || u.name}</div>
                              <div className="text-xs text-gray-500">{u.email} &middot; {u.department || 'No Dept'}</div>
                            </button>
                          ))}
                        {availableUsers.filter(u => {
                          const term = enrollSearchTerm.toLowerCase();
                          const alreadyEnrolled = enrolledStudents.some(s => s.id === u.id);
                          return !alreadyEnrolled && (
                            (u.fullName || u.name || '').toLowerCase().includes(term) ||
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

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Create New Course</h2>
              <button
                onClick={() => setShowCreateModal(false)}
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
                try {
                  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
                  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                  const res = await fetch('/api/admin/courses', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'X-CSRF-TOKEN': csrf,
                    },
                    body: JSON.stringify({
                      title: fd.get('title'),
                      description: fd.get('description'),
                      department: fd.get('department'),
                      instructor_id: fd.get('instructor_id') || null,
                      status: fd.get('status'),
                    }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || 'Failed to create course');
                  }
                  setShowCreateModal(false);
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
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="" disabled selected>Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
                  onClick={() => setShowCreateModal(false)}
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
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Edit Course</h2>
              <button
                onClick={() => { setShowEditModal(false); setEditingCourse(null); }}
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
                    defaultValue={editingCourse.department}
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
                    <option value="Archived">Archived</option>
                  </select>
                </div>
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
                  onClick={() => { setShowEditModal(false); setEditingCourse(null); }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
