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
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Student Feedbacks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">View student feedback on lessons and quizzes (view-only)</p>
        </div>
        <div>
          <label className="mr-2 text-sm text-slate-700 dark:text-slate-300">Type:</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
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
