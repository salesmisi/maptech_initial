import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Trash2, AlertTriangle, Search } from 'lucide-react';

interface ModuleLogoItem {
  id: number;
  title: string;
  course_id: string;
  course_title: string | null;
  logo_path: string | null;
  logo_name: string | null;
  logo_url: string | null;
  broken_logo: boolean;
  updated_at: string | null;
}

const API_BASE = '/api/admin/product-logos/modules';
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

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

export function ProductLogoManager() {
  const [items, setItems] = useState<ModuleLogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [busyModuleId, setBusyModuleId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoName, setLogoName] = useState('');
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const readModuleIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('moduleId');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const writeModuleIdToUrl = (moduleId: number | null) => {
    const params = new URLSearchParams(window.location.search);
    if (moduleId) {
      params.set('moduleId', String(moduleId));
    } else {
      params.delete('moduleId');
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', nextUrl);
  };

  const loadModules = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const url = search.trim() ? `${API_BASE}?q=${encodeURIComponent(search.trim())}` : API_BASE;
      const res = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Failed to load modules for Product Logo Manager.');
      }

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Unable to load module logos.' });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, []);

  useEffect(() => {
    const routeModuleId = readModuleIdFromUrl();
    if (routeModuleId) {
      setSelectedModuleId(routeModuleId);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setSelectedModuleId(readModuleIdFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (selectedModuleId === null) {
      setLogoName('');
      return;
    }

    const selected = items.find((item) => item.id === selectedModuleId);
    setLogoName(selected?.logo_name || '');
  }, [selectedModuleId, items]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        keyword.length === 0 ||
        item.title.toLowerCase().includes(keyword) ||
        (item.course_title || '').toLowerCase().includes(keyword);

      return matchSearch;
    });
  }, [items, search]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedModuleId) || null,
    [items, selectedModuleId]
  );

  useEffect(() => {
    if (selectedModuleId === null) {
      writeModuleIdToUrl(null);
      return;
    }

    const exists = items.some((item) => item.id === selectedModuleId);
    if (!exists) {
      setSelectedModuleId(null);
      writeModuleIdToUrl(null);
      return;
    }

    writeModuleIdToUrl(selectedModuleId);
  }, [selectedModuleId, items]);

  const validateImage = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only PNG and JPG files are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Logo file is too large. Maximum size is 2MB.';
    }
    return null;
  };

  const handleUpload = async (moduleId: number, file: File) => {
    const validationError = validateImage(file);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setBusyModuleId(moduleId);
    setMessage(null);

    try {
      const token = await getXsrfToken();
      const formData = new FormData();
      formData.append('logo', file);
      if (logoName.trim()) {
        formData.append('logo_name', logoName.trim());
      }

      const res = await fetch(`${API_BASE}/${moduleId}/logo`, {
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
      await loadModules();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Could not upload logo.' });
    } finally {
      setBusyModuleId(null);
      const input = fileInputRefs.current[moduleId];
      if (input) input.value = '';
    }
  };

  const handleUpdateName = async (moduleId: number) => {
    if (!logoName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a logo name before saving.' });
      return;
    }

    setBusyModuleId(moduleId);
    setMessage(null);

    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${moduleId}/logo`, {
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
      await loadModules();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Could not update logo name.' });
    } finally {
      setBusyModuleId(null);
    }
  };

  const handleDelete = async (moduleId: number) => {
    setBusyModuleId(moduleId);
    setMessage(null);

    try {
      const token = await getXsrfToken();
      const res = await fetch(`${API_BASE}/${moduleId}/logo`, {
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
      await loadModules();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Could not remove logo.' });
    } finally {
      setBusyModuleId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Product Logo Manager</h1>
        <p className="text-sm text-slate-600">
          Select a module first, then add, replace, rename, or delete its logo. Uploaded logos are stored in storage/product_logos.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search module or course..."
              className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <button
            type="button"
            onClick={loadModules}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="text-xs text-slate-500">Allowed formats: PNG/JPG. Maximum file size: 2MB.</div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading modules...</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">No modules found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Modules</h2>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const isSelected = selectedModuleId === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedModuleId(item.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                      isSelected
                        ? 'border-green-300 bg-green-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{item.title}</div>
                        <div className="text-xs text-slate-500">{item.course_title || 'Unassigned course'}</div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">ID {item.id}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Logo Actions</h2>

            {!selectedItem ? (
              <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg bg-slate-50">
                Select a module to manage its logo.
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <div className="text-sm font-medium text-slate-900">{selectedItem.title}</div>
                  <div className="text-xs text-slate-500">{selectedItem.course_title || 'Unassigned course'}</div>
                </div>

                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 min-h-[180px] p-3 flex items-center justify-center">
                  {selectedItem.logo_url ? (
                    <img
                      src={selectedItem.logo_url}
                      alt={`${selectedItem.title} logo`}
                      className="max-h-[150px] w-auto object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-center text-xs text-slate-500">
                      <ImagePlus className="h-5 w-5 mx-auto mb-1 text-slate-400" />
                      No logo assigned
                    </div>
                  )}
                </div>

                {selectedItem.broken_logo && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Assigned logo file is missing. Upload a replacement.
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Logo Name</label>
                  <input
                    value={logoName}
                    onChange={(e) => setLogoName(e.target.value)}
                    placeholder="Type logo name"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    You can set this while uploading, or edit it later when a logo already exists.
                  </p>
                </div>

                <input
                  ref={(el) => {
                    fileInputRefs.current[selectedItem.id] = el;
                  }}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUpload(selectedItem.id, file);
                    }
                  }}
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyModuleId === selectedItem.id}
                    onClick={() => fileInputRefs.current[selectedItem.id]?.click()}
                    className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <ImagePlus className="h-4 w-4 mr-1.5" />
                    {selectedItem.logo_path ? 'Replace Logo' : 'Upload Logo'}
                  </button>

                  <button
                    type="button"
                    disabled={busyModuleId === selectedItem.id || !selectedItem.logo_path}
                    onClick={() => handleUpdateName(selectedItem.id)}
                    className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Save Logo Name
                  </button>

                  <button
                    type="button"
                    disabled={busyModuleId === selectedItem.id || !selectedItem.logo_path}
                    onClick={() => handleDelete(selectedItem.id)}
                    className="inline-flex items-center rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete Logo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
