import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, X } from 'lucide-react';

const PAGE_SIZE = 6;

interface LessonOption {
  id: number;
  title: string;
  module_title: string;
  course_title: string;
}

interface Props {
  open: boolean;
  lessons: LessonOption[];
  selectedId: number | null;
  scope?: 'employee' | 'instructor' | 'admin';
  onConfirm: (id: number | null) => void;
  onCancel: () => void;
}

export default function LessonSelectModal({ open, lessons, selectedId, scope = 'admin', onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<number | null>(selectedId);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (open) {
      setSelected(selectedId);
      setSearch('');
      setPage(1);
    }
  }, [open, selectedId]);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.module_title.toLowerCase().includes(q) ||
        l.course_title.toLowerCase().includes(q),
    );
  }, [lessons, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">

        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Select a Lesson</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Choose a lesson to filter questions.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Click a selected lesson again to unselect.</p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lessons, modules, or courses..."
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 py-2.5 pl-10 pr-3 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* "All Lessons" card — non-employee only, not when searching */}
        {scope !== 'employee' && !search && (
          <button
            type="button"
            onClick={() => setSelected(selected === null ? null : null)}
            className={`mb-2 flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition ${
              selected === null
                ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-950/40'
                : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500/40 dark:hover:bg-slate-800/70'
            }`}
          >
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">All Lessons</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Show all questions</div>
            </div>
            {selected === null && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          </button>
        )}

        {/* Lesson cards */}
        <div className="mb-4 min-h-[20.5rem] space-y-2">
          {paginated.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No lessons match your search.
            </div>
          ) : (
            paginated.map((l) => {
              const isSelected = selected === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : l.id)}
                  className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-950/40'
                      : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500/40 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{l.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{l.course_title} › {l.module_title}</div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                </button>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Confirm */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="px-5 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  , document.body);
}
