import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import {
  BookOpen,
  Clock,
  Award,
  CheckCircle,
  PlayCircle,
  ArrowRight,
  Bell,
  FileQuestion,
} from 'lucide-react';
import { UserTimeLog } from '../../components/UserTimeLog';

const API_BASE = '/api';

interface Course {
  id: string;
  title: string;
  progress: number;
  nextLesson: string;
  thumbnail: string;
  enroll_status: string | null;
  last_activity: string | null;
}

interface DashboardData {
  user: {
    id: number;
    name: string;
    email: string;
    department: string;
  };
  courses: Course[];
  total_courses: number;
}

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  data: any;
  course_id: string | null;
  module_id: number | null;
  read: boolean;
  created_at: string;
}

const upcomingDeadlines = [
{
  id: 1,
  title: 'Cybersecurity Quiz',
  date: 'Due Tomorrow',
  type: 'Quiz'
},
{
  id: 2,
  title: 'Leadership Reflection',
  date: 'Due in 3 days',
  type: 'Assignment'
}];

interface EmployeeDashboardProps {
  onNavigate?: (page: string, courseId?: string) => void;
}

export function EmployeeDashboard({ onNavigate }: EmployeeDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const lastUnreadRef = React.useRef<number>(0);
  const { pushToast } = useToast();

  const loadNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/employee/notifications`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        // API may return an object with `{ data: [...] }` or the array directly.
        const list = Array.isArray(data) ? data : (data?.data || []);
        setNotifications(list);
        return list;
      }
      return [];
    } catch (err) {
      console.error('Failed to load notifications:', err);
      return [];
    }
  };

  const loadQuizReminders = async () => {
    try {
      const res = await fetch(`${API_BASE}/employee/quiz-reminders?hours=48`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return [];

      // Show toasts for each reminder via global toast provider
      data.forEach((r: any) => {
        const title = `Quiz due soon: ${r.title}`;
        const dateText = r.deadline ? new Date(r.deadline).toLocaleString() : 'Soon';
        pushToast(title, `${r.course_title} • Due ${dateText}`, 'info', 8000);
      });

      return data;
    } catch (err) {
      // ignore
      return [];
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[2]) : '';
      };
      const xsrf = getCookie('XSRF-TOKEN');
      await fetch(`${API_BASE}/employee/notifications/${id}/read`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': xsrf },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch(`${API_BASE}/employee/dashboard`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load dashboard');
        }

        const data = await response.json();

        // Map courses to include thumbnail colors
        const coursesArr = data.courses || [];
        const mappedCourses = coursesArr.map((course: any) => ({
          id: course.id,
          title: course.title,
          progress: course.my_progress ?? course.progress ?? 0,
          nextLesson: course.modules?.[0]?.title || 'Start Learning',
          thumbnail: getThumbnailColor(course.department),
          enroll_status: course.enroll_status ?? null,
          last_activity: course.last_activity ?? null,
        }));


        setDashboardData({
          user: (data && data.user) ? data.user : { id: 0, name: 'Employee', email: '', department: '' },
          courses: mappedCourses,
          total_courses: mappedCourses.length,
        });
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    const handles: any = {};
    const runAsync = async () => {
      await loadDashboard();
      const initial = await loadNotifications();
      await loadQuizReminders();
      // initialize last unread count after initial load
      lastUnreadRef.current = (initial || []).filter((n: any) => !n.read).length;
      // Subscribe to realtime notifications channel (if Echo is available)
      try {
        const Echo = (window as any).Echo;
        if (Echo && typeof Echo.private === 'function' && data?.user?.id) {
          const notifChannel = Echo.private('notifications.' + data.user.id);
          const createdHandler = (payload: any) => {
            const n = payload?.notification || payload;
            if (!n) return;
            setNotifications(prev => [n, ...prev.filter(p => p.id !== n.id)]);
            pushToast(n.title, n.message, 'info', 6000);
          };
          const countHandler = (payload: any) => {
            const c = payload?.count ?? 0;
            lastUnreadRef.current = c;
          };
          notifChannel.listen('NotificationCreated', createdHandler);
          notifChannel.listen('NotificationCountUpdated', countHandler);

          // store for cleanup
          handles.notifChannel = notifChannel;
        }
      } catch (e) {
        // ignore realtime subscription errors
      }
      // Poll for new notifications. If Echo (websockets) is available we'll poll infrequently;
      // otherwise poll at a reduced rate to lower server load.
      const Echo = (window as any).Echo;
      const pollMs = (Echo && typeof Echo.private === 'function') ? 60_000 : 10_000;
      handles.poll = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/employee/notifications/unread-count`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
          });
          if (!res.ok) return;
          const data = await res.json();
          const count = data.count || 0;
          if (count > lastUnreadRef.current) {
            // new notifications arrived
            const latest = await loadNotifications();
            const newOnes = (latest || []).filter((n: any) => !n.read).slice(0, count - lastUnreadRef.current);
            newOnes.forEach(n => {
              pushToast(n.title, n.message, 'info', 6000);
            });
            lastUnreadRef.current = count;
          } else {
            lastUnreadRef.current = count;
          }
        } catch (err) {
          // ignore polling errors
        }
      }, pollMs);

      // Reminders polling (every 15 minutes)
      const reminderInterval = setInterval(async () => {
        await loadQuizReminders();
      }, 15 * 60 * 1000);
      // store on handles so cleanup can clear it too
      handles.reminder = reminderInterval;
    };
    runAsync();
    return () => {
      // cleanup polling intervals
      try {
        if (handles.poll) clearInterval(handles.poll);
        if (handles.reminder) clearInterval(handles.reminder);
      } catch (e) {
        // ignore
      }
      // cleanup realtime notif subscription if present
      try {
        const notifChannel = handles.notifChannel;
        if (notifChannel && typeof notifChannel.stopListening === 'function') {
          notifChannel.stopListening('NotificationCreated');
          notifChannel.stopListening('NotificationCountUpdated');
        }
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const getThumbnailColor = (department: string) => {
    const colors: Record<string, string> = {
      it: 'bg-blue-500',
      hr: 'bg-purple-500',
      operations: 'bg-green-500',
      finance: 'bg-yellow-500',
      marketing: 'bg-orange-500',
    };
    const key = (department || '').toLowerCase();
    return colors[key] || 'bg-slate-500';
  };

  const myCourses = dashboardData?.courses || [];
  const userName = (dashboardData?.user && (dashboardData.user.fullName || dashboardData.user.fullname || dashboardData.user.name)) || 'Employee';
  const totalCourses = dashboardData?.total_courses || 0;

  // Find the most-recently-active in-progress course for Resume Learning
  const resumeCourse = myCourses
    .filter(c => c.progress > 0 && ((c.enroll_status || '').toLowerCase() !== 'completed'))
    .sort((a, b) => {
      if (!a.last_activity && !b.last_activity) return 0;
      if (!a.last_activity) return 1;
      if (!b.last_activity) return -1;
      return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
    })[0] ?? null;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-slate-600">Loading dashboard...</span>
      </div>
    );
  }
  return (
    <div className="space-y-8">

      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {userName}! 👋
          </h1>
          <p className="text-slate-500 mt-1">
            You are enrolled in {totalCourses} course{totalCourses !== 1 ? 's' : ''}.
          </p>
        </div>
        {resumeCourse && (
          <div className="hidden sm:block">
            <button
              onClick={() => onNavigate?.('course-viewer', resumeCourse.id)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Resume Learning
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center">
            <div className="p-3 bg-blue-50 rounded-full">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">
                Assigned Courses
              </p>
              <p className="text-2xl font-bold text-slate-900">{totalCourses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center">
            <div className="p-3 bg-green-50 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">Completed</p>
              <p className="text-2xl font-bold text-slate-900">{myCourses.filter(c => c.progress === 100).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-50 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">In Progress</p>
              <p className="text-2xl font-bold text-slate-900">{myCourses.filter(c => c.progress > 0 && c.progress < 100).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center">
            <div className="p-3 bg-purple-50 rounded-full">
              <Award className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">Certificates</p>
              <p className="text-2xl font-bold text-slate-900">3</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Notifications */}
      {notifications.filter(n => !n.read).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Notifications ({notifications.filter(n => !n.read).length} new)
            </h2>
          </div>
          <div className="space-y-3">
            {notifications.filter(n => !n.read).map(notif => (
              <div key={notif.id} className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-100 rounded-lg">
                <FileQuestion className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {notif.created_at ? `${new Date(notif.created_at).toLocaleDateString()} at ${new Date(notif.created_at).toLocaleTimeString()}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {notif.course_id && (
                    <button
                      onClick={() => { markAsRead(notif.id); onNavigate?.('course-viewer', notif.course_id!); }}
                      className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700"
                    >
                      Take Quiz
                    </button>
                  )}
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md hover:bg-slate-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Courses */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">
              My Current Courses
            </h2>
            <button className="text-sm text-green-600 font-medium hover:text-green-700">
              View All
            </button>
          </div>

          <div className="space-y-4">
            {myCourses.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-2 text-sm font-medium text-slate-900">No enrolled courses yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Search for courses using the bar at the top to enroll.
                </p>
              </div>
            ) : (
            myCourses.map((course) =>
            <div
              key={course.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row gap-4 hover:shadow-md transition-shadow">

                <div
                className={`w-full sm:w-32 h-24 ${course.thumbnail} rounded-md flex-shrink-0 flex items-center justify-center`}>

                  <PlayCircle className="h-10 w-10 text-white opacity-75" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {course.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Next: {course.nextLesson}
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{course.progress}% Complete</span>
                      <span>
                        {course.progress === 100 ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${course.progress}%`
                      }}>
                    </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end sm:justify-center">
                  <button
                    onClick={() => onNavigate?.('course-viewer', course.id)}
                    className="px-4 py-2 bg-slate-50 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-100 border border-slate-200">
                    Continue
                  </button>
                </div>
              </div>
            )
            )}
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Deadlines */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 dark:bg-slate-900/80 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 mb-4 dark:text-slate-100">
              Upcoming Deadlines
            </h3>
            <div className="space-y-4">
              {upcomingDeadlines.map((item) =>
              <div
                key={item.id}
                className="flex items-start p-3 bg-red-50 rounded-md border border-red-100 dark:bg-red-950/25 dark:border-red-900/40">

                  <Clock className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0 dark:text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-300">
                      {item.title}
                    </p>
                    <p className="text-xs text-red-600 mt-1 dark:text-red-400">
                      {item.date} • {item.type}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Achievement */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center mb-4">
              <Award className="h-8 w-8 text-yellow-300" />
              <h3 className="ml-3 text-lg font-bold">Latest Achievement</h3>
            </div>
            <p className="text-green-50 mb-4">
              You've earned the "Safety First" badge for completing Workplace
              Safety training!
            </p>
            <button className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors backdrop-blur-sm">
              View Certificates
            </button>
          </div>

          {/* Time Log */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-bold mb-4">Time Log</h3>
            <UserTimeLog />
          </div>
        </div>
      </div>
    </div>);

}

