import React, { useState, useEffect } from 'react';
import useConfirm from '../../hooks/useConfirm';
import { Bell, Send, Eye, Trash2, Users, AlertCircle, X, MessageCircle } from 'lucide-react';
import { safeArray } from '../../utils/safe';
import { LoadingState } from '../../components/ui/LoadingState';

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

interface Course {
  id: string;
  title: string;
}

interface FormData {
  title: string;
  message: string;
  course_id: string;
  department_id: string | number;
  type: string;
}

export function InstructorNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<{id:number;name:string}[]>([]);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    message: '',
    course_id: '',
    department_id: '',
    type: 'announcement',
  });

  const token = localStorage.getItem('token');
  const confirm = useConfirm();
  const { showConfirm } = confirm;

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
      setNotifications(data.notifications?.data || []);
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
    try {
      await fetch(`/api/instructor/notifications/${id}/read`, fetchOptions('POST'));
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/instructor/notifications/read-all', fetchOptions('POST'));
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id: number) => {
    showConfirm('Delete this notification?', async () => {
      try {
        await fetch(`/api/instructor/notifications/${id}`, {
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

  const handleSendToEmployees = async (e: React.FormEvent) => {
    e.preventDefault();

    // allow either department or course selection
    if (!formData.course_id && !formData.department_id) {
      alert('Please select a department or a course');
      return;
    }

    setIsSending(true);
    try {
      const payload: any = {
        title: formData.title,
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
        alert(`Notification sent to ${data.recipients_count} enrolled employees!`);
        setIsModalOpen(false);
        setFormData({ title: '', message: '', course_id: '', department_id: '', type: 'announcement' });
      } else {
        alert(data.message || 'Failed to send notification');
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
      alert('Failed to send notification');
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
          {unreadCount > 0 && (
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
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <LoadingState message="Loading notifications" className="p-8" />
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-300">
            <Bell className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-500" />
            <p>No notifications yet</p>
            <p className="text-sm mt-2">You'll receive notifications from employees here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                  !notification.read_at ? 'bg-emerald-50 dark:bg-emerald-950/35' : 'bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`mt-1 p-2 rounded-full ${getNotificationBg(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {notification.title}
                        {!notification.read_at && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                            New
                          </span>
                        )}
                      </h3>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{notification.message}</p>
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
      </div>

      {/* Send to Employees Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-900/70"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-slate-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200 dark:border-slate-700">
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
                    <label htmlFor="notify-title" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Title *</label>
                    <input
                      id="notify-title"
                      name="title"
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      placeholder="Notification title"
                    />
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
      {confirm.ConfirmModalRenderer()}
    </div>
  );
}
