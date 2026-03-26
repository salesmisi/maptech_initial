import React from 'react';

export default function ConfirmModal({ open, message, onConfirm, onCancel }: {
  open: boolean;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5">
        <p className="text-sm text-slate-700">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 border rounded text-sm">No</button>
          <button onClick={onConfirm} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm">Yes</button>
        </div>
      </div>
    </div>
  );
}
