import React, { useState } from 'react';
import FeedbackList from '../../components/FeedbackList';
import useConfirm from '../../hooks/useConfirm';

const API = '/api/admin/feedbacks';

export function AdminFeedback() {
  const [endpoint, setEndpoint] = useState(API + '?type=lesson');
  const [type, setType] = useState<'lesson' | 'quiz'>('lesson');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const confirm = useConfirm();
  const { showConfirm } = confirm;

  const bulkDelete = async () => {
    showConfirm('Delete selected feedbacks?', async () => {
      try {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
        const xsrf = document.cookie.match(/(^|; )XSRF-TOKEN=([^;]+)/)?.[2];
        const res = await fetch(`${API}/admin/feedbacks/bulk-delete`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf ? decodeURIComponent(xsrf) : '' },
          body: JSON.stringify({ ids: selectedIds, type }),
        });
        if (res.ok) {
          alert('Deleted');
          window.location.reload();
        }
      } catch (e: any) {
        alert(e.message || 'Failed to delete feedback');
      }
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin — Feedbacks</h1>
        <div className="flex items-center gap-3">
          <div>
            <label className="mr-2 text-sm">Type:</label>
            <select value={type} onChange={(e) => { const t = e.target.value as any; setType(t); setEndpoint(API + '?type=' + t); }} className="border rounded px-2 py-1">
              <option value="lesson">Lesson</option>
              <option value="quiz">Quiz</option>
            </select>
          </div>
          <div>
            <button onClick={bulkDelete} className="px-3 py-2 bg-red-600 text-white rounded">Delete Selected</button>
          </div>
        </div>
      </div>

      <FeedbackList url={endpoint} />
      {confirm.ConfirmModalRenderer()}
    </div>
  );
}

export default AdminFeedback;
