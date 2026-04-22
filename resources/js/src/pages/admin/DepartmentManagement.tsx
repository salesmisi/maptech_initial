import { useEffect, useMemo, useState } from 'react';
import { safeArray } from '../../utils/safe';
import { LoadingState } from '../../components/ui/LoadingState';
import { Building2, BookOpen, Check, ChevronDown, Plus, Search, Trash2, Users, X } from 'lucide-react';

interface EmployeeRecord {
  id: number;
  fullname: string;
  email?: string | null;
  department?: string | null;
  subdepartment_id?: number | null;
}

interface Subdepartment {
  id: number;
  name: string;
  head_id: number | null;
  employee_id: number | null;
  head_user?: { id: number; fullname: string } | null;
  employee?: { id: number; fullname: string } | null;
  employees?: EmployeeRecord[];
}

interface Department {
  id: number;
  name: string;
  code: string;
  description: string | null;
  head: string;
  head_id: number | null;
  head_user?: { id: number; fullname: string } | null;
  employee_count: number;
  instructor_count?: number;
  status: 'Active' | 'Inactive';
  subdepartments: Subdepartment[];
}

interface HeadCandidate {
  id: number;
  fullname: string;
  role: string;
}

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  action: null | (() => Promise<void>);
}

interface InfoDialogState {
  open: boolean;
  title: string;
  message: string;
}

type HeadPickerTarget =
  | { type: 'department' }
  | { type: 'newSubdepartment' }
  | { type: 'subdepartment'; subdepartmentId: number; subdepartmentName: string };

