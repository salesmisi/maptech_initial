import React, { useEffect, useMemo, useState } from 'react';
import FeedbackList from '../FeedbackList';
import useConfirm from '../../hooks/useConfirm';

type FeedbackType = 'lesson' | 'quiz';

interface FeedbacksPageProps {
  apiBase: string;
  title?: string;
  description?: string;
  canDelete?: boolean;
}

export function FeedbacksPage({
  apiBase,
  title = 'Feedbacks',
  description = 'Review feedback on lessons and quizzes.',
  canDelete = false,
}: FeedbacksPageProps) {
  const [type, setType] = useState<FeedbackType>('lesson');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const confirm = useConfirm();

  useEffect(() => {
    setSelectedIds([]);
  }, [type]);

  const endpoint = useMemo(() => `${apiBase}?type=${type}`, [apiBase, type]);
  const hasSelection = selectedIds.length > 0;

  const bulkDelete = () => {
    if (!canDelete || !hasSelection) return;

    confirm.showConfirm(
      'Delete selected feedbacks? This action cannot be undone.',
      async () => {
        try {
          await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
          const xsrf = document.cookie.match(/(^|; )XSRF-TOKEN=([^;]+)/)?.[2];
          const res = await fetch(`${apiBase}/bulk-delete`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-XSRF-TOKEN': xsrf ? decodeURIComponent(xsrf) : '',
            },
            body: JSON.stringify({ ids: selectedIds, type }),
          });

          if (res.ok) {
            setSelectedIds([]);
            window.location.reload();
            return;
          }

          const data = await res.json().catch(() => null);
          alert(data?.message || 'Failed to delete feedbacks');
        } catch (e: any) {
          alert(e?.message || 'Failed to delete feedbacks');
        }
      },
      {
        variant: 'danger',
        title: 'Delete feedbacks',
        confirmText: 'Delete',
      }
    );
  };

  return (
    <div className="p-6">
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500/90">
              Feedback Center
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-300">
              <span>Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as FeedbackType)}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="lesson">Lesson</option>
                <option value="quiz">Quiz</option>
              </select>
            </div>

            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
              {type === 'lesson' ? 'Lesson feedback' : 'Quiz feedback'}
            </div>

            {canDelete && (
              <button
                type="button"
                onClick={bulkDelete}
                disabled={!hasSelection}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  hasSelection
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                Delete selected
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded-full border border-slate-200/70 bg-white/60 px-3 py-1 font-semibold dark:border-slate-700/70 dark:bg-slate-900/60">
            {hasSelection ? `${selectedIds.length} selected` : 'No feedback selected'}
          </span>
          <span className="rounded-full border border-slate-200/70 bg-white/60 px-3 py-1 font-semibold dark:border-slate-700/70 dark:bg-slate-900/60">
            Auto refresh enabled
          </span>
        </div>
      </div>

      <div className="mt-6">
        <FeedbackList url={endpoint} onSelectionChange={setSelectedIds} />
      </div>

      {confirm.ConfirmModalRenderer()}
    </div>
  );
}

export default FeedbacksPage;
