"use client";

import { memo } from "react";

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-pulse">
      <div className="w-16 h-16 bg-white/5 rounded-2xl mb-5" />
      <div className="h-6 w-48 bg-white/5 rounded mb-3" />
      <div className="h-4 w-64 bg-white/5 rounded mb-6" />
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-7 w-32 bg-white/5 rounded-full" />
        ))}
      </div>
    </div>
  );
});

export default LoadingSkeleton;
