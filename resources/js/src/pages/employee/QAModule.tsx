<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
=======
import React, { useState, useEffect, useRef } from 'react';
>>>>>>> origin/merge/kurt_phen
import {
  MessageCircle,
  Send,
  Edit2,
  Trash2,
  Plus,
  X,
  Clock,
<<<<<<< HEAD
  CheckCircle,
  Loader2,
  AlertCircle } from
'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

interface Question {
  id: number;
  course: string;
  department: string | null;
  question: string;
  answer: string | null;
  asked_by: string;
  asked_by_id: number;
  answered_by: string | null;
  answered_by_id: number | null;
  answered_at: string | null;
  created_at: string;
}

async function getCsrf() {
  await fetch('http://127.0.0.1:8000/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(
    document.cookie.split('; ').find(r => r.startsWith('XSRF-TOKEN='))?.split('=')[1] || ''
  );
}

export function QAModule() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [askCourse, setAskCourse] = useState('');
  const [askQuestion, setAskQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState<string[]>([
    'Cybersecurity Fundamentals',
    'Leadership Training 101',
    'Data Privacy Compliance',
  ]);

  useEffect(() => { loadQuestions(); }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/qa/questions`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) throw new Error('Failed to load questions');
      const data: Question[] = await res.json();
      setQuestions(data);
      const uniqueCourses = [...new Set(data.map(q => q.course))];
      if (uniqueCourses.length > 0) setCourses(prev => [...new Set([...prev, ...uniqueCourses])]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askCourse || !askQuestion.trim()) return;
    setSubmitting(true);
    try {
      const xsrf = await getCsrf();
      const res = await fetch(`${API_BASE}/qa/questions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify({ course: askCourse, question: askQuestion }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || 'Failed to submit question');
      }
      setAskCourse('');
      setAskQuestion('');
      setIsModalOpen(false);
      await loadQuestions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (!editText.trim()) return;
    try {
      const xsrf = await getCsrf();
      const res = await fetch(`${API_BASE}/qa/questions/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify({ question: editText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || 'Failed to update question');
      }
      setEditingId(null);
      setEditText('');
      await loadQuestions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      const xsrf = await getCsrf();
      const res = await fetch(`${API_BASE}/qa/questions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrf,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || 'Failed to delete question');
      }
      await loadQuestions();
    } catch (err: any) {
      alert(err.message);
    }
  };
  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      <span className="ml-2 text-slate-600">Loading questions...</span>
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
        <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
        <span className="text-red-700">{error}</span>
        <button onClick={loadQuestions} className="ml-auto text-red-600 underline text-sm">Retry</button>
      </div>
    </div>
  );
=======
  Loader2,
  SmilePlus } from
'lucide-react';

const API_BASE = '/api';

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

interface Course {
  id: string;
  title: string;
}

interface Reply {
  id: number;
  user: { id: number; fullName: string; role: string } | null;
  message: string;
  created_at: string;
  reactions: { id: number; user_id: number; emoji: string }[];
}

interface Question {
  id: number;
  course_id: string;
  course: { id: string; title: string } | null;
  question: string;
  answer: string | null;
  answerer: { id: number; fullName: string } | null;
  answered_at: string | null;
  replies: Reply[];
  created_at: string;
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function QAModule({ userId }: { userId?: number }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [newCourseId, setNewCourseId] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);

  const EMOJI_OPTIONS = ['👍', '❤️', '😄', '🎉', '🤔', '👏'];

