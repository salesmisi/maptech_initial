import React, { useState, useEffect } from 'react';
import useConfirm from '../../hooks/useConfirm';
import { Bell, Send, Eye, Trash2, MessageCircle, AlertCircle, X, User } from 'lucide-react';

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

export function EmployeeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'instructor' | 'admin'>('instructor');
  const [isSending, setIsSending] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);

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

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    fetchEnrolledCourses();
  }, []);

  const fetchEnrolledCourses = async () => {
    try {
      const res = await fetch('/api/employee/courses', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const data = await res.json();
      setEnrolledCourses(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error('Failed to load enrolled courses:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employee/notifications', {
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
      const res = await fetch('/api/employee/notifications/unread-count', {
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
      await fetch(`/api/employee/notifications/${id}/read`, {
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
      await fetch('/api/employee/notifications/read-all', {
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
        await fetch(`/api/employee/notifications/${id}`, {
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

  const openModal = (type: 'instructor' | 'admin') => {
    setModalType(type);
    setFormData({ title: '', message: '', course_id: '', type: type === 'admin' ? 'feedback' : '' });
    setIsModalOpen(true);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (modalType === 'instructor' && !formData.course_id) {
      alert('Please select a course');
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
            title: formData.title,
            message: formData.message,
            type: formData.type,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message || 'Message sent successfully!');
        setIsModalOpen(false);
        setFormData({ title: '', message: '', course_id: '', type: 'feedback' });
      } else {
        alert(data.message || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message');
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

      {/* Notifications List */}
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
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                  !notification.read_at ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`mt-1 p-2 rounded-full ${getNotificationBg(notification.type, notification.data?.from_role)}`}>
                      {getNotificationIcon(notification.type, notification.data?.from_role)}
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
                        {enrolledCourses.map((course) => (
                          <option key={course.id} value={course.id}>{course.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {modalType === 'admin' && (
                    <div>
                      <label htmlFor="notify-type" className="block text-sm font-medium text-slate-700">Type</label>
                      <select
                        id="notify-type"
                        name="type"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      >
                        <option value="feedback">Feedback</option>
                        <option value="issue">Report Issue</option>
                        <option value="suggestion">Suggestion</option>
                      </select>
                    </div>
                  )}
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
    </div>
  );
}
