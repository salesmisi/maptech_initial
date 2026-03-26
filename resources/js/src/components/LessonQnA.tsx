import React, { useEffect, useState } from 'react';
import useConfirm from '../hooks/useConfirm';

interface Question {
  id: number;
  user: { id: number; fullname: string; role?: string };
  lesson?: { id: number; title: string };
  course?: { id: string; title: string };
  question: string;
  created_at: string;
  replies: Array<{ id: number; user: { id:number; fullname:string; role?:string }; message: string; created_at: string }>;
}

interface LessonOption {
  id: number;
  title: string;
  module_title: string;
  course_title: string;
}

export default function LessonQnA({ scope = 'employee', lessonIdProp, userId }: { scope?: 'employee'|'instructor'|'admin', lessonIdProp?: number, userId?: number }) {
  const API_PREFIX = scope === 'admin' ? '/api/admin' : scope === 'instructor' ? '/api/instructor' : '/api/employee';

  const getCookie = (name: string) => {
    const v = `; ${document.cookie}`;
    const parts = v.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  };

  const getHeaders = (isJson = true) => {
    const h: Record<string,string> = {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': decodeURIComponent(getCookie('XSRF-TOKEN') || ''),
    };
    if (isJson) h['Content-Type'] = 'application/json';
    return h;
  };

  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [lessonId, setLessonId] = useState<number | null>(lessonIdProp ?? null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [replyText, setReplyText] = useState<Record<number,string>>({});

  const confirm = useConfirm();
  const { showConfirm } = confirm;

  // Load lessons for selection based on scope
  useEffect(() => {
    const loadLessons = async () => {
      try {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
        // Use scope-appropriate endpoint - all use /lessons now
        const lessonsEndpoint = `${API_PREFIX}/lessons`;
        const res = await fetch(lessonsEndpoint, { credentials: 'include', headers: getHeaders() });
        if (res.ok) setLessons(await res.json());
      } catch { /* ignore */ }
    };
    loadLessons();
  }, [scope]);

  useEffect(() => { loadQuestions(); }, [lessonId]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const url = lessonId ? `${API_PREFIX}/questions?lesson_id=${lessonId}` : `${API_PREFIX}/questions`;
      const res = await fetch(url, { credentials: 'include', headers: getHeaders() });
      if (res.ok) {
        setQuestions(await res.json());
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonId) { alert('Select a lesson first'); return; }
    if (!newQuestion.trim()) { alert('Enter a question'); return; }
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    const res = await fetch('/api/employee/questions', {
      method: 'POST', credentials: 'include', headers: getHeaders(), body: JSON.stringify({ lesson_id: lessonId, question: newQuestion })
    });
    if (res.ok) { setNewQuestion(''); loadQuestions(); } else { const err = await res.json().catch(() => ({})); alert(err.message || 'Failed'); }
  };

  const submitReply = async (questionId: number) => {
    const text = replyText[questionId];
    if (!text) return;
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    const res = await fetch(`${API_PREFIX}/questions/${questionId}/replies`, {
      method: 'POST', credentials: 'include', headers: getHeaders(), body: JSON.stringify({ message: text })
    });
    if (res.ok) { setReplyText((s)=>({ ...s, [questionId]: '' })); loadQuestions(); } else { const err = await res.json().catch(()=>({})); alert(err.message || 'Failed'); }
  };

  const deleteQuestion = async (questionId: number) => {
    if (scope !== 'admin') return;
    showConfirm('Are you sure you want to delete this question and all of its replies?', async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const res = await fetch(`/api/admin/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getHeaders(),
      });
      if (res.ok) {
        await loadQuestions();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to delete question');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lesson Q&A</h1>
      </div>

      {/* Lesson Selector */}
      <div className="bg-white dark:bg-slate-900/80 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <label htmlFor="select-lesson" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Select a Lesson</label>
        <select
          id="select-lesson"
          name="lessonId"
          value={lessonId ?? ''}
          onChange={(e) => setLessonId(e.target.value ? Number(e.target.value) : null)}
          className="w-full border border-slate-300 dark:border-slate-700 rounded-md py-2 px-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-green-500 focus:border-green-500"
        >
          <option value="">{scope === 'employee' ? '-- Select a lesson to ask or view questions --' : '-- All Lessons (show all questions) --'}</option>
            {safeArray(lessons).map(l => (
            <option key={l.id} value={l.id}>{l.course_title} &rsaquo; {l.module_title} &rsaquo; {l.title}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-6 text-slate-500 dark:text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Ask new question — employees only when lesson selected */}
          {scope === 'employee' && lessonId && (
            <form onSubmit={submitQuestion} className="flex space-x-2">
              <input value={newQuestion} onChange={(e)=>setNewQuestion(e.target.value)} className="flex-1 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400" placeholder="Ask a question about this lesson..." />
              <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Ask</button>
            </form>
          )}

          {questions.length === 0 ? (
            <div className="text-slate-500 dark:text-slate-400 text-center py-8">No questions {lessonId ? 'for this lesson' : 'found'}.</div>
          ) : (
            <div className="space-y-4">
              {questions.map(q => (
                <div key={q.id} className="bg-white dark:bg-slate-900/80 rounded-lg p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm text-slate-700 dark:text-slate-200 font-medium">{q.user.fullname} <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{q.user.role}</span></div>
                      {q.lesson && <div className="text-xs text-green-700 dark:text-green-400 mt-1">Lesson: {q.lesson.title}</div>}
                      <div className="mt-2 text-slate-900 dark:text-slate-100">{q.question}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">{new Date(q.created_at).toLocaleString()}</div>
                    </div>
                    {scope === 'admin' && (
                      <button
                        type="button"
                        onClick={() => deleteQuestion(q.id)}
                        className="ml-4 text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Replies */}
                  {q.replies.length > 0 && (
                    <div className="mt-4 space-y-2 pl-4 border-l-2 border-green-200 dark:border-green-700/60">
                      {q.replies.map(r => (
                        <div key={r.id} className="bg-slate-50 dark:bg-slate-800 rounded p-3">
                          <div className="text-sm text-slate-700 dark:text-slate-200"><strong>{r.user.fullname}</strong> <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">{r.user.role}</span></div>
                          <div className="text-slate-700 dark:text-slate-200 mt-1">{r.message}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(r.created_at).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply form */}
                  <div className="mt-4 flex space-x-2">
                    <input value={replyText[q.id] || ''} onChange={(e)=>setReplyText((s)=>({ ...s, [q.id]: e.target.value }))} placeholder="Write a reply..." className="flex-1 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400" />
                    <button onClick={()=>submitReply(q.id)} type="button" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Reply</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {confirm.ConfirmModalRenderer()}
    </div>
  );
}
