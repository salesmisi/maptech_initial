import React from 'react';

type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingStateProps {
  message?: string;
  size?: LoadingSize;
  className?: string;
  inline?: boolean;
}

const shellClasses: Record<LoadingSize, string> = {
  sm: 'max-w-xs gap-3 rounded-xl p-3',
  md: 'max-w-sm gap-4 rounded-2xl p-4',
  lg: 'max-w-lg gap-5 rounded-3xl p-5',
};

const avatarClasses: Record<LoadingSize, string> = {
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-11 w-11 rounded-xl',
  lg: 'h-14 w-14 rounded-2xl',
};

const headingClasses: Record<LoadingSize, string> = {
  sm: 'h-2.5 w-24',
  md: 'h-3 w-32',
  lg: 'h-3.5 w-40',
};

const lineSetClasses: Record<LoadingSize, string[]> = {
  sm: ['h-2 w-full', 'h-2 w-5/6'],
  md: ['h-2.5 w-full', 'h-2.5 w-11/12', 'h-2.5 w-8/12'],
  lg: ['h-3 w-full', 'h-3 w-10/12', 'h-3 w-7/12'],
};

const inlineShellClasses: Record<LoadingSize, string> = {
  sm: 'max-w-[11rem] gap-2.5 py-0',
  md: 'max-w-[14rem] gap-3 py-0.5',
  lg: 'max-w-[16rem] gap-3 py-1',
};

const inlineAvatarClasses: Record<LoadingSize, string> = {
  sm: 'h-4 w-4 rounded',
  md: 'h-5 w-5 rounded-md',
  lg: 'h-6 w-6 rounded-md',
};

const inlineLineClasses: Record<LoadingSize, string[]> = {
  sm: ['h-2 w-16', 'h-2 w-10'],
  md: ['h-2.5 w-20', 'h-2.5 w-12'],
  lg: ['h-3 w-24', 'h-3 w-16'],
};

function SkeletonBar({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 ${className}`}
    />
  );
};

export function LoadingState({
  message = 'Loading',
  size = 'md',
  className = '',
  inline = false,
}: LoadingStateProps) {
  if (inline) {
    return (
      <div
        className={`loading-state flex items-center justify-start ${inlineShellClasses[size]} ${className}`.trim()}
        role="status"
        aria-live="polite"
        aria-label={message}
      >
        <SkeletonBar className={inlineAvatarClasses[size]} />
        <div className="flex flex-col gap-1.5">
          {inlineLineClasses[size].map((lineClass) => (
            <SkeletonBar key={lineClass} className={lineClass} />
          ))}
        </div>
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  return (
    <div
      className={`loading-state flex justify-center py-8 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className={`w-full border border-slate-200/80 bg-white/85 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 ${shellClasses[size]}`}>
        <div className="flex items-center gap-3">
          <SkeletonBar className={avatarClasses[size]} />
          <div className="flex flex-1 flex-col gap-2">
            <SkeletonBar className={headingClasses[size]} />
            <SkeletonBar className="h-2 w-24 rounded-full" />
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {lineSetClasses[size].map((lineClass) => (
            <SkeletonBar key={lineClass} className={`${lineClass} rounded-full`} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 dark:border-slate-800">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {message}
          </span>
          <SkeletonBar className="h-2 w-14 rounded-full" />
        </div>
      </div>
      <span className="sr-only">{message}</span>
    </div>
  );
}
