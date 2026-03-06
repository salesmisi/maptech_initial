import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface User {
  id: number;
  fullname: string;
  email: string;
  department: string | null;
  subdepartment_id: number | null;
  subdepartment?: { id: number; name: string } | null;
  subdepartments?: { id: number; name: string }[];
  head_of_departments?: { id: number; name: string }[];
  role: 'Admin' | 'Instructor' | 'Employee';
  status: 'Active' | 'Inactive';
  created_at?: string;
}

interface FormData {
  fullName: string;
  email: string;
  password: string;
  department: string;
  subdepartment_id: string;
  role: 'Admin' | 'Instructor' | 'Employee';
  status: 'Active' | 'Inactive';
}

interface DeptWithSubs {
  id: number;
  name: string;
  code: string;
  subdepartments: { id: number; name: string }[];
}

const API_BASE = 'http://127.0.0.1:8000/api';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<DeptWithSubs[]>([]);
  const [formDepartment, setFormDepartment] = useState('');
  const [formSubdepartment, setFormSubdepartment] = useState('');
  const [formRole, setFormRole] = useState<'Admin' | 'Instructor' | 'Employee'>('Employee');
  const [formSubdepartmentIds, setFormSubdepartmentIds] = useState<number[]>([]);
  const [formIsHead, setFormIsHead] = useState(false);

  // Form refs
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLInputElement>(null);

  // Helper to read a cookie value
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  };

  // Fetch CSRF cookie then return decoded XSRF token
  const getXsrfToken = async (): Promise<string> => {
    await fetch('http://127.0.0.1:8000/sanctum/csrf-cookie', { credentials: 'include' });
    return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
  };

  // Load users on mount
  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/departments`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      setDepartments(data);
    } catch { /* ignore */ }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/admin/users`, {
        credentials: 'include',
        headers: getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. You are not authorized to view this data.');
        }
        throw new Error('Failed to load data');
      }

      const data = await response.json();
      setUsers(data); // Correctly assign the response data to users
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const name = user.fullname || '';
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept =
      departmentFilter === 'All' || user.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  // Delete handler
  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const xsrfToken = await getXsrfToken();
      const response = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      setUsers(users.filter((user) => user.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  // Modal handlers
  const handleOpenModal = (user?: User) => {
    setEditingUser(user || null);
    setFormDepartment(user?.department || '');
    setFormSubdepartment(user?.subdepartment_id ? String(user.subdepartment_id) : '');
    setFormRole(user?.role || 'Employee');
    setFormSubdepartmentIds(user?.subdepartments?.map(s => s.id) || []);
    setFormIsHead(user?.head_of_departments && user.head_of_departments.length > 0 ? true : false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormDepartment('');
    setFormSubdepartment('');
    setFormRole('Employee');
    setFormSubdepartmentIds([]);
    setFormIsHead(false);
    setFormError(null);
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const formData: FormData = {
      fullName: fullNameRef.current?.value || '',
      email: emailRef.current?.value || '',
      password: passwordRef.current?.value || '',
      department: formDepartment,
      subdepartment_id: formSubdepartment,
      role: formRole,
      status: statusRef.current?.checked ? 'Active' : 'Inactive',
    };

    // Validation
    if (!formData.fullName.trim()) {
      setFormError('Full name is required');
      setSubmitting(false);
      return;
    }
    if (!formData.email.trim()) {
      setFormError('Email is required');
      setSubmitting(false);
      return;
    }
    if (!editingUser && !formData.password) {
      setFormError('Password is required for new users');
      setSubmitting(false);
      return;
    }
    if (formData.role === 'Employee' && !formData.department) {
      setFormError('Department is required for Employee role');
      setSubmitting(false);
      return;
    }
    if (formData.role === 'Instructor' && !formData.department) {
      setFormError('Department is required for Instructor role');
      setSubmitting(false);
      return;
    }

    try {
      const xsrfToken = await getXsrfToken();
      const url = editingUser
        ? `${API_BASE}/admin/users/${editingUser.id}`
        : `${API_BASE}/admin/users`;

      const method = editingUser ? 'PUT' : 'POST';

      const body: any = {
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        department: (formData.role === 'Employee' || formData.role === 'Instructor') ? formData.department : null,
        subdepartment_id: formData.role === 'Employee' && formData.subdepartment_id ? Number(formData.subdepartment_id) : null,
        status: formData.status,
      };

      // For instructors, include subdepartment_ids and head flag
      if (formData.role === 'Instructor') {
        body.subdepartment_ids = formSubdepartmentIds;
        body.is_department_head = formIsHead;
      }

      // Only include password if provided (for edit) or required (for create)
      if (formData.password) {
        body.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save user');
      }

      // Reload users
      await loadUsers();
      handleCloseModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-2 text-slate-600">Loading users...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
          <button
            onClick={loadUsers}
            className="ml-auto text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
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
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
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
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                            {(user.fullname || '?').charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900">
                            {user.fullname}
                          </div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">
                        {user.department || '-'}
                      </div>
                      {user.role === 'Instructor' && user.head_of_departments && user.head_of_departments.length > 0 && (
                        <div className="text-xs text-amber-600 font-medium">Head</div>
                      )}
                      {user.role === 'Employee' && user.subdepartment && (
                        <div className="text-xs text-slate-400">
                          {user.subdepartment.name}
                        </div>
                      )}
                      {user.role === 'Instructor' && user.subdepartments && user.subdepartments.length > 0 && (
                        <div className="text-xs text-slate-400">
                          {user.subdepartments.map(s => s.name).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'Admin'
                            ? 'bg-purple-100 text-purple-800'
                            : user.role === 'Instructor'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-900">
                    {editingUser ? 'Edit User' : 'Add New User'}
                  </h3>
                  <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {formError && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                    <span className="text-sm text-red-700">{formError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={fullNameRef}
                      type="text"
                      defaultValue={editingUser?.fullname || ''}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={emailRef}
                      type="email"
                      defaultValue={editingUser?.email || ''}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Password {!editingUser && <span className="text-red-500">*</span>}
                      {editingUser && <span className="text-slate-400 text-xs ml-1">(leave blank to keep current)</span>}
                    </label>
                    <input
                      ref={passwordRef}
                      type="password"
                      placeholder={editingUser ? '••••••••' : ''}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => {
                        const newRole = e.target.value as 'Admin' | 'Instructor' | 'Employee';
                        setFormRole(newRole);
                        setFormDepartment('');
                        setFormSubdepartment('');
                        setFormSubdepartmentIds([]);
                        setFormIsHead(false);
                      }}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    >
                      <option value="Employee">Employee</option>
                      <option value="Instructor">Instructor</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>

                  {/* Department dropdown for Employee and Instructor */}
                  {(formRole === 'Employee' || formRole === 'Instructor') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Department
                      </label>
                      <select
                        value={formDepartment}
                        onChange={(e) => {
                          setFormDepartment(e.target.value);
                          setFormSubdepartment('');
                          setFormSubdepartmentIds([]);
                          setFormIsHead(false);
                        }}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      >
                        <option value="">Select Department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Employee: single subdepartment dropdown */}
                  {formRole === 'Employee' && formDepartment && (() => {
                    const dept = departments.find(d => d.name === formDepartment);
                    const subs = dept?.subdepartments || [];
                    return subs.length > 0 ? (
                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          Sub Department
                        </label>
                        <select
                          value={formSubdepartment}
                          onChange={(e) => setFormSubdepartment(e.target.value)}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        >
                          <option value="">Select Sub Department</option>
                          {subs.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : null;
                  })()}

                  {/* Instructor: checkbox subdepartments + head of department */}
                  {formRole === 'Instructor' && formDepartment && (() => {
                    const dept = departments.find(d => d.name === formDepartment);
                    const subs = dept?.subdepartments || [];
                    return subs.length > 0 ? (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Sub Departments
                        </label>
                        <div className="border border-slate-300 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                          {subs.map((s) => (
                            <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formSubdepartmentIds.includes(s.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormSubdepartmentIds([...formSubdepartmentIds, s.id]);
                                  } else {
                                    setFormSubdepartmentIds(formSubdepartmentIds.filter(id => id !== s.id));
                                  }
                                }}
                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded"
                              />
                              <span className="text-sm text-slate-700">{s.name}</span>
                            </label>
                          ))}
                        </div>
                        <label className="flex items-center gap-2 mt-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formIsHead}
                            onChange={(e) => setFormIsHead(e.target.checked)}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded"
                          />
                          <span className="text-sm text-slate-700 font-medium">Head of Department</span>
                        </label>
                      </div>
                    ) : null;
                  })()}
                  <div className="flex items-center">
                    <input
                      ref={statusRef}
                      type="checkbox"
                      defaultChecked={editingUser ? editingUser.status === 'Active' : true}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-slate-900">Active Account</label>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={submitting}
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
