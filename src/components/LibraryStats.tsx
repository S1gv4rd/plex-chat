"use client";

import { memo } from "react";
import { PlexLibrarySummary } from "@/lib/plex";

interface LibraryStatsProps {
  summary: PlexLibrarySummary | null;
  error: string | null;
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

const LibraryStats = memo(function LibraryStats({ summary, error }: LibraryStatsProps) {
  if (error) {
    return (
      <div className="hidden sm:block">
        <span className="text-xs text-red-400/80 bg-red-900/20 px-2 py-1 rounded-md">Offline</span>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="hidden sm:flex items-center gap-1 text-xs text-foreground/50">
      <span className="font-medium text-plex-orange">{formatNumber(summary.totalMovies)}</span>
      <span>movies</span>
      <span className="text-foreground/20 mx-1">•</span>
      <span className="font-medium text-plex-orange">{formatNumber(summary.totalShows)}</span>
      <span>shows</span>
      <span className="text-foreground/20 mx-1">•</span>
      <span className="font-medium text-plex-orange">{formatNumber(summary.totalEpisodes)}</span>
      <span>episodes</span>
    </div>
  );
});

export default LibraryStats;
