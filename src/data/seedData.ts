import {
  AppSettings,
  ColorPaletteOption,
  Playlist,
  Track,
  VisualizerConfig,
  VisualizerLayer,
} from '../types/novabeat';

/**
 * Generates an inline SVG data URI for track covers and visualizer backdrops
 * so images never fail to load and match the midnight-purple & neon aesthetic.
 */
function createArtworkSvgDataUri(options: {
  bgStart: string;
  bgEnd: string;
  accent1: string;
  accent2: string;
  motif: 'moon-silhouette' | 'triangle-portal' | 'neon-city' | 'trap-tunnel' | 'star-nebula' | 'cyber-grid' | 'infinity-ring';
}): string {
  const { bgStart, bgEnd, accent1, accent2, motif } = options;

  let centerGraphic = '';
  if (motif === 'moon-silhouette') {
    centerGraphic = `
      <circle cx="200" cy="155" r="92" fill="url(#moonGlow)" opacity="0.95" />
      <circle cx="200" cy="155" r="115" fill="none" stroke="${accent1}" stroke-width="1.5" opacity="0.45" />
      <path d="M40 310 L110 245 L165 280 L235 230 L300 275 L360 235 L400 290 L400 400 L0 400 L0 290 Z" fill="#090514" opacity="0.9"/>
      <path d="M165 390 C168 320 175 290 200 285 C225 290 232 320 235 390 Z" fill="#05030a"/>
      <circle cx="200" cy="248" r="24" fill="#05030a"/>
    `;
  } else if (motif === 'triangle-portal') {
    centerGraphic = `
      <circle cx="200" cy="195" r="108" fill="none" stroke="${accent1}" stroke-width="4" opacity="0.85" />
      <polygon points="200,88 104,268 296,268" fill="none" stroke="${accent2}" stroke-width="6" />
      <polygon points="200,108 122,258 278,258" fill="${accent1}" opacity="0.18" />
      <path d="M0 320 L130 265 L200 245 L275 268 L400 325 L400 400 L0 400 Z" fill="#06040e"/>
    `;
  } else if (motif === 'trap-tunnel') {
    centerGraphic = `
      <rect x="45" y="45" width="310" height="310" rx="28" fill="none" stroke="${accent1}" stroke-width="2" opacity="0.35" />
      <circle cx="200" cy="200" r="105" fill="none" stroke="${accent1}" stroke-width="5" />
      <circle cx="200" cy="200" r="96" fill="none" stroke="${accent2}" stroke-width="2.5" opacity="0.8" />
      <line x1="60" y1="60" x2="140" y2="140" stroke="${accent2}" stroke-width="4" stroke-dasharray="10 8" />
      <line x1="340" y1="60" x2="260" y2="140" stroke="${accent2}" stroke-width="4" stroke-dasharray="10 8" />
      <line x1="60" y1="340" x2="140" y2="260" stroke="${accent1}" stroke-width="4" stroke-dasharray="10 8" />
      <line x1="340" y1="340" x2="260" y2="260" stroke="${accent1}" stroke-width="4" stroke-dasharray="10 8" />
    `;
  } else if (motif === 'neon-city') {
    centerGraphic = `
      <circle cx="200" cy="175" r="82" fill="url(#moonGlow)" />
      <rect x="75" y="180" width="32" height="140" fill="#090614" stroke="${accent1}" stroke-width="1.5"/>
      <rect x="120" y="140" width="42" height="180" fill="#090614" stroke="${accent2}" stroke-width="1.5"/>
      <rect x="175" y="115" width="50" height="205" fill="#090614" stroke="${accent1}" stroke-width="2"/>
      <rect x="238" y="152" width="40" height="168" fill="#090614" stroke="${accent2}" stroke-width="1.5"/>
      <rect x="290" y="190" width="35" height="130" fill="#090614" stroke="${accent1}" stroke-width="1.5"/>
      <line x1="0" y1="320" x2="400" y2="320" stroke="${accent2}" stroke-width="3"/>
    `;
  } else {
    centerGraphic = `
      <circle cx="200" cy="200" r="112" fill="none" stroke="${accent1}" stroke-width="3" stroke-dasharray="6 8" />
      <circle cx="200" cy="200" r="78" fill="none" stroke="${accent2}" stroke-width="5" />
      <circle cx="200" cy="200" r="32" fill="url(#moonGlow)" />
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}" />
        <stop offset="100%" stop-color="${bgEnd}" />
      </linearGradient>
      <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.92" />
        <stop offset="45%" stop-color="${accent1}" stop-opacity="0.75" />
        <stop offset="100%" stop-color="${accent2}" stop-opacity="0.0" />
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="url(#bg)" />
    <circle cx="80" cy="70" r="1.8" fill="#ffffff" opacity="0.6" />
    <circle cx="330" cy="85" r="2.2" fill="#ffffff" opacity="0.5" />
    <circle cx="310" cy="260" r="1.5" fill="${accent2}" opacity="0.7" />
    <circle cx="65" cy="230" r="2" fill="${accent1}" opacity="0.7" />
    ${centerGraphic}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const ARTWORK_COVERS = {
  lostInShadows: createArtworkSvgDataUri({
    bgStart: '#14082E',
    bgEnd: '#06030D',
    accent1: '#A855F7',
    accent2: '#38BDF8',
    motif: 'moon-silhouette',
  }),
  futureTrap: createArtworkSvgDataUri({
    bgStart: '#2A0808',
    bgEnd: '#090306',
    accent1: '#F43F5E',
    accent2: '#F59E0B',
    motif: 'trap-tunnel',
  }),
  dreamscape: createArtworkSvgDataUri({
    bgStart: '#0D1333',
    bgEnd: '#050614',
    accent1: '#8B5CF6',
    accent2: '#06B6D4',
    motif: 'triangle-portal',
  }),
  neonLights: createArtworkSvgDataUri({
    bgStart: '#1D093A',
    bgEnd: '#090414',
    accent1: '#EC4899',
    accent2: '#06B6D4',
    motif: 'neon-city',
  }),
  eternalNight: createArtworkSvgDataUri({
    bgStart: '#12072B',
    bgEnd: '#04020A',
    accent1: '#9333EA',
    accent2: '#6366F1',
    motif: 'star-nebula',
  }),
  skyline: createArtworkSvgDataUri({
    bgStart: '#071A2E',
    bgEnd: '#040812',
    accent1: '#06B6D4',
    accent2: '#8B5CF6',
    motif: 'neon-city',
  }),
  infinity: createArtworkSvgDataUri({
    bgStart: '#230B2E',
    bgEnd: '#08030F',
    accent1: '#F43F5E',
    accent2: '#F59E0B',
    motif: 'trap-tunnel',
  }),
};

export const COLOR_PALETTES: ColorPaletteOption[] = [
  {
    id: 'nova-purple',
    name: 'Nova Violet & Cyan',
    primary: '#A855F7',
    secondary: '#06B6D4',
    accent: '#EC4899',
  },
  {
    id: 'electric-azure',
    name: 'Electric Azure',
    primary: '#3B82F6',
    secondary: '#22D3EE',
    accent: '#8B5CF6',
  },
  {
    id: 'cyber-mint',
    name: 'Cyber Mint & Blue',
    primary: '#2DD4BF',
    secondary: '#38BDF8',
    accent: '#A855F7',
  },
  {
    id: 'avee-sunset',
    name: 'Avee Sunset Trap',
    primary: '#F43F5E',
    secondary: '#F59E0B',
    accent: '#EC4899',
  },
  {
    id: 'ocean-cobalt',
    name: 'Cobalt Horizon',
    primary: '#6366F1',
    secondary: '#0EA5E9',
    accent: '#C084FC',
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    primary: '#E2E8F0',
    secondary: '#38BDF8',
    accent: '#A855F7',
  },
];

export const INITIAL_TRACKS: Track[] = [
  {
    id: 'track-lost-in-shadows',
    title: 'Lost in Shadows',
    artist: 'NovaBeat',
    album: 'Midnight Sanctuary',
    folder: 'NovaBeat Originals',
    durationSec: 225, // 03:45 matching screenshot
    bpm: 124,
    genre: 'Dark Synthwave',
    coverUrl: ARTWORK_COVERS.lostInShadows,
    customBackdropUrl: ARTWORK_COVERS.dreamscape,
    audioSource: 'synth-stem',
    synthProfile: 'shadow-synth',
    isFavorite: true,
    isCloudSynced: true,
    playCount: 42,
    addedAt: Date.now() - 86400000 * 6,
    lastPlayedAt: Date.now() - 1800000,
  },
  {
    id: 'track-future-trap-bass',
    title: 'Future Trap & Bass',
    artist: 'NovaBeat × Avee Lab',
    album: 'Subwoofer Ritual',
    folder: 'Bass & Trap',
    durationSec: 308, // 05:08 matching reference image 1
    bpm: 140,
    genre: 'Future Trap',
    coverUrl: ARTWORK_COVERS.futureTrap,
    customBackdropUrl: ARTWORK_COVERS.futureTrap,
    audioSource: 'synth-stem',
    synthProfile: 'future-trap',
    isFavorite: true,
    isCloudSynced: true,
    playCount: 38,
    addedAt: Date.now() - 86400000 * 5,
    lastPlayedAt: Date.now() - 3600000,
  },
  {
    id: 'track-dreamscape',
    title: 'Dreamscape',
    artist: 'NovaBeat',
    album: 'Midnight Sanctuary',
    folder: 'NovaBeat Originals',
    durationSec: 252,
    bpm: 118,
    genre: 'Melodic Chillwave',
    coverUrl: ARTWORK_COVERS.dreamscape,
    customBackdropUrl: ARTWORK_COVERS.dreamscape,
    audioSource: 'synth-stem',
    synthProfile: 'dreamscape-chill',
    isFavorite: false,
    isCloudSynced: true,
    playCount: 27,
    addedAt: Date.now() - 86400000 * 4,
    lastPlayedAt: Date.now() - 7200000,
  },
  {
    id: 'track-neon-lights',
    title: 'Neon Lights',
    artist: 'Synthwave',
    album: 'Outrun 2088',
    folder: 'Synthwave Vault',
    durationSec: 238,
    bpm: 128,
    genre: 'Outrun Synth',
    coverUrl: ARTWORK_COVERS.neonLights,
    customBackdropUrl: ARTWORK_COVERS.neonLights,
    audioSource: 'synth-stem',
    synthProfile: 'neon-outrun',
    isFavorite: true,
    isCloudSynced: true,
    playCount: 31,
    addedAt: Date.now() - 86400000 * 3,
    lastPlayedAt: Date.now() - 14400000,
  },
  {
    id: 'track-eternal-night',
    title: 'Eternal Night',
    artist: 'NovaBeat',
    album: 'Obsidian Pulse',
    folder: 'NovaBeat Originals',
    durationSec: 270,
    bpm: 132,
    genre: 'Midtempo Bass',
    coverUrl: ARTWORK_COVERS.eternalNight,
    customBackdropUrl: ARTWORK_COVERS.eternalNight,
    audioSource: 'synth-stem',
    synthProfile: 'eternal-bass',
    isFavorite: false,
    isCloudSynced: false,
    playCount: 19,
    addedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'track-skyline',
    title: 'Skyline',
    artist: 'Electro Vibes',
    album: 'Electric Horizon',
    folder: 'Synthwave Vault',
    durationSec: 202,
    bpm: 126,
    genre: 'Electro House',
    coverUrl: ARTWORK_COVERS.skyline,
    customBackdropUrl: ARTWORK_COVERS.skyline,
    audioSource: 'synth-stem',
    synthProfile: 'skyline-electro',
    isFavorite: false,
    isCloudSynced: true,
    playCount: 15,
    addedAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'track-infinity',
    title: 'Infinity',
    artist: 'NovaBeat',
    album: 'Obsidian Pulse',
    folder: 'Bass & Trap',
    durationSec: 285,
    bpm: 138,
    genre: 'Progressive Trance',
    coverUrl: ARTWORK_COVERS.infinity,
    customBackdropUrl: ARTWORK_COVERS.infinity,
    audioSource: 'synth-stem',
    synthProfile: 'infinity-trance',
    isFavorite: true,
    isCloudSynced: true,
    playCount: 24,
    addedAt: Date.now() - 43200000,
  },
];

export const INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-midnight-studio',
    name: 'Midnight Studio Essentials',
    description: 'Deep purple synthwave & holographic bass visualizers',
    trackIds: [
      'track-lost-in-shadows',
      'track-dreamscape',
      'track-neon-lights',
      'track-eternal-night',
    ],
    accentColor: '#A855F7',
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'pl-avee-trap',
    name: 'Avee Bass & Trap Reactors',
    description: 'High-impact sub-bass tracks tuned for circular wave rings',
    trackIds: ['track-future-trap-bass', 'track-infinity', 'track-skyline'],
    accentColor: '#F43F5E',
    createdAt: Date.now() - 86400000 * 2,
  },
];

export const DEFAULT_LAYERS: VisualizerLayer[] = [
  {
    id: 'layer-triangle',
    name: 'Triangle Shape',
    type: 'geometry-triangle',
    visible: true,
    opacity: 0.9,
    scale: 1.0,
    rotation: 0,
    xOffset: 0,
    yOffset: 0,
    colorPrimary: '#C084FC',
    colorSecondary: '#38BDF8',
    reactToBand: 'mid',
    reactivityAmount: 0.65,
  },
  {
    id: 'layer-particles',
    name: 'Particles',
    type: 'particles',
    visible: true,
    opacity: 0.85,
    scale: 1.0,
    rotation: 0,
    xOffset: 0,
    yOffset: 0,
    colorPrimary: '#38BDF8',
    colorSecondary: '#A855F7',
    reactToBand: 'bass',
    reactivityAmount: 1.1,
  },
  {
    id: 'layer-bg',
    name: 'Background',
    type: 'background-image',
    visible: true,
    opacity: 0.55,
    scale: 1.05,
    rotation: 0,
    xOffset: 0,
    yOffset: 0,
    colorPrimary: '#1E1B4B',
    colorSecondary: '#0F172A',
    reactToBand: 'bass',
    reactivityAmount: 0.35,
  },
  {
    id: 'layer-spectrum',
    name: 'Spectrum Ring',
    type: 'spectrum-ring',
    visible: true,
    opacity: 1.0,
    scale: 1.0,
    rotation: 0,
    xOffset: 0,
    yOffset: 0,
    colorPrimary: '#A855F7',
    colorSecondary: '#06B6D4',
    reactToBand: 'full',
    reactivityAmount: 1.0,
  },
  {
    id: 'layer-emblem',
    name: 'Center Emblem',
    type: 'center-emblem',
    visible: true,
    opacity: 0.95,
    scale: 1.0,
    rotation: 0,
    xOffset: 0,
    yOffset: 0,
    colorPrimary: '#A855F7',
    colorSecondary: '#38BDF8',
    reactToBand: 'bass',
    reactivityAmount: 0.8,
  },
];

export const INITIAL_PRESETS: VisualizerConfig[] = [
  {
    id: 'preset-novabeat-ring',
    name: 'NovaBeat Signature Ring',
    style: 'circular-spectrum',
    colorSchemeId: 'nova-purple',
    primaryColor: '#A855F7',
    secondaryColor: '#06B6D4',
    accentColor: '#EC4899',
    sensitivity: 70,
    smoothing: 0.72,
    glowIntensity: 78,
    spectrumSize: 1.0,
    barCount: 72,
    opacity: 0.95,
    rotationSpeed: 6,
    baseRotation: 0,
    xPosition: 0,
    yPosition: 0,
    scale: 1.0,
    mirrorMode: true,
    backgroundUrl: ARTWORK_COVERS.dreamscape,
    centerImageUrl: '',
    showEditorGrid: false,
    layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
  },
  {
    id: 'preset-avee-trap-wave',
    name: 'Avee Future Trap Wave',
    style: 'avee-wave-rings',
    colorSchemeId: 'avee-sunset',
    primaryColor: '#F43F5E',
    secondaryColor: '#F59E0B',
    accentColor: '#EC4899',
    sensitivity: 82,
    smoothing: 0.68,
    glowIntensity: 88,
    spectrumSize: 1.08,
    barCount: 96,
    opacity: 1.0,
    rotationSpeed: 10,
    baseRotation: 0,
    xPosition: 0,
    yPosition: 0,
    scale: 1.05,
    mirrorMode: true,
    backgroundUrl: ARTWORK_COVERS.futureTrap,
    centerImageUrl: '',
    showEditorGrid: false,
    layers: DEFAULT_LAYERS.map((l) =>
      l.id === 'layer-triangle' ? { ...l, visible: false } : { ...l }
    ),
  },
  {
    id: 'preset-neon-triangle-studio',
    name: 'Neon Triangle Portal',
    style: 'radial-waveform',
    colorSchemeId: 'electric-azure',
    primaryColor: '#8B5CF6',
    secondaryColor: '#38BDF8',
    accentColor: '#C084FC',
    sensitivity: 75,
    smoothing: 0.75,
    glowIntensity: 85,
    spectrumSize: 0.96,
    barCount: 64,
    opacity: 0.95,
    rotationSpeed: 4,
    baseRotation: 0,
    xPosition: 0,
    yPosition: 0,
    scale: 1.0,
    mirrorMode: true,
    backgroundUrl: ARTWORK_COVERS.dreamscape,
    centerImageUrl: '',
    showEditorGrid: true,
    layers: DEFAULT_LAYERS.map((l) => ({ ...l, visible: true })),
  },
  {
    id: 'preset-vertical-eq',
    name: 'Horizon Vertical Bars',
    style: 'vertical-bars',
    colorSchemeId: 'cyber-mint',
    primaryColor: '#2DD4BF',
    secondaryColor: '#38BDF8',
    accentColor: '#A855F7',
    sensitivity: 74,
    smoothing: 0.7,
    glowIntensity: 70,
    spectrumSize: 1.0,
    barCount: 48,
    opacity: 0.92,
    rotationSpeed: 0,
    baseRotation: 0,
    xPosition: 0,
    yPosition: 0,
    scale: 1.0,
    mirrorMode: false,
    backgroundUrl: ARTWORK_COVERS.skyline,
    centerImageUrl: '',
    showEditorGrid: false,
    layers: DEFAULT_LAYERS.map((l) =>
      l.id === 'layer-triangle' || l.id === 'layer-emblem'
        ? { ...l, visible: false }
        : { ...l }
    ),
  },
  {
    id: 'preset-horizontal-mirror',
    name: 'Mirrored Horizon Spectrum',
    style: 'horizontal-spectrum',
    colorSchemeId: 'nova-purple',
    primaryColor: '#A855F7',
    secondaryColor: '#38BDF8',
    accentColor: '#F43F5E',
    sensitivity: 76,
    smoothing: 0.74,
    glowIntensity: 76,
    spectrumSize: 1.0,
    barCount: 64,
    opacity: 0.95,
    rotationSpeed: 0,
    baseRotation: 0,
    xPosition: 0,
    yPosition: 0,
    scale: 1.0,
    mirrorMode: true,
    backgroundUrl: ARTWORK_COVERS.neonLights,
    centerImageUrl: '',
    showEditorGrid: false,
    layers: DEFAULT_LAYERS.map((l) =>
      l.id === 'layer-triangle' ? { ...l, visible: false } : { ...l }
    ),
  },
  {
    id: 'preset-waveform-osc',
    name: 'Oscilloscope Harmonic Wave',
    style: 'audio-waveform',
    colorSchemeId: 'ocean-cobalt',
    primaryColor: '#6366F1',
    secondaryColor: '#22D3EE',
    accentColor: '#EC4899',
    sensitivity: 80,
    smoothing: 0.65,
    glowIntensity: 80,
    spectrumSize: 1.0,
    barCount: 96,
    opacity: 0.95,
    rotationSpeed: 0,
    baseRotation: 0,
    xPosition: 0,
    yPosition: 0,
    scale: 1.0,
    mirrorMode: false,
    backgroundUrl: ARTWORK_COVERS.eternalNight,
    centerImageUrl: '',
    showEditorGrid: false,
    layers: DEFAULT_LAYERS.map((l) =>
      l.id === 'layer-triangle' || l.id === 'layer-emblem'
        ? { ...l, visible: false }
        : { ...l }
    ),
  },
  {
    id: 'preset-particle-reactor',
    name: 'Supernova Particle Core',
    style: 'particle-reactor',
    colorSchemeId: 'avee-sunset',
    primaryColor: '#EC4899',
    secondaryColor: '#8B5CF6',
    accentColor: '#38BDF8',
    sensitivity: 85,
    smoothing: 0.72,
    glowIntensity: 90,
    spectrumSize: 1.1,
    barCount: 80,
    opacity: 1.0,
    rotationSpeed: 12,
    baseRotation: 0,
    xPosition: 0,
    yPosition: 0,
    scale: 1.05,
    mirrorMode: true,
    backgroundUrl: ARTWORK_COVERS.lostInShadows,
    centerImageUrl: '',
    showEditorGrid: false,
    layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
  },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  fftSize: 1024,
  smoothingTimeConstant: 0.74,
  bassBoostDb: 6,
  autoCloudSync: true,
  highFpsCanvas: true,
  showPeakTelemetry: true,
  lockScreenMediaControls: true,
};
