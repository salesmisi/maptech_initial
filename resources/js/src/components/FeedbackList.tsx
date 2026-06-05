import React, { useMemo, useState, useEffect } from 'react';

interface FeedbackItem {
  id: number;
  type?: 'lesson' | 'quiz';
  user: { id?: number; name?: string; department?: string };
  lesson: { id?: number; title?: string; module?: string; course?: string; course_department?: string };
  rating: number;
  comment?: string;
  created_at?: string;
  archived?: boolean;
}

interface Props {
  url: string; // API endpoint
  onSelectionChange?: (ids: number[]) => void;
  showSelection?: boolean;
  searchQuery?: string;
  onArchiveToggle?: (item: FeedbackItem, archived: boolean) => void;
  showArchiveAction?: boolean;
  isArchivedList?: boolean;
  refreshToken?: number;
}

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

const getCoursePath = (item: FeedbackItem) => {
  const parts = [item.lesson?.course, item.lesson?.module].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Course details unavailable';
};

export function FeedbackList({
  url,
  onSelectionChange,
  showSelection = true,
  searchQuery = '',
  onArchiveToggle,
  showArchiveAction = false,
  isArchivedList = false,
  refreshToken,
}: Props) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      // Data might be paginated; extract items
      const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : (data?.items || []));
      setItems(list);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchList();
    const id = setInterval(fetchList, 5000); // poll for real-time updates
    return () => clearInterval(id);
  }, [url, refreshToken]);

  useEffect(() => {
    if (!showSelection) {
      setSelected({});
      return;
    }
    setSelected((prev) => {
      if (!items.length) return {};
      const next: Record<number, boolean> = {};
      items.forEach((item) => {
        if (prev[item.id]) next[item.id] = true;
      });
      const prevCount = Object.keys(prev).length;
      const nextCount = Object.keys(next).length;
      return prevCount === nextCount ? prev : next;
    });
  }, [items, showSelection]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((key) => selected[Number(key)]).map(Number),
    [selected]
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const haystack = [
        item.user?.name,
        item.user?.department,
        item.lesson?.title,
        item.lesson?.course,
        item.lesson?.module,
        item.lesson?.course_department,
        item.comment,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, searchQuery]);

  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedIds);
  }, [onSelectionChange, selectedIds]);

  const toggle = (id: number) => setSelected((state) => ({ ...state, [id]: !state[id] }));

  const selectAll = () => {
    const map: Record<number, boolean> = {};
    items.forEach(i => map[i.id] = true);
    setSelected(map);
  };
  const clearAll = () => setSelected({});

  return (
    <div className="space-y-4">
      {showSelection && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={selectAll}
            className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Select all
          </button>
          <button
            onClick={clearAll}
            className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Clear
          </button>
          <span className="ml-auto text-xs font-semibold text-slate-400 dark:text-slate-500">
            {loading ? 'Refreshing...' : `${items.length} feedback${items.length === 1 ? '' : 's'}`}
          </span>
        </div>
      )}

      {filteredItems.length === 0 && !loading ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          {searchQuery ? 'No feedback matches your search.' : 'No feedback available yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const title = item.lesson?.title || 'Untitled lesson';
            const coursePath = getCoursePath(item);
            const comment = item.comment?.trim() || 'No comment provided.';
            const timestamp = formatDate(item.created_at);
            const userName = item.user?.name || 'Unknown learner';
            const department = item.user?.department || 'No department';
            const typeLabel = item.type === 'quiz' ? 'Quiz' : 'Lesson';

            return (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{userName}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {typeLabel}
                      </span>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                        Rating {item.rating}/5
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{coursePath}</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{comment}</p>
                    {timestamp && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">Submitted {timestamp}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 md:flex-col md:items-end">
                    {showSelection && (
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={!!selected[item.id]}
                          onChange={() => toggle(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                        />
                        Select
                      </label>
                    )}
                    {showArchiveAction && onArchiveToggle && (
                      <button
                        type="button"
                        onClick={() => onArchiveToggle(item, !isArchivedList)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {isArchivedList ? 'Restore' : 'Archive'}
                      </button>
                    )}
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{department}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FeedbackList;
