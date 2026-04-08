import { useState, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function useConfirm() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<ConfirmOptions>({});
  const actionRef = useRef<(() => Promise<void> | void) | null>(null);

  const showConfirm = (
    msg: string,
    action: () => Promise<void> | void,
    opts: ConfirmOptions = {}
  ) => {
    actionRef.current = action;
    setMessage(msg);
    setOptions(opts);
    setOpen(true);
  };

  const handleConfirm = async () => {
    setOpen(false);
    const a = actionRef.current;
    actionRef.current = null;
    if (a) await a();
  };

  const handleCancel = () => {
    actionRef.current = null;
    setOpen(false);
  };

  const ConfirmModalRenderer = () => (
    <ConfirmModal
      open={open}
      message={message}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      title={options.title}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      variant={options.variant}
    />
  );

  return { showConfirm, ConfirmModalRenderer };
}
