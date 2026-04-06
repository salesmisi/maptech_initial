import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  Upload,
  FileText,
  Video,
  File,
  Loader2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  X,
  GripVertical,
  Users,
  UserMinus,
} from 'lucide-react';
import { RichTextEditor, sanitizeHtml, RICH_CONTENT_STYLES } from '../../components/RichTextEditor';
import YouTubePlayer from '../../components/YouTubePlayer';
import UnlockModuleModal from '../../components/UnlockModuleModal';
import DepartmentSelectModal from '../../components/DepartmentSelectModal';
import useConfirm from '../../hooks/useConfirm';

const API_BASE = '/api';

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const getXsrfToken = async (): Promise<string> => {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
};

interface Lesson {
  id: number;
  title: string;
  text_content: string | null;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  order: number;
}

interface Module {
  id: number;
  title: string;
  description: string | null;
  content_path: string | null;
  content_url: string | null;
  file_type: string | null;
  lessons: Lesson[];
  created_at: string;
}

interface QuizSummary {
  id: number;
  title: string;
  description: string | null;
  pass_percentage: number;
  module_id: number | null;
  question_count: number;
  created_at: string;
}

// ── Inline form for attaching a quiz to a module ──────────────────────────────
interface AddQuizFormProps {
  moduleId: number;
  courseId: string;
  onCreated: (quiz: QuizSummary) => void;
  onCancel: () => void;
  onManageQuiz: (quizId: number, courseId: string) => void;
  apiPrefix: string;
}

