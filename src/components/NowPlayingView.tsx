import React from 'react';
import {
  BarChart3,
  ChevronRight,
  Heart,
  ImagePlus,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatDuration } from '../domain/libraryLogic';
import { FrequencyBands, Track } from '../types/novabeat';

interface NowPlayingViewProps {
  track: Track;
  isPlaying: boolean;
  currentTimeSec: number;
  bands: FrequencyBands;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (sec: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleFavorite: (trackId: string) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onUpdateTrackCover: (trackId: string, dataUrl: string) => void;
  onOpenVisualizer: () => void;
}

export const NowPlayingView: React.FC<NowPlayingViewProps> = ({
  track,
  isPlaying,
  currentTimeSec,
  bands,
  isShuffle,
  repeatMode,
  volume,
  isMuted,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onToggleFavorite,
  onVolumeChange,
  onToggleMute,
  onUpdateTrackCover,
  onOpenVisualizer,
}) => {
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateTrackCover(track.id, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <section
      aria-label="Now Playing"
      className="flex flex-col justify-between h-full bg-[#090614]/90 border border-violet-500/15 rounded-2xl p-5 sm:p-6 overflow-y-auto"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-medium text-violet-400">
            Now Playing
          </span>
          <h2 className="text-lg font-bold text-white font-display truncate">
            {track.album}
          </h2>
        </div>

        <label
          title="Upload personal cover artwork"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-200 bg-violet-950/70 hover:bg-violet-900/80 border border-violet-500/25 rounded-xl cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          <ImagePlus className="w-3.5 h-3.5 text-violet-400" />
          <span>Change Art</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Main Artwork Frame (matching Phone 1 in reference image) */}
      <div className="my-5 flex flex-col items-center">
        <div className="relative w-full max-w-[310px] aspect-square rounded-3xl overflow-hidden border border-violet-400/30 shadow-2xl shadow-violet-900/40 bg-[#120A28]">
          <img
            src={track.coverUrl}
            alt={`${track.title} artwork`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-150"
            style={{
              transform: `scale(${1 + bands.bass * 0.045})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080511]/80 via-transparent to-transparent" />

          {/* Live Bass / Mid / Treble telemetry badge at bottom-left of cover */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono tabular-nums text-violet-200/90 bg-black/55 backdrop-blur-md px-3 py-1.5 rounded-xl border border-violet-500/20">
            <span>
              BASS {Math.round(bands.bass * 100)}% · MID{' '}
              {Math.round(bands.mid * 100)}%
            </span>
            <span>{bands.peakHz > 0 ? `${bands.peakHz} Hz` : `${track.bpm} BPM`}</span>
          </div>
        </div>
      </div>

      {/* Track Title + Artist + Favorite Heart */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl sm:text-2xl font-bold text-white font-display truncate">
            {track.title}
          </h3>
          <p className="text-sm text-slate-400 truncate mt-0.5">
            {track.artist} · {track.genre}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onToggleFavorite(track.id)}
          aria-label={
            track.isFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
          className="w-11 h-11 rounded-full flex items-center justify-center bg-violet-950/60 hover:bg-violet-900/70 border border-violet-500/25 transition-colors shrink-0 cursor-pointer"
        >
          <Heart
            className={`w-5 h-5 ${
              track.isFavorite
                ? 'text-violet-400 fill-violet-400'
                : 'text-slate-400'
            }`}
          />
        </button>
      </div>

      {/* Seek Bar & Timestamps */}
      <div className="mt-4">
        <input
          type="range"
          min={0}
          max={track.durationSec}
          step={1}
          value={Math.min(track.durationSec, Math.floor(currentTimeSec))}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek playback position"
          className="w-full"
        />
        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400 mt-1.5">
          <span>{formatDuration(currentTimeSec)}</span>
          <span>{formatDuration(track.durationSec)}</span>
        </div>
      </div>

      {/* Primary Transport Controls (Shuffle, Prev, Glowing Play/Pause, Next, Repeat) */}
      <div className="flex items-center justify-between gap-2 my-4 px-2">
        <button
          type="button"
          onClick={onToggleShuffle}
          aria-label={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isShuffle
              ? 'text-violet-400 bg-violet-500/15'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shuffle className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous track"
          className="w-11 h-11 rounded-full flex items-center justify-center text-slate-200 hover:text-white hover:bg-violet-500/15 transition-colors cursor-pointer"
        >
          <SkipBack className="w-5 h-5 fill-current" />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
          className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 text-white shadow-xl shadow-violet-500/40 ring-4 ring-violet-400/25 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 fill-white" />
          ) : (
            <Play className="w-7 h-7 fill-white ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={onNext}
          aria-label="Next track"
          className="w-11 h-11 rounded-full flex items-center justify-center text-slate-200 hover:text-white hover:bg-violet-500/15 transition-colors cursor-pointer"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>

        <button
          type="button"
          onClick={onToggleRepeat}
          aria-label={`Repeat mode: ${repeatMode}`}
          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            repeatMode !== 'off'
              ? 'text-violet-400 bg-violet-500/15'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Repeat className="w-4 h-4" />
          {repeatMode === 'one' && (
            <span className="absolute top-1.5 right-1.5 text-[9px] font-bold font-mono text-violet-300">
              1
            </span>
          )}
        </button>
      </div>

      {/* Volume Control Bar */}
      <div className="flex items-center gap-3 px-2 mb-4">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          className="text-slate-400 hover:text-white cursor-pointer"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-violet-400" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={isMuted ? 0 : volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label="Master volume"
          className="flex-1"
        />
        <span className="text-xs font-mono tabular-nums text-slate-400 w-9 text-right">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>

      {/* Bottom "Visualizer >" Action Card matching Phone 1 in reference image */}
      <button
        type="button"
        onClick={onOpenVisualizer}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#130D26] hover:bg-[#1A1233] border border-violet-500/25 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Visualizer Studio</p>
            <p className="text-xs text-slate-400">
              Customize spectrum rings, Avee waves & personal images
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </button>
    </section>
  );
};
