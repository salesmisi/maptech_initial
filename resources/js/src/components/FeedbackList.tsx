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
      <div className="flex items-center gap-2 mb-4">
        <button onClick={selectAll} className="px-3 py-1 bg-slate-100 rounded">Select all</button>
        <button onClick={clearAll} className="px-3 py-1 bg-slate-100 rounded">Clear</button>
        <div className="text-sm text-slate-500 ml-auto">{loading ? 'Refreshing...' : ''}</div>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-white p-4 rounded shadow border">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{item.lesson.title}</div>
                <div className="text-xs text-slate-500">{item.lesson.course} › {item.lesson.module}</div>
                <div className="mt-2 text-sm text-slate-700">{item.comment || '—'}</div>
                <div className="mt-2 text-xs text-slate-400">Rating: {item.rating} • {item.created_at ? new Date(item.created_at).toLocaleString() : ''}</div>
              </div>
              <div className="ml-4 text-right">
                <input type="checkbox" checked={!!selected[item.id]} onChange={() => toggle(item.id)} className="mb-2" />
                <div className="text-xs text-slate-500">{item.user.name}<br/>{item.user.department}</div>
              </div>
            </div>

            {/* Reply functionality removed - This is feedback, not a conversation */}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FeedbackList;
