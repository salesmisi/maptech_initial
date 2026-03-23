import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

export type NotificationBellRole = 'Admin' | 'Instructor' | 'Employee';

interface NotificationBellProps {
  role: NotificationBellRole;
  onOpenAll?: () => void;
  className?: string;
}

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  type: string;
  created_at: string;
  data?: {
    from_user_name?: string;
    from_role?: string;
    course_title?: string;
  } | null;
  read_at: string | null;
};

export function NotificationBell({ role, onOpenAll, className = '' }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;

    const prefix = role === 'Admin' ? 'admin' : role === 'Instructor' ? 'instructor' : 'employee';

    const fetchUnread = async () => {
      try {
        const res = await fetch(`/api/${prefix}/notifications/unread-count`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'application/json',
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled) {
          setUnreadCount(data.count || 0);
        }
      } catch {
        // ignore
      }
    };

    const fetchRecent = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/${prefix}/notifications?per_page=5`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'application/json',
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list: NotificationItem[] = data.notifications?.data || data.notifications || [];
        if (!isCancelled) {
          setItems(list);
        }
      } catch {
        // ignore
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchUnread();
    fetchRecent();

    // Subscribe to realtime updates via Echo if available
    (async () => {
      try {
        const Echo = (window as any).Echo;
        if (!Echo || typeof Echo.private !== 'function') return;

        const res = await fetch('/user', {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'application/json',
          },
        });
        if (!res.ok) return;
        const me = await res.json();
        if (!me?.id) return;

        const channel = Echo.private('notifications.' + me.id);
        const countHandler = (payload: any) => {
          if (typeof payload?.count === 'number') {
            setUnreadCount(payload.count);
          }
        };
        const createdHandler = (_payload: any) => {
          // Fallback in case count event is missed: refetch.
          fetchUnread();
          fetchRecent();
        };

        channel.listen('NotificationCountUpdated', countHandler);
        channel.listen('NotificationCreated', createdHandler);

        return () => {
          try {
            channel.stopListening('NotificationCountUpdated');
            channel.stopListening('NotificationCreated');
          } catch {
            // ignore
          }
        };
      } catch {
        // ignore
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [role]);

  const hasUnread = unreadCount > 0;
  const displayCount = unreadCount > 9 ? '9+' : unreadCount.toString();

  const prefixLabel = role === 'Admin' ? 'Admin' : role === 'Instructor' ? 'Instructor' : 'Employee';
  const prefix = role === 'Admin' ? 'admin' : role === 'Instructor' ? 'instructor' : 'employee';

  const toggleOpen = () => {
    setOpen((prev) => !prev);
  };

  const handleViewAll = () => {
    if (onOpenAll) onOpenAll();
    setOpen(false);
  };

  const handleItemClick = async (n: NotificationItem) => {
    // Only mark as read if currently unread
    if (!n || n.read_at !== null) return;

    // Optimistically update UI
    setItems((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item))
    );
    setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));

    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      await fetch(`/api/${prefix}/notifications/${n.id}/read`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'application/json',
        },
      });
    } catch {
      // If it fails, silently ignore; realtime count events will eventually correct the badge.
    }
  };

  return (
    <div className={`relative ${className}`.trim()}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative bg-white p-1 rounded-full text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        <span className="sr-only">View notifications</span>
        <Bell className="h-6 w-6" />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-semibold shadow-sm">
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 z-20">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700">{prefixLabel} Notifications</p>
              <p className="text-[11px] text-slate-400">
                {hasUnread ? `${unreadCount} unread` : 'No unread notifications'}
              </p>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="px-3 py-4 text-xs text-slate-500">Loading notifications...</div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-500">No notifications yet.</div>
            )}
            {!loading && items.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={`px-3 py-2 hover:bg-slate-50 cursor-pointer ${
                      n.read_at ? 'bg-white' : 'bg-slate-50'
                    }`}
                    onClick={() => handleItemClick(n)}
                  >
                    <p
                      className={`text-xs font-semibold line-clamp-1 ${
                        n.read_at ? 'text-slate-700' : 'text-slate-900'
                      }`}
                    >
                      {n.title}
                    </p>
                    {n.data?.from_user_name && (
                      <p className="text-[11px] text-slate-400">
                        From {n.data.from_user_name}
                        {n.data.from_role ? ` \\ ${n.data.from_role}` : ''}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-3 py-2 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={handleViewAll}
              className="text-xs font-semibold text-green-600 hover:text-green-700"
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