export default function DepartmentManagement() {
  const API = '/api';
  const HEAD_PICKER_PAGE_SIZE = 6;

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return '';
  };

  const getHeaders = () => ({
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  });

  const getXsrfToken = async (): Promise<string> => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
  };

  const [departments, setDepartments] = useState<Department[]>([]);
  const [headCandidates, setHeadCandidates] = useState<HeadCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showHeadPickerModal, setShowHeadPickerModal] = useState(false);
  const [headPickerTarget, setHeadPickerTarget] = useState<HeadPickerTarget | null>(null);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [employeeToMove, setEmployeeToMove] = useState<EmployeeRecord | null>(null);
  const [moveDepartment, setMoveDepartment] = useState('');
  const [moveSubdepartmentId, setMoveSubdepartmentId] = useState('');

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    action: null,
  });
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [infoDialog, setInfoDialog] = useState<InfoDialogState>({
    open: false,
    title: '',
    message: '',
  });

  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    description: '',
  });

  const [deptHeadId, setDeptHeadId] = useState('');
  const [headSearchQuery, setHeadSearchQuery] = useState('');
  const [departmentSearchQuery, setDepartmentSearchQuery] = useState('');
  const [headPickerPage, setHeadPickerPage] = useState(1);
  const [newSubForm, setNewSubForm] = useState({
    name: '',
    head_id: '',
  });
  const [subHeadDrafts, setSubHeadDrafts] = useState<Record<number, string>>({});

  const activeDepartment = useMemo(
    () => departments.find((d) => d.id === activeDeptId) ?? null,
    [departments, activeDeptId]
  );

  const selectedDepartmentHead = useMemo(
    () => headCandidates.find((candidate) => String(candidate.id) === deptHeadId) ?? null,
    [headCandidates, deptHeadId]
  );

  const getSelectedHeadLabel = (headId: string) => {
    const selected = headCandidates.find((candidate) => String(candidate.id) === headId);
    return selected ? `${selected.fullname} (${selected.role})` : '';
  };

  const filteredHeadCandidates = useMemo(() => {
    const query = headSearchQuery.trim().toLowerCase();

    return headCandidates.filter((candidate) => {
      if (!query) return true;

      return candidate.fullname.toLowerCase().includes(query) || candidate.role.toLowerCase().includes(query);
    });
  }, [headCandidates, headSearchQuery]);

  const headPickerTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredHeadCandidates.length / HEAD_PICKER_PAGE_SIZE)),
    [filteredHeadCandidates.length]
  );

  const paginatedHeadCandidates = useMemo(() => {
    const pageStart = (headPickerPage - 1) * HEAD_PICKER_PAGE_SIZE;
    return filteredHeadCandidates.slice(pageStart, pageStart + HEAD_PICKER_PAGE_SIZE);
  }, [filteredHeadCandidates, headPickerPage]);

  useEffect(() => {
    setHeadPickerPage(1);
  }, [headSearchQuery, headPickerTarget, showHeadPickerModal]);

  useEffect(() => {
    if (headPickerPage > headPickerTotalPages) {
      setHeadPickerPage(headPickerTotalPages);
    }
  }, [headPickerPage, headPickerTotalPages]);

  const moveDepartmentSubdepartments = useMemo(() => {
    const dept = departments.find((d) => d.name === moveDepartment);
    return dept?.subdepartments ?? [];
  }, [departments, moveDepartment]);

  const hasUnsavedHeadChanges = useMemo(() => {
    if (!activeDepartment) return false;

    const existingDeptHeadId = activeDepartment.head_id ? String(activeDepartment.head_id) : '';
    if (deptHeadId !== existingDeptHeadId) {
      return true;
    }

    for (const sub of safeArray(activeDepartment.subdepartments)) {
      const draftSubHeadId = subHeadDrafts[sub.id] ?? '';
      const existingSubHeadId = sub.head_id ? String(sub.head_id) : '';

      if (draftSubHeadId !== existingSubHeadId) {
        return true;
      }
    }

    return false;
  }, [activeDepartment, deptHeadId, subHeadDrafts]);

  const filteredDepartments = useMemo(() => {
    const query = departmentSearchQuery.trim().toLowerCase();
    if (!query) return departments;

    return departments.filter((dept) => {
      const matchesDepartment =
        dept.name.toLowerCase().includes(query) ||
        dept.code.toLowerCase().includes(query) ||
        (dept.description || '').toLowerCase().includes(query) ||
        (dept.head_user?.fullname || '').toLowerCase().includes(query);

      if (matchesDepartment) return true;

      return safeArray(dept.subdepartments).some((sub) => {
        return (
          sub.name.toLowerCase().includes(query) ||
          (sub.head_user?.fullname || '').toLowerCase().includes(query)
        );
      });
    });
  }, [departments, departmentSearchQuery]);

  const loadDepartments = async () => {
    const res = await fetch(`${API}/departments`, {
      credentials: 'include',
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error('Failed to load departments.');
    }

    const data = await res.json();
    setDepartments(Array.isArray(data) ? data : []);
  };

  const loadHeadCandidates = async () => {
    const res = await fetch(`${API}/admin/users`, {
      credentials: 'include',
      headers: getHeaders(),
    });

    if (!res.ok) {
      setHeadCandidates([]);
      return;
    }

    const data = await res.json();
    const candidates: HeadCandidate[] = (Array.isArray(data) ? data : [])
      .filter((u: any) => {
        const role = String(u?.role || '').toLowerCase();
        return role === 'admin' || role === 'instructor';
      })
      .map((u: any) => ({
        id: u.id,
        fullname: u.fullname || u.fullName || u.name || 'Unknown User',
        role: String(u.role || ''),
      }));

    setHeadCandidates(candidates);
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      await Promise.all([loadDepartments(), loadHeadCandidates()]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (!activeDepartment) {
      setSubHeadDrafts({});
      return;
    }

    setDeptHeadId(activeDepartment.head_id ? String(activeDepartment.head_id) : '');

    const nextDrafts: Record<number, string> = {};
    for (const sub of safeArray(activeDepartment.subdepartments)) {
      nextDrafts[sub.id] = sub.head_id ? String(sub.head_id) : '';
    }
    setSubHeadDrafts(nextDrafts);
  }, [activeDepartment]);

  const openManageModal = (dept: Department) => {
    setActiveDeptId(dept.id);
    setDeptHeadId(dept.head_id ? String(dept.head_id) : '');
    setHeadSearchQuery('');
    setNewSubForm({ name: '', head_id: '' });
    setShowManageModal(true);
  };

  const closeManageModal = () => {
    setShowManageModal(false);
    setShowHeadPickerModal(false);
    setHeadSearchQuery('');
  };

  const requestCloseManageModal = () => {
    if (saving) return;

    if (hasUnsavedHeadChanges) {
      showInfoDialog('Unsaved Changes', 'You have unsaved changes. Please click Save Changes before closing this window.');
      return;
    }

    closeManageModal();
  };

  const openHeadPicker = (target: HeadPickerTarget) => {
    setHeadPickerTarget(target);
    setHeadSearchQuery('');
    setShowHeadPickerModal(true);
  };

  const closeHeadPicker = () => {
    setShowHeadPickerModal(false);
    setHeadPickerTarget(null);
    setHeadSearchQuery('');
  };

  const reloadAndKeepActive = async () => {
    await loadDepartments();
  };

  const askConfirm = (title: string, message: string, action: () => Promise<void>) => {
    setConfirmDialog({ open: true, title, message, action });
  };

  const showInfoDialog = (title: string, message: string) => {
    setInfoDialog({ open: true, title, message });
  };

  const runConfirmAction = async () => {
    if (!confirmDialog.action) return;

    setConfirmBusy(true);
    try {
      await confirmDialog.action();
      setConfirmDialog({ open: false, title: '', message: '', action: null });
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleCreateDepartment = async () => {
    if (!createForm.name.trim()) {
      alert('Department Name is required.');
      return;
    }

    if (!createForm.code.trim()) {
      alert('Department Code is required.');
      return;
    }

    setSaving(true);
    try {
      const xsrfToken = await getXsrfToken();
      const res = await fetch(`${API}/departments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          code: createForm.code.trim(),
          description: createForm.description.trim() || null,
          status: 'Active',
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to create department.');
      }

      setCreateForm({ name: '', code: '', description: '' });
      setShowCreateModal(false);
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to create department.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDepartmentHead = async () => {
    if (!activeDepartment) return;

    setSaving(true);
    try {
      await saveAllHeadChanges();

      await reloadAndKeepActive();
      closeManageModal();
    } catch (err: any) {
      alert(err.message || 'Failed to update department head.');
    } finally {
      setSaving(false);
    }
  };

  const saveAllHeadChanges = async () => {
    if (!activeDepartment) return;

    const xsrfToken = await getXsrfToken();
    const existingDeptHeadId = activeDepartment.head_id ? String(activeDepartment.head_id) : '';
    const requestedDeptHead = headCandidates.find((h) => String(h.id) === deptHeadId);

    if (deptHeadId !== existingDeptHeadId) {
      const res = await fetch(`${API}/departments/${activeDepartment.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
        body: JSON.stringify({
          name: activeDepartment.name,
          code: activeDepartment.code,
          description: activeDepartment.description,
          status: activeDepartment.status,
          head_id: deptHeadId ? Number(deptHeadId) : null,
          head: requestedDeptHead?.fullname || '',
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to update department head.');
      }
    }

    for (const sub of safeArray(activeDepartment.subdepartments)) {
      const draft = subHeadDrafts[sub.id] ?? '';
      const existingSubHeadId = sub.head_id ? String(sub.head_id) : '';

      if (draft === existingSubHeadId) {
        continue;
      }

      const res = await fetch(`${API}/subdepartments/${sub.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
        body: JSON.stringify({
          name: sub.name,
          head_id: draft ? Number(draft) : null,
          employee_id: sub.employee_id,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to update subdepartment head.');
      }
    }
  };

  const handleCreateSubdepartment = async () => {
    if (!activeDepartment) return;
    if (!newSubForm.name.trim()) {
      showInfoDialog('Required Field', 'Subdepartment Name is required.');
      return;
    }

    if (!newSubForm.head_id) {
      showInfoDialog('Required Field', 'Subdepartment Head is required.');
      return;
    }

    setSaving(true);
    try {
      const xsrfToken = await getXsrfToken();
      const res = await fetch(`${API}/departments/${activeDepartment.id}/subdepartments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
        body: JSON.stringify({
          name: newSubForm.name.trim(),
          head_id: newSubForm.head_id ? Number(newSubForm.head_id) : null,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to create subdepartment.');
      }

      setNewSubForm({ name: '', head_id: '' });
      await reloadAndKeepActive();
    } catch (err: any) {
      alert(err.message || 'Failed to create subdepartment.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSubHead = async (sub: Subdepartment) => {
    if (!activeDepartment) return;

    setSaving(true);
    try {
      const xsrfToken = await getXsrfToken();
      const draft = subHeadDrafts[sub.id] ?? '';
      const res = await fetch(`${API}/subdepartments/${sub.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
        body: JSON.stringify({
          name: sub.name,
          head_id: draft ? Number(draft) : null,
          employee_id: sub.employee_id,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to update subdepartment head.');
      }

      await reloadAndKeepActive();
    } catch (err: any) {
      alert(err.message || 'Failed to update subdepartment head.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = (dept: Department) => {
    askConfirm(
      'Delete Department',
      `Are you sure you want to delete ${dept.name}? This will also remove its subdepartments.`,
      async () => {
        const xsrfToken = await getXsrfToken();
        const res = await fetch(`${API}/departments/${dept.id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken,
          },
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Failed to delete department.');
        }

        setShowHeadPickerModal(false);
        setShowManageModal(false);
        setActiveDeptId(null);
        await refreshAll();
      }
    );
  };

  const handleDeleteSubdepartment = (sub: Subdepartment) => {
    askConfirm('Delete Subdepartment', `Are you sure you want to delete ${sub.name}?`, async () => {
      const xsrfToken = await getXsrfToken();
      const res = await fetch(`${API}/subdepartments/${sub.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to delete subdepartment.');
      }

      await reloadAndKeepActive();
    });
  };

  const openMoveEmployeeModal = (employee: EmployeeRecord) => {
    setEmployeeToMove(employee);
    setMoveDepartment(employee.department || activeDepartment?.name || '');
    setMoveSubdepartmentId(employee.subdepartment_id ? String(employee.subdepartment_id) : '');
    setShowMoveModal(true);
  };

  const handleMoveEmployee = async () => {
    if (!employeeToMove) return;
    if (!moveDepartment) {
      alert('Please select a department.');
      return;
    }

    setSaving(true);
    try {
      const xsrfToken = await getXsrfToken();
      const res = await fetch(`${API}/admin/users/${employeeToMove.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
        body: JSON.stringify({
          department: moveDepartment,
          subdepartment_id: moveSubdepartmentId ? Number(moveSubdepartmentId) : null,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to move employee.');
      }

      setShowMoveModal(false);
      setEmployeeToMove(null);
      await reloadAndKeepActive();
    } catch (err: any) {
      alert(err.message || 'Failed to move employee.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading departments" className="p-6" />;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="px-6 pb-6 pt-2 text-slate-900 dark:text-slate-100">
      <div className="department-toolbar-animate mb-2 flex items-center justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="department-cta-button flex items-center rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Department
        </button>
      </div>

      <div className="mb-2 max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={departmentSearchQuery}
            onChange={(e) => setDepartmentSearchQuery(e.target.value)}
            placeholder="Search departments, codes, heads, or subdepartments"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredDepartments.map((dept, deptIndex) => (
          <div
            key={dept.id}
            className="department-card rounded-xl border border-slate-200 bg-white p-5 shadow dark:border-slate-700/80 dark:bg-slate-900/80 dark:shadow-[0_10px_30px_rgba(2,6,23,0.35)]"
            style={{ animationDelay: `${Math.min(deptIndex * 55, 440)}ms` }}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/20 p-3">
                  <Building2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div>
                  <p className="text-lg font-semibold">{dept.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{dept.code}</p>
                </div>
              </div>
            </div>

            <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">
              Head:{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {dept.head_user?.fullname || 'Unassigned'}
              </span>
            </p>

            {dept.description && <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{dept.description}</p>}

            <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="mb-1 flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Users className="h-3.5 w-3.5" /> Employees
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{dept.employee_count ?? 0}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="mb-1 flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <BookOpen className="h-3.5 w-3.5" /> Instructor
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{dept.instructor_count ?? 0}</div>
              </div>
            </div>

            <div className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Subdepartments: <span className="text-emerald-600 dark:text-emerald-400">{safeArray(dept.subdepartments).length}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => openManageModal(dept)}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                Manage
              </button>

              <button
                onClick={() => handleDeleteDepartment(dept)}
                className="inline-flex items-center rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
        {filteredDepartments.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No departments matched your search.
          </div>
        )}
      </div>

      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <h2 className="mb-4 text-lg font-semibold">Add Department</h2>
          <TextInput
            placeholder="Department Name"
            value={createForm.name}
            onChange={(v) => setCreateForm((s) => ({ ...s, name: v }))}
          />
          <TextInput
            placeholder="Department Code"
            value={createForm.code}
            onChange={(v) => setCreateForm((s) => ({ ...s, code: v }))}
          />
          <TextInput
            placeholder="Description"
            value={createForm.description}
            onChange={(v) => setCreateForm((s) => ({ ...s, description: v }))}
          />

          <button
            onClick={handleCreateDepartment}
            disabled={saving}
            className="mt-3 w-full rounded-md bg-emerald-500 py-2 font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Create Department'}
          </button>
        </Modal>
      )}

      {showManageModal && activeDepartment && (
        <Modal onClose={requestCloseManageModal} maxWidthClass="max-w-4xl" showCloseButton={false}>
          <div className="mb-4 flex items-start justify-between gap-3 pr-10">
            <div>
              <h2 className="text-lg font-semibold">Manage {activeDepartment.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Use the picker controls below, then save once from the top right.</p>
            </div>
            <button
              type="button"
              onClick={handleSaveDepartmentHead}
              disabled={saving}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="mb-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-2 text-sm font-semibold">Department Head</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => openHeadPicker({ type: 'department' })}
                className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 transition hover:border-emerald-500 focus:border-emerald-500 focus:outline-none sm:w-80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <span className={selectedDepartmentHead ? 'truncate' : 'text-slate-500 dark:text-slate-400'}>
                  {selectedDepartmentHead ? `${selectedDepartmentHead.fullname} (${selectedDepartmentHead.role})` : 'Select Department Head'}
                </span>
                <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-2 text-sm font-semibold">Add Subdepartment</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_auto]">
              <input
                value={newSubForm.name}
                onChange={(e) => setNewSubForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Subdepartment name"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => openHeadPicker({ type: 'newSubdepartment' })}
                className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 transition hover:border-emerald-500 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <span className={newSubForm.head_id ? 'truncate' : 'text-slate-500 dark:text-slate-400'}>
                  {newSubForm.head_id ? getSelectedHeadLabel(newSubForm.head_id) : 'Select Head'}
                </span>
                <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              </button>
              <button
                onClick={handleCreateSubdepartment}
                disabled={saving}
                className="inline-flex w-12 justify-self-end items-center justify-center rounded-md bg-emerald-500 px-0 py-2 text-lg font-bold leading-none text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Add subdepartment"
                title="Add subdepartment"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {safeArray(activeDepartment.subdepartments).length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No subdepartments yet.
              </div>
            ) : (
              safeArray(activeDepartment.subdepartments).map((sub) => (
                <div key={sub.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{sub.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Subdepartment Head</p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => openHeadPicker({ type: 'subdepartment', subdepartmentId: sub.id, subdepartmentName: sub.name })}
                        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 transition hover:border-emerald-500 focus:border-emerald-500 focus:outline-none sm:w-72 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <span className={subHeadDrafts[sub.id] ? 'truncate' : 'text-slate-500 dark:text-slate-400'}>
                          {subHeadDrafts[sub.id] ? getSelectedHeadLabel(subHeadDrafts[sub.id]) : 'Select sub head'}
                        </span>
                        <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubdepartment(sub)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-rose-300 bg-rose-50 text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40"
                        aria-label={`Delete ${sub.name}`}
                        title={`Delete ${sub.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-800/70">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Employee Records</div>
                    {safeArray(sub.employees).length > 0 ? (
                      <div className="space-y-1">
                        {safeArray(sub.employees).map((emp) => (
                          <div key={emp.id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{emp.fullname}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 dark:text-slate-400">{emp.email || 'No email'}</span>
                              <button
                                onClick={() => openMoveEmployeeModal(emp)}
                                className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-300"
                              >
                                Move
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No employees assigned yet.</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {showHeadPickerModal && activeDepartment && (
        <Modal onClose={closeHeadPicker} maxWidthClass="max-w-2xl">
          <h3 className="mb-1 text-lg font-semibold">
            {headPickerTarget?.type === 'newSubdepartment'
              ? 'Select Subdepartment Head'
              : headPickerTarget?.type === 'subdepartment'
                ? `Select Head for ${headPickerTarget.subdepartmentName}`
                : 'Select Department Head'}
          </h3>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {headPickerTarget?.type === 'department'
              ? `Choose an instructor or admin for ${activeDepartment.name}.`
              : headPickerTarget?.type === 'newSubdepartment'
                ? `Choose an instructor or admin for the new subdepartment in ${activeDepartment.name}.`
                : 'Choose an instructor or admin for this subdepartment.'}
          </p>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Click a selected user again to unselect.</p>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={headSearchQuery}
              onChange={(e) => setHeadSearchQuery(e.target.value)}
              placeholder="Search instructors or admins"
              className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </div>

          <div className="mb-4 min-h-[20.5rem] space-y-2">
            {filteredHeadCandidates.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No matching instructors or admins found.
              </div>
            ) : (
              paginatedHeadCandidates.map((candidate) => {
                const selectedHeadId =
                  headPickerTarget?.type === 'department'
                    ? deptHeadId
                    : headPickerTarget?.type === 'newSubdepartment'
                      ? newSubForm.head_id
                      : headPickerTarget?.type === 'subdepartment'
                        ? subHeadDrafts[headPickerTarget.subdepartmentId] ?? ''
                        : '';
                const isSelected = String(candidate.id) === selectedHeadId;

                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      const nextHeadId = isSelected ? '' : String(candidate.id);

                      if (headPickerTarget?.type === 'department') {
                        setDeptHeadId(nextHeadId);
                      } else if (headPickerTarget?.type === 'newSubdepartment') {
                        setNewSubForm((current) => ({ ...current, head_id: nextHeadId }));
                      } else if (headPickerTarget?.type === 'subdepartment') {
                        setSubHeadDrafts((current) => ({ ...current, [headPickerTarget.subdepartmentId]: nextHeadId }));
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 text-slate-900 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-slate-100'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-emerald-500/40 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{candidate.fullname}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{candidate.role}</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                );
              })
            )}
          </div>

          {filteredHeadCandidates.length > 0 && (
            <div className="mb-4 flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                onClick={() => setHeadPickerPage((page) => Math.max(1, page - 1))}
                disabled={headPickerPage === 1}
                className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <div className="text-slate-500 dark:text-slate-400">
                Page {headPickerPage} of {headPickerTotalPages}
              </div>
              <button
                type="button"
                onClick={() => setHeadPickerPage((page) => Math.min(headPickerTotalPages, page + 1))}
                disabled={headPickerPage === headPickerTotalPages}
                className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeHeadPicker}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Done
            </button>
          </div>
        </Modal>
      )}

      {showMoveModal && employeeToMove && (
        <Modal
          onClose={() => {
            setShowMoveModal(false);
            setEmployeeToMove(null);
          }}
          maxWidthClass="max-w-xl"
        >
          <h3 className="mb-1 text-lg font-semibold">Move Employee</h3>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Move <span className="font-semibold text-slate-900 dark:text-slate-100">{employeeToMove.fullname}</span> to another department/subdepartment.
          </p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Department</label>
              <select
                value={moveDepartment}
                onChange={(e) => {
                  setMoveDepartment(e.target.value);
                  setMoveSubdepartmentId('');
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Subdepartment</label>
              <select
                value={moveSubdepartmentId}
                onChange={(e) => setMoveSubdepartmentId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select subdepartment</option>
                {moveDepartmentSubdepartments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setEmployeeToMove(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveEmployee}
                disabled={saving}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Moving...' : 'Move Employee'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDialog.open && (
        <Modal
          onClose={() => {
            if (confirmBusy) return;
            setConfirmDialog({ open: false, title: '', message: '', action: null });
          }}
          maxWidthClass="max-w-lg"
        >
          <h3 className="mb-2 text-lg font-semibold">{confirmDialog.title}</h3>
          <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">{confirmDialog.message}</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmDialog({ open: false, title: '', message: '', action: null })}
              disabled={confirmBusy}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={runConfirmAction}
              disabled={confirmBusy}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirmBusy ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </Modal>
      )}

      {infoDialog.open && (
        <Modal
          onClose={() => {
            setInfoDialog({ open: false, title: '', message: '' });
          }}
          maxWidthClass="max-w-md"
        >
          <h3 className="mb-2 text-lg font-semibold">{infoDialog.title}</h3>
          <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">{infoDialog.message}</p>
          <div className="flex justify-end">
            <button
              onClick={() => setInfoDialog({ open: false, title: '', message: '' })}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              OK
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
  maxWidthClass = 'max-w-md',
  showCloseButton = true,
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidthClass?: string;
  showCloseButton?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center px-4 py-4 sm:py-8">
        <div className={`relative max-h-[92dvh] w-full ${maxWidthClass} overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900`}>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="absolute right-6 top-4 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300/70 bg-white/90 text-slate-500 shadow-sm backdrop-blur transition hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <div className="modal-scroll-area max-h-[92dvh] overflow-y-auto p-6 pr-5 pt-12">{children}</div>
        </div>
      </div>
    </div>
  );
}

function TextInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mb-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
    />
  );
}
