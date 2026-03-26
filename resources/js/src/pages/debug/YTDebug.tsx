import React from 'react';
import YouTubePlayer from '../../components/YouTubePlayer';

export function YTDebug() {
  const sampleUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">YouTube Player Debug</h1>
      <p className="text-sm text-slate-600 mb-3">This page is intentionally unauthenticated for quick preview.</p>
      <div className="w-full max-w-3xl h-80 bg-black rounded-md overflow-hidden">
        <YouTubePlayer contentUrl={sampleUrl} lessonId={0} />
      </div>
    </div>
  );
}

export default YTDebug;
