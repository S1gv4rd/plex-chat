// Plex API type definitions

export interface PlexMediaItem {
  ratingKey: string;
  title: string;
  type: string;
  year?: number;
  summary?: string;
  genres?: string[];
  directors?: string[];
  actors?: string[];
  addedAt?: number;
  lastViewedAt?: number;
  viewCount?: number;
  grandparentTitle?: string;
  parentTitle?: string;
  index?: number;
  parentIndex?: number;
  leafCount?: number;
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
  itemCount?: number;
}

export interface PlexLibrarySummary {
  libraries: PlexLibrary[];
  totalMovies: number;
  totalShows: number;
  totalEpisodes: number;
  recentlyAdded: PlexMediaItem[];
  recentlyWatched: PlexMediaItem[];
}

// Plex API response types
export interface PlexApiTag {
  tag: string;
}

export interface PlexApiMediaItem {
  ratingKey: string;
  title: string;
  type: string;
  year?: number;
  summary?: string;
  addedAt?: number;
  lastViewedAt?: number;
  viewCount?: number;
  grandparentTitle?: string;
  parentTitle?: string;
  index?: number;
  parentIndex?: number;
  leafCount?: number;
  Genre?: PlexApiTag[];
  Director?: PlexApiTag[];
  Role?: (PlexApiTag & { role?: string })[];
  Writer?: PlexApiTag[];
  duration?: number;
  rating?: number;
  contentRating?: string;
  studio?: string;
  originallyAvailableAt?: string;
}

export interface PlexApiLibrary {
  key: string;
  title: string;
  type: string;
}

export interface PlexApiCollection {
  ratingKey: string;
  title: string;
  childCount?: number;
}

export interface PlexApiResponse {
  MediaContainer?: {
    Directory?: PlexApiLibrary[];
    Metadata?: (PlexApiMediaItem | PlexApiCollection)[];
    totalSize?: number;
    size?: number;
  };
}
