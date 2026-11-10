import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Crown,
  Edit3,
  Film,
  Home,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { NovaBeatSoundEngine } from './audio/soundEngine';
import { EditorPresetsView } from './components/EditorPresetsView';
import { ExportAndAndroidView } from './components/ExportAndAndroidView';
import { LibraryView } from './components/LibraryView';
import {
  FirstLaunchEulaModal,
  FullScreenAdOverlay,
  LegalDocumentModal,
  MonetizationRuntimeState,
  NovaBeatProModal,
  RewardedAdDialog,
  UmpConsentDialog,
} from './components/MonetizationComponents';
import { NowPlayingView } from './components/NowPlayingView';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import { VisualizerStudioView } from './components/VisualizerStudioView';
import {
  DEFAULT_APP_SETTINGS,
  INITIAL_PLAYLISTS,
  INITIAL_PRESETS,
  INITIAL_TRACKS,
} from './data/seedData';
import {
  createNewPlaylist,
  formatDuration,
  saveCustomPreset,
  toggleTrackFavorite,
  updateTrackMetadata,
} from './domain/libraryLogic';
import {
  AdEnvironmentMode,
  AdFormatType,
  applyRewardedAdOutcome,
  CURRENT_EULA_VERSION,
  evaluateAdGuardrails,
  isEulaAcceptanceRequired,
  PlayStorePurchaseRecord,
  reconcileProEntitlement,
  recordFullScreenAdImpression,
  UmpConsentStatus,
} from './domain/monetizationConfig';
import {
  AppSettings,
  FrequencyBands,
  NavigationTab,
  Playlist,
  Track,
  VisualizerConfig,
} from './types/novabeat';

