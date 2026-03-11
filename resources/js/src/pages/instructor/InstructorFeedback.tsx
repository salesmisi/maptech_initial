import React from 'react';
import FeedbackList from '../../components/FeedbackList';

// Instructor should use the instructor route
const API = '/api/instructor/feedbacks';

export function InstructorFeedback() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Instructor — Feedbacks</h1>
      </div>
      <FeedbackList url={API} />
    </div>
  );
}

export default InstructorFeedback;
