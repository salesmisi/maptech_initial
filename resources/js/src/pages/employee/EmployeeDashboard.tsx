import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Clock,
  Award,
  CheckCircle,
  PlayCircle,
  ArrowRight,
  Bell,
  FileQuestion,
  GraduationCap,
  ExternalLink,
  X,
} from 'lucide-react';
import { UserTimeLog } from '../../components/UserTimeLog';
import { safeArray } from '../../utils/safe';

const API_BASE = '/api';
const MAPTECH_LOGO_URL = '/assets/Maptech-Official-Logo.png';

interface Course {
  id: string;
  title: string;
  progress: number;
  nextLesson: string;
  thumbnail: string;
  enroll_status: string | null;
  last_activity: string | null;
}

interface CustomModule {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  lessons_count: number;
  progress: number;
  assigned_at: string;
  creator: {
    id: number;
    fullname: string;
  } | null;
}

interface DashboardData {
  user: {
    id: number;
    name: string;
    fullName?: string;
    fullname?: string;
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

interface CertificateAchievement {
  id: number;
  course_id: string;
  title: string;
  certificate_code: string;
  completed_at: string;
  completed_date: string;
  score: string;
  user_name: string;
  logo_url: string | null;
  instructor_name: string;
  instructor_signature_url: string | null;
  signer_name?: string | null;
  signer_title?: string | null;
  admin_signature_url?: string | null;
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
  onNavigate?: (page: string, courseId?: string, moduleId?: number) => void;
}

export function EmployeeDashboard({ onNavigate }: EmployeeDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [customModules, setCustomModules] = useState<CustomModule[]>([]);
  const [certificates, setCertificates] = useState<CertificateAchievement[]>([]);
  const [activeCertificateIndex, setActiveCertificateIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const lastUnreadRef = React.useRef<number>(0);
  const { pushToast } = useToast();

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewImage(null);
    setPreviewLoading(false);
  };

  const generateCertificateImage = async (cert: CertificateAchievement): Promise<string | null> => {
    const loadImage = async (url?: string | null): Promise<HTMLImageElement | null> => {
      if (!url) return null;
      return new Promise<HTMLImageElement | null>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    };

    const presidentName = cert.signer_name || null;
    const presidentTitle = cert.signer_title || null;
    const instructorName = cert.instructor_name || 'Instructor';

    const [maptechLogoImg, partnerLogoImg, adminSigImg, instructorSigImg] = await Promise.all([
      loadImage(MAPTECH_LOGO_URL),
      loadImage(cert.logo_url),
      loadImage(cert.admin_signature_url),
      loadImage(cert.instructor_signature_url),
    ]);

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = 1000 * scale;
    canvas.height = 700 * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);

    const pageW = 1000;
    const pageH = 700;

    const wrapText = (text: string, maxWidth: number, font: string) => {
      ctx.font = font;
      const words = (text || '').trim().split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = '';

      words.forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      });

      if (line) lines.push(line);
      return lines;
    };