const STORAGE_KEYS = {
  tracks: 'novabeat_tracks_v1',
  playlists: 'novabeat_playlists_v1',
  presets: 'novabeat_presets_v1',
  activeConfig: 'novabeat_active_config_v1',
  settings: 'novabeat_settings_v1',
  monetization: 'novabeat_monetization_v2',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(() =>
    loadFromStorage(STORAGE_KEYS.tracks, INITIAL_TRACKS)
  );
  const [playlists, setPlaylists] = useState<Playlist[]>(() =>
    loadFromStorage(STORAGE_KEYS.playlists, INITIAL_PLAYLISTS)
  );
  const [presets, setPresets] = useState<VisualizerConfig[]>(() =>
    loadFromStorage(STORAGE_KEYS.presets, INITIAL_PRESETS)
  );
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig>(
    () => loadFromStorage(STORAGE_KEYS.activeConfig, INITIAL_PRESETS[0])
  );
  const [settings, setSettings] = useState<AppSettings>(() =>
    loadFromStorage(STORAGE_KEYS.settings, DEFAULT_APP_SETTINGS)
  );

  const [activeNav, setActiveNav] = useState<NavigationTab>('visualizer');
  const [currentTrackId, setCurrentTrackId] = useState<string>(
    INITIAL_TRACKS[0].id
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(84); // 01:24 matching screenshot
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [volume, setVolume] = useState<number>(0.82);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isTheaterStage, setIsTheaterStage] = useState<boolean>(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    'layer-triangle'
  );

  // Monetization, First-Launch EULA & Google Play Billing 9.1.0 runtime state
  const [monetization, setMonetization] = useState<MonetizationRuntimeState>(
    () => {
      const fallback: MonetizationRuntimeState = {
        environment: 'test',
        acceptedEulaVersion: null,
        acceptedEulaAtMs: null,
        requiredEulaVersion: CURRENT_EULA_VERSION,
        isFirstLaunchSessionBeforeOnboardingComplete: true,
        umpConsentCompleted: false,
        umpConsentStatus: 'UNKNOWN',
        canRequestAds: false,
        sdkInitialized: false,
        isOfflineSimulated: false,
        isProEntitled: false,
        purchaseState: 'NOT_PURCHASED',
        purchaseOrderId: null,
        purchaseToken: null,
        statusMessage: 'Standard Free Tier (Ad-Supported)',
        rewardPassExpiresAtMs: 0,
        frequency: {
          lastFullScreenAdShownAtMs: 0,
          lastAppOpenShownAtMs: 0,
          interstitialTimestampsMs: [],
          userActionsSinceLastInterstitial: 0,
          isShowingFullScreenAd: false,
        },
        appOpenLoadedAtMs: Date.now(),
      };
      const loaded = loadFromStorage<Partial<MonetizationRuntimeState>>(
        STORAGE_KEYS.monetization,
        fallback
      );
      const effectiveRequiredEula =
        typeof loaded.requiredEulaVersion === 'string' &&
        loaded.requiredEulaVersion > CURRENT_EULA_VERSION
          ? loaded.requiredEulaVersion
          : CURRENT_EULA_VERSION;
      const isAlreadyOnboarded =
        Boolean(loaded.acceptedEulaVersion) &&
        loaded.acceptedEulaVersion === effectiveRequiredEula &&
        Boolean(loaded.umpConsentCompleted);
      return {
        ...fallback,
        ...loaded,
        requiredEulaVersion: effectiveRequiredEula,
        isFirstLaunchSessionBeforeOnboardingComplete: !isAlreadyOnboarded,
        frequency: {
          ...fallback.frequency,
          ...(loaded.frequency || {}),
          interstitialTimestampsMs: Array.isArray(
            loaded.frequency?.interstitialTimestampsMs
          )
            ? loaded.frequency.interstitialTimestampsMs
            : [],
          isShowingFullScreenAd: false,
        },
      };
    }
  );
  const [showProModal, setShowProModal] = useState(false);
  const [showUmpModal, setShowUmpModal] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<
    'eula' | 'privacy' | null
  >(null);
  const [rewardedModalFormat, setRewardedModalFormat] = useState<
    'rewarded' | 'rewarded-interstitial' | null
  >(null);
  const [activeFullScreenAd, setActiveFullScreenAd] = useState<Extract<
    AdFormatType,
    'interstitial' | 'app-open'
  > | null>(null);
  const [isBillingBusy, setIsBillingBusy] = useState(false);

  const [liveBands, setLiveBands] = useState<FrequencyBands>({
    bass: 0.62,
    mid: 0.48,
    treble: 0.35,
    overall: 0.52,
    peakHz: 124,
    spectrum: new Array(72).fill(0.35),
    waveform: new Array(96).fill(0),
  });

  const soundEngineRef = useRef<NovaBeatSoundEngine | null>(null);
  const visualizerCanvasElRef = useRef<HTMLCanvasElement | null>(null);

  if (!soundEngineRef.current && typeof window !== 'undefined') {
    soundEngineRef.current = new NovaBeatSoundEngine();
  }

  // Reconcile Pro entitlement directly with the Play Billing ledger on startup & resume
  const reconcileBillingWithServer = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/purchases');
      if (!res.ok) return;
      const data: { purchases?: PlayStorePurchaseRecord[] } = await res.json();
      const purchases = Array.isArray(data.purchases) ? data.purchases : [];
      let proGranted = false;
      setMonetization((prev) => {
        const reconciled = reconcileProEntitlement(
          prev.isProEntitled,
          purchases
        );
        proGranted = reconciled.isProEntitled;
        return {
          ...prev,
          isProEntitled: reconciled.isProEntitled,
          purchaseState: reconciled.purchaseState,
          purchaseOrderId: reconciled.orderId,
          purchaseToken: reconciled.purchaseToken,
          statusMessage: reconciled.statusMessage,
          appOpenLoadedAtMs: reconciled.isProEntitled
            ? 0
            : prev.appOpenLoadedAtMs,
          frequency: reconciled.isProEntitled
            ? { ...prev.frequency, isShowingFullScreenAd: false }
            : prev.frequency,
        };
      });
      if (proGranted) {
        setActiveFullScreenAd(null);
        setRewardedModalFormat(null);
      }
    } catch {
      // Offline fallback preserves reconciled state until network resumes
    }
  }, []);

  useEffect(() => {
    reconcileBillingWithServer();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        reconcileBillingWithServer();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [reconcileBillingWithServer]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.monetization,
        JSON.stringify(monetization)
      );
    } catch {
      // Ignore quota errors
    }
  }, [monetization]);

  const handleExecutePurchase = useCallback(
    async (outcome: 'PURCHASED' | 'PENDING' | 'CANCELLED' | 'FAILED') => {
      setIsBillingBusy(true);
      try {
        const res = await fetch('/api/billing/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: 'novabeat_pro_lifetime',
            outcome,
          }),
        });
        const data: {
          responseCode?: number;
          debugMessage?: string;
          purchases?: PlayStorePurchaseRecord[];
        } = await res.json();

        if (outcome === 'CANCELLED' || data.responseCode === 1) {
          setMonetization((prev) => ({
            ...prev,
            purchaseState: 'CANCELLED',
            statusMessage: 'Purchase cancelled. No charges were made.',
          }));
          return;
        }

        if (outcome === 'FAILED' || (data.responseCode && data.responseCode > 1)) {
          setMonetization((prev) => ({
            ...prev,
            purchaseState: 'FAILED',
            statusMessage:
              data.debugMessage || 'Purchase failed. Please try again.',
          }));
          return;
        }

        const purchases = Array.isArray(data.purchases) ? data.purchases : [];
        const reconciled = reconcileProEntitlement(false, purchases);
        setMonetization((prev) => ({
          ...prev,
          isProEntitled: reconciled.isProEntitled,
          purchaseState: reconciled.purchaseState,
          purchaseOrderId: reconciled.orderId,
          purchaseToken: reconciled.purchaseToken,
          statusMessage: reconciled.statusMessage,
          appOpenLoadedAtMs: reconciled.isProEntitled
            ? 0
            : prev.appOpenLoadedAtMs,
          frequency: reconciled.isProEntitled
            ? { ...prev.frequency, isShowingFullScreenAd: false }
            : prev.frequency,
        }));
        if (reconciled.isProEntitled) {
          setActiveFullScreenAd(null);
          setRewardedModalFormat(null);
        }
      } catch {
        setMonetization((prev) => ({
          ...prev,
          statusMessage:
            'Unable to reach Google Play Billing while offline.',
        }));
      } finally {
        setIsBillingBusy(false);
      }
    },
    []
  );

  const handleCompletePendingPurchase = useCallback(async () => {
    setIsBillingBusy(true);
    try {
      const res = await fetch('/api/billing/complete-pending', {
        method: 'POST',
      });
      if (res.ok) {
        const data: { purchases?: PlayStorePurchaseRecord[] } = await res.json();
        const reconciled = reconcileProEntitlement(
          false,
          Array.isArray(data.purchases) ? data.purchases : []
        );
        setMonetization((prev) => ({
          ...prev,
          isProEntitled: reconciled.isProEntitled,
          purchaseState: reconciled.purchaseState,
          purchaseOrderId: reconciled.orderId,
          purchaseToken: reconciled.purchaseToken,
          statusMessage: reconciled.statusMessage,
          appOpenLoadedAtMs: reconciled.isProEntitled
            ? 0
            : prev.appOpenLoadedAtMs,
          frequency: reconciled.isProEntitled
            ? { ...prev.frequency, isShowingFullScreenAd: false }
            : prev.frequency,
        }));
        if (reconciled.isProEntitled) {
          setActiveFullScreenAd(null);
          setRewardedModalFormat(null);
        }
      }
    } finally {
      setIsBillingBusy(false);
    }
  }, []);

  const handleResetPurchasesForTest = useCallback(async () => {
    setIsBillingBusy(true);
    try {
      await fetch('/api/billing/reset', { method: 'POST' });
      setMonetization((prev) => ({
        ...prev,
        isProEntitled: false,
        purchaseState: 'NOT_PURCHASED',
        purchaseOrderId: null,
        purchaseToken: null,
        statusMessage: 'Standard Free Tier (Ad-Supported)',
      }));
    } finally {
      setIsBillingBusy(false);
    }
  }, []);

  const handleRecordUserAction = useCallback(() => {
    setMonetization((prev) => ({
      ...prev,
      frequency: {
        ...prev.frequency,
        userActionsSinceLastInterstitial:
          prev.frequency.userActionsSinceLastInterstitial + 1,
      },
    }));
  }, []);

  const handleAcceptEula = useCallback(() => {
    setMonetization((prev) => ({
      ...prev,
      acceptedEulaVersion: prev.requiredEulaVersion,
      acceptedEulaAtMs: Date.now(),
    }));
    // Strictly separate UMP consent from EULA acceptance:
    // If UMP consent has not been completed yet, prompt the UMP dialog after EULA acceptance
    if (!monetization.umpConsentCompleted) {
      setShowUmpModal(true);
    }
  }, [monetization.umpConsentCompleted]);

  const handleTriggerFullScreenAdCheck = useCallback(
    (format: Extract<AdFormatType, 'interstitial' | 'app-open'>) => {
      const nowMs = Date.now();
      const isEulaCurrent = !isEulaAcceptanceRequired(
        monetization.acceptedEulaVersion,
        monetization.requiredEulaVersion
      );
      const check = evaluateAdGuardrails({
        format,
        isEulaAcceptedForCurrentVersion: isEulaCurrent,
        isFirstLaunchSessionBeforeOnboardingComplete:
          monetization.isFirstLaunchSessionBeforeOnboardingComplete,
        umpConsentCompleted: monetization.umpConsentCompleted,
        canRequestAds: monetization.canRequestAds,
        isProEntitled: monetization.isProEntitled,
        isOffline: monetization.isOfflineSimulated,
        isAudioPlaying: isPlaying,
        isEditingVisualizer: activeNav === 'editor',
        isExportingVideo: isRecordingVideoRef.current,
        frequency: monetization.frequency,
        appOpenLoadedAtMs: monetization.appOpenLoadedAtMs,
        nowMs,
      });

      if (!check.allowed) {
        return {
          shown: false,
          message: check.reason || 'Full-screen ad blocked by safety guardrail.',
        };
      }

      setActiveFullScreenAd(format);
      setMonetization((prev) => ({
        ...prev,
        frequency: recordFullScreenAdImpression(prev.frequency, format, nowMs),
      }));
      return {
        shown: true,
        message: `${format.toUpperCase()} ad displayed at natural idle break.`,
      };
    },
    [monetization, isPlaying, activeNav]
  );

  const currentTrack =
    tracks.find((t) => t.id === currentTrackId) || tracks[0] || INITIAL_TRACKS[0];

  // Persist user changes to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.tracks, JSON.stringify(tracks));
    } catch {
      // Ignore quota errors on large base64 images
    }
  }, [tracks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.playlists,
        JSON.stringify(playlists)
      );
    } catch {
      // Ignore quota errors
    }
  }, [playlists]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.presets,
        JSON.stringify(presets)
      );
    } catch {
      // Ignore quota errors
    }
  }, [presets]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.activeConfig,
        JSON.stringify(visualizerConfig)
      );
    } catch {
      // Ignore quota errors
    }
  }, [visualizerConfig]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify(settings)
      );
    } catch {
      // Ignore quota errors
    }
    soundEngineRef.current?.updateSettings(settings);
  }, [settings]);

  // Sync current track into soundEngine
  useEffect(() => {
    soundEngineRef.current?.loadTrack(
      currentTrack,
      currentTrack.id === INITIAL_TRACKS[0].id ? 84 : 0,
      isPlaying
    );
  }, [currentTrack.id]);

  const isRecordingVideoRef = useRef<boolean>(false);

  const handleNextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    if (isRecordingVideoRef.current || repeatMode === 'one') {
      soundEngineRef.current?.seek(0);
      setCurrentTimeSec(0);
      return;
    }
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (isShuffle && tracks.length > 1) {
      const nextIdx = (idx + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length;
      setCurrentTrackId(tracks[nextIdx].id);
    } else {
      const nextIdx = (idx + 1) % tracks.length;
      setCurrentTrackId(tracks[nextIdx].id);
    }
    setCurrentTimeSec(0);
  }, [tracks, currentTrack.id, repeatMode, isShuffle]);

  const handlePrevTrack = useCallback(() => {
    if (tracks.length === 0) return;
    if (currentTimeSec > 5) {
      soundEngineRef.current?.seek(0);
      setCurrentTimeSec(0);
      return;
    }
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = (idx - 1 + tracks.length) % tracks.length;
    setCurrentTrackId(tracks[prevIdx].id);
    setCurrentTimeSec(0);
  }, [tracks, currentTrack.id, currentTimeSec]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        soundEngineRef.current?.play();
      } else {
        soundEngineRef.current?.pause();
      }
      return next;
    });
  }, []);

  const handleSelectTrack = useCallback(
    (track: Track, autoPlay = true) => {
      setCurrentTrackId(track.id);
      setCurrentTimeSec(0);
      soundEngineRef.current?.loadTrack(track, 0, autoPlay);
      if (autoPlay) {
        setIsPlaying(true);
      }
      if (track.customBackdropUrl) {
        setVisualizerConfig((prev) => ({
          ...prev,
          backgroundUrl: track.customBackdropUrl || prev.backgroundUrl,
        }));
      }
    },
    []
  );

  const handleSeek = useCallback((sec: number) => {
    soundEngineRef.current?.seek(sec);
    setCurrentTimeSec(sec);
  }, []);

  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val);
    setIsMuted(val === 0);
    soundEngineRef.current?.setVolume(val);
    soundEngineRef.current?.setMuted(val === 0);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleSampleFrame = useCallback(
    (barCount: number, sensitivity: number, smoothing: number) => {
      if (!soundEngineRef.current) {
        return { currentTimeSec: 0, bands: liveBands };
      }
      return soundEngineRef.current.sampleFrame(
        barCount,
        sensitivity,
        smoothing,
        handleNextTrack
      );
    },
    [handleNextTrack, liveBands]
  );

  const handleTelemetryUpdate = useCallback(
    (timeSec: number, bands: FrequencyBands) => {
      setCurrentTimeSec(timeSec);
      setLiveBands(bands);
    },
    []
  );

  const handleUpdateConfig = useCallback(
    (updates: Partial<VisualizerConfig>) => {
      setVisualizerConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const handleSavePreset = useCallback(
    (name: string) => {
      const res = saveCustomPreset(presets, visualizerConfig, name);
      if (!res.saved) {
        return { ok: false, error: res.error };
      }
      setPresets(res.presets);
      setVisualizerConfig(res.saved);
      return { ok: true };
    },
    [presets, visualizerConfig]
  );

  const handleDeletePreset = useCallback((presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
  }, []);

  const handleCreatePlaylist = useCallback(
    (name: string, description: string, trackIds: string[]) => {
      const res = createNewPlaylist(playlists, name, description, trackIds);
      if (!res.created) {
        return { ok: false, error: res.error };
      }
      setPlaylists(res.playlists);
      return { ok: true };
    },
    [playlists]
  );

  useEffect(() => {
    document.body.dataset.state = isPlaying ? 'playing' : 'paused';
    document.body.dataset.visualizerStyle = visualizerConfig.style;
  }, [isPlaying, visualizerConfig.style]);

  return (
    <div className="min-h-screen bg-[#070510] text-slate-100 flex flex-col pb-16 lg:pb-0">
      {/* Mandatory 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5 bg-[#090614]/90 backdrop-blur-md border-b border-violet-500/15 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('visualizer');
          }}
          className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          NovaBeat
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          aria-label="Primary studio navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          {(
            [
              { id: 'library', label: 'Library' },
              { id: 'now-playing', label: 'Now Playing' },
              { id: 'visualizer', label: 'Visualizer' },
              { id: 'editor', label: 'Layer Editor' },
              { id: 'export', label: 'Export Studio' },
            ] as const
          ).map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveNav(item.id);
                  handleRecordUserAction();
                }}
                className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                  active
                    ? 'text-white border-b-2 border-violet-400 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-md shadow-violet-600/30 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPlaying ? 'Pause Audio' : 'Play Audio'}
          </button>
        </div>
      </header>

      {/* Main Responsive Studio Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT / CENTER STAGE: Live 60FPS Audio-Reactive Visualizer Canvas + Avee Transport Bar */}
        <div
          className={`${
            isTheaterStage ? 'lg:col-span-12' : 'lg:col-span-7'
          } flex flex-col bg-[#090614] border border-violet-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-violet-950/30 min-h-[340px] sm:min-h-[460px] lg:min-h-[680px]`}
        >
          {/* Stage Top Overlay Bar (Presets quick-select, Editor shortcut, Theater toggle) */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#0D081D]/90 border-b border-violet-500/15">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-white truncate">
                {visualizerConfig.name}
              </span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-violet-300 font-mono tabular-nums whitespace-nowrap">
                {visualizerConfig.barCount} Bars · {visualizerConfig.sensitivity}% Gain
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <select
                aria-label="Quick preset selector"
                value={visualizerConfig.id}
                onChange={(e) => {
                  const found = presets.find((p) => p.id === e.target.value);
                  if (found) setVisualizerConfig(found);
                }}
                className="px-2.5 py-1 text-xs bg-[#150E2D] border border-violet-500/25 rounded-lg text-violet-100 cursor-pointer"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0E0920]">
                    {p.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowProModal(true)}
                aria-label="Open NovaBeat Pro upgrade"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                  monetization.isProEntitled
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/35 text-amber-200'
                }`}
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{monetization.isProEntitled ? 'PRO' : 'Go Pro'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNav('editor')}
                aria-label="Open multi-layer editor"
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  activeNav === 'editor'
                    ? 'bg-violet-600 border-violet-400 text-white'
                    : 'bg-[#150E2D] border-violet-500/20 text-slate-300 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsTheaterStage(!isTheaterStage)}
                aria-label={
                  isTheaterStage
                    ? 'Exit full width stage'
                    : 'Expand visualizer stage'
                }
                className="hidden lg:flex p-1.5 rounded-lg bg-[#150E2D] border border-violet-500/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {isTheaterStage ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Interactive 60FPS Canvas Stage */}
          <div className="relative flex-1 w-full bg-[#06040D] overflow-hidden">
            <VisualizerCanvas
              config={visualizerConfig}
              track={currentTrack}
              isPlaying={isPlaying}
              sampleFrame={handleSampleFrame}
              onTelemetryUpdate={handleTelemetryUpdate}
              selectedLayerId={selectedLayerId}
              showEditorHandles={activeNav === 'editor'}
              onCanvasReady={(el) => {
                visualizerCanvasElRef.current = el;
              }}
            />

            {/* Optional Live Frequency Telemetry Overlay */}
            {settings.showPeakTelemetry && (
              <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/55 backdrop-blur-md border border-violet-500/20 text-[11px] font-mono tabular-nums text-slate-300">
                <span>BASS {Math.round(liveBands.bass * 100)}%</span>
                <span aria-hidden="true">·</span>
                <span>MID {Math.round(liveBands.mid * 100)}%</span>
                <span aria-hidden="true">·</span>
                <span>HIGH {Math.round(liveBands.treble * 100)}%</span>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-300">{liveBands.peakHz} Hz</span>
              </div>
            )}
          </div>

          {/* Stage Bottom Transport Dock (matching reference image 1: volume, time, seek bar, title, prev, play/pause, next) */}
          <div className="px-4 py-3 bg-[#0B0719] border-t border-violet-500/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[220px]">
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Unmute stage audio' : 'Mute stage audio'}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                )}
              </button>

              <span className="text-xs font-mono tabular-nums text-slate-400">
                {formatDuration(currentTimeSec)}
              </span>

              <div className="flex-1 flex flex-col">
                <input
                  type="range"
                  min={0}
                  max={currentTrack.durationSec}
                  step={1}
                  value={Math.min(
                    currentTrack.durationSec,
                    Math.floor(currentTimeSec)
                  )}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  aria-label="Stage playback progress"
                  className="w-full"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-semibold text-white truncate">
                    {currentTrack.title}{' '}
                    <span className="text-slate-400 font-normal">
                      — {currentTrack.artist}
                    </span>
                  </span>
                </div>
              </div>

              <span className="text-xs font-mono tabular-nums text-slate-400">
                {formatDuration(currentTrack.durationSec)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrevTrack}
                aria-label="Previous song"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-200 hover:text-white hover:bg-violet-500/20 transition-colors cursor-pointer"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label={
                  isPlaying ? 'Pause visualizer track' : 'Play visualizer track'
                }
                className="w-10 h-10 rounded-full flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/40 transition-all cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-white" />
                ) : (
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleNextTrack}
                aria-label="Next song"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-200 hover:text-white hover:bg-violet-500/20 transition-colors cursor-pointer"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT STUDIO DECK: Active Destination View */}
        {!isTheaterStage && (
          <div className="lg:col-span-5 flex flex-col min-h-[540px] lg:h-[680px]">
            {activeNav === 'library' && (
              <LibraryView
                tracks={tracks}
                playlists={playlists}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onSelectTrack={handleSelectTrack}
                onTogglePlay={handleTogglePlay}
                onToggleFavorite={(id) =>
                  setTracks((prev) => toggleTrackFavorite(prev, id))
                }
                onAddCustomTrack={(created) => {
                  setTracks((prev) => [created, ...prev]);
                  handleSelectTrack(created, true);
                }}
                onUpdateTrack={(id, updates) => {
                  setTracks((prev) => updateTrackMetadata(prev, id, updates));
                  if (updates.customBackdropUrl && id === currentTrack.id) {
                    handleUpdateConfig({
                      backgroundUrl: updates.customBackdropUrl,
                    });
                  }
                }}
                onCreatePlaylist={handleCreatePlaylist}
                onOpenVisualizer={() => setActiveNav('visualizer')}
                monetization={monetization}
                onOpenProModal={() => setShowProModal(true)}
                onOpenRewardedModal={() => setRewardedModalFormat('rewarded')}
              />
            )}

            {activeNav === 'now-playing' && (
              <NowPlayingView
                track={currentTrack}
                isPlaying={isPlaying}
                currentTimeSec={currentTimeSec}
                bands={liveBands}
                isShuffle={isShuffle}
                repeatMode={repeatMode}
                volume={volume}
                isMuted={isMuted}
                onTogglePlay={handleTogglePlay}
                onPrev={handlePrevTrack}
                onNext={handleNextTrack}
                onSeek={handleSeek}
                onToggleShuffle={() => setIsShuffle((s) => !s)}
                onToggleRepeat={() =>
                  setRepeatMode((m) =>
                    m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'
                  )
                }
                onToggleFavorite={(id) =>
                  setTracks((prev) => toggleTrackFavorite(prev, id))
                }
                onVolumeChange={handleVolumeChange}
                onToggleMute={handleToggleMute}
                onUpdateTrackCover={(id, dataUrl) =>
                  setTracks((prev) =>
                    updateTrackMetadata(prev, id, { coverUrl: dataUrl })
                  )
                }
                onOpenVisualizer={() => setActiveNav('visualizer')}
              />
            )}

            {activeNav === 'visualizer' && (
              <VisualizerStudioView
                config={visualizerConfig}
                bands={liveBands}
                onUpdateConfig={handleUpdateConfig}
                onResetConfig={() => setVisualizerConfig(INITIAL_PRESETS[0])}
                onSavePreset={handleSavePreset}
              />
            )}

            {activeNav === 'editor' && (
              <EditorPresetsView
                config={visualizerConfig}
                presets={presets}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                onUpdateConfig={handleUpdateConfig}
                onLoadPreset={(preset) => setVisualizerConfig(preset)}
                onSavePreset={handleSavePreset}
                onDeletePreset={handleDeletePreset}
              />
            )}

            {(activeNav === 'export' || activeNav === 'settings') && (
              <ExportAndAndroidView
                track={currentTrack}
                currentTimeSec={currentTimeSec}
                onSeek={handleSeek}
                settings={settings}
                onUpdateSettings={(upd) =>
                  setSettings((prev) => ({ ...prev, ...upd }))
                }
                getCanvasElement={() => visualizerCanvasElRef.current}
                getAudioStream={() =>
                  soundEngineRef.current?.getAudioStream() ?? null
                }
                isPlaying={isPlaying}
                onEnsurePlaying={() => {
                  soundEngineRef.current?.play();
                  setIsPlaying(true);
                }}
                onRecordingStateChange={(rec) => {
                  isRecordingVideoRef.current = rec;
                }}
                initialSubTab={activeNav === 'settings' ? 'settings' : 'export'}
                monetization={monetization}
                onOpenProModal={() => setShowProModal(true)}
                onOpenRewardedModal={(fmt = 'rewarded') => {
                  if (!monetization.isProEntitled) {
                    setRewardedModalFormat(fmt);
                  }
                }}
                onOpenPrivacyOptions={() => setShowUmpModal(true)}
                onOpenLegalDocument={(doc) => setActiveLegalDoc(doc)}
                onSimulateMaterialEulaUpdate={() =>
                  setMonetization((prev) => ({
                    ...prev,
                    requiredEulaVersion:
                      prev.requiredEulaVersion === '2.0.0' ? '2.1.0' : '2.0.0',
                  }))
                }
                onRecordUserAction={handleRecordUserAction}
                onRestorePurchases={reconcileBillingWithServer}
                onSetAdEnvironment={(env: AdEnvironmentMode) =>
                  setMonetization((prev) => ({ ...prev, environment: env }))
                }
                onToggleOfflineSimulation={() =>
                  setMonetization((prev) => ({
                    ...prev,
                    isOfflineSimulated: !prev.isOfflineSimulated,
                  }))
                }
                onTriggerFullScreenAdCheck={handleTriggerFullScreenAdCheck}
              />
            )}
          </div>
        )}
      </main>

      {/* First-Launch / Material-Update EULA Onboarding Modal */}
      <FirstLaunchEulaModal
        isOpen={isEulaAcceptanceRequired(
          monetization.acceptedEulaVersion,
          monetization.requiredEulaVersion
        )}
        requiredVersion={monetization.requiredEulaVersion}
        previousAcceptedVersion={monetization.acceptedEulaVersion}
        onAcceptEula={handleAcceptEula}
        onOpenPrivacyPolicy={() => setActiveLegalDoc('privacy')}
      />

      {/* Full-Text EULA & Privacy Policy Viewer Modal */}
      <LegalDocumentModal
        documentType={activeLegalDoc}
        onClose={() => setActiveLegalDoc(null)}
      />

      {/* Monetization & Google Play Billing 9.1.0 Modals */}
      <NovaBeatProModal
        isOpen={showProModal}
        monetization={monetization}
        isBusy={isBillingBusy}
        onClose={() => setShowProModal(false)}
        onExecutePurchase={handleExecutePurchase}
        onCompletePendingPurchase={handleCompletePendingPurchase}
        onRestorePurchases={reconcileBillingWithServer}
        onResetPurchasesForTest={handleResetPurchasesForTest}
        onOpenPrivacyOptions={() => {
          setShowProModal(false);
          setShowUmpModal(true);
        }}
      />

      <RewardedAdDialog
        isOpen={rewardedModalFormat !== null && !monetization.isProEntitled}
        format={rewardedModalFormat || 'rewarded'}
        monetization={monetization}
        onClose={() => setRewardedModalFormat(null)}
        onRewardEarned={() => {
          setMonetization((prev) => {
            const outcome = applyRewardedAdOutcome(
              true,
              prev.rewardPassExpiresAtMs,
              Date.now()
            );
            return {
              ...prev,
              rewardPassExpiresAtMs: outcome.rewardPassExpiresAtMs,
            };
          });
        }}
        onRewardSkipped={() => {
          setMonetization((prev) => {
            const outcome = applyRewardedAdOutcome(
              false,
              prev.rewardPassExpiresAtMs,
              Date.now()
            );
            return {
              ...prev,
              rewardPassExpiresAtMs: outcome.rewardPassExpiresAtMs,
            };
          });
        }}
        onOpenProUpgrade={() => setShowProModal(true)}
      />

      <UmpConsentDialog
        isOpen={showUmpModal}
        consentStatus={monetization.umpConsentStatus}
        onSelectConsent={(status: UmpConsentStatus, canRequestAds: boolean) =>
          setMonetization((prev) => ({
            ...prev,
            umpConsentCompleted: true,
            umpConsentStatus: status,
            canRequestAds,
            sdkInitialized: canRequestAds,
            isFirstLaunchSessionBeforeOnboardingComplete: false,
          }))
        }
        onClose={() => setShowUmpModal(false)}
        onOpenPrivacyPolicy={() => setActiveLegalDoc('privacy')}
      />

      <FullScreenAdOverlay
        activeFormat={activeFullScreenAd}
        monetization={monetization}
        onDismiss={() => {
          setActiveFullScreenAd(null);
          setMonetization((prev) => ({
            ...prev,
            frequency: {
              ...prev.frequency,
              isShowingFullScreenAd: false,
            },
          }));
        }}
        onUpgradePro={() => setShowProModal(true)}
      />

      {/* Mobile Fixed Bottom Navigation Bar (matching Phone 5 bottom navigation in reference image) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0617]/95 backdrop-blur-md border-t border-violet-500/20 grid grid-cols-5 items-center h-16 px-2"
      >
        {(
          [
            { id: 'library', label: 'Home', Icon: Home },
            { id: 'now-playing', label: 'Playing', Icon: Music2 },
            { id: 'visualizer', label: 'Visualize', Icon: BarChart3 },
            { id: 'editor', label: 'Create', Icon: Edit3 },
            { id: 'export', label: 'Export', Icon: Film },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeNav === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveNav(id);
                handleRecordUserAction();
              }}
              className={`flex flex-col items-center justify-center min-h-[44px] rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'text-violet-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight mt-1">
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
