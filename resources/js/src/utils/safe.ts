export function safeArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v as T[] : [];
}

export function safeLength(v: any): number {
  return Array.isArray(v) ? v.length : 0;
}

export function resolveImageUrl(
  value: string | null | undefined,
  options?: { fallback?: string; assumeStorage?: boolean }
): string {
  const fallback = options?.fallback ?? '';
  if (!value || typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if (/^(data:|blob:|https?:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\\/g, '/');

  if (normalized.startsWith('/')) {
    return normalized;
  }

  if (normalized.startsWith('storage/')) {
    return `/${normalized}`;
  }

  if (normalized.startsWith('public/storage/')) {
    return `/${normalized.slice('public/'.length)}`;
  }

  if (normalized.startsWith('public/')) {
    return `/${normalized.slice('public/'.length)}`;
  }

  if (normalized.startsWith('assets/') || normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  if (options?.assumeStorage ?? true) {
    return `/storage/${normalized.replace(/^storage\//, '')}`;
  }

  return `/${normalized}`;
}
