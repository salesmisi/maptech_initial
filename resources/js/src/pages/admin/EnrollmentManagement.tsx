import React, { useState, useEffect } from 'react';
import useConfirm from '../../hooks/useConfirm';
import {
  Search,
  UserPlus,
  Filter,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { safeArray } from '../../utils/safe';

const API_BASE = '/api';

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const getXsrfToken = async (): Promise<string> => {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
};

interface Enrollment {
  id: number;
  user_id: number;
  course_id: string;
  employee_name: string;
  employee_email: string;
  department: string;
  course_title: string;
  course_department: string;
  enrolled_at: string;
  progress: number;
  status: 'Completed' | 'In Progress' | 'Not Started' | 'Active';
}

interface CourseOption {
  id: string;
  title: string;
  department: string;
  subdepartment_id?: number | null;
  modules?: { id: number; title: string }[];
}

interface UserOption {
  id: number;
  fullname: string;
  email: string;
  department: string;
  subdepartment_id?: number | null;
  subdepartment_name?: string | null;
}

interface DepartmentOption {
  id: number;
  name: string;
  code?: string | null;
  subdepartments: { id: number; name: string }[];
}

export function EnrollmentManagement() {
  const normalizeDepartment = (value?: string | null) => (value || '').trim().toLowerCase();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal state
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
  const [selectedSubDeptId, setSelectedSubDeptId] = useState<number | ''>('');
  // multi-select users
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserOption[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [moduleUsersLoading, setModuleUsersLoading] = useState(false);
  const [moduleNotEnrolledUsers, setModuleNotEnrolledUsers] = useState<UserOption[]>([]);
  const [moduleEnrolledUsers, setModuleEnrolledUsers] = useState<UserOption[]>([]);

    const confirm = useConfirm();
    const { showConfirm } = confirm;

  // Action menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [unenrolling, setUnenrolling] = useState<number | null>(null);

  // Persistent module enrollment lists (Admin view section)
  const [listCourses, setListCourses] = useState<CourseOption[]>([]);
  const [listCourseId, setListCourseId] = useState('');
  const [listModuleId, setListModuleId] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listNotEnrolledUsers, setListNotEnrolledUsers] = useState<UserOption[]>([]);
  const [listEnrolledUsers, setListEnrolledUsers] = useState<UserOption[]>([]);

  const loadEnrollments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/enrollments`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load enrollments.');
      const data = await res.json();
      setEnrollments(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEnrollments(); }, []);

  const loadCoursesForListSection = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/courses`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      setListCourses(data.map((x: any) => ({
        id: x.id,
        title: x.title,
        department: x.department,
        modules: (x.modules || []).map((m: any) => ({ id: m.id, title: m.title })),
      })));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCoursesForListSection();
  }, []);

  const loadPersistentModuleLists = async (moduleId: string) => {
    if (!moduleId) {
      setListNotEnrolledUsers([]);
      setListEnrolledUsers([]);
      setListError(null);
      return;
    }

    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/modules/${moduleId}/enrollment-lists`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load employee enrollment lists.');
      const data = await res.json();
      setListNotEnrolledUsers((data.not_enrolled_users || []).map((u: any) => ({
        id: u.id,
        fullname: u.fullname,
        email: u.email,
        department: u.department,
      })));
      setListEnrolledUsers((data.enrolled_users || []).map((u: any) => ({
        id: u.id,
        fullname: u.fullname,
        email: u.email,
        department: u.department,
      })));
    } catch (e: any) {
      setListError(e.message || 'Failed to load employee enrollment lists.');
      setListNotEnrolledUsers([]);
      setListEnrolledUsers([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadPersistentModuleLists(listModuleId);
  }, [listModuleId]);

  const loadModalData = async () => {
    try {
      const [coursesRes, usersRes, departmentsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/courses`, { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch(`${API_BASE}/admin/users?role=Employee`, { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch(`${API_BASE}/departments`, { credentials: 'include', headers: { Accept: 'application/json' } }),
      ]);
      if (coursesRes.ok) {
        const c = await coursesRes.json();
        setCourses(c.map((x: any) => ({
          id: x.id,
          title: x.title,
          department: x.department,
          subdepartment_id: x.subdepartment_id ?? null,
          modules: (x.modules || []).map((m: any) => ({ id: m.id, title: m.title })),
        })));
      }
      if (usersRes.ok) {
        const u = await usersRes.json();
        setUsers(u.map((x: any) => ({
          id: x.id,
          fullname: x.fullname || x.fullName || x.name || `${x.first_name || ''} ${x.last_name || ''}`.trim(),
          email: x.email,
          department: x.department,
          subdepartment_id: x.subdepartment_id ?? null,
          subdepartment_name: x.subdepartment?.name ?? null,
        })));
      }
      if (departmentsRes && departmentsRes.ok) {
        const d = await departmentsRes.json();
        setDepartments(d.map((x: any) => ({
          id: x.id,
          name: x.name,
          code: x.code ?? null,
          subdepartments: Array.isArray(x.subdepartments)
            ? x.subdepartments.map((s: any) => ({ id: s.id, name: s.name }))
            : [],
        })));
      }
    } catch (e) {
      // ignore for now
    }
  };

  useEffect(() => {
    // Show selectable employees immediately once all required filters are chosen.
    if (!selectedDeptId || !selectedSubDeptId || !selectedCourseId) {
      setSearchResults([]);
      return;
    }

    const selectedDept = departments.find(d => d.id === Number(selectedDeptId));
    const selectedDeptName = normalizeDepartment(selectedDept?.name);
    const selectedDeptCode = normalizeDepartment(selectedDept?.code);
    const selectedSubDept = Number(selectedSubDeptId);
    const q = userQuery.trim().toLowerCase();

    const enrolledInCourse = new Set(
      enrollments
        .filter((en) => String(en.course_id) === String(selectedCourseId))
        .map((en) => Number(en.user_id))
    );

    const filteredUsers = users.filter((u) => {
      const userDept = normalizeDepartment(u.department);
      const deptMatches = userDept === selectedDeptName || (selectedDeptCode && userDept === selectedDeptCode);
      const subDeptMatches = Number(u.subdepartment_id) === selectedSubDept;
      const notYetEnrolled = !enrolledInCourse.has(Number(u.id));
      const notYetSelected = !selectedUserIds.includes(Number(u.id));
      const queryMatches = !q
        || u.fullname.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q);
      return deptMatches && subDeptMatches && notYetEnrolled && notYetSelected && queryMatches;
    });

    setSearchResults(filteredUsers);
  }, [
    userQuery,
    users,
    selectedDeptId,
    selectedSubDeptId,
    selectedCourseId,
    selectedUserIds,
    departments,
    enrollments,
  ]);

  const openModal = () => {
    setIsModalOpen(true);
    setSelectedCourseId('');
    setSelectedModuleId('');
    setSelectedUserIds([]);
    setSelectedUsers([]);
    setSelectedDeptId('');
    setSelectedSubDeptId('');
    setUserQuery('');
    setSearchResults([]);
    setEnrollError(null);
    loadModalData();
  };

  const addSelectedUser = (u: UserOption) => {
    setSelectedUserIds(prev => (prev.includes(u.id) ? prev : [...prev, u.id]));
    setSelectedUsers(prev => (prev.some(x => x.id === u.id) ? prev : [...prev, u]));
  };

  const removeSelectedUser = (userId: number) => {
    setSelectedUserIds(prev => prev.filter(id => id !== userId));
    setSelectedUsers(prev => prev.filter(x => x.id !== userId));
  };

  const loadModuleEnrollmentLists = async (moduleId: string) => {
    if (!moduleId) {
      setModuleNotEnrolledUsers([]);
      setModuleEnrolledUsers([]);
      return;
    }
    setModuleUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/modules/${moduleId}/enrollment-lists`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to load module enrollment lists.');
      const data = await res.json();

      const notEnrolled: UserOption[] = (data.not_enrolled_users || []).map((x: any) => ({
        id: x.id,
        fullname: x.fullname,
        email: x.email,
        department: x.department,
      }));

      const enrolled: UserOption[] = (data.enrolled_users || []).map((x: any) => ({
        id: x.id,
        fullname: x.fullname,
        email: x.email,
        department: x.department,
      }));

      setModuleNotEnrolledUsers(notEnrolled);
      setModuleEnrolledUsers(enrolled);

      const notEnrolledIds = new Set(notEnrolled.map(u => u.id));
      setSelectedUserIds(prev => prev.filter(id => notEnrolledIds.has(id)));
      setSelectedUsers(prev => prev.filter(u => notEnrolledIds.has(u.id)));
    } catch (e: any) {
      setModuleNotEnrolledUsers([]);
      setModuleEnrolledUsers([]);
      setEnrollError(e.message || 'Failed to load module enrollment lists.');
    } finally {
      setModuleUsersLoading(false);
    }
  };

  // Poll for updates while modal is open so newly created users appear in search
  useEffect(() => {
    let timer: number | null = null;
    if (isModalOpen) {
      // ensure initial data loaded
      loadModalData();
      timer = window.setInterval(() => {
        loadModalData();
      }, 5000) as unknown as number;
    }
    return () => {
      if (timer) window.clearInterval(timer as unknown as number);
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!selectedModuleId) {
      setModuleNotEnrolledUsers([]);
      setModuleEnrolledUsers([]);
      return;
    }
    loadModuleEnrollmentLists(selectedModuleId);
  }, [selectedModuleId]);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || selectedUserIds.length === 0) {
      setEnrollError('Please select at least one employee and a course.');
      return;
    }
    setEnrolling(true);
    setEnrollError(null);
    try {
      const token = await getXsrfToken();
      // Enroll each selected user (send requests in parallel)
      const promises = selectedUserIds.map((uid) => fetch(`${API_BASE}/admin/courses/${selectedCourseId}/enrollments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': token,
        },
        body: JSON.stringify({ user_id: Number(uid) }),
      }));
      const results = await Promise.all(promises);
      // Check for errors
      for (const r of results) {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to enroll one or more users.');
        }
      }
      setIsModalOpen(false);
      await loadEnrollments();
    } catch (e: any) {
      setEnrollError(e.message);
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async (enrollment: Enrollment) => {
    showConfirm(`Unenroll ${enrollment.employee_name} from ${enrollment.course_title}?`, async () => {
      setUnenrolling(enrollment.id);
      setOpenMenuId(null);
      try {
        const token = await getXsrfToken();
        const res = await fetch(`${API_BASE}/admin/courses/${enrollment.course_id}/enrollments/${enrollment.user_id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        });
        if (!res.ok) throw new Error('Failed to unenroll user.');
        await loadEnrollments();
      } catch (e: any) {
        alert(e.message);
      } finally {
        setUnenrolling(null);
      }
    });
  };

  const displayStatus = (status: string) => {
    if (status === 'Active') return 'In Progress';
    return status;
  };

  const filteredEnrollments = safeArray<Enrollment>(enrollments).filter((enrollment) => {
    const matchesSearch =
      enrollment.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.course_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'All' ||
      enrollment.status === statusFilter ||
      (statusFilter === 'In Progress' && enrollment.status === 'Active');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Enrollment Management
        </h1>
        <button
          onClick={openModal}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
          <UserPlus className="h-4 w-4 mr-2" />
          New Enrollment
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900/80 p-4 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
            placeholder="Search employee or course..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="sm:w-48">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Completed">Completed</option>
              <option value="In Progress">In Progress</option>
              <option value="Not Started">Not Started</option>
            </select>
          </div>
        </div>
      </div>

      {/* Module Enrollment Lists */}
      <div className="bg-white dark:bg-slate-900/80 p-4 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Module Employee Lists</h2>
          <span className="text-xs text-slate-500">New and old employees are grouped by selected module</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Course</label>
            <select
              className="mt-1 block w-full border border-slate-300 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              value={listCourseId}
              onChange={(e) => {
                setListCourseId(e.target.value);
                setListModuleId('');
                setListNotEnrolledUsers([]);
                setListEnrolledUsers([]);
              }}
            >
              <option value="">-- Select a course --</option>
              {listCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.title} ({c.department})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Module</label>
            <select
              className="mt-1 block w-full border border-slate-300 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              value={listModuleId}
              onChange={(e) => setListModuleId(e.target.value)}
              disabled={!listCourseId}
            >
              <option value="">-- Select a module --</option>
              {(listCourses.find(c => c.id === listCourseId)?.modules || []).map((m) => (
                <option key={m.id} value={String(m.id)}>{m.title}</option>
              ))}
            </select>
          </div>
        </div>

        {listError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{listError}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Not Yet Enrolled Employees ({listNotEnrolledUsers.length})</div>
            {listLoading ? (
              <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</div>
            ) : !listModuleId ? (
              <div className="text-xs text-slate-500">Select a module to view list.</div>
            ) : listNotEnrolledUsers.length === 0 ? (
              <div className="text-xs text-slate-500">No employees pending enrollment for this module.</div>
            ) : (
              <div className="max-h-56 overflow-auto divide-y divide-slate-100 dark:divide-slate-700">
                {listNotEnrolledUsers.map((u) => (
                  <div key={u.id} className="py-2">
                    <div className="text-sm text-slate-800 dark:text-slate-100">{u.fullname}</div>
                    <div className="text-xs text-slate-500">{u.email} - {u.department || 'No Dept'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Enrolled Employees ({listEnrolledUsers.length})</div>
            {listLoading ? (
              <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</div>
            ) : !listModuleId ? (
              <div className="text-xs text-slate-500">Select a module to view list.</div>
            ) : listEnrolledUsers.length === 0 ? (
              <div className="text-xs text-slate-500">No enrolled employees for this module.</div>
            ) : (
              <div className="max-h-56 overflow-auto divide-y divide-slate-100 dark:divide-slate-700">
                {listEnrolledUsers.map((u) => (
                  <div key={u.id} className="py-2">
                    <div className="text-sm text-slate-800 dark:text-slate-100">{u.fullname}</div>
                    <div className="text-xs text-slate-500">{u.email} - {u.department || 'No Dept'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4" />{error}
          <button onClick={loadEnrollments} className="ml-auto text-sm underline">Retry</button>
        </div>
      ) : (
      <div className="bg-white dark:bg-slate-900/80 shadow-sm rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Enrolled Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900/30 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    {enrollments.length === 0 ? 'No enrollments yet.' : 'No enrollments match your search.'}
                  </td>
                </tr>
              ) : filteredEnrollments.map((enrollment) => {
                const status = displayStatus(enrollment.status);
                return (
                <tr
                  key={enrollment.id}
                  className="hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {enrollment.employee_name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {enrollment.department}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                    {enrollment.course_title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                    {enrollment.enrolled_at}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 max-w-[100px]">
                      <div
                        className="bg-green-600 h-2.5 rounded-full"
                        style={{ width: `${enrollment.progress}%` }}>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                      {enrollment.progress}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-300' :
                        status === 'In Progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-amber-500/20 dark:text-amber-300' :
                        'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                      }`}>
                      {status === 'Completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {status === 'In Progress' && <Clock className="h-3 w-3 mr-1" />}
                      {status === 'Not Started' && <AlertCircle className="h-3 w-3 mr-1" />}
                      {status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                    {unenrolling === enrollment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400 inline" />
                    ) : (
                      <div className="relative inline-block">
                        <button
                          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100"
                          onClick={() => setOpenMenuId(openMenuId === enrollment.id ? null : enrollment.id)}
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {openMenuId === enrollment.id && (
                          <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 z-10">
                            <button
                              onClick={() => handleUnenroll(enrollment)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-md"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Unenroll
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
      {confirm.ConfirmModalRenderer()}

      {/* Enrollment Modal */}
      {isModalOpen && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
          </div>
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-slate-900">
                  New Enrollment
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {enrollError && (
                <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{enrollError}
                </div>
              )}
              <form onSubmit={handleEnroll} className="space-y-4">
                {/* 1. Select Department */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">Select Department</label>
                  <select
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={selectedDeptId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedDeptId(v ? Number(v) : '');
                      setSelectedSubDeptId('');
                      setSelectedCourseId('');
                      setSelectedUserIds([]);
                      setSelectedUsers([]);
                      setSearchResults([]);
                      setUserQuery('');
                    }}
                  >
                    <option value="">-- All Departments --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Select Sub Department</label>
                  <select
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={selectedSubDeptId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedSubDeptId(v ? Number(v) : '');
                      setSelectedCourseId('');
                      setSelectedUserIds([]);
                      setSelectedUsers([]);
                      setSearchResults([]);
                      setUserQuery('');
                    }}
                    disabled={!selectedDeptId}
                  >
                    <option value="">-- All Sub Departments --</option>
                    {(selectedDeptId ? (departments.find(d => d.id === Number(selectedDeptId))?.subdepartments || []) : []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Course */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">Select Course</label>
                  <select
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setSelectedUserIds([]);
                      setSelectedUsers([]);
                      setSearchResults([]);
                      setUserQuery('');
                    }}
                  >
                    <option value="">-- Select a course --</option>
                    {(() => {
                      const selectedDept = selectedDeptId ? departments.find(d => d.id === Number(selectedDeptId)) : null;
                      const selectedDeptName = normalizeDepartment(selectedDept?.name);
                      const selectedDeptCode = normalizeDepartment(selectedDept?.code);
                      const filtered = selectedDept
                        ? courses.filter((c) => {
                            const courseDept = normalizeDepartment(c.department);
                            return courseDept === selectedDeptName || (selectedDeptCode && courseDept === selectedDeptCode);
                          })
                        : courses;
                      const filteredBySubDept = selectedSubDeptId
                        ? filtered.filter((c) => !c.subdepartment_id || Number(c.subdepartment_id) === Number(selectedSubDeptId))
                        : filtered;

                      return filteredBySubDept.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.department})
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                {/* 3. Search & Click-to-Select Employees */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">Select Employees</label>
                  <div className="mt-1">
                    <input
                      type="text"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder={selectedCourseId ? 'Search employees...' : 'Select a course first...'}
                      className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      disabled={!selectedCourseId}
                    />
                  </div>

                  {selectedCourseId ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selected</div>
                        {selectedUsers.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedUsers.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => removeSelectedUser(u.id)}
                                className="inline-flex items-center gap-2 rounded-full border border-blue-400 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                title="Click to remove"
                              >
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">✓</span>
                                <span>{u.fullname}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            No employees selected yet.
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Options</div>
                        {searchResults.length > 0 ? (
                          <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                            <div className="flex flex-wrap gap-2">
                              {searchResults.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => addSelectedUser(u)}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-green-400 hover:bg-green-50"
                                  title={`${u.email} - ${u.subdepartment_name || u.department}`}
                                >
                                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500">○</span>
                                  <span>{u.fullname}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            {userQuery
                              ? `No employees found for "${userQuery}".`
                              : 'No available employees for this department, sub department, and course.'}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Select department, sub department, and course first.
                    </div>
                  )}
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="submit"
                      disabled={enrolling || !selectedCourseId || selectedUserIds.length === 0}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                  >
                    {enrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Enroll Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
