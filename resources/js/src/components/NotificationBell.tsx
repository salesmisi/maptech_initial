import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { LoadingState } from './ui/LoadingState';
import { resolveImageUrl } from '../utils/safe';

// Helper to get cookie value
const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

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
    from_user_profile_picture?: string | null;
    course_title?: string;
  } | null;
  read_at: string | null;
};

const PENDING_NOTIFICATION_ID_KEY = 'maptech_pending_notification_id';
const PENDING_NOTIFICATION_ROLE_KEY = 'maptech_pending_notification_role';
const OPEN_NOTIFICATION_EVENT = 'maptech-open-notification';

function extractNotificationItems(payload: any): NotificationItem[] {
  const candidates = [
    payload,
    payload?.data,
    payload?.notifications,
    payload?.notifications?.data,
    payload?.data?.data,
    payload?.notifications?.data?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

export function NotificationBell({ role, onOpenAll, className = '' }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const isCancelledRef = useRef(false);
  const fetchingRecentRef = useRef(false);

  const messagePreviewText = (value: string) => {
    const html = String(value || '');
    if (!html) return '';
    const plain = new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
    return plain.replace(/\s+/g, ' ').trim();
  };

  const formatNotificationTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const prefix = role === 'Admin' ? 'admin' : role === 'Instructor' ? 'instructor' : 'employee';
  const prefixLabel = role === 'Admin' ? 'Admin' : role === 'Instructor' ? 'Instructor' : 'Employee';

  const fetchUnread = useCallback(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const res = await fetch(`/api/${prefix}/notifications/unread-count`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'application/json',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!isCancelledRef.current) {
        setUnreadCount(data.count || 0);
      }
    } catch {
      // ignore
    }
  }, [prefix]);

  const fetchRecent = useCallback(async (options?: { silent?: boolean }) => {
    if (fetchingRecentRef.current) return;
    fetchingRecentRef.current = true;

    const silent = options?.silent ?? false;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      if (!silent) {
        setLoading(true);
      }
      const res = await fetch(`/api/${prefix}/notifications?per_page=5`, {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch notifications: ${res.status}`);
      }
      const data = await res.json();
      let list = extractNotificationItems(data);

      // Fallback: if unread count exists but recent list is empty, query unread feed directly.
      if (list.length === 0) {
        const unreadRes = await fetch(`/api/${prefix}/notifications?unread=true&per_page=5`, {
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'application/json',
          },
        });
        if (unreadRes.ok) {
          const unreadData = await unreadRes.json();
          const unreadList = extractNotificationItems(unreadData);
          if (unreadList.length > 0) {
            list = unreadList;
          }
        }
      }

      if (!isCancelledRef.current) {
        setItems(list);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('NotificationBell fetchRecent failed:', error);
    } finally {
      if (!isCancelledRef.current && !silent) {
        setLoading(false);
      }
      fetchingRecentRef.current = false;
    }
  }, [prefix]);

  useEffect(() => {
    isCancelledRef.current = false;

    fetchUnread();
    fetchRecent({ silent: true });

    // Subscribe to realtime updates via Echo if available
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
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
        const createdHandler = (payload: any) => {
          const incoming = payload?.notification || payload;
          if (incoming?.id) {
            setItems((prev) => [incoming, ...prev.filter((item) => item.id !== incoming.id)].slice(0, 5));
          }
          // Fallback in case count event is missed.
          fetchUnread();
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
      isCancelledRef.current = true;
    };
  }, [role, fetchUnread, fetchRecent]);

  useEffect(() => {
    if (!open) return;

    const handleFocus = () => {
      if (document.visibilityState !== 'visible') return;
      fetchUnread();
      fetchRecent({ silent: true });
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [open, fetchUnread, fetchRecent]);

  const hasUnread = unreadCount > 0;
  const displayCount = unreadCount > 9 ? '9+' : unreadCount.toString();

  const toggleOpen = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    // Refresh data when opening dropdown to ensure count is up-to-date
    if (nextOpen) {
      fetchUnread();
      fetchRecent({ silent: true });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || marking) return;
    setMarking(true);
    try {
      // Fetch CSRF cookie first
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      const xsrfToken = getCookie('XSRF-TOKEN');
      await fetch(`/api/${prefix}/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
        },
      });
      // Update UI immediately
      setUnreadCount(0);
      setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    } catch {
      // Silently ignore errors
    } finally {
      setMarking(false);
    }
  };

  const handleViewAll = () => {
    if (onOpenAll) onOpenAll();
    setOpen(false);
  };

  const handleItemClick = async (n: NotificationItem) => {
    try {
      localStorage.setItem(PENDING_NOTIFICATION_ID_KEY, String(n.id));
      localStorage.setItem(PENDING_NOTIFICATION_ROLE_KEY, role);
      window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATION_EVENT));
    } catch {
      // ignore storage errors
    }

    if (onOpenAll) {
      onOpenAll();
      setOpen(false);
    }

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
        className="relative bg-white dark:bg-slate-800 p-1 rounded-full text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
        <div className="absolute right-0 mt-2 w-[22rem] sm:w-96 rounded-xl shadow-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{prefixLabel} Notifications</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {hasUnread ? `${unreadCount} unread` : 'No unread notifications'}
              </p>
            </div>
            {hasUnread && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={marking}
                className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {marking ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {loading && (
              <div className="px-4 py-5">
                <LoadingState message="Loading notifications" size="sm" inline />
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">No notifications yet.</div>
            )}
            {!loading && items.length > 0 && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 cursor-pointer transition-all duration-150 hover:translate-x-[1px] ${
                      n.read_at
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                        : 'bg-emerald-100/75 dark:bg-emerald-900/35 border-l-2 border-emerald-500 dark:border-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/45'
                    }`}
                    onClick={() => handleItemClick(n)}
                  >
                    <div className="flex items-start gap-3">
                      {n.data?.from_user_profile_picture ? (
                        <img
                          src={resolveImageUrl(n.data.from_user_profile_picture)}
                          alt={n.data.from_user_name || 'User'}
                          className="h-9 w-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                        />
                      ) : n.data?.from_user_name ? (
                        <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                            {n.data.from_user_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold line-clamp-1 ${
                            n.read_at ? 'text-slate-800 dark:text-slate-100' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {n.title}
                        </p>
                        {n.data?.from_user_name && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            From {n.data.from_user_name}
                            {n.data.from_role ? ` • ${n.data.from_role}` : ''}
                          </p>
                        )}
                        <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2 mt-1 break-words">{messagePreviewText(n.message)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                          {formatNotificationTime(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50/60 dark:bg-slate-800/70">
            <button
              type="button"
              onClick={handleViewAll}
              className="text-sm font-semibold text-green-600 hover:text-green-700"
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
