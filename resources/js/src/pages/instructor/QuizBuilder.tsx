import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Trash2,
  Upload,
  Image,
  Video,
  Loader2,
  AlertCircle,
  CheckCircle,
  Edit2,
  X,
  Check,
} from 'lucide-react';
import useConfirm from '../../hooks/useConfirm';
import { safeArray } from '../../utils/safe';

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuizOption {
  id?: number;
  option_text: string;
  is_correct: boolean;
  order: number;
}

interface QuizQuestion {
  id: number;
  question_text: string;
  image_url: string | null;
  video_url: string | null;
  image_path: string | null;
  video_path: string | null;
  order: number;
  options: QuizOption[];
}

interface QuizData {
  id: number;
  title: string;
  description: string | null;
  pass_percentage: number;
  course_id: string;
  course_title: string;
  questions: QuizQuestion[];
}

interface DraftOption {
  text: string;
  is_correct: boolean;
}

const emptyDraftOptions = (): DraftOption[] => [
  { text: '', is_correct: false },
  { text: '', is_correct: false },
  { text: '', is_correct: false },
  { text: '', is_correct: false },
];

// ─── QuestionForm (top-level component to avoid re-mount on parent re-render) ─

interface QuestionFormProps {
  editId?: number;
  qText: string;
  setQText: (v: string) => void;
  draftOptions: DraftOption[];
  mediaType: 'none' | 'image' | 'video';
  setMediaType: (v: 'none' | 'image' | 'video') => void;
  mediaFile: File | null;
  setMediaFile: (f: File | null) => void;
  mediaInputRef: React.RefObject<HTMLInputElement>;
  questionError: string | null;
  savingQuestion: boolean;
  onOptionTextChange: (idx: number, text: string) => void;
  onMarkCorrect: (idx: number) => void;
  onAddOption: () => void;
  onRemoveOption: (idx: number) => void;
  onSave: (editId?: number) => void;
  onCancel: () => void;
}

