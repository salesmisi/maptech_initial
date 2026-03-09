import { useState, useEffect } from "react";
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

  const [subName, setSubName] = useState("");

  // ================= HELPERS =================
  const getXsrfToken = async (): Promise<string> => {
    await fetch('http://127.0.0.1:8000/sanctum/csrf-cookie', { credentials: 'include' });
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
  }, []);

  const loadInstructors = async () => {
    try {
      await fetch('http://127.0.0.1:8000/sanctum/csrf-cookie', { credentials: 'include' });
      const res = await fetch(`${API}/admin/users?role=Instructor`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      setInstructors(data.map((u: any) => ({ id: u.id, fullname: u.fullname })));
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
      setDeptForm({ name: "", code: "", head: "", description: "" });
      await loadDepartments();
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  // ================= ADD/EDIT SUB =================
  const handleSaveSub = async () => {
    const xsrfToken = await getXsrfToken();

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
          body: JSON.stringify({ name: subName }),
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
            body: JSON.stringify({ name: subName }),
          }
        );
      }

      setSubName("");
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
  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">
          Department Management
        </h1>

        <button
          onClick={() => {
            setEditing(null);
            setDeptForm({ name: "", code: "", head: "", head_id: "", description: "" });
            setShowDeptModal(true);
          }}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div key={dept.id} className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-md">
                  <Building2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{dept.name}</h2>
                  <p className="text-sm text-gray-500">{dept.code}</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              Head: <span className="font-medium">{dept.head_user?.fullname || dept.head || 'Unassigned'}</span>
            </p>

            {/* DESCRIPTION */}
            {dept.description && (
              <p className="text-sm text-gray-500 mb-3">
                {dept.description}
              </p>
            )}

            {/* SUBDEPARTMENTS */}
            {dept.subdepartments?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2 font-medium">Subdepartments:</p>
                <div className="flex flex-wrap gap-2">
                {dept.subdepartments.map((sub) => (
                  <span
                    key={sub.id}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1 group"
                  >
                    {sub.name}
                    <Pencil
                      onClick={() => {
                        setEditingSub(sub);
                        setSubName(sub.name);
                        setShowSubModal(true);
                      }}
                      className="w-3 h-3 cursor-pointer opacity-0 group-hover:opacity-100 hover:text-blue-900"
                    />
                    <X
                      onClick={() => {
                        setSelectedSubId(sub.id);
                        setSelectedSubName(sub.name);
                        setShowDeleteSubModal(true);
                      }}
                      className="w-3 h-3 cursor-pointer text-blue-400 hover:text-red-600"
                    />
                  </span>
                ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-4">
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => {
                    setSelectedDeptId(dept.id);
                    setSubName("");
                    setEditingSub(null);
                    setShowSubModal(true);
                  }}
                  className="text-green-600 text-xs"
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
                      description: dept.description,
                    });
                    setShowDeptModal(true);
                  }}
                  className="w-4 h-4 cursor-pointer text-gray-600"
                />

                <Trash2
                  onClick={() => {
                    setSelectedDeptId(dept.id);
                    setShowDeleteModal(true);
                  }}
                  className="w-4 h-4 cursor-pointer text-gray-600"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Department Head</label>
            <select
              value={deptForm.head_id}
              onChange={(e) => setDeptForm({ ...deptForm, head_id: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select Instructor</option>
              {instructors.map((inst) => (
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
            className="w-full mt-4 bg-green-600 text-white py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700"
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
          setSubName("");
        }}>
          <h2 className="text-lg font-semibold mb-4">
            {editingSub ? "Edit Subdepartment" : "Add Subdepartment"}
          </h2>

          <Input
            placeholder="Subdepartment Name"
            value={subName}
            onChange={setSubName}
          />

          <button
            onClick={handleSaveSub}
            className="w-full mt-4 bg-green-600 text-white py-2 rounded-md"
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
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete <span className="font-semibold text-gray-800">"{deptToDelete?.name}"</span>? This will also remove all its subdepartments. This action cannot be undone.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border rounded-md"
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
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete <span className="font-semibold text-gray-800">"{selectedSubName}"</span>? This action cannot be undone and all employees assigned to this subdepartment will be unassigned.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteSubModal(false)}
              className="px-4 py-2 border rounded-md"
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-96 rounded-lg shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3"
        >
          <X className="w-5 h-5 text-gray-500" />
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
      className="w-full border rounded-md px-3 py-2 mb-3"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
