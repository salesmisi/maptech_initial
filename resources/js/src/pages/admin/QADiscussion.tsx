import React from 'react';
import LessonQnA from '../../components/LessonQnA';

export function QADiscussion({ userId }: { userId?: number }) {
  return (
    <div className="space-y-6">
      <LessonQnA scope="admin" userId={userId} />
    </div>
  );
}

export default QADiscussion;
