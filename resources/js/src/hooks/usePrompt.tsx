import { useRef, useState } from 'react';
import PromptModal from '../components/PromptModal';

export default function usePrompt() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const actionRef = useRef<((val: string | null) => Promise<void> | void) | null>(null);

  const showPrompt = (msg: string, def: string | undefined, action: (val: string | null) => Promise<void> | void) => {
    actionRef.current = action;
    setMessage(msg);
    setDefaultValue(def || '');
    setOpen(true);
  };

  const handleConfirm = async (val: string | null) => {
    setOpen(false);
    const a = actionRef.current;
    actionRef.current = null;
    if (a) await a(val);
  };

  const handleCancel = () => {
    actionRef.current = null;
    setOpen(false);
  };

  const PromptModalRenderer = () => (
    <PromptModal open={open} message={message} defaultValue={defaultValue} onConfirm={handleConfirm} onCancel={handleCancel} />
  );

  return { showPrompt, PromptModalRenderer };
}
