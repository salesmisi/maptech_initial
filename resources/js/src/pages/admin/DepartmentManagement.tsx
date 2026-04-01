import { useState, useEffect } from "react";
import { safeArray } from '../../utils/safe';
import { LoadingState } from '../../components/ui/LoadingState';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  BookOpen,
  Building2,
  X,
} from "lucide-react";

interface Subdepartment {
  id: number;
  name: string;
  head_id: number | null;
  employee_id: number | null;
  head_user?: { id: number; fullname: string } | null;
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
  course_count: number;
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

export default function DepartmentManagement() {
  const API = '/api';

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
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
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    action: null,
  });
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [employeeToMove, setEmployeeToMove] = useState<EmployeeRecord | null>(null);
  const [moveDepartment, setMoveDepartment] = useState('');
  const [moveSubdepartmentId, setMoveSubdepartmentId] = useState('');

  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    description: '',
  });

  const [deptHeadId, setDeptHeadId] = useState('');
  const [newSubForm, setNewSubForm] = useState({
    name: '',
    head_id: '',
  });
  const [subHeadDrafts, setSubHeadDrafts] = useState<Record<number, string>>({});

  const activeDepartment = useMemo(
    () => departments.find((d) => d.id === activeDeptId) ?? null,
    [departments, activeDeptId]
  );

  const moveDepartmentSubdepartments = useMemo(() => {
    const dept = departments.find((d) => d.name === moveDepartment);
    return dept?.subdepartments ?? [];
  }, [departments, moveDepartment]);

  const loadDepartments = async () => {
    const res = await fetch(`${API}/departments`, {
      credentials: 'include',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load departments.');
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
    for (const sub of activeDepartment.subdepartments || []) {
      nextDrafts[sub.id] = sub.head_id ? String(sub.head_id) : '';
    }
    setSubHeadDrafts(nextDrafts);
  }, [activeDepartment?.id, activeDepartment?.head_id, activeDepartment?.subdepartments]);

  const openManageModal = (dept: Department) => {
    setActiveDeptId(dept.id);
    setDeptHeadId(dept.head_id ? String(dept.head_id) : '');
    setNewSubForm({ name: '', head_id: '' });
    setShowManageModal(true);
  };

  const reloadAndKeepActive = async () => {
    await loadDepartments();
  };

  const askConfirm = (title: string, message: string, action: () => Promise<void>) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      action,
    });
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
      const xsrfToken = await getXsrfToken();
      const selectedHead = headCandidates.find((h) => String(h.id) === deptHeadId);

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
          head: selectedHead?.fullname || '',
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to update department head.');
      }

      await reloadAndKeepActive();
    } catch (err: any) {
      alert(err.message || 'Failed to update department head.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubdepartment = async () => {
    if (!activeDepartment) return;
    if (!newSubForm.name.trim()) {
      alert('Subdepartment Name is required.');
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
        const responseText = await res.text();
        let errData: any = {};
        try {
          errData = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Failed to save: ${res.status} - ${responseText}`);
        }

        if (errData.errors) {
          const errorMessages = Object.values(errData.errors).flat().join('\n');
          throw new Error(errorMessages);
        }
        throw new Error(errData.message || `Failed to save: ${res.status}`);
      }

      setShowDeptModal(false);
      setEditing(null);
      setDeptForm({ name: "", code: "", head: "", head_id: "", description: "" });
      await loadDepartments();
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

        setShowManageModal(false);
        setActiveDeptId(null);
        await refreshAll();
      }
    );
  };

  const handleDeleteSubdepartment = (sub: Subdepartment) => {
    askConfirm(
      'Delete Subdepartment',
      `Are you sure you want to delete ${sub.name}?`,
      async () => {
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

    setShowDeleteSubModal(false);
    setSelectedSubId(null);
    loadDepartments();
  };

  // ================= DELETE =================
  const confirmDelete = async () => {
    if (!selectedDeptId) return;

    const xsrfToken = await getXsrfToken();
    await fetch(`${API}/departments/${selectedDeptId}`, {
      method: "DELETE",
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': xsrfToken,
      },
    });

    setShowDeleteModal(false);
    loadDepartments();
  };

  // ================= RENDER =================
  if (loading) return <LoadingState message="Loading departments" className="p-6" />;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      {/* HEADER */}
      <div className="department-toolbar-animate flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Department Management
        </h1>

        <button
          onClick={() => {
            setEditing(null);
            setDeptForm({ name: "", code: "", head: "", head_id: "", description: "" });
            setShowDeptModal(true);
          }}
          className="department-cta-button flex items-center px-4 py-2 bg-emerald-500 text-slate-950 font-semibold rounded-lg hover:bg-emerald-400 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Department
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept, deptIndex) => (
          <div
            key={dept.id}
            className="department-card group bg-white border border-slate-200 rounded-xl shadow p-5 dark:bg-slate-900/80 dark:border-slate-700/80 dark:shadow-[0_10px_30px_rgba(2,6,23,0.35)]"
            style={{ animationDelay: `${Math.min(deptIndex * 55, 440)}ms` }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/20 p-3">
                  <Building2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div>
                  <p className="text-lg font-semibold">{dept.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{dept.code}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
            </div>

            <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">
              Head: <span className="font-medium text-slate-900 dark:text-slate-100">{dept.head_user?.fullname || 'Unassigned'}</span>
            </p>

            {/* DESCRIPTION */}
            {dept.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {dept.description}
              </p>
            )}

            {/* SUBDEPARTMENTS */}
            {safeArray(dept.subdepartments).length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Subdepartments:</p>
                <div className="space-y-2">
                {safeArray(dept.subdepartments).map((sub, subIndex) => (
                  <div
                    key={sub.id}
                    className="department-sub-item px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs group dark:bg-slate-800/90 dark:border-slate-700"
                    style={{ animationDelay: `${Math.min(subIndex * 35, 245)}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sky-700 dark:text-sky-300">{sub.name}</span>
                      <div className="flex items-center gap-1">
                        <Pencil
                          onClick={() => {
                            setEditingSub(sub);
                            setSubForm({
                              name: sub.name,
                              head_id: sub.head_id || "",
                              employee_id: sub.employee_id || "",
                            });
                            setShowSubModal(true);
                          }}
                          className="department-action-icon w-3 h-3 cursor-pointer text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                        />
                        <X
                          onClick={() => {
                            setSelectedSubId(sub.id);
                            setSelectedSubName(sub.name);
                            setShowDeleteSubModal(true);
                          }}
                          className="department-action-icon w-3 h-3 cursor-pointer text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400"
                        />
                      </div>
                    </div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400 space-y-0.5">
                      <p>Head: <span className="text-slate-700 dark:text-slate-200">{sub.head_user?.fullname || 'Unassigned'}</span></p>
                      <p>Employee: <span className="text-slate-700 dark:text-slate-200">{sub.employee?.fullname || 'Unassigned'}</span></p>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-4">
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => {
                    setSelectedDeptId(dept.id);
                    setSubForm({ name: "", head_id: "", employee_id: "" });
                    setEditingSub(null);
                    setShowSubModal(true);
                  }}
                  className="department-sub-cta text-emerald-700 text-xs font-medium hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                >
                  + Sub
                </button>

                <Pencil
                  onClick={() => {
                    setEditing(dept);
                    setDeptForm({
                      name: dept.name,
                      code: dept.code,
                      head: dept.head,
                      head_id: dept.head_id || "",
                      description: dept.description || "",
                    });
                    setShowDeptModal(true);
                  }}
                  className="department-action-icon w-4 h-4 cursor-pointer text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                />

                <Trash2
                  onClick={() => {
                    setSelectedDeptId(dept.id);
                    setShowDeleteModal(true);
                  }}
                  className="department-action-icon w-4 h-4 cursor-pointer text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400"
                />
              </div>
            </div>
          </div>
        ))}
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
          <div className="mb-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department Head</label>
            <select
              value={deptForm.head_id}
              onChange={(e) => setDeptForm({ ...deptForm, head_id: e.target.value })}
              className="w-full border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select Instructor</option>
              {safeArray(instructors).map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.fullname}</option>
              ))}
            </select>
          </div>
          <Input
            placeholder="Description"
            value={deptForm.description}
            onChange={(v) =>
              setDeptForm({ ...deptForm, description: v })
            }
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

      {/* ================= SUB MODAL ================= */}
      {showSubModal && (
        <Modal onClose={() => {
          setShowSubModal(false);
          setEditingSub(null);
          setSubForm({ name: "", head_id: "", employee_id: "" });
        }}>
          <h2 className="text-lg font-semibold mb-4">
            {editingSub ? "Edit Subdepartment" : "Add Subdepartment"}
          </h2>

          <Input
            placeholder="Subdepartment Name"
            value={subForm.name}
            onChange={(v) => setSubForm({ ...subForm, name: v })}
          />

          <div className="mb-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subdepartment Head</label>
            <select
              value={subForm.head_id}
              onChange={(e) => setSubForm({ ...subForm, head_id: e.target.value })}
              className="w-full border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select Head</option>
              {safeArray(instructors).map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.fullname}</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subdepartment Employee</label>
            <select
              value={subForm.employee_id}
              onChange={(e) => setSubForm({ ...subForm, employee_id: e.target.value })}
              className="w-full border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select Employee</option>
              {safeArray(employees).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.fullname}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {activeDepartment.subdepartments?.length ? (
              activeDepartment.subdepartments.map((sub) => (
                <div key={sub.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{sub.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Subdepartment Head (Admin / Instructor)</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <select
                        value={subHeadDrafts[sub.id] ?? ''}
                        onChange={(e) => setSubHeadDrafts((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none sm:w-72 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">Select sub head</option>
                        {headCandidates.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullname} ({u.role})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveSubHead(sub)}
                        disabled={saving}
                        className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleDeleteSubdepartment(sub)}
                        className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-800/70">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <Users className="h-4 w-4" />
                      Employee Records
                    </div>
                    {sub.employees && sub.employees.length > 0 ? (
                      <div className="space-y-1">
                        {sub.employees.map((emp) => (
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
                      <p className="text-sm text-slate-500 dark:text-slate-400">No employees assigned in User Management yet.</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No subdepartments yet. Create one above.
              </div>
            )}
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
            Move <span className="font-semibold text-slate-900 dark:text-slate-100">{employeeToMove.fullname}</span> to the correct department and subdepartment.
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
                  <option key={d.id} value={d.name}>{d.name}</option>
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
                  <option key={s.id} value={s.id}>{s.name}</option>
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
    </div>
  );
}

function Modal({
  children,
  onClose,
  maxWidthClass = 'max-w-md',
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center px-4 py-4 sm:py-8">
        <div className={`relative w-full ${maxWidthClass} max-h-[92dvh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900`}>
          <button
            onClick={onClose}
            className="absolute right-6 top-4 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300/70 bg-white/90 text-slate-500 shadow-sm backdrop-blur transition hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="max-h-[92dvh] overflow-y-auto p-6 pr-5 pt-12">
            {children}
          </div>
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