function AddQuizForm({ moduleId, courseId, onCreated, onCancel, onManageQuiz, apiPrefix }: AddQuizFormProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [passPercent, setPassPercent] = useState(70);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) { setErr('Quiz title is required.'); return; }
    setSaving(true); setErr(null);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/modules/${moduleId}/quizzes`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({ title: title.trim(), description: desc.trim() || null, pass_percentage: passPercent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create quiz.');
      onCreated(data);
      onManageQuiz(data.id, courseId);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Attach Quiz to this Module</p>
      {err && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{err}</p>}
      <input
        type="text"
        placeholder="Quiz title (e.g. Module 1 Assessment)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <textarea
        rows={2}
        placeholder="Description (optional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
      />
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Pass Percentage</label>
        <input
          type="number"
          min={1} max={100}
          value={passPercent}
          onChange={e => setPassPercent(Number(e.target.value))}
          className="w-20 border border-slate-300 rounded-md py-1.5 px-2 text-sm text-center focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-500">% to unlock next module</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {saving ? 'Creating...' : 'Create & Add Questions'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// Unlock modal rendered outside main markup
function UnlockModalRenderer({
  course,
  open,
  userId,
  onConfirm,
  onCancel,
}: {
  course: CourseData | null;
  open: boolean;
  userId: number | null;
  onConfirm: (userId: number, moduleId: number) => void;
  onCancel: () => void;
}) {
  if (!course) return null;
  return (
    <UnlockModuleModal
      open={open}
      modules={course.modules.map(m => ({ id: m.id, title: m.title }))}
      onConfirm={(moduleId) => {
        if (userId) onConfirm(userId, Number(moduleId));
      }}
      onCancel={onCancel}
    />
  );
}

// Render UnlockModuleModal at end of component tree
export default function InstructorCourseDetailWrapper(props: Props) {
  return <InstructorCourseDetail {...props} />;
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  department: string;
  status: string;
  deadline: string | null;
  modules: Module[];
  enrolled_users: EnrolledUser[];
}

interface EnrolledUser {
  id: number;
  fullname: string;
  email: string;
  department: string | null;
  role: string;
  status: string;
  enrolled_at: string;
  progress: number;
  enrollment_status: string;
  locked: boolean;
}

interface AllUser {
  id: number;
  fullname: string;
  email: string;
  role: string;
  department: string | null;
  status: string;
}

interface Props {
  courseId: string;
  onBack: () => void;
  onManageQuiz: (quizId: number, courseId: string) => void;
  apiPrefix?: string;
}

const fileTypeIcon = (fileType: string | null) => {
  if (fileType === 'video')    return <Video className="h-4 w-4 text-blue-500" />;
  if (fileType === 'pdf')      return <FileText className="h-4 w-4 text-red-500" />;
  if (fileType === 'document') return <FileText className="h-4 w-4 text-slate-500" />;
  return <File className="h-4 w-4 text-slate-400" />;
};

const DEPT_COLORS: Record<string, string> = {
  IT: 'bg-blue-600',
  HR: 'bg-purple-600',
  Operations: 'bg-green-600',
  Finance: 'bg-yellow-600',
  Marketing: 'bg-orange-600',
};

const LESSON_INFO_BLOCK_RE = /<div\s+data-lesson-info="1">[\s\S]*?<\/div>/i;
const LESSON_GLOSSARY_BLOCK_RE = /<div\s+data-lesson-glossary="1"\s+data-json="([^"]*)"\s*><\/div>/i;

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const stripLessonInfoBlock = (content: string) =>
  (content || '').replace(LESSON_INFO_BLOCK_RE, '').trim();

const stripLessonMetaBlocks = (content: string) =>
  (content || '').replace(LESSON_INFO_BLOCK_RE, '').replace(LESSON_GLOSSARY_BLOCK_RE, '').trim();

const extractLessonInfo = (content: string) => {
  const match = (content || '').match(LESSON_INFO_BLOCK_RE);
  if (!match) return '';
  return match[0]
    .replace(/<[^>]+>/g, ' ')
    .replace(/Lesson Info:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractLessonGlossary = (content: string): Record<string, string> => {
  const match = (content || '').match(LESSON_GLOSSARY_BLOCK_RE);
  if (!match?.[1]) return {};

  try {
    const json = decodeURIComponent(match[1]);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
};

const composeLessonContent = (info: string, richContent: string, glossary: Record<string, string> = {}) => {
  const cleanedRich = stripLessonMetaBlocks(richContent || '');
  const cleanedInfo = info.trim();
  const cleanedGlossary = Object.entries(glossary)
    .reduce<Record<string, string>>((acc, [k, v]) => {
      const word = (k || '').trim();
      const def = (v || '').trim();
      if (word && def) {
        acc[word] = def;
      }
      return acc;
    }, {});

  const blocks: string[] = [];

  if (cleanedInfo) {
    blocks.push(`<div data-lesson-info="1"><p><strong>Lesson Info:</strong> ${escapeHtml(cleanedInfo)}</p></div>`);
  }

  if (Object.keys(cleanedGlossary).length > 0) {
    blocks.push(`<div data-lesson-glossary="1" data-json="${encodeURIComponent(JSON.stringify(cleanedGlossary))}"></div>`);
  }

  if (cleanedRich) {
    blocks.push(cleanedRich);
  }

  return blocks.join('\n').trim();
};

export function InstructorCourseDetail({ courseId, onBack, onManageQuiz, apiPrefix = 'instructor' }: Props) {
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Module upload state
  const [addingModule, setAddingModule] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleSuccess, setModuleSuccess] = useState<string | null>(null);
  const [deletingModuleId, setDeletingModuleId] = useState<number | null>(null);

  // Lesson state
  const [addingLessonForModule, setAddingLessonForModule] = useState<number | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonInfo, setLessonInfo] = useState('');
  const [lessonTextContent, setLessonTextContent] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [uploadingLesson, setUploadingLesson] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const lessonFileRef = useRef<HTMLInputElement>(null);

  // Quiz state — keyed by module_id
  const [quizByModule, setQuizByModule] = useState<Record<number, QuizSummary>>({});
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [addingQuizForModule, setAddingQuizForModule] = useState<number | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [deletingQuizId, setDeletingQuizId] = useState<number | null>(null);
  const confirm = useConfirm();
  const { showConfirm } = confirm;
  const [unenrollConfirm, setUnenrollConfirm] = useState<{ userId: number; name: string } | null>(null);
  const [unlockModalAction, setUnlockModalAction] = useState<'unlock' | 'lock'>('unlock');
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockModalUserId, setUnlockModalUserId] = useState<number | null>(null);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptModalModuleId, setDeptModalModuleId] = useState<number | null>(null);
  const [deptModalAction, setDeptModalAction] = useState<'unlock' | 'lock'>('unlock');
  // Simple "unlock for all enrolled users" modal state
  const [moduleUnlockAllOpen, setModuleUnlockAllOpen] = useState(false);
  const [moduleUnlockAllModuleId, setModuleUnlockAllModuleId] = useState<number | null>(null);
  const [moduleUnlockDuration, setModuleUnlockDuration] = useState<number>(1440);
  const [moduleUnlockPermanent, setModuleUnlockPermanent] = useState(false);

  // Edit module state
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');
  const [savingModule, setSavingModule] = useState(false);

  // Edit lesson state
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonInfo, setEditLessonInfo] = useState('');
  const [editLessonTextContent, setEditLessonTextContent] = useState('');
  const [editLessonFile, setEditLessonFile] = useState<File | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [quickEditLessonId, setQuickEditLessonId] = useState<number | null>(null);
  const [quickEditInfo, setQuickEditInfo] = useState('');
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);
  const [wordEditorLessonId, setWordEditorLessonId] = useState<number | null>(null);
  const [wordEditorWord, setWordEditorWord] = useState('');
  const [wordEditorDefinition, setWordEditorDefinition] = useState('');
  const [savingWordDefinition, setSavingWordDefinition] = useState(false);
  const editLessonFileRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'modules' | 'students'>('modules');

  // Enrollment state
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const loadCourse = async () => {
    try {
      const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Course not found.');
      const data = await res.json();
      setCourse({
        ...data,
        enrolled_users: (data.enrolled_users ?? []).map((u: any) => ({
          id: u.id,
          fullname: u.fullname,
          email: u.email,
          department: u.department,
          role: u.role,
          status: u.status,
          enrolled_at: u.pivot?.enrolled_at ?? u.enrolled_at,
          progress: u.pivot?.progress ?? u.progress ?? 0,
          enrollment_status: u.pivot?.status ?? u.enrollment_status ?? 'Not Started',
          locked: u.pivot?.locked ?? false,
        })),
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };



  const handleLock = async (userId: number) => {
    showConfirm("Lock this student's access to the course?", async () => {
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/enrollments/${userId}/lock`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Failed to lock enrollment');
      await loadCourse();
    } catch (e: any) {
      alert(e.message || 'Failed to lock');
    }
    });
  };

  const handleUnlock = async (userId: number) => {
    showConfirm("Unlock this student's access to the course?", async () => {
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/enrollments/${userId}/unlock`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Failed to unlock enrollment');
      await loadCourse();
    } catch (e: any) {
      alert(e.message || 'Failed to unlock');
    }
    });
  };

  const handleUnlockModuleForUser = async (userId: number) => {
    // open modal to choose module instead of using prompt
    if (!course || !course.modules || course.modules.length === 0) {
      alert('No modules available for this course.');
      return;
    }
    setUnlockModalAction('unlock');
    setUnlockModalUserId(userId);
    setUnlockModalOpen(true);
  };

  const performUnlockModuleForUser = async (userId: number, moduleId: number) => {
    try {
      if (!course) throw new Error('Course not loaded');
      const module = course.modules.find(m => m.id === moduleId);
      if (!module) throw new Error('Module not found');
      // close the selection modal and show a confirm modal
      setUnlockModalOpen(false);
      setUnlockModalUserId(null);
      showConfirm(`Unlock module "${module.title}" for this user?`, async () => {
        try {
          const token = await getXsrfToken();
          const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/modules/${moduleId}/enrollments/${userId}/unlock`, {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
          });
          if (!res.ok) throw new Error('Failed to unlock module');
          await loadCourse();
          alert('Module unlocked for user');
        } catch (e: any) {
          alert(e.message || 'Failed to unlock module');
        }
      });
    } catch (e: any) {
      alert(e.message || 'Failed to unlock module');
    }
  };

    const handleUnlockModuleForAll = (moduleId: number) => {
      setModuleUnlockAllModuleId(moduleId);
      setModuleUnlockDuration(1440);
      setModuleUnlockPermanent(false);
      setModuleUnlockAllOpen(true);
    };

    const performUnlockModuleForAll = async () => {
      if (!course || moduleUnlockAllModuleId === null) return;
      const mod = course.modules.find(m => m.id === moduleUnlockAllModuleId);
      setModuleUnlockAllOpen(false);
      showConfirm(`Unlock module "${mod?.title || moduleUnlockAllModuleId}" for all enrolled students?`, async () => {
        try {
          const token = await getXsrfToken();
          const users = course.enrolled_users || [];
          for (const u of users) {
            const body: any = {};
            if (!moduleUnlockPermanent) body.duration_minutes = moduleUnlockDuration;
            const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/modules/${moduleUnlockAllModuleId}/enrollments/${u.id}/unlock`, {
              method: 'POST',
              credentials: 'include',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
              body: JSON.stringify(body),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              console.warn('unlock failed for user', u.id, err);
            }
          }
          await loadCourse();
          window.dispatchEvent(new CustomEvent('course:unlocked', { detail: { courseId } }));
          alert('Module unlocked for enrolled students');
        } catch (e: any) {
          alert(e.message || 'Failed to unlock module for all');
        }
      });
    };

  const handleLockModuleForUser = async (userId: number) => {
    if (!course || !course.modules || course.modules.length === 0) {
      alert('No modules available for this course.');
      return;
    }
    setUnlockModalAction('lock');
    setUnlockModalUserId(userId);
    setUnlockModalOpen(true);
  };

  const performLockModuleForUser = async (userId: number, moduleId: number) => {
    try {
      if (!course) throw new Error('Course not loaded');
      const module = course.modules.find(m => m.id === moduleId);
      if (!module) throw new Error('Module not found');
      setUnlockModalOpen(false);
      setUnlockModalUserId(null);
      showConfirm(`Lock module "${module.title}" for this user?`, async () => {
        try {
          const token = await getXsrfToken();
          const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/modules/${moduleId}/enrollments/${userId}/lock`, {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
          });
          if (!res.ok) throw new Error('Failed to lock module');
          await loadCourse();
          alert('Module locked for user');
        } catch (e: any) {
          alert(e.message || 'Failed to lock module');
        }
      });
    } catch (e: any) {
      alert(e.message || 'Failed to lock module');
    }
  };

  const handleUnlockModuleForDepartment = async (moduleId: number) => {
    if (!course) return;
    setDeptModalModuleId(moduleId);
    setDeptModalAction('unlock');
    setDeptModalOpen(true);
  };

  const handleLockModuleForDepartment = async (moduleId: number) => {
    if (!course) return;
    setDeptModalModuleId(moduleId);
    setDeptModalAction('lock');
    setDeptModalOpen(true);
  };

  const performDeptAction = async (department: string) => {
    if (!course || !deptModalModuleId) return;
    const moduleId = deptModalModuleId;
    const action = deptModalAction;
    setDeptModalOpen(false);
    showConfirm(`${action === 'unlock' ? 'Unlock' : 'Lock'} module for department "${department}"?`, async () => {
      try {
        const token = await getXsrfToken();
        const url = `${API_BASE}/${apiPrefix}/courses/${courseId}/modules/${moduleId}/${action === 'unlock' ? 'unlock-department' : 'lock-department'}`;
        const res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
          body: JSON.stringify({ department }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to perform department module action');
        }
        await loadCourse();
        alert(`Module ${action === 'unlock' ? 'unlocked' : 'locked'} for department`);
      } catch (e: any) {
        alert(e.message || 'Failed to perform department action');
      }
    });
  };

  const loadQuizzes = async () => {
    setQuizzesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/quizzes`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const quizzes: QuizSummary[] = await res.json();
        const byModule: Record<number, QuizSummary> = {};
        quizzes.forEach(q => { if (q.module_id !== null) byModule[q.module_id] = q; });
        setQuizByModule(byModule);
      }
    } catch (_) {
      // non-critical
    } finally {
      setQuizzesLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const query = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
      const res = await fetch(`${API_BASE}/${apiPrefix}/users${query}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data: AllUser[] = await res.json();
      setAllUsers(data.filter(u => u.status === 'Active'));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (courseId) {
      loadCourse();
      loadQuizzes();
      loadAllUsers();
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId && activeTab === 'students') {
      loadAllUsers();
    }
  }, [courseId, activeTab]);

  const deptOptions = Array.from(new Set(course?.enrolled_users.map(u => String(u.department).trim()).filter(d => d && d !== 'null')) || []);

  const handleAddModule = async () => {
    if (!moduleTitle.trim()) {
      setModuleError('Module title is required.');
      return;
    }
    setUploading(true);
    setModuleError(null);
    setModuleSuccess(null);
    try {
      const token = await getXsrfToken();
      const formData = new FormData();
      formData.append('title', moduleTitle.trim());
      if (moduleDescription.trim()) formData.append('description', moduleDescription.trim());

      const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/modules`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add module.');

      setModuleSuccess('Module added successfully!');
      setModuleTitle('');
      setModuleDescription('');
      setAddingModule(false);
      await loadCourse();
      // Notify other parts of the UI (Courses list) that a module was added
      try {
        window.dispatchEvent(new CustomEvent('module:added', { detail: { courseId } }));
      } catch (e) {
        // ignore
      }
      setTimeout(() => setModuleSuccess(null), 3000);
    } catch (e: any) {
      setModuleError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteModule = async (moduleId: number) => {
    showConfirm('Delete this module and all its lessons?', async () => {
    setDeletingModuleId(moduleId);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/modules/${moduleId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Failed to delete module.');
      await loadCourse();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingModuleId(null);
    }
    });
  };

  const handleAddLesson = async (moduleId: number) => {
    if (!lessonTitle.trim()) {
      setLessonError('Lesson title is required.');
      return;
    }
    setUploadingLesson(true);
    setLessonError(null);
    try {
      const token = await getXsrfToken();
      const fd = new FormData();
      fd.append('title', lessonTitle.trim());
      const combinedText = composeLessonContent(lessonInfo, lessonTextContent, {});
      if (combinedText.trim()) fd.append('text_content', combinedText);
      if (lessonFile) fd.append('content', lessonFile);

      const res = await fetch(`${API_BASE}/${apiPrefix}/modules/${moduleId}/lessons`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to add lesson.');
      }
      setLessonTitle('');
      setLessonInfo('');
      setLessonTextContent('');
      setLessonFile(null);
      if (lessonFileRef.current) lessonFileRef.current.value = '';
      setAddingLessonForModule(null);
      await loadCourse();
    } catch (e: any) {
      setLessonError(e.message);
    } finally {
      setUploadingLesson(false);
    }
  };

  const handleDeleteLesson = async (moduleId: number, lessonId: number) => {
    showConfirm('Delete this lesson?', async () => {
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/modules/${moduleId}/lessons/${lessonId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Failed to delete lesson.');
      await loadCourse();
    } catch (e: any) {
      alert(e.message);
    } finally {
      // noop
    }
    });
  };
  // ─── EDIT MODULE ──────────────────────────────────────────────────────────
  const startEditModule = (mod: Module) => {
    setEditingModuleId(mod.id);
    setEditModuleTitle(mod.title);
  };

  const cancelEditModule = () => { setEditingModuleId(null); setEditModuleTitle(''); };

  const handleSaveModule = async (moduleId: number) => {
    if (!editModuleTitle.trim()) return;
    setSavingModule(true);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/modules/${moduleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify({ title: editModuleTitle.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update module.');
      setEditingModuleId(null);
      await loadCourse();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingModule(false);
    }
  };

  // ─── EDIT LESSON ──────────────────────────────────────────────────────────
  const startEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setQuickEditLessonId(null);
    setWordEditorLessonId(null);
    setEditLessonTitle(lesson.title);
    setEditLessonInfo(extractLessonInfo(lesson.text_content || ''));
    setEditLessonTextContent(stripLessonMetaBlocks(lesson.text_content || ''));
    setEditLessonFile(null);
  };

  const cancelEditLesson = () => { setEditingLessonId(null); setEditLessonTitle(''); setEditLessonInfo(''); setEditLessonTextContent(''); setEditLessonFile(null); };

  const handleSaveLesson = async (moduleId: number, lessonId: number) => {
    if (!editLessonTitle.trim()) return;
    setSavingLesson(true);
    try {
      const token = await getXsrfToken();
      const fd = new FormData();
      fd.append('title', editLessonTitle.trim());
      fd.append('text_content', composeLessonContent(editLessonInfo, editLessonTextContent, extractLessonGlossary(course?.modules.flatMap(m => m.lessons).find(l => l.id === lessonId)?.text_content || '')));
      if (editLessonFile) fd.append('content', editLessonFile);

      const res = await fetch(`${API_BASE}/${apiPrefix}/modules/${moduleId}/lessons/${lessonId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: fd,
      });
      if (!res.ok) throw new Error('Failed to update lesson.');
      setEditingLessonId(null);
      await loadCourse();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingLesson(false);
    }
  };

  const startQuickEditLessonText = (lesson: Lesson) => {
    setQuickEditLessonId(lesson.id);
    setWordEditorLessonId(null);
    setQuickEditInfo(extractLessonInfo(lesson.text_content || ''));
  };

  const cancelQuickEditLessonText = () => {
    setQuickEditLessonId(null);
    setQuickEditInfo('');
  };

  const handleSaveQuickLessonText = async (moduleId: number, lesson: Lesson) => {
    setSavingQuickEdit(true);
    try {
      const token = await getXsrfToken();
      const fd = new FormData();
      fd.append('title', lesson.title);
      fd.append('text_content', composeLessonContent(quickEditInfo, stripLessonMetaBlocks(lesson.text_content || ''), extractLessonGlossary(lesson.text_content || '')));

      const res = await fetch(`${API_BASE}/${apiPrefix}/modules/${moduleId}/lessons/${lesson.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: fd,
      });

      if (!res.ok) {
        throw new Error('Failed to update lesson text information.');
      }

      cancelQuickEditLessonText();
      await loadCourse();
    } catch (e: any) {
      alert(e.message || 'Failed to update lesson text information.');
    } finally {
      setSavingQuickEdit(false);
    }
  };

  const getSentenceFromClick = (event: React.MouseEvent<HTMLDivElement>): string => {
    const selected = window.getSelection()?.toString().trim();
    if (selected) {
      return selected.replace(/\s+/g, ' ').trim();
    }

    const pointX = event.clientX;
    const pointY = event.clientY;
    let textNode: Text | null = null;
    let offset = 0;

    const anyDoc = document as any;
    if (typeof anyDoc.caretPositionFromPoint === 'function') {
      const pos = anyDoc.caretPositionFromPoint(pointX, pointY);
      textNode = pos?.offsetNode ?? null;
      offset = pos?.offset ?? 0;
    } else if (typeof anyDoc.caretRangeFromPoint === 'function') {
      const range = anyDoc.caretRangeFromPoint(pointX, pointY);
      textNode = range?.startContainer ?? null;
      offset = range?.startOffset ?? 0;
    }

    if (!textNode || textNode.nodeType !== Node.TEXT_NODE || !textNode.textContent) {
      return '';
    }

    const text = textNode.textContent;
    if (!text) return '';

    let idx = Math.min(Math.max(offset, 0), text.length - 1);
    if (/\s/.test(text[idx] || '') && idx > 0) {
      idx -= 1;
    }
    if (!text[idx]) {
      return '';
    }

    let start = idx;
    let end = idx;

    while (start > 0 && !/[.!?\n]/.test(text[start - 1])) start--;
    while (end < text.length && !/[.!?\n]/.test(text[end])) end++;
    if (end < text.length && /[.!?]/.test(text[end])) end++;

    return text
      .slice(start, end)
      .replace(/\s+/g, ' ')
        .replace(/^[\s\-*]+/, '')
      .trim();
  };

  const startWordDefinitionEditor = (event: React.MouseEvent<HTMLDivElement>, lesson: Lesson) => {
    const sentence = getSentenceFromClick(event);
    if (!sentence) return;

    const glossary = extractLessonGlossary(lesson.text_content || '');
    setWordEditorLessonId(lesson.id);
    setWordEditorWord(sentence);
    setWordEditorDefinition(glossary[sentence] || '');
  };

  const handleSaveWordDefinition = async (moduleId: number, lesson: Lesson) => {
    if (!wordEditorWord.trim()) return;
    if (!wordEditorDefinition.trim()) {
      alert('Please enter a definition before saving.');
      return;
    }

    setSavingWordDefinition(true);
    try {
      const glossary = extractLessonGlossary(lesson.text_content || '');
      glossary[wordEditorWord.trim()] = wordEditorDefinition.trim();

      const token = await getXsrfToken();
      const fd = new FormData();
      fd.append('title', lesson.title);
      fd.append('text_content', composeLessonContent(
        extractLessonInfo(lesson.text_content || ''),
        stripLessonMetaBlocks(lesson.text_content || ''),
        glossary
      ));

      const res = await fetch(`${API_BASE}/${apiPrefix}/modules/${moduleId}/lessons/${lesson.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: fd,
      });

      if (!res.ok) {
        throw new Error('Failed to save sentence definition.');
      }

      setWordEditorLessonId(null);
      setWordEditorWord('');
      setWordEditorDefinition('');
      await loadCourse();
    } catch (e: any) {
      alert(e.message || 'Failed to save sentence definition.');
    } finally {
      setSavingWordDefinition(false);
    }
  };

  // ─── DRAG & DROP MODULE REORDER ───────────────────────────────────────────
  const handleDragStart = (idx: number) => { setDragIdx(idx); };
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const handleDrop = async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx || !course) { handleDragEnd(); return; }
    const modules = [...course.modules];
    const [moved] = modules.splice(dragIdx, 1);
    modules.splice(targetIdx, 0, moved);
    setCourse({ ...course, modules });
    handleDragEnd();

    try {
      const token = await getXsrfToken();
      await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/modules/reorder`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify({ order: modules.map(m => m.id) }),
      });
    } catch {
      await loadCourse();
    }
  };

  const handleDeleteQuiz = async (quizId: number) => {
    showConfirm('Delete this quiz and all its questions?', async () => {
    setDeletingQuizId(quizId);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/quizzes/${quizId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Failed to delete quiz.');
      await loadQuizzes();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingQuizId(null);
    }
    });
  };

  // ─── ENROLLMENT HANDLERS ──────────────────────────────────────────────────
  const enrolledIds = new Set(course?.enrolled_users.map(u => u.id) ?? []);

  const normalizeDepartmentKey = (value?: string | null) => {
    const raw = String(value || '').toLowerCase();
    const compact = raw
      .replace(/department/g, '')
      .replace(/dept/g, '')
      .replace(/[^a-z0-9]/g, '');

    if (['it', 'informationtechnology', 'informationtech'].includes(compact)) return 'it';
    if (['hr', 'humanresources'].includes(compact)) return 'humanresources';
    if (['salesandmarketing', 'marketingandsales'].includes(compact)) return 'salesandmarketing';
    return compact;
  };

  const courseDepartmentKey = normalizeDepartmentKey(course?.department);
  // Only show employees from the same department as the course (exclude already-enrolled)
  const availableUsers = allUsers.filter(u => {
    if (enrolledIds.has(u.id)) return false;
    if (!courseDepartmentKey) return true;
    return normalizeDepartmentKey(u.department) === courseDepartmentKey;
  });

  const normalizedEnrollSearch = enrollSearch.trim().toLowerCase();
  const filteredAvailableUsers = availableUsers.filter(u => {
    if (!normalizedEnrollSearch) return true;
    const name = (u.fullname || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(normalizedEnrollSearch) || email.includes(normalizedEnrollSearch);
  });

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setEnrolling(true);
    setEnrollError(null);
    setEnrollSuccess(null);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/enrollments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify({ user_id: Number(selectedUserId) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to enroll user');
      }
      setSelectedUserId('');
      setEnrollSuccess('User enrolled successfully');
      await loadCourse();
      setTimeout(() => setEnrollSuccess(null), 3000);
    } catch (e: any) {
      setEnrollError(e.message || 'Failed to enroll user');
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = (userId: number, name: string) => {
    setUnenrollConfirm({ userId, name });
  };

  const confirmUnenroll = async () => {
    if (!unenrollConfirm) return;
    const { userId } = unenrollConfirm;
    setUnenrollConfirm(null);
    try {
      const xsrf = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/courses/${courseId}/enrollments/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf },
      });
      if (!res.ok) throw new Error('Failed to unenroll user');
      await loadCourse();
    } catch (e: any) {
      alert(e.message || 'Failed to unenroll user');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-3 text-slate-600">Loading course...</span>
      </div>
    );
  }

  if (!course || error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-3 text-slate-600">{error || 'Course not found.'}</p>
        <button onClick={onBack} className="mt-4 text-sm text-green-600 hover:underline">
          &larr; Back to Courses
        </button>
      </div>
    );
  }

  const headerColor = DEPT_COLORS[course.department] || 'bg-slate-600';

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Courses &amp; Content
      </button>

      {/* Course Header */}
      <div className={`${headerColor} rounded-xl p-6 text-white`}>
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full mb-2 inline-block">
              {course.department}
            </span>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-white/80 mt-1 max-w-xl">{course.description}</p>
            )}
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            course.status === 'Active' ? 'bg-green-200 text-green-900' :
            course.status === 'Draft'  ? 'bg-yellow-200 text-yellow-900' :
            'bg-white/20 text-white'
          }`}>
            {course.status}
          </span>
        </div>
        {course.deadline && (
          <p className="mt-3 text-xs text-white/70">
            Deadline: {new Date(course.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'modules'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            Modules &amp; Content
            <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">{course.modules.length}</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'students'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Enrolled Employees
            <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">{course.enrolled_users.length}</span>
          </span>
        </button>
      </div>

      {/* Modules Panel */}
      {activeTab === 'modules' && (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Modules &amp; Content
              <span className="ml-2 text-sm font-normal text-slate-400">({course.modules.length})</span>
            </h2>
          </div>
          <button
            onClick={() => { setAddingModule(true); setModuleError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Module
          </button>
        </div>

        {/* Add module form */}
        {addingModule && (
          <div className="mx-6 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3">New Module</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Module title"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500"
              />
              <textarea
                rows={6}
                placeholder="Lesson content — e.g. Introduction, What to learn, Where to start, What to know..."
                value={moduleDescription}
                onChange={(e) => setModuleDescription(e.target.value)}
                className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500 resize-y"
              />
              {moduleError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{moduleError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAddModule}
                  disabled={uploading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {uploading ? 'Saving...' : 'Save Module'}
                </button>
                <button
                  onClick={() => { setAddingModule(false); setModuleTitle(''); setModuleDescription(''); setModuleError(null); }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {moduleSuccess && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm">
            <CheckCircle className="h-4 w-4" />{moduleSuccess}
          </div>
        )}

        {/* Module list with lessons and quiz */}
        <div className="divide-y divide-slate-100 mt-2">
          {course.modules.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 text-sm">
              No modules yet. Click <strong>Add Module</strong> to get started.
            </div>
          ) : (
            course.modules.map((mod, idx) => {
              const quiz = quizByModule[mod.id];
              const isExpanded = expandedModules.has(mod.id);
              const isEditingMod = editingModuleId === mod.id;
              return (
                <div
                  key={mod.id}
                  draggable={!isExpanded}
                  onDragStart={() => { if (!isExpanded) handleDragStart(idx); }}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDrop={() => handleDrop(idx)}
                  className={`transition-all ${dragOverIdx === idx ? 'border-t-2 border-green-400' : ''} ${dragIdx === idx ? 'opacity-50' : ''}`}
                >
                  {/* Module header */}
                  <div
                    className="px-6 py-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    onClick={() => setExpandedModules(prev => {
                      const next = new Set(prev);
                      next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id);
                      return next;
                    })}
                  >
                    <div className="flex-shrink-0 cursor-grab text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300" onMouseDown={e => e.stopPropagation()}>
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <span className="flex-shrink-0 h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      {isEditingMod ? (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editModuleTitle}
                            onChange={e => setEditModuleTitle(e.target.value)}
                            className="flex-1 border border-green-300 rounded-md py-1 px-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveModule(mod.id); if (e.key === 'Escape') cancelEditModule(); }}
                          />
                          <button onClick={() => handleSaveModule(mod.id)} disabled={savingModule}
                            className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded">
                            {savingModule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                          <button onClick={cancelEditModule} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{mod.title}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-300 mt-0.5">
                            {mod.lessons?.length || 0} lesson{(mod.lessons?.length || 0) !== 1 ? 's' : ''}
                            {quiz ? ` · Quiz: ${quiz.pass_percentage}% to pass` : ''}
                          </p>
                        </>
                      )}
                    </div>

                    {quizzesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400 flex-shrink-0" />
                    ) : quiz ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium flex-shrink-0">
                        <HelpCircle className="h-3.5 w-3.5" />
                        Quiz
                      </span>
                    ) : null}

                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400 dark:text-slate-300 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-300 flex-shrink-0" />}

                    {!isEditingMod && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditModule(mod); }}
                        className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-green-600 dark:hover:text-emerald-300 hover:bg-green-50 dark:hover:bg-emerald-900/30 rounded flex-shrink-0"
                        title="Edit module"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteModule(mod.id); }}
                      disabled={deletingModuleId === mod.id}
                      className="p-1.5 text-red-400 dark:text-rose-300 hover:text-red-600 dark:hover:text-rose-200 hover:bg-red-50 dark:hover:bg-rose-900/25 rounded disabled:opacity-40 flex-shrink-0"
                    >
                      {deletingModuleId === mod.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Expanded body: Lessons + Quiz */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-700">
                      {/* Lessons list */}
                      <div className="px-6 py-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Lessons</p>
                        {(mod.lessons?.length || 0) === 0 ? (
                          <p className="text-xs text-slate-400 italic">No lessons yet. Add one below.</p>
                        ) : (
                          <div className="space-y-2">
                            {mod.lessons.map((lesson, li) => {
                              const isEditingThisLesson = editingLessonId === lesson.id;
                              return (
                                <div key={lesson.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/35 overflow-hidden">
                                  {isEditingThisLesson ? (
                                    /* ── EDIT LESSON FORM ── */
                                    <div className="p-3 space-y-2 bg-amber-50/70 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 rounded-md">
                                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Edit Lesson</p>
                                      <input
                                        type="text" value={editLessonTitle}
                                        onChange={e => setEditLessonTitle(e.target.value)}
                                        className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md py-1.5 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="Lesson title"
                                      />
                                      <RichTextEditor
                                        value={editLessonTextContent}
                                        onChange={setEditLessonTextContent}
                                        placeholder="Lesson content..."
                                        minHeight="120px"
                                      />
                                      <textarea
                                        value={editLessonInfo}
                                        onChange={e => setEditLessonInfo(e.target.value)}
                                        rows={2}
                                        className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md py-1.5 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                                        placeholder="Text information (short summary for this lesson)"
                                      />
                                      <div className="flex items-center gap-2">
                                        <label className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md cursor-pointer hover:bg-white dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-200 bg-white/60 dark:bg-slate-900">
                                          <Upload className="h-3.5 w-3.5" />
                                          {editLessonFile ? editLessonFile.name : 'Replace file (optional)'}
                                          <input ref={editLessonFileRef} type="file" accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                                            className="sr-only" onChange={e => setEditLessonFile(e.target.files?.[0] || null)} />
                                        </label>
                                        {editLessonFile && (
                                          <button onClick={() => { setEditLessonFile(null); if (editLessonFileRef.current) editLessonFileRef.current.value = ''; }}
                                            className="text-xs text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200">Remove</button>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleSaveLesson(mod.id, lesson.id)} disabled={savingLesson}
                                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md disabled:opacity-50 flex items-center gap-1">
                                          {savingLesson ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                          {savingLesson ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button onClick={cancelEditLesson}
                                          className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200 text-xs font-medium rounded-md hover:bg-white dark:hover:bg-slate-700">
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* ── DISPLAY LESSON ── */
                                    <>
                                      <div className="flex items-center gap-3 py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                        <span className="text-xs text-slate-400 dark:text-slate-300 font-medium w-5">{li + 1}.</span>
                                        {fileTypeIcon(lesson.file_type)}
                                        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-100 truncate">{lesson.title}</span>
                                        {lesson.content_url && (
                                          <a href={lesson.content_url} target="_blank" rel="noreferrer"
                                            className="text-xs text-green-600 hover:underline flex-shrink-0">View file</a>
                                        )}
                                        <button onClick={() => startEditLesson(lesson)}
                                          className="p-1 text-slate-400 dark:text-slate-300 hover:text-green-600 dark:hover:text-emerald-300 hover:bg-green-50 dark:hover:bg-emerald-900/30 rounded flex-shrink-0" title="Edit lesson">
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteLesson(mod.id, lesson.id)}
                                          className="p-1 text-red-400 dark:text-rose-300 hover:text-red-600 dark:hover:text-rose-200 hover:bg-red-50 dark:hover:bg-rose-900/25 rounded flex-shrink-0" title="Delete lesson">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                      {lesson.text_content && (
                                        <div className="px-4 pb-3 pt-1 border-t border-slate-200">
                                          {quickEditLessonId === lesson.id ? (
                                            <div className="space-y-2">
                                              <textarea
                                                value={quickEditInfo}
                                                onChange={(e) => setQuickEditInfo(e.target.value)}
                                                rows={3}
                                                className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                                                placeholder="Enter lesson text information or definition"
                                              />
                                              <div className="flex items-center gap-2">
                                                <button
                                                  onClick={() => handleSaveQuickLessonText(mod.id, lesson)}
                                                  disabled={savingQuickEdit}
                                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md disabled:opacity-50"
                                                >
                                                  {savingQuickEdit ? 'Saving...' : 'Save Info'}
                                                </button>
                                                <button
                                                  onClick={cancelQuickEditLessonText}
                                                  className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-md hover:bg-white"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              <div
                                                className={`${RICH_CONTENT_STYLES} cursor-text`}
                                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(stripLessonMetaBlocks(lesson.text_content)) }}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {lesson.content_url && lesson.file_type === 'video' && (
                                        <div className="px-4 pb-3 pt-1 border-t border-slate-200">
                                          {/(youtube\.com|youtu\.be)/.test(lesson.content_url) ? (
                                            <div className="w-full max-h-80 rounded-md overflow-hidden">
                                              <YouTubePlayer contentUrl={lesson.content_url} lessonId={lesson.id} />
                                            </div>
                                          ) : (
                                            <video controls className="w-full max-h-80 rounded-md bg-black">
                                              <source src={lesson.content_url} />
                                            </video>
                                          )}
                                        </div>
                                      )}
                                      {lesson.content_url && lesson.file_type === 'pdf' && (
                                        <div className="px-4 pb-3 pt-1 border-t border-slate-200">
                                          <iframe src={lesson.content_url} className="w-full h-96 rounded-md border border-slate-300" title={lesson.title} />
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add Lesson form */}
                        {addingLessonForModule === mod.id ? (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
                            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Add Lesson</p>
                            {lessonError && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{lessonError}</p>}
                            <input
                              type="text"
                              placeholder="Lesson title"
                              value={lessonTitle}
                              onChange={e => setLessonTitle(e.target.value)}
                              className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                            <RichTextEditor
                              value={lessonTextContent}
                              onChange={setLessonTextContent}
                              placeholder="Type the lesson content here — use the toolbar for bold, headings, lists..."
                              minHeight="120px"
                            />
                            <textarea
                              rows={2}
                              placeholder="Text information (short summary for this lesson)"
                              value={lessonInfo}
                              onChange={e => setLessonInfo(e.target.value)}
                              className="w-full border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-md cursor-pointer hover:bg-white text-xs text-slate-600">
                                <Upload className="h-3.5 w-3.5" />
                                {lessonFile ? lessonFile.name : 'Upload document or video (optional)'}
                                <input
                                  ref={lessonFileRef}
                                  type="file"
                                  accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                                  className="sr-only"
                                  onChange={e => setLessonFile(e.target.files?.[0] || null)}
                                />
                              </label>
                              {lessonFile && (
                                <button
                                  onClick={() => { setLessonFile(null); if (lessonFileRef.current) lessonFileRef.current.value = ''; }}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddLesson(mod.id)}
                                disabled={uploadingLesson}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md disabled:opacity-50 flex items-center gap-1"
                              >
                                {uploadingLesson ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                {uploadingLesson ? 'Saving...' : 'Save Lesson'}
                              </button>
                              <button
                                onClick={() => { setAddingLessonForModule(null); setLessonTitle(''); setLessonInfo(''); setLessonTextContent(''); setLessonFile(null); setLessonError(null); }}
                                className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-md hover:bg-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingLessonForModule(mod.id); setLessonTitle(''); setLessonInfo(''); setLessonTextContent(''); setLessonFile(null); setLessonError(null); }}
                            className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Lesson
                          </button>
                        )}
                      </div>

                      {/* Quiz section */}
                      <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-3">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Quiz</p>
                        {quiz ? (
                          <div className="bg-indigo-50 dark:bg-slate-700/50 border border-indigo-100 dark:border-slate-600 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                                  <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{quiz.title}</p>
                                  {quiz.description && <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">{quiz.description}</p>}
                                  <div className="flex gap-3 mt-1 text-xs text-slate-500 dark:text-slate-300">
                                    <span>{quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}</span>
                                    <span>·</span>
                                    <span className="flex items-center gap-1">
                                      <Lock className="h-3 w-3 text-amber-500" />
                                      Must score <strong className="text-amber-700 dark:text-amber-300 mx-0.5">{quiz.pass_percentage}%</strong> to unlock next module
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => onManageQuiz(quiz.id, courseId)}
                                  className="text-xs font-medium text-green-600 dark:text-emerald-300 hover:text-green-800 dark:hover:text-emerald-200 px-3 py-1.5 border border-green-200 dark:border-emerald-700 rounded-md hover:bg-green-50 dark:hover:bg-emerald-900/30 transition-colors"
                                >
                                  Manage Quiz
                                </button>
                                <button
                                  onClick={() => handleDeleteQuiz(quiz.id)}
                                  disabled={deletingQuizId === quiz.id}
                                  className="p-1.5 text-red-400 dark:text-rose-300 hover:text-red-600 dark:hover:text-rose-200 hover:bg-red-100 dark:hover:bg-rose-900/25 rounded disabled:opacity-40"
                                >
                                  {deletingQuizId === quiz.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Trash2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          addingQuizForModule === mod.id ? (
                            <AddQuizForm
                              moduleId={mod.id}
                              courseId={courseId}
                              onCreated={(q) => {
                                setQuizByModule(prev => ({ ...prev, [mod.id]: q }));
                                setAddingQuizForModule(null);
                              }}
                              onCancel={() => setAddingQuizForModule(null)}
                              onManageQuiz={onManageQuiz}
                              apiPrefix={apiPrefix}
                            />
                          ) : (
                            <button
                              onClick={() => setAddingQuizForModule(mod.id)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Quiz
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {course.modules.length > 1 && (
          <div className="px-6 pb-4 flex items-center gap-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            Modules with a quiz gate the next module — employees must pass before proceeding.
          </div>
        )}
      </div>
      )}

      {/* Enrolled Students Tab */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          {/* Enroll User Form */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600 dark:text-emerald-400" />
              Enroll an Employee
            </h3>
            {enrollError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-red-600 text-sm mb-3">
                <AlertCircle className="h-4 w-4" />
                {enrollError}
              </div>
            )}
            {enrollSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-3 py-2 text-green-700 text-sm mb-3">
                <CheckCircle className="h-4 w-4" />
                {enrollSuccess}
              </div>
            )}
            <form onSubmit={handleEnroll} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={enrollSearch}
                  onChange={e => setEnrollSearch(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md py-1.5 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder={course.department ? `Search ${course.department} employees by name or email` : 'Search employees by name or email'}
                />
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {filteredAvailableUsers.length === 0 && (
                    <option disabled>
                      {availableUsers.length === 0
                        ? 'All active employees are already enrolled'
                        : 'No employees match your search'}
                    </option>
                  )}
                  {filteredAvailableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullname} ({u.email}) · {u.department || 'No Dept'}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={!selectedUserId || enrolling}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Enroll
              </button>
            </form>
          </div>

          {/* Enrolled Students Table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {course.enrolled_users.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <Users className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm">No employees enrolled yet.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-700/60">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Enrolled</th>
                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {course.enrolled_users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
                            {(user.fullname || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.fullname}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{user.department || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full max-w-[80px]">
                            <div
                              className={`h-2 rounded-full ${
                                user.progress >= 100
                                  ? 'bg-green-500'
                                  : user.progress > 0
                                  ? 'bg-blue-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${Math.min(user.progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{user.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.enrollment_status === 'Completed'
                            ? 'bg-green-100 text-green-800'
                            : user.enrollment_status === 'In Progress'
                            ? 'bg-blue-100 text-blue-700'
                            : user.enrollment_status === 'Dropped'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {user.enrollment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {user.enrolled_at
                          ? new Date(user.enrolled_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleUnenroll(user.id, user.fullname)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
                        >
                          Unenroll
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <UnlockModalRenderer
        course={course}
        open={unlockModalOpen}
        userId={unlockModalUserId}
        onConfirm={(userId, moduleId) => {
          if (unlockModalAction === 'unlock') {
            performUnlockModuleForUser(userId, moduleId);
            return;
          }
          performLockModuleForUser(userId, moduleId);
        }}
        onCancel={() => {
          setUnlockModalOpen(false);
          setUnlockModalUserId(null);
        }}
      />

      {confirm.ConfirmModalRenderer()}

      {/* Unenroll Confirmation Modal */}
      {unenrollConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">Unenroll Employee</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Are you sure you want to unenroll <span className="font-medium text-slate-900 dark:text-slate-100">{unenrollConfirm.name}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUnenrollConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnenroll}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
