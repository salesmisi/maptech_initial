import React from 'react';
import FeedbackList from '../../components/FeedbackList';

// Instructor should use the instructor route
const API = '/api/instructor/feedbacks';

export function InstructorFeedback() {
  const [type, setType] = React.useState<'lesson' | 'quiz'>('lesson');
  const endpoint = API + '?type=' + type;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Instructor — Feedbacks</h1>
        <div>
          <label className="mr-2 text-sm">Type:</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="border rounded px-2 py-1">
            <option value="lesson">Lesson</option>
            <option value="quiz">Quiz</option>
          </select>
        </div>
      </div>
      <FeedbackList url={endpoint} />
    </div>
  );
}

export default InstructorFeedback;
