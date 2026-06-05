import React from 'react';
import FeedbacksPage from '../../components/feedback/FeedbacksPage';

const API = '/api/instructor/feedbacks';

export function InstructorFeedback() {
  return <FeedbacksPage apiBase={API} />;
}

export default InstructorFeedback;
