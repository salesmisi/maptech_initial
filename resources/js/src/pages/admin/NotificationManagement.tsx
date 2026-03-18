import React, { useState, useEffect } from 'react';
import useConfirm from '../../hooks/useConfirm';
import { Bell, Send, Clock, CheckCircle, Plus, Trash2, Eye, Users, AlertCircle, X } from 'lucide-react';

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

export function NotificationManagement() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sentHistory, setSentHistory] = useState<SentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');

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

  const token = localStorage.getItem('token');
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

  // Load notifications
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const data = await res.json();
      setNotifications(data.notifications?.data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/admin/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const data = await res.json();
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/admin/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/admin/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id: number) => {
    showConfirm('Delete this notification?', async () => {
      try {
        await fetch(`/api/admin/notifications/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        fetchNotifications();
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
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}${roleParam}${deptParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
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
    fetch('/api/departments')
      .then(res => res.json())
      .then(data => setDepartments(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load departments:', err));
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.roles.length === 0) {
      alert('Please select at least one target audience');
      return;
    }

    setIsSending(true);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch('/api/admin/notifications/announce', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          roles: formData.roles,
          course_id: formData.course_id || null,
            department_id: selectedDepartment ? Number(selectedDepartment) : null,
          target_user_ids: formData.target_user_ids && formData.target_user_ids.length > 0 ? formData.target_user_ids : null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Announcement sent to ${data.recipients_count} users!`);
        setIsModalOpen(false);
        setFormData({ title: '', message: '', roles: [], course_id: '', target_user_ids: [] });

        // Add to sent history
        setSentHistory(prev => [{
          id: Date.now(),
          title: formData.title,
          message: formData.message,
          target: formData.target_user_ids && formData.target_user_ids.length > 0 ? `Users: ${formData.target_user_ids.length}` : formData.roles.join(', '),
          date: new Date().toISOString().split('T')[0],
          status: 'Sent',
          recipients_count: data.recipients_count,
        }, ...prev]);
      } else {
        alert(data.message || 'Failed to send announcement');
      }
    } catch (err) {
      console.error('Failed to send announcement:', err);
      alert('Failed to send announcement');
    } finally {
      setIsSending(false);
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
          <h1 className="text-2xl font-bold text-slate-900">
            Notification System
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-slate-500 mt-1">
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
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Send Announcement
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('received')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'received'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Received ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sent'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Sent History ({sentHistory.length})
          </button>
        </nav>
      </div>

      {/* Received Notifications */}
      {activeTab === 'received' && (
        <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-slate-50 transition-colors ${
                    !notification.read_at ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`mt-1 p-2 rounded-full ${
                        notification.type === 'announcement' ? 'bg-blue-100' :
                        notification.type === 'employee_message' ? 'bg-yellow-100' :
                        'bg-slate-100'
                      }`}>
                        {notification.type === 'announcement' ? (
                          <Bell className="h-4 w-4 text-blue-600" />
                        ) : notification.type === 'employee_message' ? (
                          <Users className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-slate-900">
                          {notification.title}
                          {!notification.read_at && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              New
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                        {notification.data?.from_user_name && (
                          <p className="mt-1 text-xs text-slate-400">
                            From: {notification.data.from_user_name} ({notification.data.from_role})
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!notification.read_at && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-slate-400 hover:text-green-600"
                          title="Mark as read"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-slate-400 hover:text-red-600"
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
        <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
          {sentHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Send className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No announcements sent yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Message</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Recipients</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {sentHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {item.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-xs">
                        {item.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {item.target}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {item.recipients_count} users
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {item.date}
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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
      {confirm.ConfirmModalRenderer()}
    </div>
  );
}