  const toggleReaction = async (questionId: number, replyId: number, emoji: string) => {
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');
      const res = await fetch(`${API_BASE}/employee/questions/${questionId}/replies/${replyId}/reactions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || '') },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const updatedReactions = await res.json();
        setQuestions(questions.map((q) =>
          q.id === questionId
            ? { ...q, replies: q.replies.map((r) => r.id === replyId ? { ...r, reactions: updatedReactions } : r) }
            : q
        ));
      }
    } catch (err) {
      console.error('Failed to toggle reaction', err);
    }
    setShowEmojiPicker(null);
  };

  const initializedRef = useRef(false);

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`${API_BASE}/employee/questions`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } catch (err) {
      console.error('Failed to fetch questions', err);
    } finally {
      if (!initializedRef.current) {
        initializedRef.current = true;
        setLoading(false);
      }
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch(`${API_BASE}/employee/courses`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
        if (data.length > 0) setNewCourseId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch courses', err);
    }
  };

  useEffect(() => {
    fetchQuestions();
    fetchCourses();
    const interval = setInterval(fetchQuestions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseId || !newQuestion.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');
      const res = await fetch(`${API_BASE}/employee/questions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || '') },
        body: JSON.stringify({ course_id: newCourseId, question: newQuestion }),
      });
      if (res.ok) {
        const created = await res.json();
        setQuestions([created, ...questions]);
        setIsModalOpen(false);
        setNewQuestion('');
      }
    } catch (err) {
      console.error('Failed to submit question', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');
      const res = await fetch(`${API_BASE}/employee/questions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || '') },
      });
      if (res.ok) {
        setQuestions(questions.filter((q) => q.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete question', err);
    }
  };

  const handleEdit = (id: number) => {
    const q = questions.find((q) => q.id === id);
    if (q) {
      setEditingId(id);
      setEditText(q.question);
    }
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');
      const res = await fetch(`${API_BASE}/employee/questions/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || '') },
        body: JSON.stringify({ question: editText }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuestions(questions.map((q) => (q.id === id ? updated : q)));
      }
    } catch (err) {
      console.error('Failed to update question', err);
    } finally {
      setEditingId(null);
      setEditText('');
    }
  };

  const handlePostReply = async (questionId: number) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');
      const res = await fetch(`${API_BASE}/employee/questions/${questionId}/replies`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || '') },
        body: JSON.stringify({ message: replyText }),
      });
      if (res.ok) {
        const newReply: Reply = await res.json();
        setQuestions(questions.map((q) =>
          q.id === questionId ? { ...q, replies: [...(q.replies || []), newReply] } : q
        ));
      }
    } catch (err) {
      console.error('Failed to post reply', err);
    } finally {
      setReplyText('');
      setReplyingTo(null);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }
>>>>>>> origin/merge/kurt_phen

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Q&A</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ask questions and get answers from your instructors
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          Ask a Question
        </button>
      </div>

      <div className="space-y-4">