function QuestionForm({
  editId,
  qText, setQText,
  draftOptions,
  mediaType, setMediaType,
  mediaFile, setMediaFile,
  mediaInputRef,
  questionError,
  savingQuestion,
  onOptionTextChange,
  onMarkCorrect,
  onAddOption,
  onRemoveOption,
  onSave,
  onCancel,
}: QuestionFormProps) {
  const confirm = useConfirm();
  const { showConfirm } = confirm;
  return (
    <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">
        {editId ? 'Edit Question' : 'New Question'}
      </h3>

      {/* Question text */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Question Text <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          placeholder="Type the question here..."
          className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500 resize-none"
        />
      </div>

      {/* Media upload */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Attach Media (optional)</label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => { setMediaType('none'); setMediaFile(null); }}
            className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${mediaType === 'none' ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
          >None</button>
          <button
            type="button"
            onClick={() => setMediaType('image')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${mediaType === 'image' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
          ><Image className="h-3.5 w-3.5" />Image</button>
          <button
            type="button"
            onClick={() => setMediaType('video')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${mediaType === 'video' ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
          ><Video className="h-3.5 w-3.5" />Video</button>
        </div>
        {mediaType !== 'none' && (
          <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-md cursor-pointer hover:bg-slate-100 text-sm text-slate-600 w-fit">
            <Upload className="h-4 w-4" />
            {mediaFile ? mediaFile.name : `Upload ${mediaType}...`}
            <input
              ref={mediaInputRef}
              type="file"
              accept={mediaType === 'image' ? 'image/*' : 'video/*'}
              className="sr-only"
              onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
            />
          </label>
        )}
      </div>

      {/* Options */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-medium text-slate-600">
            Answer Options (select correct one) <span className="text-red-500">*</span>
          </label>
          {draftOptions.length < 6 && (
            <button type="button" onClick={onAddOption} className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add option
            </button>
          )}
        </div>
        <div className="space-y-2">
          {draftOptions.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onMarkCorrect(idx)}
                title="Mark as correct answer"
                className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${opt.is_correct ? 'bg-green-600 border-green-600' : 'border-slate-300 hover:border-green-500'}`}
              >
                {opt.is_correct && <Check className="h-3 w-3 text-white" />}
              </button>
              <input
                type="text"
                value={opt.text}
                onChange={(e) => onOptionTextChange(idx, e.target.value)}
                placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                className="flex-1 border border-slate-300 rounded-md py-1.5 px-3 text-sm focus:ring-green-500 focus:border-green-500"
              />
              {draftOptions.length > 2 && (
                <button
                  type="button"
                  onClick={() => onRemoveOption(idx)}
                  className="p-1 text-slate-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-1.5">Click the circle next to an option to mark it as the correct answer.</p>
      </div>

      {questionError && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{questionError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(editId)}
          disabled={savingQuestion}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md disabled:opacity-50 flex items-center gap-1.5"
        >
          {savingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {savingQuestion ? 'Saving...' : (editId ? 'Update Question' : 'Save Question')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50"
        >Cancel</button>
      </div>
      {confirm.ConfirmModalRenderer()}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  quizId: number;
  onBack: () => void;
  apiPrefix?: string;
}

export function InstructorQuizBuilder({ quizId, onBack, apiPrefix = 'instructor' }: Props) {
  const confirm2 = useConfirm();
  const { showConfirm: showConfirm2 } = confirm2;
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit quiz metadata
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaPassPct, setMetaPassPct] = useState(70);
  const [savingMeta, setSavingMeta] = useState(false);

  // Add question form
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [qText, setQText] = useState('');
  const [draftOptions, setDraftOptions] = useState<DraftOption[]>(emptyDraftOptions());
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>('none');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit question
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);

  // Delete question
  const [deletingQuestionId, setDeletingQuestionId] = useState<number | null>(null);

  const mediaInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

  // ─── Load ───────────────────────────────────────────────────────────────────

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${apiPrefix}/quizzes/${quizId}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Quiz not found.');
      const data: QuizData = await res.json();
      setQuiz(data);
      setMetaTitle(data.title);
      setMetaDesc(data.description || '');
      setMetaPassPct(data.pass_percentage || 70);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (quizId) loadQuiz(); }, [quizId]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleSaveMeta = async () => {
    if (!metaTitle.trim()) return;
    setSavingMeta(true);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/quizzes/${quizId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': token,
        },
        body: JSON.stringify({ title: metaTitle.trim(), description: metaDesc.trim() || null, pass_percentage: metaPassPct }),
      });
      if (!res.ok) throw new Error('Failed to update quiz.');
      await loadQuiz();
      setEditingMeta(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingMeta(false);
    }
  };

  const handleOptionTextChange = (idx: number, text: string) => {
    setDraftOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text } : o)));
  };

  const handleMarkCorrect = (idx: number) => {
    setDraftOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
  };

  const handleAddOption = () => {
    if (draftOptions.length >= 6) return;
    setDraftOptions((prev) => [...prev, { text: '', is_correct: false }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (draftOptions.length <= 2) return;
    setDraftOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetAddForm = () => {
    setQText('');
    setDraftOptions(emptyDraftOptions());
    setMediaType('none');
    setMediaFile(null);
    setQuestionError(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleSaveQuestion = async (editId?: number) => {
    if (!qText.trim()) {
      setQuestionError('Question text is required.');
      return;
    }
    const filledOptions = draftOptions.filter((o) => o.text.trim());
    if (filledOptions.length < 2) {
      setQuestionError('At least 2 options are required.');
      return;
    }
    if (!filledOptions.some((o) => o.is_correct)) {
      setQuestionError('Mark one option as the correct answer.');
      return;
    }

    setSavingQuestion(true);
    setQuestionError(null);
    try {
      const token = await getXsrfToken();
      const formData = new FormData();
      formData.append('question_text', qText.trim());
      filledOptions.forEach((opt, idx) => {
        formData.append(`options[${idx}][text]`, opt.text.trim());
        formData.append(`options[${idx}][is_correct]`, opt.is_correct ? '1' : '0');
      });
      if (mediaType === 'image' && mediaFile) {
        formData.append('image', mediaFile);
      } else if (mediaType === 'video' && mediaFile) {
        formData.append('video', mediaFile);
      }

      const url = editId
        ? `${API_BASE}/${apiPrefix}/quizzes/${quizId}/questions/${editId}`
        : `${API_BASE}/${apiPrefix}/quizzes/${quizId}/questions`;

      // For edit we use PUT but FormData doesn't support PUT on some servers; use POST with _method override
      if (editId) formData.append('_method', 'PUT');

      const res = await fetch(url.replace('/questions/' + editId, editId ? '/questions/' + editId : ''), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || JSON.stringify(data.errors || 'Failed to save question.'));

      setSuccessMsg(editId ? 'Question updated!' : 'Question added!');
      resetAddForm();
      setAddingQuestion(false);
      setEditingQuestionId(null);
      await loadQuiz();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setQuestionError(e.message);
    } finally {
      setSavingQuestion(false);
    }
  };

  const startEditQuestion = (q: QuizQuestion) => {
    setEditingQuestionId(q.id);
    setQText(q.question_text);
    setDraftOptions(
      safeArray(q.options).length > 0
        ? safeArray(q.options).map((o) => ({ text: o.option_text, is_correct: o.is_correct }))
        : emptyDraftOptions()
    );
    setMediaType(q.image_url ? 'image' : q.video_url ? 'video' : 'none');
    setMediaFile(null);
    setQuestionError(null);
    setAddingQuestion(false);
  };

  const handleDeleteQuestion = async (questionId: number) => {
    showConfirm2('Delete this question?', async () => {
    setDeletingQuestionId(questionId);
    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${apiPrefix}/quizzes/${quizId}/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      });
      if (!res.ok) throw new Error('Failed to delete question.');
      await loadQuiz();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingQuestionId(null);
    }
    });
  };

  const sharedFormProps = {
    qText, setQText,
    draftOptions,
    mediaType, setMediaType,
    mediaFile, setMediaFile,
    mediaInputRef,
    questionError,
    savingQuestion,
    onOptionTextChange: handleOptionTextChange,
    onMarkCorrect: handleMarkCorrect,
    onAddOption: handleAddOption,
    onRemoveOption: handleRemoveOption,
    onSave: handleSaveQuestion,
    onCancel: () => { resetAddForm(); setAddingQuestion(false); setEditingQuestionId(null); },
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-3 text-slate-600">Loading quiz...</span>
      </div>
    );
  }

  if (!quiz || error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-3 text-slate-600">{error || 'Quiz not found.'}</p>
        <button onClick={onBack} className="mt-4 text-sm text-green-600 hover:underline">&larr; Back</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Course
      </button>

      {/* Quiz header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {editingMeta ? (
          <div className="space-y-3">
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm font-semibold focus:ring-green-500 focus:border-green-500"
            />
            <textarea
              rows={2}
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:ring-green-500 focus:border-green-500 resize-none"
            />
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Pass Percentage (%)</label>
              <input
                type="number"
                min={1} max={100}
                value={metaPassPct}
                onChange={(e) => setMetaPassPct(Number(e.target.value))}
                className="w-20 border border-slate-300 rounded-md py-1.5 px-2 text-sm text-center focus:ring-2 focus:ring-green-500"
              />
              <span className="text-xs text-slate-500">employees must reach this score to unlock the next lesson</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveMeta}
                disabled={savingMeta}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingMeta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {savingMeta ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingMeta(false); setMetaTitle(quiz.title); setMetaDesc(quiz.description || ''); setMetaPassPct(quiz.pass_percentage || 70); }}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50"
              >Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{quiz.title}</h1>
                {quiz.description && <p className="text-sm text-slate-500 mt-0.5">{quiz.description}</p>}
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                  <span>Course: {quiz.course_title}</span>
                  <span>·</span>
                  <span>{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span className="text-amber-600 font-medium">Pass: {quiz.pass_percentage ?? 80}%</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setEditingMeta(true)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm">
          <CheckCircle className="h-4 w-4" />{successMsg}
        </div>
      )}

      {/* Questions list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-900">
            Questions <span className="text-sm font-normal text-slate-400">({quiz.questions.length})</span>
          </h2>
          {!addingQuestion && editingQuestionId === null && (
            <button
              onClick={() => { setAddingQuestion(true); resetAddForm(); setEditingQuestionId(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* Add question form */}
          {addingQuestion && <QuestionForm {...sharedFormProps} />}

          {quiz.questions.length === 0 && !addingQuestion && (
            <div className="text-center py-10 text-slate-500 text-sm">
              No questions yet. Click <strong>Add Question</strong> to start building this quiz.
            </div>
          )}

          {quiz.questions.map((q, idx) => (
            <div key={q.id} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Question header */}
              <div className="bg-slate-50 px-5 py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-medium text-slate-900 leading-relaxed">{q.question_text}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {editingQuestionId !== q.id && (
                    <button
                      onClick={() => startEditQuestion(q)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    disabled={deletingQuestionId === q.id}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                  >
                    {deletingQuestionId === q.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Edit form inline */}
              {editingQuestionId === q.id && (
                <div className="px-5 pt-2 pb-5">
                  <QuestionForm {...sharedFormProps} editId={q.id} />
                </div>
              )}

              {/* Media preview */}
              {editingQuestionId !== q.id && (q.image_url || q.video_url) && (
                <div className="px-5 pt-3">
                  {q.image_url && (
                    <img
                      src={q.image_url}
                      alt="question media"
                      className="max-h-48 rounded-lg object-contain border border-slate-200"
                    />
                  )}
                  {q.video_url && (
                    <video
                      src={q.video_url}
                      controls
                      className="max-h-48 w-full rounded-lg border border-slate-200"
                    />
                  )}
                </div>
              )}

              {/* Options */}
              {editingQuestionId !== q.id && (
                <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {safeArray(q.options).map((opt, oi) => (
                    <div
                      key={oi}
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm ${
                        opt.is_correct
                          ? 'border-green-300 bg-green-50 text-green-800 font-medium'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center ${opt.is_correct ? 'bg-green-600 border-green-600' : 'border-slate-300'}`}>
                        {opt.is_correct && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span>{String.fromCharCode(65 + oi)}. {opt.option_text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
