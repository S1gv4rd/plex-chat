"use client";

import { memo } from "react";

interface OfflineIndicatorProps {
  error: string | null;
}

const OfflineIndicator = memo(function OfflineIndicator({ error }: OfflineIndicatorProps) {
  if (!error) return null;

  return (
    <div role="alert" className="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 mb-1">
      <div className="max-w-2xl mx-auto flex items-center justify-center gap-2.5 text-red-400 text-sm font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-7.072 7.072a9 9 0 010-12.728m3.536 3.536a4 4 0 010 5.656M12 12h.01" />
        </svg>
        <span>Plex server offline</span>
        <button
          onClick={() => window.location.reload()}
          className="ml-2 underline hover:text-red-300"
        >
          Retry
        </button>
      </div>
    </div>
  );
});

export default OfflineIndicator;