<<<<<<< HEAD
        {questions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <MessageCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No questions yet. Ask your first question!</p>
          </div>
        ) : (
          questions.map((q) =>
=======
        {questions.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No questions yet. Ask your first question!</p>
          </div>
        )}
        {questions.map((q) =>
>>>>>>> origin/merge/kurt_phen
        <div
          key={q.id}
          className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    {q.course?.title ?? 'Unknown Course'}
                  </span>
<<<<<<< HEAD
                  <span className="text-xs text-slate-400">{q.created_at}</span>
=======
                  <span className="text-xs text-slate-400">{timeAgo(q.created_at)}</span>
>>>>>>> origin/merge/kurt_phen
                </div>
                {(!q.replies || q.replies.length === 0) &&
              <div className="flex gap-1">
                    <button
                  onClick={() => { setEditingId(q.id); setEditText(q.question); }}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                  onClick={() => handleDelete(q.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
              }
              </div>

              {editingId === q.id ?
            <div className="mt-3">
                  <textarea
                rows={3}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 text-sm text-slate-600">
                      Cancel
                    </button>
                    <button
                  onClick={() => handleSaveEdit(q.id)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700">
                      Save
                    </button>
                  </div>
                </div> :
            <div className="mt-3 flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-800 font-medium">
                    {q.question}
                  </p>
                </div>
            }

<<<<<<< HEAD
              {/* Instructor Answer */}
              {q.answer ?
            <div className="mt-4 ml-8 p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">
                      {q.answered_by?.charAt(0) || 'A'}
                    </div>
                    <p className="text-xs font-medium text-slate-700">
                      {q.answered_by}
                    </p>
                    <span className="text-xs text-slate-400">
                      • {q.answered_at}
                    </span>
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-auto" />
                  </div>
                  <p className="text-sm text-slate-600">{q.answer}</p>
                </div> :

            <div className="mt-4 ml-8 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
=======
              {/* Replies Thread */}
              {q.replies && q.replies.length > 0 ? (
                <div className="mt-4 ml-8 pl-4 border-l-2 border-green-300 space-y-3">
                  {q.replies.map((reply) => {
                    const isAdmin = reply.user?.role === 'Admin' || reply.user?.role === 'Instructor';
                    return (
                      <div key={reply.id} className={`p-3 rounded-lg border ${isAdmin ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${isAdmin ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            {reply.user?.fullName?.charAt(0) ?? '?'}
                          </div>
                          <p className="text-xs font-medium text-slate-700">
                            {reply.user?.fullName ?? 'Unknown'}
                          </p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {reply.user?.role ?? 'User'}
                          </span>
                          <span className="text-xs text-slate-400">
                            • {timeAgo(reply.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 ml-8">{reply.message}</p>
                        {/* Emoji Reactions */}
                        <div className="flex items-center gap-1 mt-1.5 ml-8 flex-wrap">
                          {Object.entries(
                            (reply.reactions || []).reduce((acc: Record<string, number>, r) => {
                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(q.id, reply.id, emoji)}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-sm border transition-colors ${
                                (reply.reactions || []).some(r => r.user_id === userId && r.emoji === emoji)
                                  ? 'bg-blue-100 border-blue-300 font-medium'
                                  : 'bg-slate-50 border-slate-200 hover:bg-blue-50'
                              }`}
                            >
                              {emoji} <span className="text-xs text-slate-500">{count}</span>
                            </button>
                          ))}
                          <div className="relative">
                            <button
                              onClick={() => setShowEmojiPicker(showEmojiPicker === reply.id ? null : reply.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                              title="Add reaction"
                            >
                              <SmilePlus className="h-3.5 w-3.5" />
                            </button>
                            {showEmojiPicker === reply.id && (
                              <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-white border border-slate-200 rounded-lg shadow-lg p-1.5 z-10">
                                {EMOJI_OPTIONS.map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(q.id, reply.id, emoji)}
                                    className={`text-lg px-1 py-0.5 rounded hover:bg-slate-100 transition-colors ${
                                      (reply.reactions || []).some(r => r.user_id === userId && r.emoji === emoji) ? 'bg-blue-50' : ''
                                    }`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 ml-8 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
>>>>>>> origin/merge/kurt_phen
                  <Clock className="h-4 w-4 text-slate-400" />
                  <p className="text-xs text-slate-500">
                    Waiting for instructor response...
                  </p>
                </div>
              )}

              {/* Employee Reply Box - show when there are replies (conversation started) */}
              {q.replies && q.replies.length > 0 && (
                <div className="mt-3 ml-8">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                      Y
                    </div>
                    <div className="flex-1">
                      <textarea
                        rows={2}
                        value={replyingTo === q.id ? replyText : ''}
                        onChange={(e) => {
                          setReplyingTo(q.id);
                          setReplyText(e.target.value);
                        }}
                        onFocus={() => { if (replyingTo !== q.id) { setReplyingTo(q.id); setReplyText(''); } }}
                        className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        placeholder="Type your reply..."
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        {replyingTo === q.id && replyText.trim() && (
                          <button
                            onClick={() => { setReplyingTo(null); setReplyText(''); }}
                            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => handlePostReply(q.id)}
                          disabled={submitting || !(replyingTo === q.id && replyText.trim())}
                          className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
        )}
      </div>

      {/* Ask Question Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
            className="fixed inset-0 transition-opacity"
            aria-hidden="true">
              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>
            <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-900">
                    Ask a Question
                  </h3>
                  <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleAsk} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Course
                    </label>
                    <select
<<<<<<< HEAD
                      required
                      value={askCourse}
                      onChange={(e) => setAskCourse(e.target.value)}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                      <option value="">Select a course</option>
                      {courses.map((c) => <option key={c} value={c}>{c}</option>)}
=======
                      value={newCourseId}
                      onChange={(e) => setNewCourseId(e.target.value)}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
>>>>>>> origin/merge/kurt_phen
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Your Question
                    </label>
                    <textarea
                    rows={4}
<<<<<<< HEAD
                    required
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
=======
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
>>>>>>> origin/merge/kurt_phen
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Type your question here..." />
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                    type="submit"
<<<<<<< HEAD
                    disabled={submitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 sm:col-start-2 sm:text-sm disabled:opacity-50">

                      {submitting
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Send className="h-4 w-4 mr-2" />}
=======
                    disabled={submitting || !newQuestion.trim()}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:col-start-2 sm:text-sm">
                      {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
>>>>>>> origin/merge/kurt_phen
                      Submit Question
                    </button>
                    <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 sm:mt-0 sm:col-start-1 sm:text-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      }
    </div>);

}
