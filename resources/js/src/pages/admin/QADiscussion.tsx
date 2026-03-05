import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, Edit2, Trash2, Clock, Loader2, AlertCircle } from 'lucide-react';

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

export function QADiscussion() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'answered'>('all');
  const [submitting, setSubmitting] = useState(false);

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
      setQuestions(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (id: number) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const xsrf = await getCsrf();
      const res = await fetch(`${API_BASE}/qa/questions/${id}/answer`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify({ answer: replyText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || 'Failed to post answer');
      }
      setReplyText('');
      setReplyingTo(null);
      await loadQuestions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnswer = async (id: number) => {
    if (!window.confirm('Delete this answer?')) return;
    try {
      const xsrf = await getCsrf();
      const res = await fetch(`${API_BASE}/qa/questions/${id}/answer`, {
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
        throw new Error((data as any).message || 'Failed to delete answer');
      }
      await loadQuestions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
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

  const filtered = questions.filter((q) => {
    if (filter === 'unanswered') return !q.answer;
    if (filter === 'answered') return !!q.answer;
    return true;
  });

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Q&A Discussion</h1>
          <p className="text-sm text-slate-500 mt-1">Answer employee questions across your courses</p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'unanswered', 'answered'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${filter === f ? 'bg-green-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
            >
              {f}
              {f === 'unanswered' && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-100 text-amber-800">
                  {questions.filter((q) => !q.answer).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <MessageCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No questions found.</p>
          </div>
        ) : (
          filtered.map((q) => (
          <div key={q.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                    {q.asked_by.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{q.asked_by}</p>
                      {q.department && <>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{q.department}</span>
                      </>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="font-medium text-green-600">{q.course}</span> • {q.created_at}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!q.answer && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Awaiting Reply
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                    title="Delete question"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 ml-13 pl-13">
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">{q.question}</p>
              </div>

              {/* Answer */}
              {q.answer && (
                <div className="mt-4 ml-6 pl-6 border-l-2 border-green-300">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm flex-shrink-0">
                      {q.answered_by?.charAt(0) || 'A'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900">
                          {q.answered_by} <span className="text-xs text-slate-400 font-normal">• {q.answered_at}</span>
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setReplyingTo(q.id);
                              setReplyText(q.answer || '');
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeleteAnswer(q.id)} className="p-1 text-slate-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{q.answer}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reply Box */}
              {(!q.answer || replyingTo === q.id) && (
                <div className="mt-4 ml-6">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm flex-shrink-0">A</div>
                    <div className="flex-1">
                      <textarea
                        rows={3}
                        value={replyingTo === q.id ? replyText : ''}
                        onChange={(e) => {
                          setReplyingTo(q.id);
                          setReplyText(e.target.value);
                        }}
                        onFocus={() => setReplyingTo(q.id)}
                        className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        placeholder="Type your answer..."
                      />

                      <div className="mt-2 flex justify-end gap-2">
                        {replyingTo === q.id && (
                          <button
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText('');
                            }}
                            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          disabled={submitting}
                          onClick={() => handleReply(q.id)}
                          className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {submitting
                            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            : <Send className="h-3.5 w-3.5 mr-1.5" />}
                          {q.answer ? 'Update Reply' : 'Post Reply'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  );
}