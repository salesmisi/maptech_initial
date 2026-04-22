import React, { useState, useEffect } from 'react';
import useConfirm from '../../hooks/useConfirm';
import { Bell, Send, Eye, Trash2, MessageCircle, AlertCircle, X, User, RotateCcw, Archive } from 'lucide-react';
import { safeArray, resolveImageUrl } from '../../utils/safe';
import { LoadingState } from '../../components/ui/LoadingState';
import InfoModal from '../../components/InfoModal';
import { sanitizeHtml, RICH_CONTENT_STYLES } from '../../components/RichTextEditor';

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

const NOTIFICATION_LIMIT = 50;

export function EmployeeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'received' | 'deleted'>('received');
  const [visibleCount, setVisibleCount] = useState(5);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'instructor' | 'admin'>('instructor');
  const [isSending, setIsSending] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [employeeDepartment, setEmployeeDepartment] = useState<string>('');
  const [infoModal, setInfoModal] = useState<{ open: boolean; title: string; message: string; variant: 'info' | 'success' | 'warning' | 'error' }>({ open: false, title: '', message: '', variant: 'info' });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    course_id: '',
    type: 'feedback' as string,
  });

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

  const fetchOptions = (method: 'GET' | 'POST', body?: unknown): RequestInit => ({
    method,
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const fetchOptionsWithCsrf = async (method: 'GET' | 'POST', body?: unknown): Promise<RequestInit> => {
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

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    fetchRecentlyDeleted();
    fetchEnrolledCourses();
    fetchEmployeeProfile();
  }, []);

  const fetchEmployeeProfile = async () => {
    try {
      const res = await fetch('/api/profile', fetchOptions('GET'));
      const data = await res.json();
      setEmployeeDepartment(data.department || '');
    } catch (err) {
      console.error('Failed to load employee profile:', err);
    }
  };

  const fetchEnrolledCourses = async () => {
    try {
      const res = await fetch('/api/employee/courses', fetchOptions('GET'));
      const data = await res.json();
      setEnrolledCourses(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error('Failed to load enrolled courses:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employee/notifications', fetchOptions('GET'));
      const data = await res.json();
      setNotifications(safeArray(data?.data ?? data?.notifications?.data));
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/employee/notifications/unread-count', fetchOptions('GET'));
      const data = await res.json();
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/employee/notifications/${id}/read`, fetchOptions('POST'));
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const openNotificationDetail = async (notification: Notification) => {
    setSelectedNotification(notification);
    // Mark as read when opening if not already read
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/employee/notifications/read-all', fetchOptions('POST'));
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const fetchRecentlyDeleted = async () => {
    try {
      const res = await fetch('/api/employee/notifications/recently-deleted', {
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
      await fetch(`/api/employee/notifications/${id}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
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
        await fetch(`/api/employee/notifications/${id}/permanent`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        fetchRecentlyDeleted();
      } catch (err) {
        console.error('Failed to permanently delete notification:', err);
      }
    });
  };

  const deleteNotification = async (id: number) => {
    showConfirm('Delete this notification?', async () => {
      try {
        const xsrf = await getXsrfToken();
        await fetch(`/api/employee/notifications/${id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'X-XSRF-TOKEN': xsrf,
          },
        });
        fetchNotifications();
        fetchRecentlyDeleted();
        fetchUnreadCount();
      } catch (err) {
        console.error('Failed to delete notification:', err);
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
          fetch(`/api/employee/notifications/${n.id}`, {
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

  const openModal = (type: 'instructor' | 'admin') => {
    setModalType(type);
    setFormData({ title: '', message: '', course_id: '', type: type === 'admin' ? 'feedback' : '' });
    setIsModalOpen(true);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (modalType === 'instructor' && !formData.course_id) {
      setInfoModal({ open: true, title: 'Missing Course', message: 'Please select a course', variant: 'warning' });
      return;
    }

    setIsSending(true);
    try {
      const endpoint = modalType === 'instructor'
        ? '/api/employee/notifications/notify-instructor'
        : '/api/employee/notifications/report-admin';

      const body = modalType === 'instructor'
        ? {
            title: formData.title,
            message: formData.message,
            course_id: formData.course_id,
          }
        : {
            message: formData.message,
            type: formData.type,
          };

      const res = await fetch(endpoint, await fetchOptionsWithCsrf('POST', body));

      const data = await res.json();

      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ title: '', message: '', course_id: '', type: 'feedback' });
        setInfoModal({ open: true, title: 'Success', message: data.message || 'Message sent successfully!', variant: 'success' });
      } else {
        setInfoModal({ open: true, title: 'Error', message: data.message || 'Failed to send message', variant: 'error' });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setInfoModal({ open: true, title: 'Error', message: 'Failed to send message', variant: 'error' });
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

  const getNotificationIcon = (type: string, fromRole?: string) => {
    if (fromRole === 'Admin') {
      return <User className="h-4 w-4 text-purple-700 dark:text-purple-300" />;
    }
    if (fromRole === 'Instructor') {
      return <MessageCircle className="h-4 w-4 text-blue-700 dark:text-blue-300" />;
    }
    switch (type) {
      case 'announcement':
        return <Bell className="h-4 w-4 text-blue-700 dark:text-blue-300" />;
      case 'quiz_reminder':
        return <AlertCircle className="h-4 w-4 text-orange-700 dark:text-orange-300" />;
      default:
        return <Bell className="h-4 w-4 text-slate-700 dark:text-slate-300" />;
    }
  };

  const getNotificationBg = (type: string, fromRole?: string) => {
    if (fromRole === 'Admin') return 'bg-purple-100 dark:bg-purple-900/50';
    if (fromRole === 'Instructor') return 'bg-blue-100 dark:bg-blue-900/50';
    switch (type) {
      case 'announcement':
        return 'bg-blue-100 dark:bg-blue-900/50';
      case 'quiz_reminder':
        return 'bg-orange-100 dark:bg-orange-900/50';
      default:
        return 'bg-slate-100 dark:bg-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
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
              className="inline-flex items-center px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Mark All Read
            </button>
          )}
          <button
            onClick={() => openModal('instructor')}
            className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Message Instructor
          </button>
          <button
            onClick={() => openModal('admin')}
            className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
          >
            <Send className="h-4 w-4 mr-2" />
            Report to Admin
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
              <p className="text-sm mt-2">You'll receive notifications from instructors and admin here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {notifications.slice(0, visibleCount).map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => openNotificationDetail(notification)}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                    !notification.read_at ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-white dark:bg-slate-900'
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
                        <div className={`mt-1 p-2 rounded-full ${getNotificationBg(notification.type, notification.data?.from_role)}`}>
                          {getNotificationIcon(notification.type, notification.data?.from_role)}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {notification.title}
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
                        {notification.data?.from_user_name && (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            From: {notification.data.from_user_name} ({notification.data.from_role})
                            {notification.data.course_title && ` • ${notification.data.course_title}`}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!notification.read_at && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                          className="text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300"
                          title="Mark as read"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete notification"
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
                        <div className={`mt-1 p-2 rounded-full opacity-60 ${getNotificationBg(notification.type, notification.data?.from_role)}`}>
                          {getNotificationIcon(notification.type, notification.data?.from_role)}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {notification.title}
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
                        {notification.data?.from_user_name && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            From: {notification.data.from_user_name} ({notification.data.from_role})
                            {notification.data.course_title && ` • ${notification.data.course_title}`}
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

      {/* Send Message Modal */}
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
                  {modalType === 'instructor' ? (
                    <>
                      <MessageCircle className="h-5 w-5 inline mr-2 text-blue-600" />
                      Message Course Instructor
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 inline mr-2 text-purple-600" />
                      Report to Admin
                    </>
                  )}
                </h3>
                <form onSubmit={handleSend} className="space-y-4">
                  {modalType === 'instructor' && (
                    <div>
                      <label htmlFor="notify-course" className="block text-sm font-medium text-slate-700">Course *</label>
                      <select
                        id="notify-course"
                        name="course_id"
                        required
                        value={formData.course_id}
                        onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      >
                        <option value="">Select a course</option>
                        {safeArray(enrolledCourses).map((course) => (
                          <option key={course.id} value={course.id}>{course.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {modalType === 'admin' && (
                    <>
                      <div>
                        <label htmlFor="notify-type" className="block text-sm font-medium text-slate-700">Type</label>
                        <select
                          id="notify-type"
                          name="type"
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        >
                          <option value="feedback">Feedback</option>
                          <option value="issue">Report Issue</option>
                          <option value="suggestion">Suggestion</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Department</label>
                        <div className="mt-1 block w-full border border-slate-200 bg-slate-50 rounded-md py-2 px-3 text-sm text-slate-600">
                          {employeeDepartment || 'No department assigned'}
                        </div>
                      </div>
                    </>
                  )}
                  {modalType === 'instructor' && (
                    <div>
                      <label htmlFor="notify-title" className="block text-sm font-medium text-slate-700">Subject *</label>
                      <input
                        id="notify-title"
                        name="title"
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        placeholder="Message subject"
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="notify-message" className="block text-sm font-medium text-slate-700">Message *</label>
                    <textarea
                      id="notify-message"
                      name="message"
                      rows={4}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      placeholder="Type your message here..."
                    />
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
                      className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white disabled:opacity-50 sm:text-sm ${
                        modalType === 'instructor' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                      }`}
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

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
              onClick={() => setSelectedNotification(null)}
            >
              <div className="absolute inset-0 bg-slate-500 dark:bg-slate-900 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6">
                {/* Header */}
                <div className="flex items-start space-x-3 mb-4">
                  {selectedNotification.data?.from_user_profile_picture ? (
                    <img
                      src={resolveImageUrl(selectedNotification.data.from_user_profile_picture)}
                      alt={selectedNotification.data.from_user_name || 'User'}
                      className="h-12 w-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                    />
                  ) : (
                    <div className={`p-3 rounded-full ${getNotificationBg(selectedNotification.type, selectedNotification.data?.from_role)}`}>
                      {getNotificationIcon(selectedNotification.type, selectedNotification.data?.from_role)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {selectedNotification.title}
                    </h3>
                    {selectedNotification.data?.from_user_name && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        From: <span className="font-medium">{selectedNotification.data.from_user_name}</span>
                        {selectedNotification.data.from_role && (
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            selectedNotification.data.from_role === 'Admin'
                              ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200'
                              : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                          }`}>
                            {selectedNotification.data.from_role}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Course info if available */}
                {selectedNotification.data?.course_title && (
                  <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Related Course</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedNotification.data.course_title}</p>
                  </div>
                )}

                {/* Message content */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Message</p>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
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

                {/* Date */}
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sent On</p>
                    <p className="text-sm text-slate-900 dark:text-slate-100">{formatDate(selectedNotification.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sent By</p>
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      {selectedNotification.data?.from_user_name
                        ? `${selectedNotification.data.from_user_name}${selectedNotification.data.from_role ? ` (${selectedNotification.data.from_role})` : ''}`
                        : (selectedNotification.data?.from_role || 'System')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sent To</p>
                    <p className="text-sm text-slate-900 dark:text-slate-100">Employee</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Department</p>
                    <p className="text-sm text-slate-900 dark:text-slate-100">{selectedNotification.data?.from_department || employeeDepartment || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Type</p>
                    <p className="text-sm text-slate-900 dark:text-slate-100 capitalize">{selectedNotification.type.replace(/_/g, ' ')}</p>
                  </div>
                  {selectedNotification.deleted_at && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Deleted On</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{formatDate(selectedNotification.deleted_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-3 sm:px-6 flex justify-end">
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal for success/error messages */}
      <InfoModal
        open={infoModal.open}
        onClose={() => setInfoModal({ ...infoModal, open: false })}
        title={infoModal.title}
        message={infoModal.message}
        variant={infoModal.variant}
      />
      {confirm.ConfirmModalRenderer()}
    </div>
  );
}
