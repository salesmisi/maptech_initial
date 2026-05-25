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
  const [listMode, setListMode] = useState<'active' | 'archived'>('active');
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

      <div className="bg-white dark:bg-slate-900/80 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Search in Feedback</label>
        <div className="relative flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
            <button
              type="button"
              onClick={() => setListMode('active')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition ${listMode === 'active' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'}`}
            >
              Feedbacks
            </button>
            {canArchive && (
              <button
                type="button"
                onClick={() => setListMode('archived')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition ${listMode === 'archived' ? 'bg-slate-700 text-white shadow dark:bg-slate-200 dark:text-slate-900' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'}`}
              >
                Archived
              </button>
            )}
          </div>

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search comments, users, or course titles"
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 py-2 pl-10 pr-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
            />
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

      {/* toggle moved beside search input above */}

      <div className="mt-4">
        <FeedbackList
          url={listMode === 'archived' ? archivedEndpoint : endpoint}
          onSelectionChange={setSelectedIds}
          showSelection={showSelection && listMode === 'active'}
          searchQuery={searchQuery}
          onArchiveToggle={handleArchiveToggle}
          showArchiveAction={canArchive}
          isArchivedList={listMode === 'archived'}
          refreshToken={refreshToken}
        />
      </div>

      {confirm.ConfirmModalRenderer()}
    </div>
  );
}

export default FeedbacksPage;
