import { useState, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';

export default function useConfirm() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const actionRef = useRef<(() => Promise<void> | void) | null>(null);

  const showConfirm = (msg: string, action: () => Promise<void> | void) => {
    actionRef.current = action;
    setMessage(msg);
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
    <ConfirmModal open={open} message={message} onConfirm={handleConfirm} onCancel={handleCancel} />
  );

  return { showConfirm, ConfirmModalRenderer };
}
