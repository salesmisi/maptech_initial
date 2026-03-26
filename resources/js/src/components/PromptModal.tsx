import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  message: string;
  defaultValue?: string;
  onConfirm: (value: string | null) => void;
  onCancel: () => void;
}

export default function PromptModal({ open, message, defaultValue = '', onConfirm, onCancel }: Props) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onCancel}></div>
      <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-md z-50 p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">{message}</h3>
          <button onClick={onCancel} className="text-gray-500">Cancel</button>
        </div>
        <div className="mb-4">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Enter value"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1 border rounded bg-white">Cancel</button>
          <button
            onClick={() => onConfirm(value)}
            className="px-3 py-1 rounded bg-blue-600 text-white"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
