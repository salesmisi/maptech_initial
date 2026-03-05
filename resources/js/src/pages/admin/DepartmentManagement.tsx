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
  employee_count: number;
  course_count: number;
  status: "Active" | "Inactive";
  subdepartments: Subdepartment[];
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteSubModal, setShowDeleteSubModal] = useState(false);

  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Department | null>(null);
  const [editingSub, setEditingSub] = useState<Subdepartment | null>(null);

  const [deptForm, setDeptForm] = useState({
    name: "",
    code: "",
    head: "",
    description: "",
  });

  const [subName, setSubName] = useState("");

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
  }, []);

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

    setSaving(true);
    console.log('Saving to:', url, 'Method:', method);

    try {
      // Ensure CSRF cookie is fresh
      console.log('Fetching CSRF cookie...');
      await fetch('/sanctum/csrf-cookie', {
        credentials: 'include',
      });

      const xsrfToken = getCookie('XSRF-TOKEN');
      console.log('XSRF-TOKEN:', xsrfToken ? 'Found' : 'NOT FOUND');

      const requestBody = {
        name: deptForm.name.trim(),
        code: deptForm.code.trim(),
        head: deptForm.head ? deptForm.head.trim() : '',
        description: deptForm.description ? deptForm.description.trim() : '',
        status: "Active",
      };
      console.log('Request body:', requestBody);

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: getHeaders(),
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', res.status);
      const responseText = await res.text();
      console.log('Response body:', responseText);

      if (!res.ok) {
        let errData = {};
        try {
          errData = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Failed to save: ${res.status} - ${responseText}`);
        }

        // Show validation errors if any
        if ((errData as any).errors) {
          const errorMessages = Object.values((errData as any).errors).flat().join('\n');
          throw new Error(errorMessages);
        }
        throw new Error((errData as any).message || `Failed to save: ${res.status}`);
      }

      console.log('Save successful!');
      setShowDeptModal(false);
      setEditing(null);
      setDeptForm({ name: "", code: "", head: "", description: "" });
      await loadDepartments();
    } catch (err: any) {
      console.error('Save error:', err);
      alert(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  // ================= ADD/EDIT SUB =================
  const handleSaveSub = async () => {
    if (!subName.trim()) {
      alert("Please enter a subdepartment name");
      return;
    }

    try {
      if (editingSub) {
        // Edit existing subdepartment
        const res = await fetch(`${API}/subdepartments/${editingSub.id}`, {
          method: "PUT",
          credentials: 'include',
          headers: getHeaders(),
          body: JSON.stringify({ name: subName.trim() }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Failed to update: ${res.status}`);
        }
      } else {
        // Add new subdepartment
        if (!selectedDeptId) return;

        const res = await fetch(
          `${API}/departments/${selectedDeptId}/subdepartments`,
          {
            method: "POST",
            credentials: 'include',
            headers: getHeaders(),
            body: JSON.stringify({ name: subName.trim() }),
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Failed to add: ${res.status}`);
        }
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

    await fetch(`${API}/subdepartments/${selectedSubId}`, {
      method: "DELETE",
      credentials: 'include',
      headers: getHeaders(),
    });

    setShowDeleteSubModal(false);
    setSelectedSubId(null);
    loadDepartments();
  };

  // ================= DELETE =================
  const confirmDelete = async () => {
    if (!selectedDeptId) return;

    await fetch(`${API}/departments/${selectedDeptId}`, {
      method: "DELETE",
      credentials: 'include',
      headers: getHeaders(),
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
            setDeptForm({ name: "", code: "", head: "", description: "" });
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
              Head: <span className="font-medium">{dept.head}</span>
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
                        setShowDeleteSubModal(true);
                      }}
                      className="w-3 h-3 cursor-pointer opacity-0 group-hover:opacity-100 hover:text-red-600"
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
                      name: dept.name || "",
                      code: dept.code || "",
                      head: dept.head || "",
                      description: dept.description || "",
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
          <Input
            placeholder="Department Head"
            value={deptForm.head}
            onChange={(v) => setDeptForm({ ...deptForm, head: v })}
          />
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
      {showDeleteModal && (
        <Modal onClose={() => setShowDeleteModal(false)}>
          <h2 className="text-lg font-semibold mb-4">
            Delete this department?
          </h2>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border rounded-md"
            >
              Cancel
            </button>

            <button
              onClick={confirmDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {/* ================= DELETE SUB MODAL ================= */}
      {showDeleteSubModal && (
        <Modal onClose={() => setShowDeleteSubModal(false)}>
          <h2 className="text-lg font-semibold mb-4">
            Delete this subdepartment?
          </h2>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteSubModal(false)}
              className="px-4 py-2 border rounded-md"
            >
              Cancel
            </button>

            <button
              onClick={confirmDeleteSub}
              className="px-4 py-2 bg-red-600 text-white rounded-md"
            >
              Delete
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