    const drawCenteredLines = (
      lines: string[],
      centerX: number,
      startY: number,
      lineHeight: number,
      font: string,
      color: string,
    ) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      lines.forEach((line, idx) => ctx.fillText(line, centerX, startY + idx * lineHeight));
    };

    const bg = ctx.createLinearGradient(0, 0, 0, pageH);
    bg.addColorStop(0, '#fcfdfb');
    bg.addColorStop(1, '#f6f8f4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, pageW, pageH);

    ctx.strokeStyle = '#115b45';
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, 964, 664);

    ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, 936, 636);
    ctx.strokeRect(42, 42, 916, 616);

    const drawLogoInBox = (img: HTMLImageElement | null, x: number, y: number, w: number, h: number) => {
      if (!img) return;
      const ratio = Math.min((w - 16) / img.width, (h - 16) / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
    };

    drawLogoInBox(maptechLogoImg, 74, 58, 284, 92);

    if (partnerLogoImg) {
      drawLogoInBox(partnerLogoImg, 642, 58, 284, 92);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f6a4f';
      ctx.font = '700 20px Georgia';
      ctx.fillText('★', 784, 102);
      ctx.fillStyle = '#3f5d53';
      ctx.font = '600 11px Arial';
      ctx.fillText('Collaborating Brand', 784, 124);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 12px Arial';
    ctx.fillText('Maptech Information Solutions Inc.', 216, 170);
    if (partnerLogoImg) {
      ctx.fillText('Collaborating Brand', 784, 170);
    }

    const contentShiftY = 12;
    ctx.fillStyle = '#0f6a4f';
    ctx.font = '700 54px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('Certificate of Achievement', 500, 220 + contentShiftY);

    ctx.strokeStyle = '#0f6a4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(288, 244 + contentShiftY);
    ctx.lineTo(712, 244 + contentShiftY);
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.font = '700 26px Georgia';
    ctx.fillText('This certifies that', 500, 288 + contentShiftY);

    let nameSize = 48;
    let nameLines: string[] = [];
    while (nameSize >= 30) {
      nameLines = wrapText(cert.user_name || 'Learner', 760, `700 ${nameSize}px Georgia`);
      if (nameLines.length <= 2) break;
      nameSize -= 2;
    }
    const nameLineHeight = Math.round(nameSize * 1.1);
    drawCenteredLines(nameLines.slice(0, 2), 500, 352 + contentShiftY, nameLineHeight, `700 ${nameSize}px Georgia`, '#0f172a');

    const nameBottomY = 352 + contentShiftY + (Math.max(1, nameLines.slice(0, 2).length) - 1) * nameLineHeight;
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(170, nameBottomY + 14);
    ctx.lineTo(830, nameBottomY + 14);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '600 20px Georgia';
    ctx.fillText('has successfully completed the course requirements for', 500, nameBottomY + 56);

    let titleSize = 36;
    let titleLines: string[] = [];
    while (titleSize >= 20) {
      titleLines = wrapText(cert.title || 'Course', 780, `700 ${titleSize}px Georgia`);
      if (titleLines.length <= 2) break;
      titleSize -= 2;
    }
    const titleStartY = nameBottomY + 108;
    const titleLineHeight = Math.round(titleSize * 1.15);
    drawCenteredLines(titleLines.slice(0, 2), 500, titleStartY, titleLineHeight, `700 ${titleSize}px Georgia`, '#0f172a');

    const titleBottomY = titleStartY + (Math.max(1, titleLines.slice(0, 2).length) - 1) * titleLineHeight;
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(200, titleBottomY + 12);
    ctx.lineTo(800, titleBottomY + 12);
    ctx.stroke();

    const footerY = Math.min(610, Math.max(596, titleBottomY + 56));
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(70, footerY);
    ctx.lineTo(310, footerY);
    if (presidentName) {
      ctx.moveTo(360, footerY);
      ctx.lineTo(640, footerY);
    }
    ctx.moveTo(700, footerY);
    ctx.lineTo(940, footerY);
    ctx.stroke();

    const dateCenterX = 190;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = 'italic 20px Georgia';
    ctx.fillText(cert.completed_date, dateCenterX, footerY - 8);
    ctx.font = 'italic 18px Georgia';
    ctx.fillText('Date of Completion', dateCenterX, footerY + 22);

    const drawSignerBlock = (
      sigImg: HTMLImageElement | null,
      name: string,
      title: string,
      centerX: number,
    ) => {
      if (sigImg) {
        const maxSigW = 200;
        const maxSigH = 52;
        const ratio = Math.min(maxSigW / sigImg.width, maxSigH / sigImg.height);
        const sigW = sigImg.width * ratio;
        const sigH = sigImg.height * ratio;
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(sigImg, centerX - sigW / 2, footerY - 68, sigW, sigH);
        ctx.restore();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1f2937';
      ctx.font = '700 18px Georgia';
      ctx.fillText(name, centerX, footerY - 10);
      ctx.fillStyle = '#334155';
      ctx.font = 'italic 17px Georgia';
      ctx.fillText(title, centerX, footerY + 26);
    };

    if (presidentName) {
      drawSignerBlock(adminSigImg, presidentName, presidentTitle ?? 'Administrator', 500);
    }

    drawSignerBlock(instructorSigImg, instructorName, 'Instructor', 820);

    const certIdY = Math.min(648, footerY + 46);
    ctx.strokeStyle = '#c6d0d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(332, certIdY - 4);
    ctx.lineTo(430, certIdY - 4);
    ctx.moveTo(570, certIdY - 4);
    ctx.lineTo(668, certIdY - 4);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#5f7182';
    ctx.font = '600 13px Arial';
    ctx.fillText(`Certificate ID: ${cert.certificate_code}`, 500, certIdY);

    return canvas.toDataURL('image/png');
  };

  const handlePreviewCertificate = async (cert: CertificateAchievement) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    const image = await generateCertificateImage(cert);
    setPreviewImage(image);
    setPreviewLoading(false);
  };

  const loadCertificates = async () => {
    try {
      const res = await fetch(`${API_BASE}/employee/certificates`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
        : [];
      setCertificates(sorted);
      setActiveCertificateIndex(0);
      return sorted;
    } catch (err) {
      console.error('Failed to load certificates:', err);
      return [];
    }
  };

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

  const loadCustomModules = async () => {
    try {
      const res = await fetch(`${API_BASE}/employee/custom-modules`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomModules(data.modules || []);
      }
    } catch (err) {
      console.error('Failed to load custom modules:', err);
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
        return data;
      } catch (error) {
        console.error('Error loading dashboard:', error);
        return null;
      } finally {
        setLoading(false);
      }
    };

    const handles: any = {};
    const runAsync = async () => {
      const dashboard = await loadDashboard();
      const initial = await loadNotifications();
      await loadCustomModules();
      await loadCertificates();
      await loadQuizReminders();
      await loadLatestAchievement();
      // initialize last unread count after initial load
      lastUnreadRef.current = (initial || []).filter((n: any) => !n.read).length;
      // Subscribe to realtime notifications channel (if Echo is available)
      try {
        const Echo = (window as any).Echo;
        const dashboardUserId = dashboard?.user?.id;
        if (Echo && typeof Echo.private === 'function' && dashboardUserId) {
          const notifChannel = Echo.private('notifications.' + dashboardUserId);
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
            newOnes.forEach((n: any) => {
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

      handles.certificates = setInterval(async () => {
        await loadCertificates();
      }, 60 * 1000);
    };
    runAsync();
    return () => {
      // cleanup polling intervals
      try {
        if (handles.poll) clearInterval(handles.poll);
        if (handles.reminder) clearInterval(handles.reminder);
        if (handles.certificates) clearInterval(handles.certificates);
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

  useEffect(() => {
    if (certificates.length <= 1) return undefined;

    const rotate = window.setInterval(() => {
      setActiveCertificateIndex((prev) => (prev + 1) % certificates.length);
    }, 5000);

    return () => window.clearInterval(rotate);
  }, [certificates]);

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
  const userName = dashboardData?.user?.name || 'Employee';
  const totalCourses = dashboardData?.total_courses || 0;
  const activeCertificate = certificates[activeCertificateIndex] || null;

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
    <div className="space-y-6 sm:space-y-8">

      {/* Welcome Section */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Welcome back, {userName}! 👋
          </h1>
          <p className="text-slate-500 mt-1">
            You are enrolled in {totalCourses} course{totalCourses !== 1 ? 's' : ''}.
          </p>
        </div>
        {resumeCourse && (
          <div className="w-full sm:w-auto">
            <button
              onClick={() => onNavigate?.('course-viewer', resumeCourse.id)}
              className="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 sm:w-auto"
            >
              Resume Learning
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
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

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center">
            <div className="p-3 bg-purple-50 rounded-full">
              <GraduationCap className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">Custom Modules</p>
              <p className="text-2xl font-bold text-slate-900">{customModules.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
          <div className="flex items-center">
            <div className="p-3 bg-green-50 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">Completed</p>
              <p className="text-2xl font-bold text-slate-900">{safeArray<Course>(myCourses).filter(c => c.progress === 100).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-100">
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
        <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Notifications ({safeArray<NotificationItem>(notifications).filter(n => !n.read).length} new)
            </h2>
          </div>
          <div className="space-y-3">
            {notifications.filter(n => !n.read).map(notif => (
              <div key={notif.id} className="flex flex-col gap-3 rounded-lg border border-orange-100 bg-orange-50 p-4 sm:flex-row sm:items-start">
                <FileQuestion className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {notif.created_at ? `${new Date(notif.created_at).toLocaleDateString()} at ${new Date(notif.created_at).toLocaleTimeString()}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  {notif.course_id && (
                    <button
                      onClick={() => { markAsRead(notif.id); onNavigate?.('course-viewer', notif.course_id!); }}
                      className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Take Quiz
                    </button>
                  )}
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Current Courses */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

          {/* Time Log - Left side */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 dark:bg-slate-900/80 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-4 dark:text-slate-100">Time Log</h3>
            <UserTimeLog />
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Custom Modules from Instructor */}
          {customModules.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 dark:bg-slate-900/80 dark:border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 dark:text-slate-100">
                  <GraduationCap className="h-5 w-5 text-purple-600" />
                  Learning Modules
                </h3>
              </div>

              <div className="space-y-4">
                {customModules.map((module) => (
                  <div
                    key={module.id}
                    className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-4 hover:shadow-md transition-all cursor-pointer dark:from-purple-950/30 dark:to-indigo-950/30 dark:border-purple-800"
                    onClick={() => {
                      pushToast('Module Viewer', 'Custom module viewer coming soon!', 'info');
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {module.title}
                      </h4>
                      {module.category && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full dark:bg-purple-900/50 dark:text-purple-300">
                          {module.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 mb-2 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {module.lessons_count} lesson{module.lessons_count !== 1 ? 's' : ''}
                      </span>
                      {module.creator && (
                        <span>by {module.creator.fullname}</span>
                      )}
                    </div>

                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-slate-600 mb-1 dark:text-slate-400">
                        <span>{module.progress}% Complete</span>
                        <span className="text-purple-600 font-medium dark:text-purple-400">
                          {module.progress === 100 ? 'Completed ✓' : 'In Progress'}
                        </span>
                      </div>
                      <div className="w-full bg-white rounded-full h-1.5 dark:bg-slate-700">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${module.progress}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('custom-module-viewer', undefined, module.id);
                      }}
                      className="w-full px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
                    >
                      Start Learning
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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

          {/* Latest Achievement */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="flex items-center min-w-0">
                <Award className="h-8 w-8 text-yellow-300 flex-shrink-0" />
                <h3 className="ml-3 text-lg font-bold">Latest Achievement</h3>
              </div>
              {certificates.length > 1 && (
                <span className="text-xs font-medium text-green-50/90 whitespace-nowrap">
                  {activeCertificateIndex + 1}/{certificates.length}
                </span>
              )}
            </div>
            {activeCertificate ? (
              <>
                <div className="mb-4 rounded-lg border border-white/20 bg-slate-900/20 p-3 backdrop-blur-sm">
                  <div className="h-36 bg-slate-950/40 relative p-3 flex items-center justify-center border border-white/10 overflow-hidden">
                    <div className="bg-white w-full h-full shadow-sm border border-slate-200 p-3 flex flex-col items-center justify-center text-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500"></div>
                      <div className="flex items-center justify-center gap-2 mb-2 mt-2">
                        <img src={MAPTECH_LOGO_URL} alt="Maptech Logo" className="h-6 w-auto max-w-[90px] object-contain" />
                        {activeCertificate.logo_url ? (
                          <img src={activeCertificate.logo_url} alt="Partner Logo" className="h-6 w-auto max-w-[90px] object-contain" />
                        ) : (
                          <Award className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                        Certificate of Achievement
                      </h4>
                      <p className="text-[9px] text-slate-500 mb-1">
                        Presented to {activeCertificate.user_name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-800 line-clamp-2 px-3">
                        {activeCertificate.title}
                      </p>
                      <div className="mt-auto pt-2 border-t border-slate-100 w-full flex justify-between text-[7px] text-slate-400">
                        <span>{activeCertificate.completed_date}</span>
                        <span>{activeCertificate.signer_name || activeCertificate.instructor_name || 'Instructor'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-green-50 font-semibold mb-1 line-clamp-2">
                  {activeCertificate.title}
                </p>
                <p className="text-sm text-green-50/90 mb-1">
                  Completed on {activeCertificate.completed_date}
                </p>
                <p className="text-xs text-green-100/90 mb-4">
                  Certificate ID: {activeCertificate.certificate_code}
                  {activeCertificate.score ? ` • Score: ${activeCertificate.score}%` : ''}
                </p>
              </>
            ) : (
              <p className="text-green-50 mb-4">
                Complete a course to display your latest certificate achievement here.
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={() => activeCertificate && handlePreviewCertificate(activeCertificate)}
                disabled={!activeCertificate}
                className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Preview
              </button>
              <button
                onClick={() => onNavigate?.('certificates')}
                className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors backdrop-blur-sm"
              >
                View Certificates
              </button>
            </div>
          </div>

        </div>
      </div>

      {previewOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4" onClick={closePreview}>
          <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate pr-2">
                {activeCertificate ? `${activeCertificate.title} Certificate Preview` : 'Certificate Preview'}
              </h3>
              <button
                type="button"
                onClick={closePreview}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-100 p-0 overflow-auto max-h-[calc(92vh-58px)] flex items-start justify-center">
              {previewLoading && (
                <div className="text-slate-600 text-sm p-4">Rendering certificate preview...</div>
              )}
              {!previewLoading && previewImage && (
                <img src={previewImage} alt="Certificate Preview" className="w-full h-auto max-w-4xl shadow-lg border border-slate-200" />
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>);

}

