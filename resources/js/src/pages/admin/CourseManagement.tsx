import React, { useState, useEffect } from 'react';
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
  instructor: string;
  status: 'Active' | 'Draft' | 'Archived';
  enrolledCount: number;
  modulesCount: number;
  thumbnail: string;
  modules: Array<{
    id?: number;
    title: string;
    content_path?: string;
  }>;
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

const API_BASE = 'http://127.0.0.1:8000/api';

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
        instructor: course.instructor?.fullname || 'Unassigned',
        status: course.status,
        enrolledCount: course.enrolled_count || 0,
        modulesCount: course.modules?.length || 0,
        thumbnail: 'bg-green-500',
        modules: course.modules || [],
      }));
      setCourses(mappedCourses);
    } catch {
      // silently fail; initial courses remain displayed
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

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
      // Load existing modules for editing (without files since they're already uploaded)
      setModules(course.modules?.map((m, index) => ({
        id: index + 1,
        title: m.title,
        file: null,
      })) || []);
    } else {
      setEditingCourse(null);
      setModules([]);
    }
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCourse(null);
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
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) =>
        <div
          key={course.id}
          className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">

            <div
            className={`h-32 ${course.thumbnail} flex items-center justify-center`}>

              <BookOpen className="h-12 w-12 text-white opacity-50" />
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start">
                <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${course.status === 'Active' ? 'bg-green-100 text-green-800' : course.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-800'}`}>

                  {course.status}
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

              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {course.department}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Instructor: {course.instructor}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate?.('course-detail', String(course.id))}
                  className="text-sm font-medium text-green-600 hover:text-green-700">
                  Manage Content &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
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
                  defaultValue={editingCourse?.description}
                  className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <select
                    name="department"
                    defaultValue={editingCourse?.department || 'IT'}
                    required
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingCourse?.status || 'Active'}
                    className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Deadline <span className="text-slate-400 text-xs">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  name="deadline"
                  defaultValue={editingCourse?.deadline ? new Date(editingCourse.deadline).toISOString().slice(0, 16) : ''}
                  className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Instructor</label>
                <select
                  name="instructor_id"
                  defaultValue={editingCourse?.instructor}
                  className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select Instructor</option>
                  <option value="1">Prof. Ana Reyes</option>
                  <option value="2">Andres Bonifacio</option>
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
                  {isSubmitting ? 'Saving...' : 'Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>);

}
