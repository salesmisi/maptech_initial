import React, { useEffect, useState } from 'react';

interface ModuleItem {
  id: number | string;
  title: string;
}

interface Props {
  open: boolean;
  modules: ModuleItem[];
  onConfirm: (moduleId: number | string) => void;
  onCancel: () => void;
}

export default function UnlockModuleModal({ open, modules, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setValue('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleOk = () => {
    setError(null);
    const n = Number(value?.trim());
    if (!Number.isFinite(n) || n < 1 || n > modules.length) {
      setError('Please enter a valid module number from the list.');
      return;
    }
    const chosen = modules[n - 1];
    if (!chosen) {
      setError('Selected module not found.');
      return;
    }
    onConfirm(chosen.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Select module to unlock for this user:</h3>

        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700 mb-4">
          {modules.map((m, idx) => (
            <li key={m.id} className="py-1">
              <span className="font-medium mr-2">{idx + 1}.</span>
              <span>{m.title}</span>
            </li>
          ))}
        </ol>

        <label className="block text-sm text-slate-600 mb-2">Enter number:</label>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-300 mb-2"
          placeholder="e.g. 1"
        />
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full bg-pink-100 text-pink-700 hover:opacity-90"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleOk}
            className="px-4 py-2 rounded-full bg-purple-600 text-white hover:opacity-95"
            type="button"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
