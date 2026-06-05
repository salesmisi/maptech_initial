import React, { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  departments: string[];
  initial?: string;
  actionLabel?: string;
  onConfirm: (department: string) => void;
  onCancel: () => void;
}

export default function DepartmentSelectModal({ open, departments, initial, actionLabel = 'Confirm', onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<string>(initial || '');

  useEffect(() => {
    if (!open) setSelected(initial || '');
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Choose Department</h3>
        <p className="text-sm text-slate-600 mb-3">Select the department to apply this action to.</p>

        <div className="space-y-2 max-h-64 overflow-auto mb-4">
          {departments.length === 0 ? (
            <div className="text-sm text-slate-500">No departments available.</div>
          ) : (
            departments.map((d) => (
              <label key={d} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="dept"
                  value={d}
                  checked={selected === d}
                  onChange={() => setSelected(d)}
                  className="accent-green-600"
                />
                <span className="text-sm text-slate-700">{d}</span>
              </label>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onCancel} className="px-4 py-2 rounded-full bg-slate-100 text-slate-700">Cancel</button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="px-4 py-2 rounded-full bg-green-600 text-white disabled:opacity-50"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
