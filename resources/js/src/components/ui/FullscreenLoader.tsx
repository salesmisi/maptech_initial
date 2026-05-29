import React from 'react';

export function FullscreenLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95">
      <style>{`
        @keyframes barPulse {
          0% { transform: scaleY(0.3); opacity: 0.6; }
          50% { transform: scaleY(1); opacity: 1; }
          100% { transform: scaleY(0.3); opacity: 0.6; }
        }
      `}</style>
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-end gap-2 h-12">
          {[0,1,2,3,4].map((i) => (
            <div
              key={i}
              className={`rounded-sm bg-green-600 dark:bg-green-600`} 
              style={{
                width: i === 0 ? 10 : 6,
                height: 20 + i * 6,
                borderRadius: 2,
                animation: `barPulse 900ms ${i * 120}ms infinite ease-in-out`,
                transformOrigin: 'center bottom',
                boxShadow: '0 0 14px rgba(16,185,129,0.12)'
              }}
            />
          ))}
        </div>
        {message ? <div className="text-sm text-slate-200/80">{message}</div> : null}
      </div>
    </div>
  );
}
