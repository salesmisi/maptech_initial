import React, { useState, useEffect } from 'react';
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
}

interface UserOption {
  id: number;
  fullname: string;
  email: string;
  department: string;
}

export function EnrollmentManagement() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal state
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
  // multi-select users
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserOption[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const userSearchTimer = React.useRef<number | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Action menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [unenrolling, setUnenrolling] = useState<number | null>(null);

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

  const loadModalData = async () => {
    try {
      const [coursesRes, usersRes, departmentsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/courses`, { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch(`${API_BASE}/admin/users?role=Employee`, { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch(`${API_BASE}/departments`, { credentials: 'include', headers: { Accept: 'application/json' } }),
      ]);
      if (coursesRes.ok) {
        const c = await coursesRes.json();
        setCourses(c.map((x: any) => ({ id: x.id, title: x.title, department: x.department })));
      }
      if (usersRes.ok) {
        const u = await usersRes.json();
        setUsers(u.map((x: any) => ({ id: x.id, fullname: x.fullname || x.fullName || x.name || `${x.first_name || ''} ${x.last_name || ''}`.trim(), email: x.email, department: x.department })));
      }
      if (departmentsRes && departmentsRes.ok) {
        const d = await departmentsRes.json();
        setDepartments(d.map((x: any) => ({ id: x.id, name: x.name })));
      }
    } catch (e) {
      // ignore for now
    }
  };

  const searchUsers = async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearchingUsers(true);
      // Always query backend so newly created users are immediately searchable.
      const params = new URLSearchParams();
      params.set('q', q);
      // restrict search to employees only
      params.set('role', 'Employee');
      if (selectedDeptId) {
        const deptName = departments.find(d => d.id === Number(selectedDeptId))?.name;
        if (deptName) params.set('department', deptName);
      }
      const res = await fetch(`${API_BASE}/admin/users?${params.toString()}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) return setSearchResults([]);
      const data = await res.json();
      const usersFound = Array.isArray(data) ? data : (data?.data || []);
      setSearchResults(usersFound.map((x: any) => ({ id: x.id, fullname: x.fullname || x.name || `${x.first_name || ''} ${x.last_name || ''}`.trim(), email: x.email, department: x.department })));
    } catch (e) {
      setSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // debounce user search
  useEffect(() => {
    if (userSearchTimer.current) window.clearTimeout(userSearchTimer.current);
    userSearchTimer.current = window.setTimeout(() => {
      searchUsers(userQuery);
    }, 300) as unknown as number;
    return () => { if (userSearchTimer.current) window.clearTimeout(userSearchTimer.current); };
  }, [userQuery]);

  const openModal = () => {
    setIsModalOpen(true);
    setSelectedCourseId('');
    setSelectedUserIds([]);
    setSelectedUsers([]);
    setSelectedDeptId('');
    setEnrollError(null);
    loadModalData();
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
    if (!confirm(`Unenroll ${enrollment.employee_name} from ${enrollment.course_title}?`)) return;
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
  };

  const displayStatus = (status: string) => {
    if (status === 'Active') return 'In Progress';
    return status;
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
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
        <h1 className="text-2xl font-bold text-slate-900">
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
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Enrolled Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
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
                  className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">
                      {enrollment.employee_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {enrollment.department}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {enrollment.course_title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {enrollment.enrolled_at}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full bg-slate-200 rounded-full h-2.5 max-w-[100px]">
                      <div
                        className="bg-green-600 h-2.5 rounded-full"
                        style={{ width: `${enrollment.progress}%` }}>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 mt-1">
                      {enrollment.progress}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        status === 'Completed' ? 'bg-green-100 text-green-800' :
                        status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-slate-100 text-slate-800'
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
                          className="text-slate-400 hover:text-slate-600"
                          onClick={() => setOpenMenuId(openMenuId === enrollment.id ? null : enrollment.id)}
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {openMenuId === enrollment.id && (
                          <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg border border-slate-200 z-10">
                            <button
                              onClick={() => handleUnenroll(enrollment)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
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
                <div>
                  <label className="block text-sm font-medium text-slate-700">Select Department</label>
                  <select
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={selectedDeptId}
                    onChange={(e) => { const v = e.target.value; setSelectedDeptId(v ? Number(v) : ''); setSearchResults([]); setUserQuery(''); }}
                  >
                    <option value="">-- All Departments --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>

                  <label className="block text-sm font-medium text-slate-700 mt-3">Search Employees</label>
                  <input
                    type="text"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Type name to search employees..."
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-1 border border-slate-200 rounded bg-white max-h-48 overflow-auto">
                      {searchResults.map(u => (
                        <div key={u.id} className="px-3 py-2 hover:bg-slate-50 cursor-pointer" onClick={async () => {
                              if (!selectedUserIds.includes(u.id)) {
                                setSelectedUserIds(prev => [...prev, u.id]);
                                // Resolve canonical user object: prefer preloaded `users`, otherwise fetch single user
                                const existing = users.find(x => x.id === u.id);
                                if (existing) {
                                  setSelectedUsers(prev => [...prev, existing]);
                                } else {
                                  try {
                                    const res = await fetch(`${API_BASE}/admin/users/${u.id}`, { credentials: 'include', headers: { Accept: 'application/json' } });
                                    if (res.ok) {
                                      const full = await res.json();
                                      const mapped = { id: full.id, fullname: full.fullname || full.name || `${full.first_name || ''} ${full.last_name || ''}`.trim(), email: full.email, department: full.department };
                                      setSelectedUsers(prev => [...prev, mapped]);
                                    } else {
                                      setSelectedUsers(prev => [...prev, u]);
                                    }
                                  } catch {
                                    setSelectedUsers(prev => [...prev, u]);
                                  }
                                }
                              }
                              // If no department selected yet, auto-select the user's department
                              if (!selectedDeptId && u.department) {
                                const dept = departments.find(d => d.name === u.department);
                                if (dept) setSelectedDeptId(dept.id);
                              }
                              setSearchResults([]);
                              setUserQuery('');
                        }}>
                          <div className="text-sm font-medium text-slate-900">{u.fullname}</div>
                          <div className="text-xs text-slate-400">{u.email} — {u.department}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedUsers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedUsers.map(u => (
                        <span key={u.id} className="inline-flex items-center gap-2 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">
                          <span>{u.fullname}</span>
                          <button type="button" onClick={() => {
                            setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                            setSelectedUsers(prev => prev.filter(x => x.id !== u.id));
                          }} className="text-slate-400 hover:text-red-600">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Select Course
                  </label>
                  <select
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                  >
                    <option value="">-- Select a course --</option>
                    {(() => {
                      const deptName = selectedDeptId ? departments.find(d => d.id === Number(selectedDeptId))?.name : null;
                      const filtered = deptName ? courses.filter(c => c.department === deptName) : courses;
                      return filtered.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.department})
                        </option>
                      ));
                    })()}
                  </select>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="submit"
                    disabled={enrolling}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                  >
                    {enrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Enroll User
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
