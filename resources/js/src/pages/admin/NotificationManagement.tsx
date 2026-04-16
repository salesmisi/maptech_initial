import React, { useState, useEffect } from 'react';
import useConfirm from '../../hooks/useConfirm';
import { Bell, Send, Clock, CheckCircle, Plus, Trash2, Eye, Users, AlertCircle, X, RotateCcw, Archive } from 'lucide-react';
import { safeArray, resolveImageUrl } from '../../utils/safe';
import { LoadingState } from '../../components/ui/LoadingState';
import InfoModal from '../../components/InfoModal';

interface Notification {
  id: number;
  user_id: number;
  course_id: string | null;
  type: string;
  title: string;
  message: string;
  data: {
    from_user_id?: number;
    from_user_name?: string;
    from_role?: string;
    from_user_profile_picture?: string | null;
    from_department?: string | null;
    course_title?: string;
  } | null;
  read_at: string | null;
  created_at: string;
}

interface SentNotification {
  id: number;
  title: string;
  message: string;
  target: string;
  date: string;
  status: 'Sent';
  recipients_count: number;
}

interface RecentlyDeletedNotification {
  id: number;
  title: string;
  message: string;
  target: string | null;
  date: string;
  deleted_at: string;
  recipients_count: number | null;
  item_type: 'sent' | 'received';
  data?: {
    from_user_name?: string;
    from_role?: string;
    from_department?: string | null;
  } | null;
  type?: string;
}

