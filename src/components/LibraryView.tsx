import React, { useMemo, useState } from 'react';
import {
  Cloud,
  Edit3,
  Folder,
  Heart,
  ListMusic,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  filterAndSortTracks,
  formatDuration,
  LibraryFilterTab,
  LibrarySortField,
} from '../domain/libraryLogic';
import { ARTWORK_COVERS } from '../data/seedData';
import { Playlist, SynthProfile, Track } from '../types/novabeat';
import {
  AdaptiveBannerAdBar,
  MonetizationRuntimeState,
} from './MonetizationComponents';

interface LibraryViewProps {
  tracks: Track[];
  playlists: Playlist[];
  currentTrack: Track;
  isPlaying: boolean;
  onSelectTrack: (track: Track, autoPlay?: boolean) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
  onAddCustomTrack: (newTrack: Track) => void;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  onCreatePlaylist: (
    name: string,
    description: string,
    trackIds: string[]
  ) => { ok: boolean; error?: string };
  onOpenVisualizer: () => void;
  monetization?: MonetizationRuntimeState;
  onOpenProModal?: () => void;
  onOpenRewardedModal?: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  tracks,
  playlists,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onToggleFavorite,
  onAddCustomTrack,
  onUpdateTrack,
  onCreatePlaylist,
  onOpenVisualizer,
  monetization,
  onOpenProModal,
  onOpenRewardedModal,
}) => {
  const [activeTab, setActiveTab] = useState<LibraryFilterTab>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<LibrarySortField>('recent');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null
  );

  // Add Personal Audio & Image Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newGenre, setNewGenre] = useState('Electronic');
  const [newBpm, setNewBpm] = useState(128);
  const [newProfile, setNewProfile] = useState<SynthProfile>('shadow-synth');
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string>('');
  const [uploadedAudioDuration, setUploadedAudioDuration] =
    useState<number>(210);
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string>(
    ARTWORK_COVERS.lostInShadows
  );
  const [uploadedBackdropUrl, setUploadedBackdropUrl] = useState<string>(
    ARTWORK_COVERS.dreamscape
  );
  const [addFormError, setAddFormError] = useState('');

  // Edit Track Modal state
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editBpm, setEditBpm] = useState(124);
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editBackdropUrl, setEditBackdropUrl] = useState('');
  const [editCloudSynced, setEditCloudSynced] = useState(true);

  // Create Playlist Modal state
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [playlistTrackIds, setPlaylistTrackIds] = useState<string[]>([]);
  const [playlistError, setPlaylistError] = useState('');

  const folders = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tracks) {
      map.set(t.folder, (map.get(t.folder) ?? 0) + 1);
    }
    return Array.from(map.entries());
  }, [tracks]);

  const selectedPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId]
  );

  const visibleTracks = useMemo(
    () =>
      filterAndSortTracks(tracks, {
        searchQuery,
        tab: activeTab,
        selectedFolder,
        selectedPlaylist,
        sortBy,
      }),
    [tracks, searchQuery, activeTab, selectedFolder, selectedPlaylist, sortBy]
  );

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUploadedAudioUrl(objectUrl);

    if (!newTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setNewTitle(baseName);
    }

    const tempAudio = new Audio(objectUrl);
    tempAudio.onloadedmetadata = () => {
      if (Number.isFinite(tempAudio.duration) && tempAudio.duration > 0) {
        setUploadedAudioDuration(Math.round(tempAudio.duration));
      }
    };
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCustomTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setAddFormError('Please enter a track title.');
      return;
    }

    const created: Track = {
      id: `track-custom-${Date.now()}`,
      title: newTitle.trim(),
      artist: newArtist.trim() || 'Personal Studio Artist',
      album: 'Cloud & Personal Uploads',
      folder: 'Personal Uploads',
      durationSec: uploadedAudioDuration || 210,
      bpm: Number(newBpm) || 128,
      genre: newGenre.trim() || 'Custom Audio',
      coverUrl: uploadedCoverUrl || ARTWORK_COVERS.lostInShadows,
      customBackdropUrl: uploadedBackdropUrl || uploadedCoverUrl,
      audioSource: uploadedAudioUrl ? 'uploaded-audio' : 'synth-stem',
      synthProfile: newProfile,
      audioDataUrl: uploadedAudioUrl || undefined,
      isFavorite: true,
      isCloudSynced: true,
      playCount: 1,
      addedAt: Date.now(),
      lastPlayedAt: Date.now(),
    };

    onAddCustomTrack(created);
    setShowAddModal(false);
    setNewTitle('');
    setNewArtist('');
    setUploadedAudioUrl('');
    setAddFormError('');
  };

  const openEditTrackModal = (track: Track) => {
    setEditingTrack(track);
    setEditTitle(track.title);
    setEditArtist(track.artist);
    setEditGenre(track.genre);
    setEditBpm(track.bpm);
    setEditCoverUrl(track.coverUrl);
    setEditBackdropUrl(track.customBackdropUrl || track.coverUrl);
    setEditCloudSynced(track.isCloudSynced);
  };

  const handleSaveTrackEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack || !editTitle.trim()) return;
    onUpdateTrack(editingTrack.id, {
      title: editTitle.trim(),
      artist: editArtist.trim() || editingTrack.artist,
      genre: editGenre.trim() || editingTrack.genre,
      bpm: Number(editBpm) || editingTrack.bpm,
      coverUrl: editCoverUrl,
      customBackdropUrl: editBackdropUrl,
      isCloudSynced: editCloudSynced,
    });
    setEditingTrack(null);
  };

  const handleCreatePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onCreatePlaylist(playlistName, playlistDesc, playlistTrackIds);
    if (!res.ok) {
      setPlaylistError(res.error || 'Could not create playlist.');
      return;
    }
    setPlaylistName('');
    setPlaylistDesc('');
    setPlaylistTrackIds([]);
    setPlaylistError('');
    setShowPlaylistModal(false);
  };

  return (
    <section
      aria-label="Music and Cloud Library"
      className="flex flex-col h-full bg-[#090614]/90 border border-violet-500/15 rounded-2xl p-4 sm:p-6 overflow-hidden"
    >
      {/* Top Library Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-violet-500/15">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white font-display">
            Library & Cloud Studio
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {tracks.length} tracks indexed · Personal audio & custom visual backdrops synced
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl shadow-lg shadow-violet-600/25 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Add Audio / Image
          </button>

          <button
            type="button"
            onClick={() => {
              setPlaylistTrackIds([currentTrack.id]);
              setShowPlaylistModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-200 bg-violet-950/60 hover:bg-violet-900/70 border border-violet-500/25 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Playlist
          </button>
        </div>
      </div>

      {/* Segmented Category Tabs (matching Phone 5 in reference image: Songs | Playlists | Folders + Cloud & Favorites) */}
      <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
        <div
          role="tablist"
          aria-label="Library sections"
          className="flex items-center gap-1 p-1 bg-[#110B24] border border-violet-500/15 rounded-xl overflow-x-auto"
        >
          {(
            [
              { id: 'songs', label: 'Songs' },
              { id: 'cloud', label: 'Cloud Library' },
              { id: 'playlists', label: 'Playlists' },
              { id: 'folders', label: 'Folders' },
              { id: 'favorites', label: 'Favorites' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedFolder(null);
                  setSelectedPlaylistId(null);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2 flex-1 min-w-[220px] justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs, artists, genres..."
              aria-label="Search songs"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#120C24] border border-violet-500/20 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 bg-[#120C24] border border-violet-500/20 rounded-xl px-2.5 py-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <select
              aria-label="Sort tracks by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as LibrarySortField)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="recent" className="bg-[#0F0A1E]">
                Recent
              </option>
              <option value="title" className="bg-[#0F0A1E]">
                Title
              </option>
              <option value="artist" className="bg-[#0F0A1E]">
                Artist
              </option>
              <option value="duration" className="bg-[#0F0A1E]">
                Duration
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Contextual Sub-Bar for Playlists or Folders */}
      {activeTab === 'playlists' && (
        <div className="flex items-center gap-2 mt-3 pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedPlaylistId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedPlaylistId === null
                ? 'bg-violet-500/20 border-violet-400 text-violet-200'
                : 'bg-[#120C24] border-violet-500/15 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Playlists ({playlists.length})
          </button>
          {playlists.map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => setSelectedPlaylistId(pl.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedPlaylistId === pl.id
                  ? 'bg-violet-500/25 border-violet-400 text-white'
                  : 'bg-[#120C24] border-violet-500/15 text-slate-300 hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5 text-violet-400" />
              <span>{pl.name}</span>
              <span className="text-slate-400 font-mono">
                ({pl.trackIds.length})
              </span>
            </button>
          ))}
        </div>
      )}

      {activeTab === 'folders' && (
        <div className="flex items-center gap-2 mt-3 pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedFolder(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedFolder === null
                ? 'bg-violet-500/20 border-violet-400 text-violet-200'
                : 'bg-[#120C24] border-violet-500/15 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Folders
          </button>
          {folders.map(([folderName, count]) => (
            <button
              key={folderName}
              type="button"
              onClick={() => setSelectedFolder(folderName)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedFolder === folderName
                  ? 'bg-violet-500/25 border-violet-400 text-white'
                  : 'bg-[#120C24] border-violet-500/15 text-slate-300 hover:text-white'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-cyan-400" />
              <span>{folderName}</span>
              <span className="text-slate-400 font-mono">({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Track List */}
      <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
        {visibleTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-violet-500/20 rounded-2xl bg-[#0D081D]/50">
            <Music className="w-8 h-8 text-violet-400/60 mb-2" />
            <p className="text-sm font-semibold text-slate-200">
              No matching tracks in this view
            </p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Upload your own MP3/WAV audio and custom background images or clear the active search filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('songs');
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors cursor-pointer"
            >
              Show All Tracks
            </button>
          </div>
        ) : (
          visibleTracks.map((track) => {
            const isCurrent = track.id === currentTrack.id;
            return (
              <div
                key={track.id}
                className={`group flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-r from-violet-950/80 via-[#191036] to-violet-950/40 border-violet-500/45 shadow-md shadow-violet-950/50'
                    : 'bg-[#110B22]/75 hover:bg-[#17102E] border-violet-500/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isCurrent) {
                      onTogglePlay();
                    } else {
                      onSelectTrack(track, true);
                    }
                  }}
                  aria-label={`Play ${track.title} by ${track.artist}`}
                  className="flex items-center gap-3.5 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-violet-400/25 bg-[#1B1238]">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div
                      className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
                        isCurrent
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-5 h-5 text-white fill-white" />
                      ) : (
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold truncate ${
                          isCurrent ? 'text-violet-200' : 'text-slate-100'
                        }`}
                      >
                        {track.title}
                      </span>
                      {track.isCloudSynced && (
                        <Cloud
                          className="w-3.5 h-3.5 text-cyan-400 shrink-0"
                          aria-label="Cloud synced"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                      <span className="truncate">{track.artist}</span>
                      <span aria-hidden="true">·</span>
                      <span>{track.genre}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {track.bpm} BPM
                      </span>
                    </div>
                  </div>
                </button>

                {/* Right Row Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span className="text-xs font-mono tabular-nums text-slate-400 mr-1 hidden sm:inline">
                    {formatDuration(track.durationSec)}
                  </span>

                  <button
                    type="button"
                    onClick={() => onToggleFavorite(track.id)}
                    aria-label={
                      track.isFavorite
                        ? `Remove ${track.title} from favorites`
                        : `Add ${track.title} to favorites`
                    }
                    className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg hover:bg-violet-500/15 transition-colors cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        track.isFavorite
                          ? 'text-fuchsia-400 fill-fuchsia-400'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditTrackModal(track)}
                    aria-label={`Edit ${track.title} media and artwork`}
                    className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-violet-500/15 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) {
                        onTogglePlay();
                      } else {
                        onSelectTrack(track, true);
                      }
                    }}
                    aria-label={
                      isCurrent && isPlaying
                        ? `Pause ${track.title}`
                        : `Start playing ${track.title}`
                    }
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-violet-500 text-white shadow-md shadow-violet-500/40'
                        : 'bg-violet-950/70 text-violet-300 hover:bg-violet-600 hover:text-white'
                    }`}
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Non-Disruptive AdMob Adaptive Banner (Hidden automatically for Pro users or when offline) */}
      {monetization && onOpenProModal && onOpenRewardedModal && (
        <AdaptiveBannerAdBar
          monetization={monetization}
          isExportingVideo={false}
          onOpenProModal={onOpenProModal}
          onOpenRewardedModal={onOpenRewardedModal}
        />
      )}

      {/* Bottom Mini Now-Playing Bar inside Library (matching Phone 5 bottom bar) */}
      <div className="mt-3 pt-3 border-t border-violet-500/15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover border border-violet-400/30 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {currentTrack.title}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {currentTrack.artist} · Active in Studio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenVisualizer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-200 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            Visualize
          </button>
        </div>
      </div>

      {/* Modal 1: Add Personal Audio & Image */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Personal Audio and Image to Cloud Library"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-lg bg-[#110B22] border border-violet-500/30 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-violet-500/20">
              <h3 className="text-base font-bold text-white font-display">
                Add Personal Audio & Custom Images
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomTrack} className="space-y-4 mt-4">
              {addFormError && (
                <p className="text-xs text-rose-400 bg-rose-950/50 border border-rose-500/30 rounded-lg px-3 py-2">
                  {addFormError}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Track Title *
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => {
                      setNewTitle(e.target.value);
                      setAddFormError('');
                    }}
                    placeholder="e.g., Cyber Nocturne"
                    className="w-full px-3 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Artist / Creator
                  </label>
                  <input
                    type="text"
                    value={newArtist}
                    onChange={(e) => setNewArtist(e.target.value)}
                    placeholder="e.g., My Studio Project"
                    className="w-full px-3 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white focus:outline-none focus:border-violet-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Genre
                  </label>
                  <input
                    type="text"
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tempo (BPM)
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={200}
                    value={newBpm}
                    onChange={(e) => setNewBpm(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Harmonic Synth Stem
                  </label>
                  <select
                    value={newProfile}
                    onChange={(e) =>
                      setNewProfile(e.target.value as SynthProfile)
                    }
                    className="w-full px-2.5 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white"
                  >
                    <option value="shadow-synth">Shadow Synthwave</option>
                    <option value="future-trap">Future Trap Sub</option>
                    <option value="dreamscape-chill">Dreamscape Chill</option>
                    <option value="neon-outrun">Neon Outrun</option>
                    <option value="eternal-bass">Eternal Midtempo</option>
                  </select>
                </div>
              </div>

              {/* Personal Audio Upload */}
              <div className="p-3 bg-[#090614] border border-violet-500/20 rounded-xl">
                <label className="block text-xs font-semibold text-violet-200 mb-1">
                  Personal Audio File (MP3, WAV, OGG, FLAC — Optional)
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioFileUpload}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-600/30 file:text-violet-200 hover:file:bg-violet-600/50 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {uploadedAudioUrl
                    ? `Audio loaded (${formatDuration(uploadedAudioDuration)})`
                    : 'Or leave empty to synthesize with NovaBeat Studio stems.'}
                </p>
              </div>

              {/* Personal Cover Artwork & Visualizer Backdrop Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-[#090614] border border-violet-500/20 rounded-xl">
                  <label className="block text-xs font-semibold text-violet-200 mb-1.5">
                    Personal Cover Image
                  </label>
                  <div className="flex items-center gap-2.5">
                    <img
                      src={uploadedCoverUrl}
                      alt="Cover preview"
                      className="w-12 h-12 rounded-lg object-cover border border-violet-500/30 shrink-0"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageUpload(e, setUploadedCoverUrl)
                      }
                      className="block w-full text-[11px] text-slate-400 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-violet-600/30 file:text-violet-200 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#090614] border border-violet-500/20 rounded-xl">
                  <label className="block text-xs font-semibold text-cyan-200 mb-1.5">
                    Visualizer Backdrop Image
                  </label>
                  <div className="flex items-center gap-2.5">
                    <img
                      src={uploadedBackdropUrl}
                      alt="Backdrop preview"
                      className="w-12 h-12 rounded-lg object-cover border border-cyan-500/30 shrink-0"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageUpload(e, setUploadedBackdropUrl)
                      }
                      className="block w-full text-[11px] text-slate-400 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-cyan-600/30 file:text-cyan-200 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-lg shadow-violet-600/30 cursor-pointer"
                >
                  Save to Cloud Library
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Track Metadata & Personal Artwork */}
      {editingTrack && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Track and Personal Artwork"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md bg-[#110B22] border border-violet-500/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-violet-500/20">
              <h3 className="text-base font-bold text-white font-display">
                Edit Track & Personal Artwork
              </h3>
              <button
                type="button"
                onClick={() => setEditingTrack(null)}
                aria-label="Close edit modal"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTrackEdits} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Track Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Artist
                  </label>
                  <input
                    type="text"
                    value={editArtist}
                    onChange={(e) => setEditArtist(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    BPM
                  </label>
                  <input
                    type="number"
                    value={editBpm}
                    onChange={(e) => setEditBpm(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-[#090614] border border-violet-500/20 rounded-xl">
                  <span className="block text-[11px] font-medium text-slate-300 mb-1.5">
                    Replace Cover Image
                  </span>
                  <div className="flex items-center gap-2">
                    <img
                      src={editCoverUrl}
                      alt="Cover"
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setEditCoverUrl)}
                      className="w-full text-[10px] text-slate-400 file:py-1 file:px-2 file:rounded file:border-0 file:bg-violet-600/30 file:text-violet-200"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-[#090614] border border-violet-500/20 rounded-xl">
                  <span className="block text-[11px] font-medium text-slate-300 mb-1.5">
                    Visualizer Backdrop
                  </span>
                  <div className="flex items-center gap-2">
                    <img
                      src={editBackdropUrl}
                      alt="Backdrop"
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setEditBackdropUrl)}
                      className="w-full text-[10px] text-slate-400 file:py-1 file:px-2 file:rounded file:border-0 file:bg-cyan-600/30 file:text-cyan-200"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editCloudSynced}
                  onChange={(e) => setEditCloudSynced(e.target.checked)}
                  className="rounded border-violet-500 text-violet-600"
                />
                Sync modifications with NovaBeat Cloud Library
              </label>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTrack(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Playlist */}
      {showPlaylistModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create New Playlist"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md bg-[#110B22] border border-violet-500/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-violet-500/20">
              <h3 className="text-base font-bold text-white font-display">
                Create Visualizer Playlist
              </h3>
              <button
                type="button"
                onClick={() => setShowPlaylistModal(false)}
                aria-label="Close playlist modal"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreatePlaylistSubmit}
              className="space-y-3.5 mt-4"
            >
              {playlistError && (
                <p className="text-xs text-rose-400 bg-rose-950/50 border border-rose-500/30 rounded-lg px-3 py-2">
                  {playlistError}
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Playlist Name *
                </label>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => {
                    setPlaylistName(e.target.value);
                    setPlaylistError('');
                  }}
                  placeholder="e.g., Late Night Neon Sessions"
                  className="w-full px-3 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={playlistDesc}
                  onChange={(e) => setPlaylistDesc(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 text-xs bg-[#090614] border border-violet-500/25 rounded-xl text-white"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-300 mb-1.5">
                  Include Tracks ({playlistTrackIds.length} selected)
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-[#090614] border border-violet-500/20 rounded-xl">
                  {tracks.map((t) => {
                    const checked = playlistTrackIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer py-1 px-1.5 rounded hover:bg-violet-500/10"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setPlaylistTrackIds((prev) =>
                              checked
                                ? prev.filter((id) => id !== t.id)
                                : [...prev, t.id]
                            );
                          }}
                        />
                        <span className="truncate">{t.title}</span>
                        <span className="text-slate-500 ml-auto">{t.artist}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlaylistModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl cursor-pointer"
                >
                  Create Playlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
