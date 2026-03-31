import { useState, useEffect } from "react";
import { safeArray } from '../../utils/safe';
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
  employee?: { id: number; fullname: string } | null;
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
  status: "Active" | "Inactive";
  subdepartments: Subdepartment[];
}

interface Instructor {
  id: number;
  fullname: string;
}

interface Employee {
  id: number;
  fullname: string;
}

export default function DepartmentManagement() {
  const API = "/api";

  // Helper function to get cookie value
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  };

  // Helper function to get headers with XSRF token
  const getHeaders = () => ({
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': decodeURIComponent(getCookie('XSRF-TOKEN') || ''),
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteSubModal, setShowDeleteSubModal] = useState(false);

  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [selectedSubName, setSelectedSubName] = useState<string>('');
  const [editing, setEditing] = useState<Department | null>(null);
  const [editingSub, setEditingSub] = useState<Subdepartment | null>(null);

  const [deptForm, setDeptForm] = useState({
    name: "",
    code: "",
    head: "",
    head_id: "" as string | number,
    description: "",
  });

  const [subForm, setSubForm] = useState({
    name: "",
    head_id: "" as string | number,
    employee_id: "" as string | number,
  });

  // ================= HELPERS =================
  const getXsrfToken = async (): Promise<string> => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
  };

  // ================= LOAD =================
  const loadDepartments = async () => {
    try {
      setLoading(true);
      // Ensure CSRF cookie is set
      await fetch('/sanctum/csrf-cookie', {
        credentials: 'include',
      });

      const res = await fetch(`${API}/departments`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDepartments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
    loadInstructors();
    loadEmployees();
  }, []);

  const loadInstructors = async () => {
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const res = await fetch(`${API}/admin/users?role=Instructor`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      setInstructors(data.map((u: any) => ({ id: u.id, fullname: u.fullname || u.fullName || u.name })));
    } catch { /* ignore */ }
  };

  const loadEmployees = async () => {
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const res = await fetch(`${API}/admin/users?role=Employee`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      setEmployees(data.map((u: any) => ({ id: u.id, fullname: u.fullname || u.fullName || u.name })));
    } catch { /* ignore */ }
  };

  // ================= SAVE DEPARTMENT =================
  const handleSaveDepartment = async () => {
    // Log form state
    console.log('handleSaveDepartment called');
    console.log('Form data:', deptForm);

    // Validate required fields
    if (!deptForm.name || !deptForm.name.trim()) {
      alert('Department Name is required');
      return;
    }
    if (!deptForm.code || !deptForm.code.trim()) {
      alert('Department Code is required');
      return;
    }

    const url = editing
      ? `${API}/departments/${editing.id}`
      : `${API}/departments`;

    const method = editing ? "PUT" : "POST";
    const xsrfToken = await getXsrfToken();

    try {
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
        body: JSON.stringify({
          name: deptForm.name,
          code: deptForm.code,
          head: deptForm.head_id ? instructors.find(i => i.id === Number(deptForm.head_id))?.fullname || deptForm.head : deptForm.head,
          head_id: deptForm.head_id ? Number(deptForm.head_id) : null,
          description: deptForm.description,
          status: "Active",
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
      alert(err.message || "An error occurred");
    }
  };

  // ================= ADD/EDIT SUB =================
  const handleSaveSub = async () => {
    const xsrfToken = await getXsrfToken();

    const payload = {
      name: subForm.name,
      head_id: subForm.head_id ? Number(subForm.head_id) : null,
      employee_id: subForm.employee_id ? Number(subForm.employee_id) : null,
    };

    try {
      if (editingSub) {
        // Edit existing subdepartment
        await fetch(`${API}/subdepartments/${editingSub.id}`, {
          method: "PUT",
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken,
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Add new subdepartment
        if (!selectedDeptId) return;

        await fetch(
          `${API}/departments/${selectedDeptId}/subdepartments`,
          {
            method: "POST",
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'X-XSRF-TOKEN': xsrfToken,
            },
            body: JSON.stringify(payload),
          }
        );
      }

      setSubForm({ name: "", head_id: "", employee_id: "" });
      setEditingSub(null);
      setShowSubModal(false);
      loadDepartments();
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  // ================= DELETE SUB =================
  const confirmDeleteSub = async () => {
    if (!selectedSubId) return;

    const xsrfToken = await getXsrfToken();
    await fetch(`${API}/subdepartments/${selectedSubId}`, {
      method: "DELETE",
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
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
  if (loading) return <div className="p-6 text-slate-600 dark:text-slate-300">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Department Management
        </h1>

        <button
          onClick={() => {
            setEditing(null);
            setDeptForm({ name: "", code: "", head: "", head_id: "", description: "" });
            setShowDeptModal(true);
          }}
          className="flex items-center px-4 py-2 bg-emerald-500 text-slate-950 font-semibold rounded-lg hover:bg-emerald-400 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div key={dept.id} className="bg-white border border-slate-200 rounded-xl shadow p-5 dark:bg-slate-900/80 dark:border-slate-700/80 dark:shadow-[0_10px_30px_rgba(2,6,23,0.35)]">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                  <Building2 className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-slate-900 dark:text-slate-100">{dept.name}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{dept.code}</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
              Head: <span className="font-medium text-slate-900 dark:text-slate-100">{dept.head_user?.fullname || dept.head || 'Unassigned'}</span>
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
                {safeArray(dept.subdepartments).map((sub) => (
                  <div
                    key={sub.id}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs group dark:bg-slate-800/90 dark:border-slate-700"
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
                          className="w-3 h-3 cursor-pointer text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                        />
                        <X
                          onClick={() => {
                            setSelectedSubId(sub.id);
                            setSelectedSubName(sub.name);
                            setShowDeleteSubModal(true);
                          }}
                          className="w-3 h-3 cursor-pointer text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400"
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
                  className="text-emerald-700 text-xs font-medium hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
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
                  className="w-4 h-4 cursor-pointer text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                />

                <Trash2
                  onClick={() => {
                    setSelectedDeptId(dept.id);
                    setShowDeleteModal(true);
                  }}
                  className="w-4 h-4 cursor-pointer text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= DEPARTMENT MODAL ================= */}
      {showDeptModal && (
        <Modal onClose={() => setShowDeptModal(false)}>
          <h2 className="text-lg font-semibold mb-4">
            {editing ? "Edit Department" : "Add Department"}
          </h2>

          <Input
            placeholder="Department Name"
            value={deptForm.name}
            onChange={(v) => setDeptForm({ ...deptForm, name: v })}
          />
          <Input
            placeholder="Department Code"
            value={deptForm.code}
            onChange={(v) => setDeptForm({ ...deptForm, code: v })}
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
            onClick={handleSaveDepartment}
            disabled={saving}
            className="w-full mt-4 bg-emerald-500 text-slate-950 font-semibold py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400"
          >
            {saving ? 'Saving...' : 'Save'}
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

          <button
            onClick={handleSaveSub}
            className="w-full mt-4 bg-emerald-500 text-slate-950 font-semibold py-2 rounded-md hover:bg-emerald-400"
          >
            {editingSub ? "Update Subdepartment" : "Save Subdepartment"}
          </button>
        </Modal>
      )}

      {/* ================= DELETE MODAL ================= */}
      {showDeleteModal && (() => {
        const deptToDelete = departments.find(d => d.id === selectedDeptId);
        return (
        <Modal onClose={() => setShowDeleteModal(false)}>
          <h2 className="text-lg font-semibold mb-2">
            Delete Department
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">"{deptToDelete?.name}"</span>? This will also remove all its subdepartments. This action cannot be undone.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              onClick={confirmDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Yes, Delete
            </button>
          </div>
        </Modal>
        );
      })()}

      {/* ================= DELETE SUB MODAL ================= */}
      {showDeleteSubModal && (
        <Modal onClose={() => setShowDeleteSubModal(false)}>
          <h2 className="text-lg font-semibold mb-2">
            Delete Subdepartment
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">"{selectedSubName}"</span>? This action cannot be undone and all employees assigned to this subdepartment will be unassigned.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteSubModal(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              onClick={confirmDeleteSub}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Yes, Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================= REUSABLE COMPONENTS ================= */

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border border-slate-200 w-96 rounded-lg shadow-xl p-6 relative text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

function Input({
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
      placeholder={placeholder}
      className="w-full border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 mb-3 placeholder:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
