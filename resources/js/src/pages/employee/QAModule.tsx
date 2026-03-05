import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Send,
  Edit2,
  Trash2,
  Plus,
  X,
  Clock,
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
        {questions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <MessageCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No questions yet. Ask your first question!</p>
          </div>
        ) : (
          questions.map((q) =>
        <div
          key={q.id}
          className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">

            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    {q.course}
                  </span>
                  <span className="text-xs text-slate-400">{q.created_at}</span>
                </div>
                {!q.answer &&
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
                  <Clock className="h-4 w-4 text-slate-400" />
                  <p className="text-xs text-slate-500">
                    Waiting for instructor response...
                  </p>
                </div>
            }
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
                      required
                      value={askCourse}
                      onChange={(e) => setAskCourse(e.target.value)}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                      <option value="">Select a course</option>
                      {courses.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Your Question
                    </label>
                    <textarea
                    rows={4}
                    required
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Type your question here..." />

                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 sm:col-start-2 sm:text-sm disabled:opacity-50">

                      {submitting
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Send className="h-4 w-4 mr-2" />}
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