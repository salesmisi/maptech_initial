import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  BookOpen,
  Users,
  FileText,
  X,
  Upload,
  Trash } from
'lucide-react';

// Module interface for form handling
interface ModuleInput {
  id: number;
  title: string;
  file: File | null;
}

// Ensure the Course interface is exported
export interface Course {
  id: number;
  title: string;
  description: string;
  department: string;
  subdepartment_id?: number | null;
  instructor: string;
  instructor_id?: number | string | null;
  instructor_profile_picture?: string | null;
  status: 'Active' | 'Draft' | 'Inactive';
  start_date?: string | null;
  deadline?: string | null;
  enrolledCount: number;
  modulesCount: number;
  thumbnail: string;
  modules: Array<{
    id?: number;
    title: string;
    content_path?: string;
  }>;
}

interface Instructor {
  id: number;
  fullname: string;
  profile_picture?: string | null;
}

interface DeptWithSubs {
  id: number;
  name: string;
  subdepartments: { id: number; name: string }[];
}

const initialCourses: Course[] = [
{
  id: 1,
  title: 'Cybersecurity Fundamentals',
  description:
  'Learn the basics of digital security, phishing prevention, and password hygiene.',
  department: 'IT',
  instructor: 'Prof. Ana Reyes',
  status: 'Active',
  enrolledCount: 145,
  modulesCount: 8,
  thumbnail: 'bg-blue-500',
  modules: [],
},
{
  id: 2,
  title: 'Leadership Training 101',
  description: 'Essential skills for new managers and team leaders.',
  department: 'HR',
  instructor: 'Andres Bonifacio',
  status: 'Active',
  enrolledCount: 32,
  modulesCount: 12,
  thumbnail: 'bg-purple-500',
  modules: [],
},
{
  id: 3,
  title: 'Data Privacy Compliance',
  description: 'Understanding GDPR and local data privacy laws.',
  department: 'Operations',
  instructor: 'Prof. Ana Reyes',
  status: 'Draft',
  enrolledCount: 0,
  modulesCount: 5,
  thumbnail: 'bg-green-500',
  modules: [],
},
{
  id: 4,
  title: 'Customer Service Excellence',
  description:
  'Techniques for handling difficult customers and ensuring satisfaction.',
  department: 'Marketing',
  instructor: 'Andres Bonifacio',
  status: 'Active',
  enrolledCount: 89,
  modulesCount: 6,
  thumbnail: 'bg-orange-500',
  modules: [],
},
{
  id: 5,
  title: 'Workplace Safety',
  description: 'OSHA guidelines and emergency procedures.',
  department: 'Operations',
  instructor: 'Prof. Ana Reyes',
  status: 'Archived',
  enrolledCount: 210,
  modulesCount: 4,
  thumbnail: 'bg-red-500',
  modules: [],
}];

const API_BASE = '/api';

// Helper to read a cookie value
const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

