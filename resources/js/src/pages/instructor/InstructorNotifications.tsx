import React, { useState, useEffect } from 'react';
import useConfirm from '../../hooks/useConfirm';
import { Bell, Send, Eye, Trash2, Users, AlertCircle, X, MessageCircle, RotateCcw, Archive, CheckCircle, Shield } from 'lucide-react';
import { safeArray, resolveImageUrl } from '../../utils/safe';
import { LoadingState } from '../../components/ui/LoadingState';
import { useToast } from '../../components/ToastProvider';
import { sanitizeHtml, RICH_CONTENT_STYLES } from '../../components/RichTextEditor';

// Helper to get cookie value
const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

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
    image_url?: string | null;
    image_urls?: string[];
  } | null;
  read_at: string | null;
  created_at: string;
  deleted_at?: string | null;
}

interface Course {
  id: string;
  title: string;
}

interface FormData {
  message: string;
  course_id: string;
  department_id: string | number;
  type: string;
}

const NOTIFICATION_LIMIT = 50;
const PENDING_NOTIFICATION_ID_KEY = 'maptech_pending_notification_id';
const PENDING_NOTIFICATION_ROLE_KEY = 'maptech_pending_notification_role';
const OPEN_NOTIFICATION_EVENT = 'maptech-open-notification';

