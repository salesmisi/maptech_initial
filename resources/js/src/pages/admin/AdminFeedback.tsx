import React from 'react';
import FeedbacksPage from '../../components/feedback/FeedbacksPage';

const API = '/api/admin/feedbacks';

export function AdminFeedback() {
  return <FeedbacksPage apiBase={API} canDelete={true} canArchive={true} />;
}

export default AdminFeedback;
