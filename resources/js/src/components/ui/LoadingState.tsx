import React from 'react';
import { Loader2 } from 'lucide-react';

type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingStateProps {
  message?: string;
  size?: LoadingSize;
  className?: string;
  inline?: boolean;
}

const spinnerSizeClasses: Record<LoadingSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

const textSizeClasses: Record<LoadingSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function LoadingState({
  message = 'Loading',
  size = 'md',
  className = '',
  inline = false,
}: LoadingStateProps) {
  const layoutClass = inline ? 'justify-start py-0' : 'justify-center py-8';

  return (
    <div className={`loading-state flex items-center gap-2 ${layoutClass} ${className}`.trim()} role="status" aria-live="polite">
      <Loader2 className={`loading-state-spinner animate-spin text-green-600 ${spinnerSizeClasses[size]}`} />
      <span className={`loading-state-text font-medium text-slate-600 dark:text-slate-300 ${textSizeClasses[size]}`}>
        {message}
      </span>
      <span className="loading-state-dots" aria-hidden="true" />
    </div>
  );
}
