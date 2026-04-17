import React, { useState, useEffect, useRef } from 'react';
import useConfirm from '../../hooks/useConfirm';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  X,
  AlertCircle,
  Loader2,
  Camera,
  Eye,
  EyeOff,
  ChevronDown,
  KeyRound,
} from 'lucide-react';
import { LoadingState } from '../../components/ui/LoadingState';

import { safeArray, resolveImageUrl } from '../../utils/safe';

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
  profile_picture?: string | null;
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

const API_BASE = '/api';

export function UserManagement({ currentUserEmail, onLogout }: { currentUserEmail?: string; onLogout?: () => Promise<void> | (() => void) }) {
  const confirm = useConfirm();
  const { showConfirm } = confirm;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Admin' | 'Instructor' | 'Employee'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<DeptWithSubs[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [formDepartment, setFormDepartment] = useState('');
  const [formSubdepartment, setFormSubdepartment] = useState('');
  const [formRole, setFormRole] = useState<'Admin' | 'Instructor' | 'Employee'>('Employee');
  const [formSubdepartmentIds, setFormSubdepartmentIds] = useState<number[]>([]);
  const [formIsHead, setFormIsHead] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [showAddUserDropdown, setShowAddUserDropdown] = useState(false);
  const addUserDropdownRef = useRef<HTMLDivElement>(null);
  const [newUserNonce, setNewUserNonce] = useState(0);

  // Recovery key modal state
  const [showRecoveryKeyModal, setShowRecoveryKeyModal] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [createdUserName, setCreatedUserName] = useState<string>('');
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [isRegeneratedKey, setIsRegeneratedKey] = useState(false);
  const [regeneratingKeyForId, setRegeneratingKeyForId] = useState<number | null>(null);
  const [recoveryKeyUserId, setRecoveryKeyUserId] = useState<number | null>(null);

  // Form refs
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const modalFieldClass =
    'mt-1 block w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-slate-900 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 sm:text-sm dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:hover:border-emerald-400/70 dark:hover:bg-slate-700 dark:focus:ring-emerald-400/35 dark:focus:border-emerald-400';
  const modalSelectClass = `${modalFieldClass} appearance-none pr-10`;

  // Helper to read a cookie value
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  };

  // Helper to get headers with XSRF token
  const getHeaders = () => ({
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': decodeURIComponent(getCookie('XSRF-TOKEN') || ''),
  });

  // Fetch CSRF cookie then return decoded XSRF token
  const getXsrfToken = async (): Promise<string> => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
  };

  // Load users on mount
  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);

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
  const filteredUsers = safeArray(users).filter((user) => {
    const name = user.fullname || '';
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept =
      departmentFilter === 'All' || user.department === departmentFilter;
    const matchesRole =
      roleFilter === 'All' || user.role === roleFilter;
    return matchesSearch && matchesDept && matchesRole;
  });

  const selectionCheckboxClass =
    'h-4 w-4 rounded-md border border-slate-300 accent-emerald-500 cursor-pointer transition focus:ring-2 focus:ring-emerald-500/60 focus:ring-offset-0 dark:border-slate-600 dark:bg-slate-800';

  // Delete handler
  const handleDelete = async (id: number) => {
    showConfirm('Are you sure you want to delete this user?', async () => {
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
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to delete user');
        }

        setUsers(users.filter((user) => user.id !== id));
      } catch (err: any) {
        alert(err.message || 'Failed to delete user');
      }
    });
  };

  // View recovery key handler - fetch existing key
  const handleViewRecoveryKey = async (userId: number) => {
    try {
      setRegeneratingKeyForId(userId);
      setRecoveryKeyUserId(userId);
      const response = await fetch(`${API_BASE}/admin/users/${userId}/recovery-key`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to fetch recovery key');
      }

      const data = await response.json();
      setRecoveryKey(data.recovery_key);
      setCreatedUserName(data.user_name);
      setIsRegeneratedKey(false);
      setCopiedRecoveryKey(false);
      setShowRecoveryKeyModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch recovery key');
    } finally {
      setRegeneratingKeyForId(null);
    }
  };

  // Regenerate recovery key handler
  const handleRegenerateRecoveryKey = async () => {
    if (!recoveryKeyUserId) return;

    try {
      const xsrfToken = await getXsrfToken();
      const response = await fetch(`${API_BASE}/admin/users/${recoveryKeyUserId}/regenerate-recovery-key`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to regenerate recovery key');
      }

      const data = await response.json();
      setRecoveryKey(data.recovery_key);
      setCreatedUserName(data.user_name);
      setIsRegeneratedKey(true);
      setCopiedRecoveryKey(false);
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate recovery key');
    }
  };

  // Toggle selection for a single user
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Select or deselect all filtered users
  const toggleSelectAll = () => {
    const filteredIds = filteredUsers.map(u => u.id);
    const allSelected = filteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Bulk delete selected users
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    showConfirm(`Are you sure you want to delete ${selectedIds.length} user(s)?`, async () => {
      try {
        const xsrfToken = await getXsrfToken();
        const response = await fetch(`${API_BASE}/admin/users/bulk-delete`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken,
          },
          body: JSON.stringify({ ids: selectedIds }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to delete users');
        }

        // Remove deleted users from state and clear selection
        setUsers(prev => prev.filter(u => !selectedIds.includes(u.id)));
        setSelectedIds([]);
      } catch (err: any) {
        alert(err.message || 'Failed to delete users');
      }
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addUserDropdownRef.current && !addUserDropdownRef.current.contains(event.target as Node)) {
        setShowAddUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modal handlers
  const handleOpenModal = (user?: User, presetRole?: 'Admin' | 'Instructor' | 'Employee') => {
    setEditingUser(user || null);
    setFormDepartment(user?.department || '');
    setFormSubdepartment(user?.subdepartment_id ? String(user.subdepartment_id) : '');
    setFormRole(user?.role || presetRole || 'Employee');
    setFormSubdepartmentIds(user?.subdepartments?.map(s => s.id) || []);
    setFormIsHead(user?.head_of_departments && user.head_of_departments.length > 0 ? true : false);
    setFormError(null);
    setProfilePictureFile(null);
    setProfilePicturePreview(user?.profile_picture ? `/storage/${user.profile_picture}` : null);
    setShowPassword(false);
    setPasswordValue('');
    setShowAddUserDropdown(false);
    if (!user) {
      setNewUserNonce((prev) => prev + 1);
    }
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!isModalOpen || editingUser) return;

    const timer = window.setTimeout(() => {
      if (fullNameRef.current) fullNameRef.current.value = '';
      if (emailRef.current) emailRef.current.value = '';
      if (passwordRef.current) passwordRef.current.value = '';
      setPasswordValue('');
      fullNameRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isModalOpen, editingUser, newUserNonce]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormDepartment('');
    setFormSubdepartment('');
    setFormRole('Employee');
    setFormSubdepartmentIds([]);
    setFormIsHead(false);
    setFormError(null);
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
    setShowPassword(false);
    setPasswordValue('');
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const formData: FormData = {
      fullName: fullNameRef.current?.value || '',
      email: emailRef.current?.value || '',
      password: passwordValue,
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
    if (formData.password && formData.password.length < 8) {
      setFormError('Password must be at least 8 characters');
      setSubmitting(false);
      return;
    }
    if (formData.role === 'Employee' && !formData.department) {
      setFormError('Department is required for Employee role');
      setSubmitting(false);
      return;
    }

    if (formData.role === 'Employee' && !formData.subdepartment_id) {
      setFormError('Subdepartment is required for Employee role');
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
        department: formData.department || null,
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

      // Get response data to extract recovery key (for new users)
      const responseData = await response.json().catch(() => ({}));

      // Upload photo if a new file was selected
      if (profilePictureFile) {
        const userId = editingUser?.id ?? responseData.user?.id;
        if (userId) {
          const xsrfToken2 = await getXsrfToken();
          const photoFormData = new FormData();
          photoFormData.append('profile_picture', profilePictureFile);
          await fetch(`${API_BASE}/admin/users/${userId}/photo`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': xsrfToken2 },
            body: photoFormData,
          }).catch(() => { /* silently ignore photo upload failure */ });
        }
      }

      // Reload users
      await loadUsers();
      handleCloseModal();

      // Show recovery key modal for new users
      if (!editingUser && responseData.recovery_key) {
        setRecoveryKey(responseData.recovery_key);
        setCreatedUserName(formData.fullName);
        setCopiedRecoveryKey(false);
        setIsRegeneratedKey(false);
        setRecoveryKeyUserId(responseData.user?.id || null);
        setShowRecoveryKeyModal(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };
  // continue to main render below; confirm modal will be rendered inside the main JSX

  if (loading) {
    return (
      <LoadingState
        message="Loading users"
        size="lg"
        className="min-h-[40vh]"
      />
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-center dark:bg-rose-950/40 dark:border-rose-500/40">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-rose-700 dark:text-rose-200">{error}</span>
          <button
            onClick={loadUsers}
            className="ml-auto text-rose-600 hover:text-rose-700 underline dark:text-rose-300 dark:hover:text-rose-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 ui-pop-grid um-shell">
      <div className="relative z-40 overflow-visible flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 um-header">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 um-title">User Management</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center px-3 py-2 border border-rose-500/40 rounded-md shadow-sm text-sm font-medium text-rose-200 bg-rose-900/40 hover:bg-rose-800/50 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed um-action-btn"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({selectedIds.length})
          </button>
          <div className="relative z-50" ref={addUserDropdownRef}>
            <button
              onClick={() => setShowAddUserDropdown(!showAddUserDropdown)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAddUserDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 z-[120]">
                <div className="py-1">
                  <button
                    onClick={() => handleOpenModal(undefined, 'Admin')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 flex items-center"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-500 mr-3"></span>
                    Add Admin
                  </button>
                  <button
                    onClick={() => handleOpenModal(undefined, 'Instructor')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 flex items-center"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-3"></span>
                    Add Instructor
                  </button>
                  <button
                    onClick={() => handleOpenModal(undefined, 'Employee')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 flex items-center"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></span>
                    Add Employee
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 dark:bg-slate-900/80 dark:border-slate-700/80 ui-pop-in ui-force-pop um-filter-panel">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 um-search-input"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'All' | 'Admin' | 'Instructor' | 'Employee')}
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Instructor">Instructor</option>
              <option value="Employee">Employee</option>
            </select>
          </div>
        </div>
        <div className="sm:w-48">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              className="block h-10 w-full pl-10 pr-10 py-2 border border-slate-300 rounded-md leading-5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 um-filter-select ui-select-custom-arrow"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {safeArray(departments).map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
            <ChevronDown className="ui-select-arrow pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden dark:bg-slate-900/80 dark:border-slate-700/80 ui-pop-in ui-force-pop um-table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-3 py-3 text-center align-middle text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      onChange={toggleSelectAll}
                      checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.includes(u.id))}
                      className={selectionCheckboxClass}
                      aria-label="Select all users"
                    />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-900/30 dark:divide-slate-700 um-table-body">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50 um-row"
                    style={{ ['--um-row-delay' as any]: `${Math.min(index, 14) * 55}ms` }}
                  >
                    <td className="px-3 py-4 whitespace-nowrap text-center align-middle">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(user.id)}
                          onChange={() => toggleSelect(user.id)}
                          className={selectionCheckboxClass}
                          aria-label={`Select ${user.fullname}`}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {user.profile_picture ? (
                            <img
                              src={resolveImageUrl(user.profile_picture)}
                              alt={user.fullname}
                              className="h-10 w-10 rounded-full object-cover um-avatar"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold um-avatar">
                              {(user.fullname || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {user.fullname}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {user.department || '-'}
                      </div>
                      {user.role === 'Instructor' && user.head_of_departments && user.head_of_departments.length > 0 && (
                        <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">Head</div>
                      )}
                      {user.role === 'Employee' && user.subdepartment && (
                        <div className="text-xs text-slate-400">
                          {user.subdepartment.name}
                        </div>
                      )}
                      {user.role === 'Instructor' && user.subdepartments && user.subdepartments.length > 0 && (
                        <div className="text-xs text-slate-400">
                          {safeArray(user.subdepartments).map(s => s.name).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'Admin'
                            ? 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-300'
                            : user.role === 'Instructor'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="text-sky-700 hover:text-sky-900 p-1 hover:bg-sky-50 rounded dark:text-sky-400 dark:hover:text-sky-300 dark:hover:bg-slate-700 um-icon-btn"
                          title="Edit user"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewRecoveryKey(user.id)}
                          disabled={regeneratingKeyForId === user.id}
                          className="text-amber-600 hover:text-amber-800 p-1 hover:bg-amber-50 rounded dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-slate-700 um-icon-btn disabled:opacity-50 disabled:cursor-not-allowed"
                          title="View recovery key"
                        >
                          {regeneratingKeyForId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-rose-700 hover:text-rose-900 p-1 hover:bg-rose-50 rounded dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-slate-700 um-icon-btn"
                          title="Delete user"
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
        <div className="fixed inset-0 z-50 ui-overlay-fade">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0 overflow-y-auto">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-y-auto max-h-[90vh] shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ui-pop-in dark:bg-slate-900">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-900 dark:text-slate-100">
                    {editingUser ? 'Edit User' : `Add New ${formRole}`}
                  </h3>
                  <button onClick={handleCloseModal} className="rounded-md p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {formError && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                    <span className="text-sm text-red-700">{formError}</span>
                  </div>
                )}

                <form
                  key={editingUser ? `edit-user-${editingUser.id}` : `new-user-${newUserNonce}`}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                  autoComplete="off"
                >
                  {/* Profile Picture Upload */}
                  <div className="flex flex-col items-center pb-2">
                    <div
                      className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-emerald-300 cursor-pointer transition-colors duration-200 hover:border-emerald-400 dark:border-emerald-500/60 dark:hover:border-emerald-400 group"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {profilePicturePreview ? (
                        <img src={profilePicturePreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-emerald-50 flex flex-col items-center justify-center dark:bg-emerald-950/40">
                          <Camera className="h-8 w-8 text-emerald-400 transition-colors duration-200 group-hover:text-emerald-500" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setProfilePictureFile(file);
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setProfilePicturePreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <p className="text-xs text-slate-400 mt-2 dark:text-slate-300">
                      {profilePicturePreview ? 'Click photo to change' : 'Click to upload photo'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={fullNameRef}
                      type="text"
                      defaultValue={editingUser?.fullname || ''}
                      autoComplete="off"
                      className={modalFieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={emailRef}
                      type="email"
                      defaultValue={editingUser?.email || ''}
                      autoComplete="off"
                      spellCheck={false}
                      className={modalFieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Password {!editingUser && <span className="text-red-500">*</span>}
                      {editingUser && <span className="text-slate-400 text-xs ml-1 dark:text-slate-300">(leave blank to keep current)</span>}
                    </label>
                    <div className="relative mt-1 ui-select-wrap">
                      <input
                        ref={passwordRef}
                        type={showPassword ? 'text' : 'password'}
                        placeholder={editingUser ? '••••••••' : ''}
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        autoComplete="new-password"
                        className={`${modalFieldClass} pl-3 pr-10 mt-0`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors duration-200 hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Password Strength Indicator */}
                    {passwordValue && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map((level) => {
                            const strength = (() => {
                              let score = 0;
                              if (passwordValue.length >= 8) score++;
                              if (passwordValue.length >= 12) score++;
                              if (/[A-Z]/.test(passwordValue) && /[a-z]/.test(passwordValue)) score++;
                              if (/[0-9]/.test(passwordValue)) score++;
                              if (/[^A-Za-z0-9]/.test(passwordValue)) score++;
                              return Math.min(score, 4);
                            })();
                            const isActive = level <= strength;
                            const color = strength <= 1 ? 'bg-red-500' : strength === 2 ? 'bg-orange-500' : strength === 3 ? 'bg-yellow-500' : 'bg-green-500';
                            return (
                              <div
                                key={level}
                                className={`h-1 flex-1 rounded-full transition-colors ${isActive ? color : 'bg-slate-200'}`}
                              />
                            );
                          })}
                        </div>
                        <p className={`text-xs ${
                          passwordValue.length < 8
                            ? 'text-red-600'
                            : (() => {
                                let score = 0;
                                if (passwordValue.length >= 8) score++;
                                if (passwordValue.length >= 12) score++;
                                if (/[A-Z]/.test(passwordValue) && /[a-z]/.test(passwordValue)) score++;
                                if (/[0-9]/.test(passwordValue)) score++;
                                if (/[^A-Za-z0-9]/.test(passwordValue)) score++;
                                const strength = Math.min(score, 4);
                                return strength <= 1 ? 'text-red-600' : strength === 2 ? 'text-orange-600' : strength === 3 ? 'text-yellow-600' : 'text-green-600';
                              })()
                        }`}>
                          {passwordValue.length < 8
                            ? `Password is too short (${passwordValue.length}/8 characters minimum)`
                            : (() => {
                                let score = 0;
                                if (passwordValue.length >= 8) score++;
                                if (passwordValue.length >= 12) score++;
                                if (/[A-Z]/.test(passwordValue) && /[a-z]/.test(passwordValue)) score++;
                                if (/[0-9]/.test(passwordValue)) score++;
                                if (/[^A-Za-z0-9]/.test(passwordValue)) score++;
                                const strength = Math.min(score, 4);
                                return strength <= 1 ? 'Weak password' : strength === 2 ? 'Fair password' : strength === 3 ? 'Good password' : 'Strong password';
                              })()}
                        </p>
                      </div>
                    )}
                    {!passwordValue && !editingUser && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Minimum 8 characters required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Role <span className="text-red-500">*</span>
                    </label>
                    {editingUser ? (
                      <div className="relative mt-1">
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
                          className={`${modalSelectClass} mt-0 ui-select-custom-arrow`}
                        >
                          <option value="Employee">Employee</option>
                          <option value="Instructor">Instructor</option>
                          <option value="Admin">Admin</option>
                        </select>
                        <ChevronDown className="ui-select-arrow pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center">
                        <span className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                          formRole === 'Admin'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : formRole === 'Instructor'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        }`}>
                          <span className={`w-2 h-2 rounded-full mr-2 ${
                            formRole === 'Admin' ? 'bg-purple-500' : formRole === 'Instructor' ? 'bg-blue-500' : 'bg-emerald-500'
                          }`}></span>
                          {formRole}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Department and subdepartment selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Department</label>
                    <div className="relative mt-1 ui-select-wrap">
                      <select
                        value={formDepartment}
                        onChange={(e) => {
                          setFormDepartment(e.target.value);
                          setFormSubdepartment('');
                          setFormSubdepartmentIds([]);
                          setFormIsHead(false);
                        }}
                        className={`${modalSelectClass} mt-0 ui-select-custom-arrow`}
                      >
                        <option value="">Select department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="ui-select-arrow pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
                    </div>
                  </div>

                  {formRole === 'Employee' && formDepartment && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Subdepartment <span className="text-red-500">*</span>
                      </label>
                      <div className="relative mt-1 ui-select-wrap">
                        <select
                          value={formSubdepartment}
                          onChange={(e) => setFormSubdepartment(e.target.value)}
                          className={`${modalSelectClass} mt-0 ui-select-custom-arrow`}
                        >
                          <option value="">Select subdepartment</option>
                          {(departments.find(d => d.name === formDepartment)?.subdepartments || []).map(s => (
                            <option key={s.id} value={String(s.id)}>{s.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="ui-select-arrow pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
                      </div>
                    </div>
                  )}

                  {formRole === 'Instructor' && formDepartment && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Instructor Subdepartments</label>
                      <select
                        multiple
                        value={formSubdepartmentIds.map(String)}
                        onChange={(e) => {
                          const vals = Array.from(e.target.selectedOptions).map(o => Number(o.value));
                          setFormSubdepartmentIds(vals);
                        }}
                        className={`${modalFieldClass} h-28`}
                      >
                        {(departments.find(d => d.name === formDepartment)?.subdepartments || []).map(s => (
                          <option key={s.id} value={String(s.id)}>{s.name}</option>
                        ))}
                      </select>

                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          checked={formIsHead}
                          onChange={(e) => setFormIsHead(e.target.checked)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-slate-900 dark:text-slate-100">Set as Department Head</label>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center">
                    <input
                      ref={statusRef}
                      type="checkbox"
                      defaultChecked={editingUser ? editingUser.status === 'Active' : true}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-slate-900 dark:text-slate-100">Active Account</label>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-emerald-600 text-base font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-[0_10px_20px_rgba(16,185,129,0.22)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:mt-0 sm:col-start-1 sm:text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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

      {/* Recovery Key Modal */}
      {showRecoveryKeyModal && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-slate-900/75 transition-opacity"
              aria-hidden="true"
              onClick={() => {
                setShowRecoveryKeyModal(false);
                setRecoveryKey(null);
                setCreatedUserName('');
                setIsRegeneratedKey(false);
                setRecoveryKeyUserId(null);
              }}
            />
            <div className="inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${recoveryKey ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                  <svg className={`h-6 w-6 ${recoveryKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-slate-900 dark:text-slate-100">
                    {!recoveryKey ? 'No Recovery Key Found' : isRegeneratedKey ? 'Recovery Key Regenerated' : 'Recovery Key'}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {!recoveryKey ? (
                        <>No recovery key saved for <strong className="text-slate-700 dark:text-slate-200">{createdUserName}</strong>. You can generate one below.</>
                      ) : (
                        <>Recovery key for <strong className="text-slate-700 dark:text-slate-200">{createdUserName}</strong></>
                      )}
                    </p>
                    {recoveryKey && isRegeneratedKey && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ The previous key has been invalidated.
                      </p>
                    )}
                  </div>
                  {recoveryKey && (
                    <div className="mt-4">
                      <div className="relative">
                        <code className="block w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-lg font-mono text-slate-900 dark:text-slate-100 tracking-wider text-center select-all">
                          {recoveryKey}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(recoveryKey);
                            setCopiedRecoveryKey(true);
                            setTimeout(() => setCopiedRecoveryKey(false), 2000);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedRecoveryKey ? (
                            <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {copiedRecoveryKey && (
                        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">✓ Copied to clipboard</p>
                      )}
                    </div>
                  )}
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>How to use:</strong> The user can reset their password using this key on the login page → "Forgot Password" → "Use Recovery Key" option.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 space-y-2">
                <button
                  type="button"
                  onClick={handleRegenerateRecoveryKey}
                  className="w-full inline-flex justify-center rounded-md border border-amber-300 dark:border-amber-600 shadow-sm px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-base font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 sm:text-sm"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  {recoveryKey ? 'Regenerate New Key' : 'Generate Recovery Key'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryKeyModal(false);
                    setRecoveryKey(null);
                    setCreatedUserName('');
                    setIsRegeneratedKey(false);
                    setRecoveryKeyUserId(null);
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm.ConfirmModalRenderer()}
    </div>
  );
}
