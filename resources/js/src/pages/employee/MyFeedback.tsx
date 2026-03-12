import React, { useState, useEffect } from 'react';
import { Star, Plus, Edit2, Trash2, X } from 'lucide-react';

const API = '/api/employee';

interface Feedback {
  id: number;
  type: 'lesson' | 'quiz';
  item_id: number; // lesson_id or quiz_id
  title: string;
  module_title: string;
  course_title: string;
  rating: number;
  comment?: string;
  date: string;
}

interface LessonOption {
  id: number;
  title: string;
  module_title: string;
  course_title: string;
  course_department?: string | null;
}

export function MyFeedback() {
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  };

  const getHeaders = (isJson = true) => {
    const h: Record<string, string> = {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': decodeURIComponent(getCookie('XSRF-TOKEN') || ''),
    };
    if (isJson) h['Content-Type'] = 'application/json';
    return h;
  };

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [quizzes, setQuizzes] = useState<LessonOption[]>([]);
  const [feedbackType, setFeedbackType] = useState<'lesson' | 'quiz'>('lesson');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [userDepartment, setUserDepartment] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Feedback | null>(null);

  const [formLessonId, setFormLessonId] = useState<number | ''>('');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');

  const loadFeedbacks = async () => {
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      // load lesson feedbacks
      const resLessons = await fetch(`${API}/feedbacks`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      const lessonsList = resLessons.ok ? await resLessons.json() : [];

      // load quiz feedbacks
      const resQuizzes = await fetch(`${API}/quiz-feedbacks`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      const quizzesList = resQuizzes.ok ? await resQuizzes.json() : [];

      // normalize into unified list
      const normalized: Feedback[] = [
        ...(Array.isArray(lessonsList) ? lessonsList.map((l: any) => ({
          id: l.id,
          type: 'lesson' as const,
          item_id: l.lesson_id,
          title: l.lesson_title,
          module_title: l.module_title,
          course_title: l.course_title,
          rating: l.rating,
          comment: l.comment,
          date: l.date,
        })) : []),
        ...(Array.isArray(quizzesList) ? quizzesList.map((q: any) => ({
          id: q.id,
          type: 'quiz' as const,
          item_id: q.quiz_id,
          title: q.quiz_title,
          module_title: q.module_title,
          course_title: q.course_title,
          rating: q.rating,
          comment: q.comment,
          date: q.date,
        })) : []),
      ];

      // sort by date desc
      normalized.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setFeedbacks(normalized);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const loadLessons = async () => {
    try {
      const res = await fetch(`${API}/enrolled-lessons`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (res.ok) setLessons(await res.json());
    } catch { /* ignore */ }
  };

  const loadQuizzes = async () => {
    try {
      const res = await fetch(`${API}/enrolled-quizzes`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (res.ok) setQuizzes(await res.json());
    } catch { /* ignore */ }
  };

  // Load user's profile and default their department
  useEffect(() => {
    const load = async () => {
      try {
        const prof = await fetch('/api/profile', { credentials: 'include', headers: { Accept: 'application/json' } });
        if (prof.ok) {
          const p = await prof.json();
          if (p.department) {
            setUserDepartment(p.department);
            setSelectedDepartment(p.department);
          }
        }
      } catch (err) { /* ignore */ }
    };
    load();
  }, []);

  useEffect(() => {
    loadFeedbacks();
    loadLessons();
    loadQuizzes();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFormLessonId('');
    setFormRating(5);
    setFormComment('');
    setIsModalOpen(true);
  };

  const openEdit = (fb: Feedback) => {
    setEditing(fb);
    setFormLessonId(fb.item_id);
    setFormRating(fb.rating);
    setFormComment(fb.comment || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });

    if (editing) {
      if (editing.type === 'lesson') {
        const res = await fetch(`${API}/feedbacks/${editing.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: getHeaders(),
          body: JSON.stringify({ rating: formRating, comment: formComment }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.message || 'Failed to update');
          return;
        }
      } else {
        const res = await fetch(`${API}/quiz-feedbacks/${editing.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: getHeaders(),
          body: JSON.stringify({ rating: formRating, comment: formComment }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.message || 'Failed to update');
          return;
        }
      }
    } else {
      if (feedbackType === 'lesson') {
        if (!formLessonId) { alert('Please select a lesson'); return; }
        const res = await fetch(`${API}/feedbacks`, {
          method: 'POST',
          credentials: 'include',
          headers: getHeaders(),
          body: JSON.stringify({ lesson_id: formLessonId, rating: formRating, comment: formComment }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.message || 'Failed to submit');
          return;
        }
      } else {
        // quiz feedback
        if (!formLessonId) { alert('Please select a quiz'); return; }
        const res = await fetch(`${API}/quiz-feedbacks`, {
          method: 'POST',
          credentials: 'include',
          headers: getHeaders(),
          body: JSON.stringify({ quiz_id: formLessonId, rating: formRating, comment: formComment }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.message || 'Failed to submit');
          return;
        }
      }
    }

    setIsModalOpen(false);
    // reload both feedback types
    await loadFeedbacks();
  };

  const handleDelete = async (fb: Feedback) => {
    if (!window.confirm('Delete this feedback?')) return;
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    if (fb.type === 'lesson') {
      await fetch(`${API}/feedbacks/${fb.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getHeaders(),
      });
    } else {
      await fetch(`${API}/quiz-feedbacks/${fb.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getHeaders(),
      });
    }
    await loadFeedbacks();
  };

  if (loading) return <div className="p-6 text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">My Feedback</h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Give Feedback
        </button>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No feedback given yet. Give feedback on lessons you've taken!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {feedbacks.map((fb) => (
            <div key={fb.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{fb.lesson_title}</h3>
                  <p className="text-sm text-slate-500">
                    {fb.course_title} &rsaquo; {fb.module_title}
                  </p>
                  <div className="flex items-center mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < fb.rating ? 'text-yellow-400 fill-current' : 'text-slate-300'}`}
                      />
                    ))}
                    <span className="ml-2 text-sm text-slate-500">{fb.date}</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openEdit(fb)}
                    className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(fb.id)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {fb.comment && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-slate-700 italic">"{fb.comment}"</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Feedback Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-900">
                    {editing ? 'Edit Feedback' : (feedbackType === 'lesson' ? 'Give Lesson Feedback' : 'Give Quiz Feedback')}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!editing && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Feedback Type</label>
                      <div className="flex items-center gap-4 mb-3">
                        <label className="inline-flex items-center">
                          <input type="radio" name="fbtype" checked={feedbackType === 'lesson'} onChange={() => setFeedbackType('lesson')} />
                          <span className="ml-2 text-sm">Lesson</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input type="radio" name="fbtype" checked={feedbackType === 'quiz'} onChange={() => setFeedbackType('quiz')} />
                          <span className="ml-2 text-sm">Quiz</span>
                        </label>
                      </div>

                      <label className="block text-sm font-medium text-slate-700">{feedbackType === 'lesson' ? 'Select Lesson' : 'Select Quiz'}</label>
                      <select
                        value={formLessonId}
                        onChange={(e) => setFormLessonId(Number(e.target.value))}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        required
                      >
                        <option value="">-- Select a {feedbackType} --</option>
                        {(feedbackType === 'lesson' ? lessons : quizzes)
                          .filter(l => !selectedDepartment || (l.course_department || '') === selectedDepartment)
                          .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.course_title} &rsaquo; {l.module_title} &rsaquo; {l.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Department is fixed to the authenticated user's department; no chooser shown */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rating</label>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormRating(star)}
                          className="focus:outline-none"
                        >
                          <Star className={`h-8 w-8 ${star <= formRating ? 'text-yellow-400 fill-current' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Comments</label>
                    <textarea
                      rows={4}
                      value={formComment}
                      onChange={(e) => setFormComment(e.target.value)}
                      className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      placeholder="Share your thoughts about the lesson..."
                    />
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm"
                    >
                      {editing ? 'Update Feedback' : 'Submit Feedback'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    >
                      Cancel
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
