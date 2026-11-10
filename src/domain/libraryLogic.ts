import { Playlist, Track, VisualizerConfig } from '../types/novabeat';

export type LibraryFilterTab = 'songs' | 'cloud' | 'playlists' | 'favorites' | 'folders';
export type LibrarySortField = 'title' | 'artist' | 'duration' | 'recent';

/**
 * Formats seconds into MM:SS tabular string.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Filters and sorts tracks according to search query, active tab, folder, and sort field.
 */
export function filterAndSortTracks(
  tracks: Track[],
  options: {
    searchQuery: string;
    tab: LibraryFilterTab;
    selectedFolder?: string | null;
    selectedPlaylist?: Playlist | null;
    sortBy: LibrarySortField;
  }
): Track[] {
  const query = options.searchQuery.trim().toLowerCase();

  const filtered = tracks.filter((track) => {
    if (options.tab === 'favorites' && !track.isFavorite) {
      return false;
    }
    if (options.tab === 'cloud' && !track.isCloudSynced) {
      return false;
    }
    if (
      options.tab === 'folders' &&
      options.selectedFolder &&
      track.folder !== options.selectedFolder
    ) {
      return false;
    }
    if (
      options.tab === 'playlists' &&
      options.selectedPlaylist &&
      !options.selectedPlaylist.trackIds.includes(track.id)
    ) {
      return false;
    }

    if (!query) return true;
    return (
      track.title.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      track.album.toLowerCase().includes(query) ||
      track.genre.toLowerCase().includes(query)
    );
  });

  return [...filtered].sort((a, b) => {
    switch (options.sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'artist':
        return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
      case 'duration':
        return b.durationSec - a.durationSec;
      case 'recent':
        return (b.lastPlayedAt ?? b.addedAt) - (a.lastPlayedAt ?? a.addedAt);
      default:
        return 0;
    }
  });
}

/**
 * Toggles favorite status for a track by ID.
 */
export function toggleTrackFavorite(tracks: Track[], trackId: string): Track[] {
  return tracks.map((track) =>
    track.id === trackId ? { ...track, isFavorite: !track.isFavorite } : track
  );
}

/**
 * Updates editable metadata and personal artwork/backdrop for a track.
 */
export function updateTrackMetadata(
  tracks: Track[],
  trackId: string,
  updates: Partial<
    Pick<
      Track,
      | 'title'
      | 'artist'
      | 'album'
      | 'genre'
      | 'bpm'
      | 'coverUrl'
      | 'customBackdropUrl'
      | 'synthProfile'
      | 'isCloudSynced'
    >
  >
): Track[] {
  return tracks.map((track) => {
    if (track.id !== trackId) return track;
    const cleanTitle = updates.title?.trim() || track.title;
    const cleanArtist = updates.artist?.trim() || track.artist;
    return {
      ...track,
      ...updates,
      title: cleanTitle,
      artist: cleanArtist,
    };
  });
}

/**
 * Creates a new validated playlist.
 */
export function createNewPlaylist(
  existingPlaylists: Playlist[],
  name: string,
  description: string,
  trackIds: string[],
  accentColor = '#8B5CF6'
): { playlists: Playlist[]; created: Playlist | null; error?: string } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return {
      playlists: existingPlaylists,
      created: null,
      error: 'Playlist name is required.',
    };
  }

  const created: Playlist = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: trimmedName,
    description: description.trim() || 'Custom visualizer playlist',
    trackIds: Array.from(new Set(trackIds)),
    accentColor,
    createdAt: Date.now(),
  };

  return {
    playlists: [created, ...existingPlaylists],
    created,
  };
}

/**
 * Clones and saves a custom VisualizerConfig preset with validation.
 */
export function saveCustomPreset(
  presets: VisualizerConfig[],
  currentConfig: VisualizerConfig,
  presetName: string
): { presets: VisualizerConfig[]; saved: VisualizerConfig | null; error?: string } {
  const cleanName = presetName.trim();
  if (!cleanName) {
    return {
      presets,
      saved: null,
      error: 'Preset name cannot be empty.',
    };
  }

  const saved: VisualizerConfig = {
    ...currentConfig,
    id: `preset-${Date.now()}`,
    name: cleanName,
    layers: currentConfig.layers.map((layer) => ({ ...layer })),
  };

  return {
    presets: [saved, ...presets],
    saved,
  };
}
