import React from 'react';
import LessonQnA from '../../components/LessonQnA';

export function QAModule() {
  // This page will show lesson-scoped Q&A — the component expects a lessonId when used inside a lesson viewer.
  return (
    <div className="space-y-6">
      <LessonQnA scope="employee" />
    </div>
  );
}

export default QAModule;
