import React from 'react';
import LessonQnA from '../../components/LessonQnA';

export function QAModule({ userId }: { userId?: number }) {
  // This page will show lesson-scoped Q&A — the component expects a lessonId when used inside a lesson viewer.
  return (
    <div className="space-y-6">
      <LessonQnA scope="employee" userId={userId} />
    </div>
  );
}

export default QAModule;
