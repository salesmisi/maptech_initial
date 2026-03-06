import React, { useState, useEffect } from 'react';
import {
  Search,
  PlayCircle,
  CheckCircle,
  Clock,
  BookOpen,
  XCircle,
  PlusCircle,
} from 'lucide-react';

const API_BASE = '/api';

interface Course {
  id: string;
  title: string;
  description: string;
  department: string;
  progress: number;
  modulesCount: number;
  status: 'In Progress' | 'Completed' | 'Not Started' | 'Unfinished';
  thumbnail: string;
  is_enrolled?: boolean;
  deadline?: string | null;
}

interface MyCoursesProps {
  onNavigate: (page: string, courseId?: string) => void;
  globalSearch?: string;
}

export function MyCourses({ onNavigate, globalSearch = '' }: MyCoursesProps) {
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');

  // Load departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch(`${API_BASE}/departments`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setDepartments(data);
        }
      } catch (err) {
        console.error('Error loading departments:', err);
      }
    };
    loadDepartments();
  }, []);

  const isBrowseMode = globalSearch.trim().length > 0;

  const getThumbnailColor = (department: string) => {
    const colors: Record<string, string> = {
      IT: 'bg-blue-500',
      HR: 'bg-purple-500',
      Operations: 'bg-green-500',
      Finance: 'bg-yellow-500',
      Marketing: 'bg-orange-500',
    };
    return colors[department] || 'bg-slate-500';
  };

  const mapCourse = (c: any): Course => ({
    id: c.id,
    title: c.title,
    description: c.description || '',
    department: c.department,
    progress: c.my_progress ?? c.progress ?? 0,
    modulesCount: c.modules_count ?? c.modules?.length ?? 0,
    status: c.my_status ?? (c.progress === 100 ? 'Completed' : c.progress > 0 ? 'In Progress' : 'Not Started'),
    thumbnail: getThumbnailColor(c.department),
    is_enrolled: c.is_enrolled ?? true,
    deadline: c.deadline ?? null,
  });

  const loadMyCourses = async () => {
    const res = await fetch(`${API_BASE}/employee/courses`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to load enrolled courses');
    const data = await res.json();
    setMyCourses(data.map(mapCourse));
  };

  const loadAllCourses = async () => {
    const res = await fetch(`${API_BASE}/employee/all-courses`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to load all courses');
    const data = await res.json();
    setAllCourses(data.map(mapCourse));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMyCourses(), loadAllCourses()])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // --- Browse mode: all dept courses filtered by globalSearch ---
  const browseResults = allCourses.filter((c) =>
    c.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
    c.description.toLowerCase().includes(globalSearch.toLowerCase())
  );

  // --- My Courses mode: enrolled only, filtered by localSearch + status ---
  const myFiltered = myCourses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(localSearch.toLowerCase());
    const matchFilter = filter === 'All' || c.status === filter;
    return matchSearch && matchFilter;
  });

  const StatusBadge = ({ status }: { status: Course['status'] }) => {
    if (status === 'Completed')
      return <span className="text-green-600 flex items-center font-medium"><CheckCircle className="h-3 w-3 mr-1" />Completed</span>;
    if (status === 'Unfinished')
      return <span className="text-red-600 flex items-center font-medium"><XCircle className="h-3 w-3 mr-1" />Unfinished</span>;
    if (status === 'In Progress')
      return <span className="text-blue-600 flex items-center font-medium"><PlayCircle className="h-3 w-3 mr-1" />In Progress</span>;
    return <span className="text-yellow-600 flex items-center font-medium"><Clock className="h-3 w-3 mr-1" />Not Started</span>;
  };

  const CourseCard = ({ course }: { course: Course }) => {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
        <div className={`h-40 ${course.thumbnail} relative`}>
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-white opacity-75" />
          </div>
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/90 text-slate-800 shadow-sm">
              {course.department}
            </span>
          </div>
          {course.deadline && (
            <div className="absolute bottom-2 left-3">
              <span className="text-xs text-white/90 bg-black/40 rounded px-1.5 py-0.5">
                Due {new Date(course.deadline).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-1">{course.title}</h3>
            <p className="text-sm text-slate-500 line-clamp-2 mb-3">{course.description}</p>
            <div className="flex items-center text-xs text-slate-500 mb-4 gap-2">
              <BookOpen className="h-4 w-4" />
              {course.modulesCount} Modules
              <span>•</span>
              <StatusBadge status={course.status} />
            </div>
          </div>

          {course.is_enrolled ? (
            <div className="mt-auto">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>{course.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    course.status === 'Completed' ? 'bg-green-500' :
                    course.status === 'Unfinished' ? 'bg-red-400' : 'bg-blue-500'
                  }`}
                  style={{ width: `${course.progress}%` }}
                />
              </div>
              <button
                onClick={() => onNavigate('course-viewer', course.id)}
                className={`w-full flex justify-center items-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white transition-colors ${
                  course.status === 'Completed' ? 'bg-slate-600 hover:bg-slate-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {course.status === 'Not Started' ? 'Start Course' :
                 course.status === 'Completed' ? 'Review Course' : 'Continue Learning'}
                <PlayCircle className="ml-2 h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-auto">
              <button
                onClick={() => onNavigate('course-enroll', course.id)}
                className="w-full flex justify-center items-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                View &amp; Enroll
                <PlusCircle className="ml-2 h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">
          {isBrowseMode ? `Browse: "${globalSearch}"` : 'My Courses'}
        </h1>

        {!isBrowseMode && (
          <div className="flex gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm bg-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                placeholder="Search my courses..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
            </div>
            <div className="relative w-44">
              <select
                className="block w-full pl-3 pr-10 py-2 text-sm border-slate-300 focus:outline-none focus:ring-green-500 focus:border-green-500 rounded-md"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Unfinished">Unfinished</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          <span className="ml-3 text-slate-600">Loading courses...</span>
        </div>
      ) : isBrowseMode ? (
        browseResults.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No courses found</h3>
            <p className="mt-1 text-sm text-slate-500">Try a different search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {browseResults.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )
      ) : myFiltered.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">
            {myCourses.length === 0 ? 'No enrolled courses' : 'No courses match your filters'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {myCourses.length === 0
              ? 'Use the search bar at the top to find and enroll in courses.'
              : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myFiltered.map((c) => <CourseCard key={c.id} course={c} />)}
        </div>
      )}
    </div>
  );
}
