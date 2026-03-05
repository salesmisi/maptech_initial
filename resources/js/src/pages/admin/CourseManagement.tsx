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
  Trash,
  Loader2 } from
'lucide-react';

// Module interface for form handling
interface ModuleInput {
  id: number;
  title: string;
  file: File | null;
}

interface InstructorOption {
  id: number;
  fullName: string;
}

// Ensure the Course interface is exported
export interface Course {
  id: string;
  title: string;
  description: string;
  department: string;
  instructor: string;
  instructorId?: number | null;
  status: 'Active' | 'Draft' | 'Inactive';
  enrolledCount: number;
  modulesCount: number;
  thumbnail: string;
  modules: Array<{
    id?: number;
    title: string;
    content_path?: string;
  }>;
}

const THUMBNAIL_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500', 'bg-indigo-500', 'bg-teal-500'];

async function getCsrf() {
  await fetch('http://127.0.0.1:8000/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(
    document.cookie.split('; ').find(r => r.startsWith('XSRF-TOKEN='))?.split('=')[1] || ''
  );
}

const API_BASE = 'http://127.0.0.1:8000/api';

export function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);

  // Module management functions
  const addModule = () => {
    const newModule = { id: Date.now(), title: '', file: null };
    setModules(prev => [...prev, newModule]);
  };

  const removeModule = (id: number) => {
    setModules(prev => prev.filter(m => m.id !== id));
  };

  const updateModuleTitle = (id: number, title: string) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, title } : m));
  };

  const updateModuleFile = (id: number, file: File | null) => {
    setModules(prev => {
      return prev.map(m => {
        if (m.id === id) {
          return { ...m, file };
        }
        return m;
      });
    });
  };

  const loadInstructors = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/users?role=Instructor&status=Active`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load instructors');
      }

      const data = await response.json();
      setInstructors((data || []).map((user: any) => ({
        id: user.id,
        fullName: user.fullName,
      })));
    } catch (error) {
      console.error('Error loading instructors:', error);
    }
  };

  // Load courses from API on mount
  const loadCourses = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/admin/courses`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to load courses');
      }
      const data = await response.json();
      // Map API response to Course interface
      const mappedCourses = data.map((course: any, idx: number) => ({
        id: course.id,
        title: course.title,
        description: course.description || '',
        department: course.department,
        instructor: course.instructor?.fullName || 'Unassigned',
        instructorId: course.instructor_id ?? null,
        status: course.status,
        enrolledCount: course.enrolled_count || 0,
        modulesCount: course.modules?.length || 0,
        thumbnail: THUMBNAIL_COLORS[idx % THUMBNAIL_COLORS.length],
        modules: course.modules || [],
      }));
      setCourses(mappedCourses);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    loadInstructors();
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
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      const xsrf = await getCsrf();
      const response = await fetch(`${API_BASE}/admin/courses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrf,
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as any).message || 'Failed to delete course');
      }
      await loadCourses();
    } catch (err: any) {
      alert(err.message);
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

    // Add modules with file uploads to the form data
    modules.forEach((module, index) => {
      formData.append(`modules[${index}][title]`, module.title);
      if (module.file) {
        formData.append(`modules[${index}][content]`, module.file);
      }
    });

    try {
      const csrfToken = await getCsrf();

      const url = editingCourse
        ? `${API_BASE}/admin/courses/${editingCourse.id}`
        : `${API_BASE}/admin/courses`;

      // For updates with file uploads, Laravel requires POST with _method=PUT
      if (editingCourse) {
        formData.append('_method', 'PUT');
      }

      const response = await fetch(url, {
        method: 'POST', // Always use POST for FormData with files
        credentials: 'include',
        headers: {
          'X-XSRF-TOKEN': csrfToken,
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
      });
      
      const responseText = await response.text();

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          throw new Error(`Server error: ${response.status} - ${responseText.substring(0, 200)}`);
        }
        // Show validation errors in detail
        if (errorData.errors) {
          const errorMessages = Object.entries(errorData.errors)
            .map(([field, messages]: [string, any]) => `${field}: ${messages.join(', ')}`)
            .join('\n');
          throw new Error(`Validation failed:\n${errorMessages}`);
        }
        throw new Error(errorData.message || 'Failed to save course');
      }

      const data = JSON.parse(responseText);
      alert(data.message);
      handleCloseModal();
      // Reload courses
      loadCourses();
    } catch (err: any) {
      console.error('Course save error:', err);
      alert(err.message);
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
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <span className="ml-2 text-slate-600">Loading courses...</span>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{searchTerm || statusFilter !== 'All' ? 'No courses match your filters.' : 'No courses yet. Click "Create Course" to add one!'}</p>
        </div>
      ) : (
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
                <button className="text-sm font-medium text-green-600 hover:text-green-700">
                  Manage Content &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

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
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Instructor</label>
                <select
                  name="instructor_id"
                  defaultValue={editingCourse?.instructorId ?? ''}
                  className="w-full border border-slate-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select Instructor</option>
                  {instructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.fullName}
                    </option>
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
                                const file = e.target.files?.[0] || null;
                                updateModuleFile(module.id, file);
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