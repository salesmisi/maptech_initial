import React from 'react';
import LessonQnA from '../../components/LessonQnA';

export function QADiscussion() {
  return (
    <div className="space-y-6">
      <LessonQnA scope="instructor" />
    </div>
  );
}

export default QADiscussion;
