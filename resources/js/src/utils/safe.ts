export function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? v as T[] : [];
}

export function safeLength(v: any): number {
  return Array.isArray(v) ? v.length : 0;
}