export function NotificationManagement() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sentHistory, setSentHistory] = useState<SentNotification[]>([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState<RecentlyDeletedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'deleted'>('received');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [successToast, setSuccessToast] = useState<{ show: boolean; count: number }>({ show: false, count: 0 });
  const [previewModal, setPreviewModal] = useState<{ open: boolean; recipientCount: number | null; error?: string }>({ open: false, recipientCount: null });
  const HISTORY_LIMIT = 50;

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    roles: [] as string[],
    course_id: '',
    target_user_ids: [] as number[],
  });

  // User search state
  const [userQuery, setUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; fullname: string; role: string }[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const userSearchTimer = React.useRef<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<{ id: number; fullname: string; role: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  const confirm = useConfirm();
  const { showConfirm } = confirm;

  // Helper to read cookie value
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  };

  const getXsrfToken = async (): Promise<string> => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
  };

  const fetchOptions = async (method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<RequestInit> => {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    };

    if (method !== 'GET') {
      headers['X-XSRF-TOKEN'] = await getXsrfToken();
    }

    return {
      method,
      credentials: 'include',
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    };
  };

  // Load notifications and sent history
  useEffect(() => {
    console.debug('NotificationManagement mounted', { formData });
    fetchNotifications();
    fetchUnreadCount();
    fetchSentAnnouncements();
    fetchRecentlyDeleted();

    // Subscribe to realtime notifications if Echo is available
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const Echo = (window as any).Echo;
        if (!Echo || typeof Echo.private !== 'function') return;
        // Fetch current user id
        const res = await fetch('/user', { credentials: 'include', headers: { 'Accept': 'application/json' } });
        if (!res.ok) return;
        const me = await res.json();
        if (!me?.id) return;
        const channel = Echo.private('notifications.' + me.id);
        const createdHandler = (payload: any) => {
          const n = payload?.notification || payload;
          if (!n) return;
          setNotifications(prev => [n, ...prev.filter(p => p.id !== n.id)]);
          setUnreadCount(c => c + 1);
        };
        const countHandler = (payload: any) => {
          setUnreadCount(payload?.count ?? 0);
        };
        channel.listen('NotificationCreated', createdHandler);
        channel.listen('NotificationCountUpdated', countHandler);

        cleanup = () => {
          try {
            channel.stopListening('NotificationCreated');
            channel.stopListening('NotificationCountUpdated');
          } catch (e) {}
        };
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/notifications', await fetchOptions('GET'));
      let data: any = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        const text = await res.text().catch(() => null);
        console.error('Failed to parse /api/admin/notifications response as JSON', { status: res.status, text });
        data = null;
      }

      const list = safeArray(data?.data ?? data?.notifications?.data);
      if (!Array.isArray(data?.data) && !Array.isArray(data?.notifications?.data) && data !== null) {
        console.warn('/api/admin/notifications returned unexpected shape', data);
      }
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/admin/notifications/unread-count', await fetchOptions('GET'));
      const data = await res.json();
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  const fetchSentAnnouncements = async () => {
    try {
      const res = await fetch('/api/admin/notifications/sent-history', await fetchOptions('GET'));
      const data = await res.json();
      setSentHistory(data.sent_announcements || []);
    } catch (err) {
      console.error('Failed to load sent announcements:', err);
    }
  };

  const fetchRecentlyDeleted = async () => {
    try {
      const res = await fetch('/api/admin/notifications/recently-deleted', await fetchOptions('GET'));
      const data = await res.json();
      setRecentlyDeleted(data.recently_deleted || []);
    } catch (err) {
      console.error('Failed to load recently deleted:', err);
    }
  };

  const deleteSentHistory = async (id: number) => {
    showConfirm('Move this announcement to recently deleted?', async () => {
      try {
        await fetch(`/api/admin/notifications/sent-history/${id}`, await fetchOptions('DELETE'));
        fetchSentAnnouncements();
        fetchRecentlyDeleted();
      } catch (err) {
        console.error('Failed to delete sent history:', err);
      }
    });
  };

  const restoreFromDeleted = async (id: number) => {
    try {
      await fetch(`/api/admin/notifications/sent-history/${id}/restore`, await fetchOptions('POST'));
      fetchSentAnnouncements();
      fetchRecentlyDeleted();
    } catch (err) {
      console.error('Failed to restore announcement:', err);
    }
  };

  const permanentlyDelete = async (id: number) => {
    showConfirm('Permanently delete this announcement? This cannot be undone.', async () => {
      try {
        await fetch(`/api/admin/notifications/sent-history/${id}/permanent`, await fetchOptions('DELETE'));
        fetchRecentlyDeleted();
      } catch (err) {
        console.error('Failed to permanently delete:', err);
      }
    });
  };

  const restoreReceivedNotification = async (id: number) => {
    try {
      await fetch(`/api/admin/notifications/${id}/restore`, await fetchOptions('POST'));
      fetchNotifications();
      fetchRecentlyDeleted();
    } catch (err) {
      console.error('Failed to restore notification:', err);
    }
  };

  const permanentlyDeleteReceived = async (id: number) => {
    showConfirm('Permanently delete this notification? This cannot be undone.', async () => {
      try {
        await fetch(`/api/admin/notifications/${id}/permanent`, await fetchOptions('DELETE'));
        fetchRecentlyDeleted();
      } catch (err) {
        console.error('Failed to permanently delete:', err);
      }
    });
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/admin/notifications/${id}/read`, await fetchOptions('POST'));
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/admin/notifications/read-all', await fetchOptions('POST'));
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id: number) => {
    showConfirm('Delete this notification?', async () => {
      try {
        await fetch(`/api/admin/notifications/${id}`, await fetchOptions('DELETE'));
        fetchNotifications();
        fetchRecentlyDeleted();
      } catch (err) {
        console.error('Failed to delete notification:', err);
      }
    });
  };

  const handleRoleToggle = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
      // clear selected users when role deselected
      target_user_ids: prev.roles.includes(role) ? prev.target_user_ids.filter(id => {
        // keep only users whose role is still selected — we'll filter after fetching details
        return true;
      }) : prev.target_user_ids,
    }));
  };

  const handleAddUser = (user: { id: number; fullname: string; role: string }) => {
    // Ensure we always keep canonical selected user objects for display.
    if (!formData.target_user_ids.includes(user.id)) {
      setFormData(prev => ({ ...prev, target_user_ids: [...prev.target_user_ids, user.id] }));
    }
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(prev => [...prev, user]);
    }
    setSearchResults([]);
    setUserQuery('');
  };

  const handleRemoveUser = (userId: number) => {
    setFormData(prev => ({ ...prev, target_user_ids: prev.target_user_ids.filter(id => id !== userId) }));
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const searchUsers = async (q: string) => {
    if (!q || q.length < 1) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearchingUsers(true);
      const roleParam = formData.roles.length === 1 ? `&role=${encodeURIComponent(formData.roles[0])}` : '';
      const deptParam = selectedDepartment ? `&department_id=${encodeURIComponent(selectedDepartment)}` : '';
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}${roleParam}${deptParam}`, await fetchOptions('GET'));
      const data = await res.json();
      // normalize: expect array of users
      const users = Array.isArray(data) ? data : (data?.data || []);
      setSearchResults(users.map((u: any) => ({ id: u.id, fullname: u.fullname || u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(), role: u.role || '' })));
    } catch (err) {
      console.error('User search failed', err);
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
  }, [userQuery, formData.roles, selectedDepartment]);

  // load departments for selector
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/departments', await fetchOptions('GET'));
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    })();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const rolesArray = Array.isArray(formData.roles) ? formData.roles : (formData.roles ? [formData.roles] : []);
    const hasSelectedUsers = Array.isArray(formData.target_user_ids) && formData.target_user_ids.length > 0;
    if (!hasSelectedUsers && rolesArray.length === 0) {
      alert('Please select at least one target role or choose specific users.');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/admin/notifications/announce', await fetchOptions('POST', {
        title: formData.title,
        message: formData.message,
        roles: rolesArray,
        course_id: formData.course_id || null,
        department_id: selectedDepartment ? Number(selectedDepartment) : null,
        target_user_ids: formData.target_user_ids && formData.target_user_ids.length > 0 ? formData.target_user_ids : null,
      }));

      const data = await res.json();

      if (res.ok) {
        setSuccessToast({ show: true, count: data.recipients_count });
        setIsModalOpen(false);
        setFormData({ title: '', message: '', roles: [], course_id: '', target_user_ids: [] });
        setSelectedUsers([]);
        setSelectedDepartment('');

        // Refresh sent history from server
        fetchSentAnnouncements();
      } else {
        const msg = data?.message || `Failed to send announcement (status ${res.status})`;
        alert(msg);
      }
    } catch (err) {
      console.error('Failed to send announcement:', err);
      alert('Failed to send announcement');
    } finally {
      setIsSending(false);
    }
  };

  const handlePreview = async () => {
    const rolesArray = Array.isArray(formData.roles) ? formData.roles : (formData.roles ? [formData.roles] : []);
    const hasSelectedUsers = Array.isArray(formData.target_user_ids) && formData.target_user_ids.length > 0;
    if (!hasSelectedUsers && rolesArray.length === 0) {
      alert('Please select at least one target role or choose specific users.');
      return;
    }

    try {
      // Ensure we have a fresh CSRF cookie when not using token fallback
      const payload = {
        title: formData.title,
        message: formData.message,
        roles: rolesArray,
        course_id: formData.course_id || null,
        department_id: selectedDepartment ? Number(selectedDepartment) : null,
        target_user_ids: hasSelectedUsers ? formData.target_user_ids : null,
        preview: true,
      };
      console.debug('Preview announce payload', payload);

      const res = await fetch('/api/admin/notifications/announce', await fetchOptions('POST', payload));

      let data: any = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        const text = await res.text().catch(() => null);
        console.error('Failed to parse preview response JSON', { status: res.status, text });
      }

      if (res.ok) {
        setPreviewModal({ open: true, recipientCount: data?.recipients_count ?? null });
      } else {
        setPreviewModal({ open: true, recipientCount: null, error: data?.message || `Failed to preview recipients (status ${res.status})` });
      }
    } catch (err) {
      console.error('Preview failed:', err);
      setPreviewModal({ open: true, recipientCount: null, error: 'Preview failed' });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Notification System
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
              You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
          <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark All Read
            </button>
          )}
          <button
            onClick={async () => {
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Send Announcement
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('received')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'received'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-100 dark:hover:border-slate-500'
            }`}
          >
            Received ({safeArray(notifications).length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sent'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-100 dark:hover:border-slate-500'
            }`}
          >
            Sent History ({safeArray(sentHistory).length}/{HISTORY_LIMIT})
          </button>
          <button
            onClick={() => setActiveTab('deleted')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'deleted'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-100 dark:hover:border-slate-500'
            }`}
          >
            Recently Deleted ({recentlyDeleted.length})
          </button>
        </nav>
      </div>

      {/* Received Notifications */}
      {activeTab === 'received' && (
        <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <LoadingState message="Loading notifications" className="p-8" />
          ) : safeArray(notifications).length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {safeArray(notifications).map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => setSelectedNotification(notification)}
                  className={`p-4 cursor-pointer transition-colors ${
                    !notification.read_at
                      ? 'bg-emerald-50 dark:bg-emerald-950 border-l-4 border-emerald-500'
                      : 'bg-white dark:bg-slate-900 border-l-4 border-transparent'
                  } hover:bg-slate-100 dark:hover:bg-slate-800`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {notification.data?.from_user_profile_picture ? (
                        <img
                          src={resolveImageUrl(notification.data.from_user_profile_picture)}
                          alt={notification.data.from_user_name || 'User'}
                          className="mt-1 h-10 w-10 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600 flex-shrink-0"
                        />
                      ) : (
                        <div className={`mt-1 p-2 rounded-full flex-shrink-0 ${
                          notification.type === 'announcement' ? 'bg-blue-100 dark:bg-blue-900' :
                          notification.type === 'employee_message' ? 'bg-yellow-100 dark:bg-yellow-900' :
                          ['feedback', 'issue', 'suggestion'].includes(notification.type) ? 'bg-purple-100 dark:bg-purple-900' :
                          'bg-slate-100 dark:bg-slate-700'
                        }`}>
                          {notification.type === 'announcement' ? (
                            <Bell className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                          ) : notification.type === 'employee_message' ? (
                            <Users className="h-4 w-4 text-yellow-600 dark:text-yellow-300" />
                          ) : ['feedback', 'issue', 'suggestion'].includes(notification.type) ? (
                            <Send className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                          {notification.title}
                          {notification.data?.from_user_name && !notification.title.includes('from ') && (
                            <span className="font-normal text-slate-600 dark:text-slate-400">
                              {' '}from {notification.data.from_user_name}
                              {notification.data.from_department ? ` (${notification.data.from_department})` : ''}
                            </span>
                          )}
                          {!notification.read_at && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                              New
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{notification.message}</p>
                        {notification.data?.from_role && (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {notification.data.from_role}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                      {!notification.read_at && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                          title="Mark as read"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sent History */}
      {activeTab === 'sent' && (
        <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {sentHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-300">
              <Send className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-500" />
              <p>No announcements sent yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Message</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Recipients</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {safeArray(sentHistory).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {item.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-200 truncate max-w-xs">
                        {item.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-200">
                        {item.target}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-200">
                        {item.recipients_count} users
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-200">
                        {item.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => deleteSentHistory(item.id)}
                          className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                          title="Move to Recently Deleted"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recently Deleted */}
      {activeTab === 'deleted' && (
        <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {recentlyDeleted.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-300">
              <Archive className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-500" />
              <p>No recently deleted announcements</p>
              <p className="text-xs mt-2 text-slate-400">When sent history exceeds {HISTORY_LIMIT} items, the oldest half will automatically appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Message</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">From/Target</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Deleted Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                  {recentlyDeleted.map((item) => (
                    <tr key={`${item.item_type}-${item.id}`} className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                          item.item_type === 'sent'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        }`}>
                          {item.item_type === 'sent' ? 'Sent' : 'Received'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-200 truncate max-w-xs">
                        {item.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-200">
                        {item.item_type === 'sent'
                          ? (item.target || '-')
                          : (item.data?.from_user_name
                              ? `${item.data.from_user_name}${item.data.from_department ? ` (${item.data.from_department})` : ''}`
                              : '-')
                        }
                        {item.item_type === 'sent' && item.recipients_count && (
                          <span className="ml-1 text-xs text-slate-400">({item.recipients_count} users)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-200">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-200">
                        {new Date(item.deleted_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => item.item_type === 'sent' ? restoreFromDeleted(item.id) : restoreReceivedNotification(item.id)}
                            className="text-slate-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-green-400"
                            title="Restore"
                          >
                            <RotateCcw className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => item.item_type === 'sent' ? permanentlyDelete(item.id) : permanentlyDeleteReceived(item.id)}
                            className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                            title="Permanently Delete"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0 overflow-y-auto">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-y-auto max-h-[90vh] shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="absolute top-4 right-4">
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-slate-900 mb-4">
                  Send Announcement
                </h3>
                <form onSubmit={handleSend} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      placeholder="Announcement title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Message *</label>
                    <textarea
                      rows={4}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      placeholder="Type your announcement here..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Target Audience *
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.roles.length === 3}
                          onChange={() => {
                            const allRoles = ['Instructor', 'Employee', 'Admin'];
                            setFormData(prev => ({
                              ...prev,
                              roles: prev.roles.length === 3 ? [] : allRoles
                            }));
                          }}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded"
                        />
                        <span className="ml-2 text-sm text-slate-700 font-medium">Select All</span>
                      </label>
                      {['Instructor', 'Employee', 'Admin'].map((role) => (
                        <label key={role} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.roles.includes(role)}
                            onChange={() => handleRoleToggle(role)}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded"
                          />
                          <span className="ml-2 text-sm text-slate-700">{role}s</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Department (optional)</label>
                        <select
                          value={selectedDepartment}
                          onChange={(e) => setSelectedDepartment(e.target.value)}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        >
                          <option value="">All departments</option>
                          {departments.map(d => (
                            <option key={d.id} value={String(d.id)}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Search Users (by name)</label>
                        <input
                          type="text"
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                          placeholder="Type a name to search instructors or employees"
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        />
                      {searchResults.length > 0 && (
                        <div className="mt-1 border border-slate-200 rounded bg-white max-h-48 overflow-auto">
                          {searchResults.map(u => (
                            <div key={u.id} className="px-3 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => handleAddUser(u)}>
                              <div className="text-sm font-medium text-slate-900">{u.fullname}</div>
                              <div className="text-xs text-slate-400">{u.role}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedUsers.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedUsers.map(u => (
                            <span key={u.id} className="inline-flex items-center gap-2 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">
                              <span>{u.fullname}</span>
                              <button type="button" onClick={() => handleRemoveUser(u.id)} className="text-slate-400 hover:text-red-600">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 sm:text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePreview}
                      className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 sm:text-sm mr-2"
                    >
                      Preview Recipients
                    </button>
                    <button
                      type="submit"
                      disabled={isSending}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:text-sm"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {isSending ? 'Sending...' : 'Send Announcement'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0 overflow-y-auto">
            <div className="fixed inset-0 transition-opacity bg-slate-900 bg-opacity-75 dark:bg-opacity-90" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-y-auto max-h-[90vh] shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="bg-white dark:bg-slate-800 px-6 py-8">
                {/* Icon and Header */}
                <div className="flex items-start space-x-4 mb-6">
                  <div className={`p-3 rounded-full flex-shrink-0 ${
                    selectedNotification.type === 'announcement' ? 'bg-blue-100 dark:bg-blue-900' :
                    selectedNotification.type === 'employee_message' ? 'bg-yellow-100 dark:bg-yellow-900' :
                    ['feedback', 'issue', 'suggestion'].includes(selectedNotification.type) ? 'bg-purple-100 dark:bg-purple-900' :
                    'bg-slate-100 dark:bg-slate-700'
                  }`}>
                    {selectedNotification.type === 'announcement' ? (
                      <Bell className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    ) : selectedNotification.type === 'employee_message' ? (
                      <Users className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
                    ) : ['feedback', 'issue', 'suggestion'].includes(selectedNotification.type) ? (
                      <Send className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedNotification.title}
                    </h2>
                    {!selectedNotification.read_at && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 mt-2">
                        New
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Message */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">Message</h3>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                    <p className="text-base text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {selectedNotification.message}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Sent On</h3>
                    <p className="text-slate-900 dark:text-white">{formatDate(selectedNotification.created_at)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Type</h3>
                    <p className="text-slate-900 dark:text-white capitalize">{selectedNotification.type.replace('_', ' ')}</p>
                  </div>
                </div>

                {/* Sender Info */}
                {selectedNotification.data?.from_user_name && (
                  <div className="mb-8 pb-8 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">From</h3>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-white">{selectedNotification.data.from_user_name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{selectedNotification.data.from_role}</p>
                      {selectedNotification.data.from_department && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {selectedNotification.data.from_department}
                          </span>
                        </p>
                      )}
                      {selectedNotification.data.course_title && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Course: {selectedNotification.data.course_title}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between">
                  <div className="flex space-x-3">
                    {!selectedNotification.read_at && (
                      <button
                        onClick={() => {
                          markAsRead(selectedNotification.id);
                          setSelectedNotification(null);
                        }}
                        className="inline-flex items-center px-4 py-2 border border-emerald-300 dark:border-emerald-700 rounded-md shadow-sm text-sm font-medium text-emerald-700 dark:text-emerald-200 bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-600">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Read
                      </button>
                    )}
                    <button
                      onClick={() => {
                        deleteNotification(selectedNotification.id);
                        setSelectedNotification(null);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-700 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-200 bg-white dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-slate-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedNotification(null)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm.ConfirmModalRenderer()}

      {/* Preview Recipients Modal */}
      <InfoModal
        open={previewModal.open}
        onClose={() => setPreviewModal({ open: false, recipientCount: null })}
        title={previewModal.error ? 'Preview Failed' : 'Preview Recipients'}
        message={
          previewModal.error
            ? previewModal.error
            : `This announcement will be sent to ${previewModal.recipientCount ?? 'unknown'} recipient${previewModal.recipientCount !== 1 ? 's' : ''}.`
        }
        variant={previewModal.error ? 'error' : 'info'}
        icon={previewModal.error ? undefined : <Users className="w-6 h-6" />}
      />
    </div>
  );
}
