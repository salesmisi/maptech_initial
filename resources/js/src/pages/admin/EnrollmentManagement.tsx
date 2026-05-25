import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import useConfirm from '../../hooks/useConfirm';
import {
  Search,
  UserPlus,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Layers,
  BookOpen,
  Users,
} from 'lucide-react';
import { safeArray } from '../../utils/safe';

// ─── Generic Picker Modal ────────────────────────────────────────────────────
interface PickerItem { id: string | number; label: string; sub?: string }
interface PickerModalProps {
  title: string;
  items: PickerItem[];
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
  pageSize?: number;
  multiSelect?: boolean;
  selectedIds?: (string | number)[];
  onConfirmMulti?: (ids: (string | number)[]) => void;
}

function PickerModal({
  title, items, onSelect, onClose, pageSize = 8,
  multiSelect = false, selectedIds = [], onConfirmMulti,
}: PickerModalProps) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState<(string | number)[]>(selectedIds);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(i => i.label.toLowerCase().includes(q) || (i.sub || '').toLowerCase().includes(q)) : items;
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggle = (id: string | number) => {
    setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleQueryChange = (v: string) => { setQuery(v); setPage(1); };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
          <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
          {paginated.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">No results found.</p>
          ) : paginated.map(item => (
            multiSelect ? (
              <label
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked.includes(item.id)}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.label}</p>
                  {item.sub && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.sub}</p>}
                </div>
              </label>
            ) : (
              <button
                key={item.id}
                type="button"
                onClick={() => { onSelect(item); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-300 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 group-hover:text-green-700 dark:group-hover:text-green-300 truncate">{item.label}</p>
                  {item.sub && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.sub}</p>}
                </div>
              </button>
            )
          ))}
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Multi-select confirm */}
        {multiSelect && (
          <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary text-sm px-4 py-1.5">Cancel</button>
            <button
              type="button"
              onClick={() => { onConfirmMulti?.(checked); onClose(); }}
              className="btn btn-primary text-sm px-4 py-1.5"
            >
              Confirm ({checked.length})
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Picker Trigger Button ───────────────────────────────────────────────────
function PickerTrigger({
  icon: Icon, label, placeholder, disabled = false, onClick,
}: {
  icon: React.ElementType; label?: string; placeholder: string; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`mt-1 w-full flex items-center gap-2 border rounded-md shadow-sm py-2 px-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-green-500
        ${disabled
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed'
          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 hover:border-green-400 cursor-pointer'
        }`}
    >
      <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
      <span className={`flex-1 truncate ${!label ? 'text-slate-400 dark:text-slate-500' : ''}`}>
        {label || placeholder}
      </span>
      <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
    </button>
  );
}

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

  // Picker modal state
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);
  const [subDeptPickerOpen, setSubDeptPickerOpen] = useState(false);
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [empPickerOpen, setEmpPickerOpen] = useState(false);

  // Action menu
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

  const filteredCourseOptions = useMemo(() => {
    const selectedDept = selectedDeptId ? departments.find(d => d.id === Number(selectedDeptId)) : null;
    const selectedDeptName = normalizeDepartment(selectedDept?.name);
    const selectedDeptCode = normalizeDepartment(selectedDept?.code);

    return courses.filter((c) => {
      // Must match selected department
      if (selectedDept) {
        const courseDept = normalizeDepartment(c.department);
        if (courseDept !== selectedDeptName && !(selectedDeptCode && courseDept === selectedDeptCode)) {
          return false;
        }
      }
      // Must match selected subdepartment exactly
      if (selectedSubDeptId) {
        if (Number(c.subdepartment_id) !== Number(selectedSubDeptId)) {
          return false;
        }
      }
      return true;
    });
  }, [courses, departments, selectedDeptId, selectedSubDeptId]);

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
    setDeptPickerOpen(false);
    setSubDeptPickerOpen(false);
    setCoursePickerOpen(false);
    setEmpPickerOpen(false);
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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isModalOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
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
      <div className="flex justify-end">
        <button
          onClick={openModal}
          className="btn btn-primary">
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

      {/* Enrollments Table */}
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
                        status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' :
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
                      <button
                        onClick={() => handleUnenroll(enrollment)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        Unenroll
                      </button>
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
      <div className="fixed inset-0 z-50">
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0 overflow-y-auto">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
          </div>
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-y-auto max-h-[90vh] shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Select Department</label>
                  <PickerTrigger
                    icon={Building2}
                    label={selectedDeptId ? departments.find(d => d.id === Number(selectedDeptId))?.name : undefined}
                    placeholder="-- All Departments --"
                    onClick={() => setDeptPickerOpen(true)}
                  />
                  {deptPickerOpen && (
                    <PickerModal
                      title="Select Department"
                      items={departments.map(d => ({ id: d.id, label: d.name }))}
                      onSelect={(item) => {
                        setSelectedDeptId(Number(item.id));
                        setSelectedSubDeptId('');
                        setSelectedCourseId('');
                        setSelectedUserIds([]);
                        setSelectedUsers([]);
                        setSearchResults([]);
                        setUserQuery('');
                      }}
                      onClose={() => setDeptPickerOpen(false)}
                    />
                  )}
                </div>

                {/* Sub Department */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Select Sub Department</label>
                  <PickerTrigger
                    icon={Layers}
                    label={selectedSubDeptId
                      ? departments.find(d => d.id === Number(selectedDeptId))?.subdepartments.find(s => s.id === Number(selectedSubDeptId))?.name
                      : undefined}
                    placeholder="-- All Sub Departments --"
                    disabled={!selectedDeptId}
                    onClick={() => setSubDeptPickerOpen(true)}
                  />
                  {subDeptPickerOpen && selectedDeptId && (
                    <PickerModal
                      title="Select Sub Department"
                      items={(departments.find(d => d.id === Number(selectedDeptId))?.subdepartments || []).map(s => ({ id: s.id, label: s.name }))}
                      onSelect={(item) => {
                        setSelectedSubDeptId(Number(item.id));
                        setSelectedCourseId('');
                        setSelectedUserIds([]);
                        setSelectedUsers([]);
                        setSearchResults([]);
                        setUserQuery('');
                      }}
                      onClose={() => setSubDeptPickerOpen(false)}
                    />
                  )}
                </div>

                {/* 2. Select Course */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Select Course</label>
                  <PickerTrigger
                    icon={BookOpen}
                    label={selectedCourseId ? filteredCourseOptions.find(c => String(c.id) === String(selectedCourseId))?.title : undefined}
                    placeholder="-- Select a course --"
                    onClick={() => setCoursePickerOpen(true)}
                  />
                  {coursePickerOpen && (
                    <PickerModal
                      title="Select Course"
                      items={filteredCourseOptions.map(c => ({ id: c.id, label: c.title, sub: c.department }))}
                      onSelect={(item) => {
                        setSelectedCourseId(String(item.id));
                        setSelectedUserIds([]);
                        setSelectedUsers([]);
                        setSearchResults([]);
                        setUserQuery('');
                      }}
                      onClose={() => setCoursePickerOpen(false)}
                    />
                  )}
                </div>

                {/* 3. Select Employees */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Select Employees</label>
                  <PickerTrigger
                    icon={Users}
                    label={selectedUserIds.length > 0 ? `${selectedUserIds.length} employee${selectedUserIds.length > 1 ? 's' : ''} selected` : undefined}
                    placeholder={selectedCourseId ? 'Click to select employees...' : 'Select a course first...'}
                    disabled={!selectedCourseId}
                    onClick={() => setEmpPickerOpen(true)}
                  />
                  {empPickerOpen && selectedCourseId && (
                    <PickerModal
                      title="Select Employees"
                      items={searchResults.map(u => ({ id: u.id, label: u.fullname, sub: u.email + (u.subdepartment_name ? ` · ${u.subdepartment_name}` : '') }))}
                      multiSelect
                      selectedIds={selectedUserIds}
                      onSelect={() => {}}
                      onConfirmMulti={(ids) => {
                        const numIds = ids.map(Number);
                        setSelectedUserIds(numIds);
                        setSelectedUsers(users.filter(u => numIds.includes(u.id)));
                      }}
                      onClose={() => setEmpPickerOpen(false)}
                    />
                  )}

                  {/* Selected employees chips */}
                  {selectedUsers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedUsers.map(u => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-400 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-600 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300"
                        >
                          {u.fullname}
                          <button type="button" onClick={() => removeSelectedUser(u.id)} className="hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {!selectedCourseId && (
                    <div className="mt-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                      Select department, sub department, and course first.
                    </div>
                  )}
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="submit"
                      disabled={enrolling || !selectedCourseId || selectedUserIds.length === 0}
                    className="btn btn-primary btn-full sm:col-start-2"
                  >
                    {enrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Enroll Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn btn-secondary btn-full sm:mt-0 sm:col-start-1"
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