function extractNotificationItems(payload: any): Notification[] {
  const candidates = [
    payload,
    payload?.data,
    payload?.notifications,
    payload?.notifications?.data,
    payload?.data?.data,
    payload?.notifications?.data?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

export function InstructorNotifications() {
    const tryOpenPendingNotification = React.useCallback(() => {
      const pendingIdRaw = localStorage.getItem(PENDING_NOTIFICATION_ID_KEY);
      const pendingRole = localStorage.getItem(PENDING_NOTIFICATION_ROLE_KEY);
      if (!pendingIdRaw || pendingRole !== 'Instructor') return;

      const pendingId = Number(pendingIdRaw);
      if (!Number.isFinite(pendingId)) {
        localStorage.removeItem(PENDING_NOTIFICATION_ID_KEY);
        localStorage.removeItem(PENDING_NOTIFICATION_ROLE_KEY);
        return;
      }

      const target = notifications.find((item) => item.id === pendingId);
      if (!target) return;

      setActiveTab('received');
      setSelectedNotification(target);
      localStorage.removeItem(PENDING_NOTIFICATION_ID_KEY);
      localStorage.removeItem(PENDING_NOTIFICATION_ROLE_KEY);

      if (!target.read_at) {
        markAsRead(target.id);
      }
    }, [notifications]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<{id:number;name:string}[]>([]);
  const [activeTab, setActiveTab] = useState<'received' | 'deleted'>('received');
  const [visibleCount, setVisibleCount] = useState(5);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const [formData, setFormData] = useState<FormData>({
    message: '',
    course_id: '',
    department_id: '',
    type: 'announcement',
  });

  const [adminFormData, setAdminFormData] = useState({
    message: '',
    type: 'report',
  });

  const token = localStorage.getItem('token');
  const confirm = useConfirm();
  const { showConfirm } = confirm;
  const { pushToast } = useToast();

  const fetchOptions = (method: 'GET' | 'POST', body?: unknown): RequestInit => ({
    method,
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    fetchRecentlyDeleted();
    fetchCourses();
    fetchDepartments();

    // Subscribe to realtime notifications if Echo is available
    (async () => {
      try {
        const Echo = (window as any).Echo;
        if (!Echo || typeof Echo.private !== 'function') return;
        // Try to fetch current user id (token auth may work via Bearer)
        const res = await fetch('/user', { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } });
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

        return () => {
          try { channel.stopListening('NotificationCreated'); channel.stopListening('NotificationCountUpdated'); } catch (e) {}
        };
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      // no-op cleanup
    };
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/instructor/courses', fetchOptions('GET'));
      const data = await res.json();
      setCourses(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments', { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } });
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/instructor/notifications', fetchOptions('GET'));
      const data = await res.json();
      setNotifications(extractNotificationItems(data));
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/instructor/notifications/unread-count', fetchOptions('GET'));
      const data = await res.json();
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  const markAsRead = async (id: number) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.read_at) return;

    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
    );
    setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));

    try {
      await fetch(`/api/instructor/notifications/${id}/read`, fetchOptions('POST'));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) =>
      prev.map((item) => (item.read_at ? item : { ...item, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await fetch('/api/instructor/notifications/read-all', fetchOptions('POST'));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  useEffect(() => {
    tryOpenPendingNotification();
  }, [notifications, tryOpenPendingNotification]);

  useEffect(() => {
    const handler = () => tryOpenPendingNotification();
    window.addEventListener(OPEN_NOTIFICATION_EVENT, handler);
    return () => window.removeEventListener(OPEN_NOTIFICATION_EVENT, handler);
  }, [tryOpenPendingNotification]);

  const deleteNotification = async (id: number) => {
    showConfirm('Delete this notification?', async () => {
      try {
        // Fetch CSRF cookie first
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
        const xsrfToken = getCookie('XSRF-TOKEN');

        await fetch(`/api/instructor/notifications/${id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
          },
        });
        fetchNotifications();
        fetchRecentlyDeleted();
      } catch (err) {
        console.error('Failed to delete notification:', err);
      }
    });
  };

  const fetchRecentlyDeleted = async () => {
    try {
      const res = await fetch('/api/instructor/notifications/recently-deleted', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const data = await res.json();
      setRecentlyDeleted(data.recently_deleted || []);
    } catch (err) {
      console.error('Failed to load recently deleted:', err);
    }
  };

  const restoreNotification = async (id: number) => {
    try {
      // Fetch CSRF cookie first
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');

      await fetch(`/api/instructor/notifications/${id}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
        },
      });
      fetchNotifications();
      fetchRecentlyDeleted();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to restore notification:', err);
    }
  };

  const permanentlyDeleteNotification = async (id: number) => {
    showConfirm('Permanently delete this notification? This cannot be undone.', async () => {
      try {
        // Fetch CSRF cookie first
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
        const xsrfToken = getCookie('XSRF-TOKEN');

        await fetch(`/api/instructor/notifications/${id}/permanent`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
          },
        });
        fetchRecentlyDeleted();
      } catch (err) {
        console.error('Failed to permanently delete notification:', err);
      }
    });
  };

  // Auto-cleanup: when notifications exceed limit, delete oldest half
  useEffect(() => {
    if (notifications.length > NOTIFICATION_LIMIT) {
      const sortedByDate = [...notifications].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const toDelete = sortedByDate.slice(0, Math.floor(notifications.length / 2));

      // Delete oldest half
      Promise.all(
        toDelete.map(n =>
          fetch(`/api/instructor/notifications/${n.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          })
        )
      ).then(() => {
        fetchNotifications();
        fetchRecentlyDeleted();
      });
    }
  }, [notifications.length]);

  const handleSendToEmployees = async (e: React.FormEvent) => {
    e.preventDefault();

    // allow either department or course selection
    if (!formData.course_id && !formData.department_id) {
      pushToast('Missing Selection', 'Please select a department or a course', 'warning');
      return;
    }

    // Auto-generate title from type
    const typeLabels: Record<string, string> = {
      announcement: 'Announcement',
      lesson_update: 'Lesson Update',
      quiz_reminder: 'Quiz Reminder',
    };
    const title = typeLabels[formData.type] || 'Announcement';

    setIsSending(true);
    try {
      const payload: any = {
        title: title,
        message: formData.message,
        type: formData.type,
      };
      if (formData.course_id) payload.course_id = formData.course_id;
      if (formData.department_id) payload.department_id = formData.department_id;

      const res = await fetch('/api/instructor/notifications/notify-employees', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        pushToast('Sent Successfully', `Notification sent to ${data.recipients_count} enrolled employees!`, 'success');
        setIsModalOpen(false);
        setFormData({ message: '', course_id: '', department_id: '', type: 'announcement' });
      } else {
        pushToast('Failed', data.message || 'Failed to send notification', 'error');
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
      pushToast('Error', 'Failed to send notification', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminFormData.message.trim()) {
      pushToast('Missing Message', 'Please fill in the message', 'warning');
      return;
    }

    // Auto-generate title from type
    const typeLabels: Record<string, string> = {
      report: 'Report',
      feedback: 'Feedback',
      issue: 'Issue',
      suggestion: 'Suggestion',
    };
    const title = typeLabels[adminFormData.type] || 'Report';

    setIsSending(true);
    try {
      // Fetch CSRF cookie first
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });

      // Get XSRF token from cookie
      const xsrfToken = getCookie('XSRF-TOKEN');

      const res = await fetch('/api/instructor/notifications/notify-admin', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
        },
        body: JSON.stringify({ ...adminFormData, title }),
      });

      const data = await res.json();

      if (res.ok) {
        pushToast('Sent Successfully', `Notification sent to ${data.recipients_count} admin(s)!`, 'success');
        setIsAdminModalOpen(false);
        setAdminFormData({ message: '', type: 'report' });
      } else {
        pushToast('Failed', data.message || 'Failed to send notification', 'error');
      }
    } catch (err) {
      console.error('Failed to send notification to admin:', err);
      pushToast('Error', 'Failed to send notification', 'error');
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

  const messagePreviewText = (value: string) => {
    const html = String(value || '');
    if (!html) return '';
    const plain = new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
    return plain.replace(/\s+/g, ' ').trim();
  };

  const getNotificationImages = (notification: Notification) => {
    return notification.data?.image_urls?.length
      ? notification.data.image_urls
      : (notification.data?.image_url ? [notification.data.image_url] : []);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'announcement':
        return <Bell className="h-4 w-4 text-blue-700 dark:text-blue-300" />;
      case 'employee_message':
        return <MessageCircle className="h-4 w-4 text-yellow-700 dark:text-yellow-300" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-700 dark:text-slate-300" />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'announcement':
        return 'bg-blue-100 dark:bg-blue-900/50';
      case 'employee_message':
        return 'bg-yellow-100 dark:bg-yellow-900/50';
      default:
        return 'bg-slate-100 dark:bg-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
              You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && activeTab === 'received' && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Mark All Read
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <Users className="h-4 w-4 mr-2" />
            Notify Employees
          </button>
          <button
            onClick={() => setIsAdminModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <Shield className="h-4 w-4 mr-2" />
            Notify Admin
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
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
            }`}
          >
            <Bell className="h-4 w-4 inline mr-2" />
            Received ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('deleted')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'deleted'
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
            }`}
          >
            <Archive className="h-4 w-4 inline mr-2" />
            Recently Deleted ({recentlyDeleted.length})
          </button>
        </nav>
      </div>

      {/* Received Notifications List */}
      {activeTab === 'received' && (
        <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-300">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-300">
              <Bell className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-500" />
              <p>No notifications yet</p>
              <p className="text-sm mt-2">You'll receive notifications from employees here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {notifications.slice(0, visibleCount).map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => setSelectedNotification(notification)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    !notification.read_at ? 'bg-emerald-50 dark:bg-emerald-950/35' : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {notification.data?.from_user_profile_picture ? (
                        <img
                          src={resolveImageUrl(notification.data.from_user_profile_picture)}
                          alt={notification.data.from_user_name || 'User'}
                          className="mt-1 h-10 w-10 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                        />
                      ) : (
                        <div className={`mt-1 p-2 rounded-full ${getNotificationBg(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {notification.title}
                          {notification.data?.from_user_name && !notification.title.includes('from ') && (
                            <span className="font-normal text-slate-600 dark:text-slate-400">
                              {' '}from {notification.data.from_user_name}
                              {notification.data.course_title ? ` (${notification.data.course_title})` : ''}
                            </span>
                          )}
                          {!notification.read_at && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                              New
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{messagePreviewText(notification.message)}</p>
                        {getNotificationImages(notification).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {getNotificationImages(notification).slice(0, 3).map((imgUrl) => (
                              <img
                                key={imgUrl}
                                src={resolveImageUrl(imgUrl)}
                                alt="Announcement attachment"
                                className="h-16 w-16 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                              />
                            ))}
                          </div>
                        )}
                        {notification.data?.from_role && (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {notification.data.from_role}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                      {!notification.read_at && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300"
                          title="Mark as read"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-300"
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
          {!loading && notifications.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + 5)}
              className="w-full py-3 text-sm text-green-600 dark:text-green-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-200 dark:border-slate-700 transition-colors font-medium"
            >
              See previous notifications ({notifications.length - visibleCount} more)
            </button>
          )}
        </div>
      )}

      {/* Recently Deleted Notifications List */}
      {activeTab === 'deleted' && (
        <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {recentlyDeleted.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-300">
              <Archive className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-500" />
              <p>No recently deleted notifications</p>
              <p className="text-sm mt-2">Deleted notifications will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {recentlyDeleted.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => setSelectedNotification(notification)}
                  className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {notification.data?.from_user_profile_picture ? (
                        <img
                          src={resolveImageUrl(notification.data.from_user_profile_picture)}
                          alt={notification.data.from_user_name || 'User'}
                          className="mt-1 h-10 w-10 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600 opacity-60"
                        />
                      ) : (
                        <div className={`mt-1 p-2 rounded-full opacity-60 ${getNotificationBg(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {notification.title}
                          {notification.data?.from_user_name && !notification.title.includes('from ') && (
                            <span className="font-normal text-slate-500 dark:text-slate-400">
                              {' '}from {notification.data.from_user_name}
                              {notification.data.course_title ? ` (${notification.data.course_title})` : ''}
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{messagePreviewText(notification.message)}</p>
                        {getNotificationImages(notification).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 opacity-80">
                            {getNotificationImages(notification).slice(0, 3).map((imgUrl) => (
                              <img
                                key={imgUrl}
                                src={resolveImageUrl(imgUrl)}
                                alt="Announcement attachment"
                                className="h-16 w-16 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                              />
                            ))}
                          </div>
                        )}
                        {notification.data?.from_role && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {notification.data.from_role}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Deleted: {notification.deleted_at ? formatDate(notification.deleted_at) : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); restoreNotification(notification.id); }}
                        className="text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-300"
                        title="Restore"
                      >
                        <RotateCcw className="h-5 w-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); permanentlyDeleteNotification(notification.id); }}
                        className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-300"
                        title="Delete permanently"
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

      {/* Send to Employees Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0 overflow-y-auto">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-900/70"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-slate-900 rounded-lg text-left overflow-y-auto max-h-[90vh] shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200 dark:border-slate-700">
              <div className="absolute top-4 right-4">
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="bg-white dark:bg-slate-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-slate-900 dark:text-slate-100 mb-4">
                  <Users className="h-5 w-5 inline mr-2" />
                  Notify Enrolled Employees
                </h3>
                <form onSubmit={handleSendToEmployees} className="space-y-4">
                  <div>
                    <label htmlFor="notify-department" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Department *</label>
                    <select
                      id="notify-department"
                      name="department_id"
                      value={(formData as any).department_id ?? ''}
                      onChange={(e) => setFormData({ ...formData, course_id: '', department_id: e.target.value ? Number(e.target.value) : '' })}
                      className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    >
                      <option value="">Select a department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Notification will be sent to all enrolled employees across courses in this department (where you have access)
                    </p>
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-300">Or choose a specific course below:</div>
                    <select
                      id="notify-course"
                      name="course_id"
                      value={formData.course_id}
                      onChange={(e) => setFormData({ ...formData, course_id: e.target.value, department_id: '' })}
                      className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    >
                      <option value="">Select a course (optional)</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="notify-type" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Type</label>
                    <select
                      id="notify-type"
                      name="type"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    >
                      <option value="announcement">Announcement</option>
                      <option value="lesson_update">Lesson Update</option>
                      <option value="quiz_reminder">Quiz Reminder</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="notify-message" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Message *</label>
                    <textarea
                      id="notify-message"
                      name="message"
                      rows={4}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      placeholder="Type your message here..."
                    />
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 sm:text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSending}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:text-sm"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send to Admin Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsAdminModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <button
              onClick={() => setIsAdminModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Contact Admin</h3>
            </div>

            <form onSubmit={handleSendToAdmin} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {['report', 'feedback', 'issue', 'suggestion'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAdminFormData({ ...adminFormData, type })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                      adminFormData.type === type
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <textarea
                name="message"
                rows={4}
                required
                value={adminFormData.message}
                onChange={(e) => setAdminFormData({ ...adminFormData, message: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                placeholder="Write your message to admin..."
              />

              <button
                type="submit"
                disabled={isSending || !adminFormData.message.trim()}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="h-4 w-4" />
                {isSending ? 'Sending...' : 'Send to Admin'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0 overflow-y-auto">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div
                className="absolute inset-0 bg-slate-900/70"
                onClick={() => setSelectedNotification(null)}
              ></div>
            </div>
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
                  {selectedNotification.data?.from_user_profile_picture ? (
                    <img
                      src={resolveImageUrl(selectedNotification.data.from_user_profile_picture)}
                      alt={selectedNotification.data.from_user_name || 'User'}
                      className="h-14 w-14 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                    />
                  ) : (
                    <div className={`p-3 rounded-full flex-shrink-0 ${getNotificationBg(selectedNotification.type)}`}>
                      {getNotificationIcon(selectedNotification.type)}
                    </div>
                  )}
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
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <div
                      className={RICH_CONTENT_STYLES}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedNotification.message || '') }}
                    />
                    {(() => {
                      const images = selectedNotification.data?.image_urls?.length
                        ? selectedNotification.data.image_urls
                        : (selectedNotification.data?.image_url ? [selectedNotification.data.image_url] : []);
                      if (images.length === 0) return null;
                      return (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {images.map((imgUrl) => (
                            <img
                              key={imgUrl}
                              src={resolveImageUrl(imgUrl)}
                              alt="Announcement attachment"
                              className="max-h-80 w-auto max-w-full rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Details */}
                <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Sent On</h3>
                    <p className="text-slate-900 dark:text-white">{formatDate(selectedNotification.created_at)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Sent By</h3>
                    <p className="text-slate-900 dark:text-white">
                      {selectedNotification.data?.from_user_name
                        ? `${selectedNotification.data.from_user_name}${selectedNotification.data.from_role ? ` (${selectedNotification.data.from_role})` : ''}`
                        : (selectedNotification.data?.from_role || 'System')}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Sent To</h3>
                    <p className="text-slate-900 dark:text-white">Instructor</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Department</h3>
                    <p className="text-slate-900 dark:text-white">{selectedNotification.data?.from_department || 'Not specified'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Type</h3>
                    <p className="text-slate-900 dark:text-white capitalize">{selectedNotification.type.replace(/_/g, ' ')}</p>
                  </div>
                  {selectedNotification.deleted_at && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Deleted On</h3>
                      <p className="text-slate-900 dark:text-white">{formatDate(selectedNotification.deleted_at)}</p>
                    </div>
                  )}
                </div>

                {/* Sender Info */}
                {selectedNotification.data?.from_user_name && (
                  <div className="mb-8 pb-8 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">From</h3>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-white">{selectedNotification.data.from_user_name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{selectedNotification.data.from_role}</p>
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
                          setSelectedNotification({ ...selectedNotification, read_at: new Date().toISOString() });
                        }}
                        className="inline-flex items-center px-4 py-2 border border-emerald-300 dark:border-emerald-700 rounded-md shadow-sm text-sm font-medium text-emerald-700 dark:text-emerald-200 bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-600"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Read
                      </button>
                    )}
                    <button
                      onClick={() => {
                        deleteNotification(selectedNotification.id);
                        setSelectedNotification(null);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-700 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-200 bg-white dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-slate-600"
                    >
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
    </div>
  );
}
