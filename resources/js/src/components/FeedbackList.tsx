import React, { useState, useEffect } from 'react';

interface FeedbackItem {
  id: number;
  user: { id?: number; name?: string; department?: string };
  lesson: { id?: number; title?: string; module?: string; course?: string; course_department?: string };
  rating: number;
  comment?: string;
  created_at?: string;
}

interface Props {
  url: string; // API endpoint
}

export function FeedbackList({ url }: Props) {
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
  }, [url]);

  const toggle = (id: number) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const selectAll = () => {
    const map: Record<number, boolean> = {};
    items.forEach(i => map[i.id] = true);
    setSelected(map);
  };
  const clearAll = () => setSelected({});

  return (
    <div>
      {/* Info banner */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>View-Only Mode:</strong> This page displays student feedback for your review. Feedbacks are one-way communications from students and cannot be responded to.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={selectAll} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-600">Select all</button>
        <button onClick={clearAll} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-600">Clear</button>
        <div className="text-sm text-slate-500 dark:text-slate-400 ml-auto">{loading ? 'Refreshing...' : ''}</div>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded shadow border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{item.lesson.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{item.lesson.course} › {item.lesson.module}</div>
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">{item.comment || '—'}</div>
                <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">Rating: {item.rating} • {item.created_at ? new Date(item.created_at).toLocaleString() : ''}</div>
              </div>
              <div className="ml-4 text-right">
                <input type="checkbox" checked={!!selected[item.id]} onChange={() => toggle(item.id)} className="mb-2" />
                <div className="text-xs text-slate-500 dark:text-slate-400">{item.user.name}<br/>{item.user.department}</div>
              </div>
            </div>

            {/* No reply functionality - Feedbacks are one-way communication, not conversations */}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FeedbackList;
