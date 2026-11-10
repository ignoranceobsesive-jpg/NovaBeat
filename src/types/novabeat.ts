export type VisualizerStyle =
  | 'circular-spectrum'
  | 'avee-wave-rings'
  | 'vertical-bars'
  | 'horizontal-spectrum'
  | 'audio-waveform'
  | 'radial-waveform'
  | 'particle-reactor';

export type SynthProfile =
  | 'shadow-synth'
  | 'future-trap'
  | 'dreamscape-chill'
  | 'neon-outrun'
  | 'eternal-bass'
  | 'skyline-electro'
  | 'infinity-trance';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  folder: string;
  durationSec: number;
  bpm: number;
  genre: string;
  coverUrl: string;
  customBackdropUrl?: string;
  audioSource: 'synth-stem' | 'uploaded-audio';
  synthProfile: SynthProfile;
  audioDataUrl?: string;
  isFavorite: boolean;
  isCloudSynced: boolean;
  lastPlayedAt?: number;
  playCount: number;
  addedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  accentColor: string;
  createdAt: number;
}

export type VisualizerLayerType =
  | 'background-image'
  | 'particles'
  | 'spectrum-ring'
  | 'center-emblem'
  | 'geometry-triangle'
  | 'text-overlay';

export type ReactiveBand = 'bass' | 'mid' | 'treble' | 'full';

export interface VisualizerLayer {
  id: string;
  name: string;
  type: VisualizerLayerType;
  visible: boolean;
  opacity: number; // 0.0 to 1.0
  scale: number; // 0.25 to 2.5
  rotation: number; // 0 to 360 deg
  xOffset: number; // -0.5 to 0.5 normalized
  yOffset: number; // -0.5 to 0.5 normalized
  colorPrimary: string;
  colorSecondary: string;
  customImageUrl?: string;
  reactToBand: ReactiveBand;
  reactivityAmount: number; // 0.0 to 2.0
}

export interface ColorPaletteOption {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface VisualizerConfig {
  id: string;
  name: string;
  style: VisualizerStyle;
  colorSchemeId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  sensitivity: number; // 10 to 200 (percentage, default 70)
  smoothing: number; // 0.1 to 0.95
  glowIntensity: number; // 0 to 100
  spectrumSize: number; // 0.4 to 1.6
  barCount: number; // 24 to 128
  opacity: number; // 0.2 to 1.0
  rotationSpeed: number; // -60 to 60 deg/s
  baseRotation: number; // 0 to 360
  xPosition: number; // -50 to 50 (%)
  yPosition: number; // -50 to 50 (%)
  scale: number; // 0.5 to 1.8
  mirrorMode: boolean;
  backgroundUrl: string;
  centerImageUrl: string;
  showEditorGrid: boolean;
  layers: VisualizerLayer[];
}

export interface FrequencyBands {
  bass: number; // 0..1 normalized energy (20-250 Hz)
  mid: number; // 0..1 normalized energy (250-4000 Hz)
  treble: number; // 0..1 normalized energy (4000-16000 Hz)
  overall: number; // 0..1 weighted RMS
  peakHz: number; // Dominant frequency in Hz
  spectrum: number[]; // Normalized 0..1 bar magnitudes
  waveform: number[]; // Normalized -1..1 time-domain samples
}

export interface ExportConfig {
  resolution: '720p' | '1080p' | '1440p';
  fps: 30 | 60;
  aspectRatio: '16:9' | '9:16' | '1:1';
  includeAudio: boolean;
  durationSec: number;
}

export interface AppSettings {
  fftSize: 512 | 1024 | 2048;
  smoothingTimeConstant: number;
  bassBoostDb: number;
  autoCloudSync: boolean;
  highFpsCanvas: boolean;
  showPeakTelemetry: boolean;
  lockScreenMediaControls: boolean;
}

export type NavigationTab =
  | 'library'
  | 'now-playing'
  | 'visualizer'
  | 'editor'
  | 'export'
  | 'settings';
