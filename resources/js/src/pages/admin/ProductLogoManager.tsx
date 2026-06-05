import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, RefreshCw, Trash2, AlertTriangle, Search, ChevronRight, X, Filter } from 'lucide-react';
import { LoadingState } from '../../components/ui/LoadingState';

interface CourseLogoItem {
  id: string;
  title: string;
  department: string | null;
  subdepartment_name: string | null;
  logo_path: string | null;
  logo_name: string | null;
  logo_url: string | null;
  broken_logo: boolean;
  updated_at: string | null;
}

const API_BASE = '/api/admin/product-logos/courses';
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const PREVIEW_COUNT = 5;

function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

async function getXsrfToken(): Promise<string> {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
}

/* ─── Course Picker Modal ─────────────────────────────────────── */
interface CoursePickerModalProps {
  items: CourseLogoItem[];
  selectedCourseId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function CoursePickerModal({ items, selectedCourseId, onSelect, onClose }: CoursePickerModalProps) {
  const [modalSearch, setModalSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSubdept, setFilterSubdept] = useState('');

  const departments = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { if (i.department) set.add(i.department); });
    return Array.from(set).sort();
  }, [items]);

  const subdepartments = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.subdepartment_name && (!filterDept || i.department === filterDept)) {
        set.add(i.subdepartment_name);
      }
    });
    return Array.from(set).sort();
  }, [items, filterDept]);

  useEffect(() => { setFilterSubdept(''); }, [filterDept]);

  const filtered = useMemo(() => {
    const kw = modalSearch.trim().toLowerCase();
    return items.filter((i) => {
      if (filterDept && i.department !== filterDept) return false;
      if (filterSubdept && i.subdepartment_name !== filterSubdept) return false;
      if (kw && !i.title.toLowerCase().includes(kw) && !(i.department || '').toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [items, filterDept, filterSubdept, modalSearch]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[88vh]">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">All Courses</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select a course to manage its logo</p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon btn-icon-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* filters */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              placeholder="Search course name..."
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Filter className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 pl-8 pr-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1">
              <Filter className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={filterSubdept}
                onChange={(e) => setFilterSubdept(e.target.value)}
                disabled={subdepartments.length === 0}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 pl-8 pr-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none disabled:opacity-50"
              >
                <option value="">All Subdepartments</option>
                {subdepartments.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* course list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No courses match the selected filters.</div>
          ) : (
            filtered.map((item) => {
              const isSelected = item.id === selectedCourseId;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => { onSelect(item.id); onClose(); }}
                  className={`group w-full text-left rounded-lg border px-3 py-2.5 transition ${
                    isSelected
                      ? 'border-green-500 bg-green-50 dark:border-green-500/70 dark:bg-green-900/35'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-sm font-medium truncate ${isSelected ? 'text-green-900 dark:text-green-100' : 'text-slate-900 dark:text-slate-100'}`}>
                        {item.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {item.department && (
                          <span className={`text-xs ${isSelected ? 'text-green-700 dark:text-green-300' : 'text-slate-500 dark:text-slate-400'}`}>
                            {item.department}
                          </span>
                        )}
                        {item.subdepartment_name && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                            <span className={`text-xs ${isSelected ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                              {item.subdepartment_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.logo_url && (
                        <img
                          src={item.logo_url}
                          alt=""
                          className="h-7 w-7 rounded object-contain border border-slate-200 dark:border-slate-700 bg-slate-50"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isSelected
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {item.logo_path ? '✓ logo' : 'no logo'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} of {items.length} course{items.length !== 1 ? 's' : ''}
          </span>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ProductLogoManager() {
  const [items, setItems] = useState<CourseLogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoName, setLogoName] = useState('');
  const [showPickerModal, setShowPickerModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const readCourseIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('courseId');
  };

  const writeCourseIdToUrl = (courseId: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (courseId) {
      params.set('courseId', courseId);
    } else {
      params.delete('courseId');
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', nextUrl);
  };

  const loadCourses = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const url = search.trim() ? `${API_BASE}?q=${encodeURIComponent(search.trim())}` : API_BASE;
      const res = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Failed to load courses for Product Logo Manager.');
      }

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Unable to load course logos.' });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    const routeCourseId = readCourseIdFromUrl();
    if (routeCourseId) {
      setSelectedCourseId(routeCourseId);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setSelectedCourseId(readCourseIdFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (selectedCourseId === null) {
      setLogoName('');
      return;
    }

    const selected = items.find((item) => item.id === selectedCourseId);
    setLogoName(selected?.logo_name || '');
  }, [selectedCourseId, items]);

  const previewItems = useMemo(() => {
    const kw = search.trim().toLowerCase();
    const filtered = kw
      ? items.filter((i) => i.title.toLowerCase().includes(kw) || (i.department || '').toLowerCase().includes(kw))
      : items;
    return filtered.slice(0, PREVIEW_COUNT);
  }, [items, search]);

  const totalFiltered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return items.length;
    return items.filter((i) => i.title.toLowerCase().includes(kw) || (i.department || '').toLowerCase().includes(kw)).length;
  }, [items, search]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedCourseId) || null,
    [items, selectedCourseId]
  );

  useEffect(() => {
    if (selectedCourseId === null) {
      writeCourseIdToUrl(null);
      return;
    }

    const exists = items.some((item) => item.id === selectedCourseId);
    if (!exists) {
      setSelectedCourseId(null);
      writeCourseIdToUrl(null);
      return;
    }

    writeCourseIdToUrl(selectedCourseId);
  }, [selectedCourseId, items]);

  const validateImage = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only PNG and JPG files are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Logo file is too large. Maximum size is 2MB.';
    }
    return null;
  };

  const handleUpload = async (courseId: string, file: File) => {
    const validationError = validateImage(file);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setBusyCourseId(courseId);
    setMessage(null);

    try {
      const token = await getXsrfToken();
      const formData = new FormData();
      formData.append('logo', file);
      if (logoName.trim()) {
        formData.append('logo_name', logoName.trim());
      }

      const res = await fetch(`${API_BASE}/${courseId}/logo`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-XSRF-TOKEN': token,
        },
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Upload failed.');
      }

      setMessage({ type: 'success', text: 'Logo uploaded and assigned successfully.' });
      await loadCourses();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Could not upload logo.' });
    } finally {
      setBusyCourseId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateName = async (courseId: string) => {
    if (!logoName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a logo name before saving.' });
      return;
    }

    setBusyCourseId(courseId);
    setMessage(null);

    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${courseId}/logo`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': token,
        },
        body: JSON.stringify({ logo_name: logoName.trim() }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Could not update logo name.');
      }

      setMessage({ type: 'success', text: 'Logo name updated successfully.' });
      await loadCourses();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Could not update logo name.' });
    } finally {
      setBusyCourseId(null);
    }
  };

  const handleDelete = async (courseId: string) => {
    setBusyCourseId(courseId);
    setMessage(null);

    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${courseId}/logo`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-XSRF-TOKEN': token,
        },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Delete failed.');
      }

      setMessage({ type: 'success', text: 'Logo removed successfully.' });
      await loadCourses();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Could not remove logo.' });
    } finally {
      setBusyCourseId(null);
    }
  };

  return (
    <div className="space-y-6">

      {message && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Search + Refresh bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search course or department..."
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>
          <button type="button" onClick={loadCourses} className="btn btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">Allowed formats: PNG/JPG. Maximum file size: 2MB.</div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-10">
          <LoadingState message="Loading courses" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">
          No courses found.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: course preview list (max 5) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm flex flex-col">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Courses</h2>

            <div className="space-y-2">
              {previewItems.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">No courses match your search.</p>
              ) : (
                previewItems.map((item) => {
                  const isSelected = selectedCourseId === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedCourseId(item.id)}
                      className={`group w-full text-left rounded-lg border px-3 py-2 transition ${
                        isSelected
                          ? 'border-green-500 bg-green-50 dark:border-green-500/70 dark:bg-green-900/35'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-sm font-medium truncate ${isSelected ? 'text-green-900 dark:text-green-100' : 'text-slate-900 dark:text-slate-100'}`}>
                            {item.title}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className={`text-xs ${isSelected ? 'text-green-700 dark:text-green-300' : 'text-slate-500 dark:text-slate-400'}`}>
                              {item.department || 'Unassigned'}
                            </span>
                            {item.subdepartment_name && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                                <span className={`text-xs ${isSelected ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                  {item.subdepartment_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] shrink-0 ${isSelected ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                          ID {item.id}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* "See all courses" — shown when more than PREVIEW_COUNT exist */}
            {totalFiltered > PREVIEW_COUNT && (
              <button
                type="button"
                onClick={() => setShowPickerModal(true)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 py-2.5 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-400 dark:hover:border-green-600 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
                See all {totalFiltered} courses
              </button>
            )}

            {/* Browse & filter — always available even with ≤5 courses */}
            {totalFiltered <= PREVIEW_COUNT && totalFiltered > 0 && (
              <button
                type="button"
                onClick={() => setShowPickerModal(true)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 py-2 text-xs text-slate-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-700 transition-colors"
              >
                <Filter className="h-3.5 w-3.5" />
                Browse &amp; filter courses
              </button>
            )}
          </div>

          {/* Right: Logo Actions */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm flex flex-col">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Logo Actions</h2>

            {!selectedItem ? (
              <div className="w-full flex-1 min-h-[220px] sm:min-h-[280px] rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30 p-4 text-center text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center">
                Select a course to manage its logo.
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedItem.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{selectedItem.department || 'Unassigned'}</span>
                    {selectedItem.subdepartment_name && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{selectedItem.subdepartment_name}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30 min-h-[180px] p-3 flex items-center justify-center">
                  {selectedItem.logo_url ? (
                    <img
                      src={selectedItem.logo_url}
                      alt={`${selectedItem.title} logo`}
                      className="max-h-[150px] w-auto object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                      <ImagePlus className="h-5 w-5 mx-auto mb-1 text-slate-400 dark:text-slate-500" />
                      No logo assigned
                    </div>
                  )}
                </div>

                {selectedItem.broken_logo && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md px-2 py-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Assigned logo file is missing. Upload a replacement.
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Logo Name</label>
                  <input
                    value={logoName}
                    onChange={(e) => setLogoName(e.target.value)}
                    placeholder="Type logo name"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    You can set this while uploading, or edit it later when a logo already exists.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && selectedItem) handleUpload(selectedItem.id, file);
                  }}
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyCourseId === selectedItem.id}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-primary btn-sm"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {selectedItem.logo_path ? 'Replace Logo' : 'Upload Logo'}
                  </button>

                  <button
                    type="button"
                    disabled={busyCourseId === selectedItem.id || !selectedItem.logo_path}
                    onClick={() => handleUpdateName(selectedItem.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    Save Logo Name
                  </button>

                  <button
                    type="button"
                    disabled={busyCourseId === selectedItem.id || !selectedItem.logo_path}
                    onClick={() => handleDelete(selectedItem.id)}
                    className="btn btn-danger-outline btn-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Logo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Course Picker Modal */}
      {showPickerModal && (
        <CoursePickerModal
          items={items}
          selectedCourseId={selectedCourseId}
          onSelect={(id) => setSelectedCourseId(id)}
          onClose={() => setShowPickerModal(false)}
        />
      )}
    </div>
  );
}
