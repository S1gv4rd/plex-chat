"use client";

import { memo } from "react";
import { PlexLibrarySummary } from "@/lib/plex";

interface LibraryStatsProps {
  summary: PlexLibrarySummary | null;
  error: string | null;
  loading?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

const LibraryStats = memo(function LibraryStats({ summary, error, loading }: LibraryStatsProps) {
  // Don't show anything when offline - the banner already indicates this
  if (error) return null;

  // Show skeleton while loading
  if (loading || !summary) {
    return (
      <div className="hidden sm:flex items-center gap-1 text-xs">
        <div className="h-3 w-6 bg-white/10 rounded animate-pulse" />
        <span className="text-foreground/30">movies</span>
        <span className="text-foreground/20 mx-1">•</span>
        <div className="h-3 w-4 bg-white/10 rounded animate-pulse" />
        <span className="text-foreground/30">shows</span>
      </div>
    );
  }

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