// Fetch CSRF cookie then return decoded XSRF token
const getXsrfToken = async (): Promise<string> => {
  await fetch('http://127.0.0.1:8000/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
};

export function CourseManagement({ onNavigate }: { onNavigate?: (page: string, courseId?: string) => void }) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [departments, setDepartments] = useState<DeptWithSubs[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | string>('');

  // Debug: Monitor modules state changes
  useEffect(() => {
    console.log('Modules state updated:', modules.map(m => ({ id: m.id, title: m.title, hasFile: !!m.file, fileName: m.file?.name })));
  }, [modules]);

  // Module management functions
  const addModule = () => {
    setModules(prev => [...prev, { id: Date.now(), title: '', file: null }]);
  };

  const removeModule = (id: number) => {
    setModules(prev => prev.filter(m => m.id !== id));
  };

  const updateModuleTitle = (id: number, title: string) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, title } : m));
  };

  const updateModuleFile = (id: number, file: File | null) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, file } : m));
  };

  // Load courses from API on mount
  const loadCourses = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/courses`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to load courses');
      }
      const data = await response.json();
      // Map API response to Course interface
      const mappedCourses = data.map((course: any) => ({
        id: course.id,
        title: course.title,
        description: course.description || '',
        department: course.department,
        subdepartment_id: course.subdepartment_id || null,
        instructor: course.instructor?.fullname || 'Unassigned',
        instructor_id: course.instructor_id,
        instructor_profile_picture: course.instructor?.profile_picture
          ? `/storage/${course.instructor.profile_picture}`
          : null,
        status: course.status,
        start_date: course.start_date,
        deadline: course.deadline,
        enrolledCount: course.enrollments_count || 0,
        modulesCount: course.modules?.length || 0,
        thumbnail: 'bg-green-500',
        modules: course.modules || [],
      }));
      setCourses(mappedCourses);
    } catch {
      // silently fail; initial courses remain displayed
    }
  };

  const loadInstructors = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users?role=Instructor`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      setInstructors(data.map((u: any) => ({
        id: u.id,
        fullname: u.fullname,
        profile_picture: u.profile_picture ? `/storage/${u.profile_picture}` : null,
      })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadCourses();
    loadInstructors();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/departments`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      setDepartments(data);
    } catch { /* ignore */ }
  };

  // Filter Logic
  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title.
    toLowerCase().
    includes(searchTerm.toLowerCase());
    const matchesStatus =
    statusFilter === 'All' || course.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  // Delete Handler
  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      const xsrfToken = await getXsrfToken();
      const response = await fetch(`${API_BASE}/admin/courses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
      });
      if (!response.ok) throw new Error('Failed to delete course');
      setCourses(prev => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete course');
    }
  };
  // Modal Handlers
  const handleOpenModal = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setSelectedDepartment(course.department || '');
      setSelectedInstructorId(course.instructor_id ?? '');
      // Load existing modules for editing (without files since they're already uploaded)
      setModules(course.modules?.map((m, index) => ({
        id: index + 1,
        title: m.title,
        file: null,
      })) || []);
    } else {
      setEditingCourse(null);
      setSelectedDepartment('');
      setSelectedInstructorId('');
      setModules([]);
    }
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCourse(null);
    setSelectedInstructorId('');
    setModules([]);
  };
  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Attach modules with file uploads
    modules.forEach((module, index) => {
      formData.append(`modules[${index}][title]`, module.title);
      if (module.file) {
        formData.append(`modules[${index}][content]`, module.file);
      }
    });

    try {
      const xsrfToken = await getXsrfToken();

      const url = editingCourse
        ? `${API_BASE}/admin/courses/${editingCourse.id}`
        : `${API_BASE}/admin/courses`;

      // For updates with file uploads, Laravel requires POST with _method=PUT
      if (editingCourse) {
        formData.append('_method', 'PUT');
      }

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-XSRF-TOKEN': xsrfToken,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Response status:', response.status);
      console.log('Response URL:', response.url);

      const responseText = await response.text();

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          throw new Error(`Server error: ${response.status}`);
        }
        if (errorData.errors) {
          const errorMessages = Object.entries(errorData.errors)
            .map(([field, messages]: [string, any]) => `${field}: ${messages.join(', ')}`)
            .join('\n');
          throw new Error(`Validation failed:\n${errorMessages}`);
        }
        throw new Error(errorData.message || 'Failed to save course');
      }

      handleCloseModal();
      loadCourses();
    } catch (err: any) {
      alert(err.message || 'Failed to save course');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Course Management</h1>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">

          <Plus className="h-4 w-4 mr-2" />
          Create Course
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />

        </div>
        <div className="sm:w-48">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}>

              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => {
          const notStarted = course.start_date && new Date(course.start_date) > new Date();
          const ended = course.deadline && new Date(course.deadline) <= new Date();
          return (
        <div
          key={course.id}
          className={`rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${notStarted ? 'bg-gray-200 border-gray-300' : ended ? 'bg-white border-red-200' : 'bg-white border-slate-200'}`}>

            <div
            className={`h-32 ${notStarted ? 'bg-gray-400' : course.thumbnail} flex items-center justify-center`}>

              {course.instructor_profile_picture ? (
                <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white/80 shadow-md">
                  <img src={course.instructor_profile_picture} alt={course.instructor} className="w-full h-full object-cover" />
                </div>
              ) : course.instructor !== 'Unassigned' ? (
                <div className="w-16 h-16 rounded-full bg-white/20 border-4 border-white/80 shadow-md flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {course.instructor.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
              ) : (
                <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-12 w-12 text-white opacity-50" />
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start">
                <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${notStarted ? 'bg-gray-100 text-gray-600' : ended ? 'bg-red-100 text-red-800' : course.status === 'Active' ? 'bg-green-100 text-green-800' : course.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-800'}`}>

                  {notStarted ? 'Not Started' : ended ? 'Locked' : course.status}
                </span>
                <div className="flex space-x-1">
                  <button
                  onClick={() => handleOpenModal(course)}
                  className="p-1 text-slate-400 hover:text-blue-600">

                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                  onClick={() => handleDelete(course.id)}
                  className="p-1 text-slate-400 hover:text-red-600">

                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {course.title}
              </h3>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                {course.description}
              </p>

              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {course.enrolledCount} Enrolled
                </div>
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-1" />
                  {course.modulesCount} Modules
                </div>
              </div>

              {notStarted && course.start_date && (
                <p className="mt-2 text-xs text-gray-500">
                  Starts on: {new Date(course.start_date).toLocaleDateString()} {new Date(course.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {ended && (
                <p className="mt-2 text-xs text-red-500 font-medium">Course has ended and is locked</p>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {course.instructor_profile_picture ? (
                    <img
                      src={course.instructor_profile_picture}
                      alt={course.instructor}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-green-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-green-700">
                        {course.instructor !== 'Unassigned'
                          ? course.instructor.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                          : '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {course.department}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {course.instructor}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate?.('course-detail', String(course.id))}
                  className="text-sm font-medium text-green-600 hover:text-green-700">
                  Manage Content &rarr;
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Add/Edit Modal - Using Portal to render at body level */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingCourse ? 'Edit Course' : 'Create New Course'}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  name="title"
                  defaultValue={editingCourse?.title}
                  required
                  className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  name="description"
                  defaultValue={editingCourse?.description || 'Self Pace'}
                  className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <select
                    name="department"
                    defaultValue={editingCourse?.department || ''}
                    required
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subdepartment</label>
                  <select
                    name="subdepartment_id"
                    defaultValue={editingCourse?.subdepartment_id ?? ''}
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">All (entire department)</option>
                    {(departments.find(d => d.name === selectedDepartment)?.subdepartments || []).map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingCourse?.status || 'Active'}
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date <span className="text-slate-400 text-xs">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="start_date"
                    defaultValue={editingCourse?.start_date ? new Date(editingCourse.start_date).toISOString().slice(0, 16) : ''}
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date <span className="text-slate-400 text-xs">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="deadline"
                    defaultValue={editingCourse?.deadline ? new Date(editingCourse.deadline).toISOString().slice(0, 16) : ''}
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Course Logo <span className="text-slate-400 text-xs">(for certificate)</span>
                </label>
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  className="w-full text-sm text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                <p className="mt-1 text-xs text-slate-400">This logo will appear on certificates issued for this course.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Instructor</label>
                {/* Selected instructor preview */}
                {selectedInstructorId !== '' && (() => {
                  const sel = instructors.find(i => String(i.id) === String(selectedInstructorId));
                  return sel ? (
                    <div className="flex items-center gap-3 mb-2 p-2 bg-green-50 border border-green-200 rounded-md">
                      {sel.profile_picture ? (
                        <img
                          src={sel.profile_picture}
                          alt={sel.fullname}
                          className="w-10 h-10 rounded-full object-cover border-2 border-green-300 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-green-200 border-2 border-green-300 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-green-800">
                            {sel.fullname.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{sel.fullname}</p>
                        <p className="text-xs text-green-600">Assigned Instructor</p>
                      </div>
                    </div>
                  ) : null;
                })()}
                <input type="hidden" name="instructor_id" value={selectedInstructorId} />
                <select
                  value={selectedInstructorId}
                  onChange={(e) => setSelectedInstructorId(e.target.value)}
                  className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select Instructor</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.fullname}</option>
                  ))}
                </select>
              </div>

              {/* Module Upload Section */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Course Modules <span className="text-green-600">({modules.length} added)</span>
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addModule();
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 cursor-pointer z-10"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Module
                  </button>
                </div>

                {modules.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No modules added yet. Click "Add Module" to add course content.</p>
                ) : (
                  <div className="space-y-3">
                    {modules.map((module, index) => (
                      <div key={module.id} className="p-3 bg-slate-50 rounded-md border border-slate-200">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              placeholder={`Module ${index + 1} Title`}
                              value={module.title}
                              onChange={(e) => updateModuleTitle(module.id, e.target.value)}
                              className="w-full border border-slate-300 rounded-md py-1.5 px-2 text-sm focus:ring-green-500 focus:border-green-500"
                            />
                            <input
                              type="file"
                              accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                              onChange={(e) => {
                                updateModuleFile(module.id, e.target.files?.[0] || null);
                              }}
                              className="w-full text-sm text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-green-50 file:text-green-700"
                            />
                            {module.file && (
                              <p className="text-xs text-green-600 flex items-center">
                                <Upload className="h-3 w-3 mr-1" />
                                {module.file.name} ({(module.file.size / 1024 / 1024).toFixed(2)} MB)
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeModule(module.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-4 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Course'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>);

}
