"use client";

import { PlexLibrarySummary } from "@/lib/plex";

interface LibraryStatsProps {
  summary: PlexLibrarySummary | null;
  loading: boolean;
  error: string | null;
}

export default function LibraryStats({ summary, loading, error }: LibraryStatsProps) {
  if (loading) {
    return (
      <div className="bg-plex-dark rounded-xl p-4 mb-4">
        <div className="animate-pulse flex gap-4">
          <div className="h-12 w-24 bg-plex-gray rounded" />
          <div className="h-12 w-24 bg-plex-gray rounded" />
          <div className="h-12 w-24 bg-plex-gray rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 mb-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="bg-plex-dark rounded-xl p-4 mb-4">
      <div className="flex flex-wrap gap-4 justify-center md:justify-start">
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-plex-orange">
            {summary.totalMovies}
          </div>
          <div className="text-xs text-foreground/60">Movies</div>
        </div>
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-plex-orange">
            {summary.totalShows}
          </div>
          <div className="text-xs text-foreground/60">TV Shows</div>
        </div>
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-plex-orange">
            {summary.totalEpisodes}
          </div>
          <div className="text-xs text-foreground/60">Episodes</div>
        </div>
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-plex-orange">
            {summary.libraries.length}
          </div>
          <div className="text-xs text-foreground/60">Libraries</div>
        </div>
      </div>
    </div>
  );
}
