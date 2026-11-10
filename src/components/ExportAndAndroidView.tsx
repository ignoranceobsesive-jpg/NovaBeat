import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Crown,
  Download,
  Film,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Square,
  XCircle,
} from 'lucide-react';
import {
  computeExportProgress,
  estimateExportSizeMb,
  getExportCanvasDimensions,
} from '../audio/fftAnalysis';
import { ANDROID_KOTLIN_FILES } from '../data/androidKotlinFiles';
import { formatDuration } from '../domain/libraryLogic';
import {
  AdEnvironmentMode,
  AdFormatType,
  getRecentInterstitialCount24h,
  MONETIZATION_CONFIG,
  resolveActiveAdUnits,
} from '../domain/monetizationConfig';
import { AppSettings, ExportConfig, Track } from '../types/novabeat';
import { MonetizationRuntimeState } from './MonetizationComponents';

export type ExportRangeMode = 'full-track' | 'from-current' | 'custom-duration';

interface ExportAndAndroidViewProps {
  track: Track;
  currentTimeSec: number;
  onSeek: (sec: number) => void;
  settings: AppSettings;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
  getCanvasElement: () => HTMLCanvasElement | null;
  getAudioStream: () => MediaStream | null;
  isPlaying: boolean;
  onEnsurePlaying: () => void;
  onRecordingStateChange?: (recording: boolean) => void;
  initialSubTab?: 'export' | 'android' | 'settings';
  monetization?: MonetizationRuntimeState;
  onOpenProModal?: () => void;
  onOpenRewardedModal?: (format?: 'rewarded' | 'rewarded-interstitial') => void;
  onOpenPrivacyOptions?: () => void;
  onOpenLegalDocument?: (doc: 'eula' | 'privacy') => void;
  onSimulateMaterialEulaUpdate?: () => void;
  onRecordUserAction?: () => void;
  onRestorePurchases?: () => void;
  onSetAdEnvironment?: (env: AdEnvironmentMode) => void;
  onToggleOfflineSimulation?: () => void;
  onTriggerFullScreenAdCheck?: (
    format: Extract<AdFormatType, 'interstitial' | 'app-open'>
  ) => { shown: boolean; message: string };
}

export const ExportAndAndroidView: React.FC<ExportAndAndroidViewProps> = ({
  track,
  currentTimeSec,
  onSeek,
  settings,
  onUpdateSettings,
  getCanvasElement,
  getAudioStream,
  isPlaying,
  onEnsurePlaying,
  onRecordingStateChange,
  initialSubTab = 'export',
  monetization,
  onOpenProModal,
  onOpenRewardedModal,
  onOpenPrivacyOptions,
  onOpenLegalDocument,
  onSimulateMaterialEulaUpdate,
  onRecordUserAction,
  onRestorePurchases,
  onSetAdEnvironment,
  onToggleOfflineSimulation,
  onTriggerFullScreenAdCheck,
}) => {
  const [subTab, setSubTab] = useState<'export' | 'android' | 'settings'>(
    initialSubTab
  );
  const [adDiagnosticMsg, setAdDiagnosticMsg] = useState<string>('');

  const [rangeMode, setRangeMode] = useState<ExportRangeMode>('full-track');
  const [customDurationSec, setCustomDurationSec] = useState<number>(
    track.durationSec || 225
  );

  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    resolution: '1080p',
    fps: 60,
    aspectRatio: '16:9',
    includeAudio: true,
    durationSec: track.durationSec || 225,
  });

  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm'>('mp4');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [elapsedExportSec, setElapsedExportSec] = useState(0);
  const [targetExportSec, setTargetExportSec] = useState(
    track.durationSec || 225
  );
  const [capturedBytes, setCapturedBytes] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedFileName, setRecordedFileName] = useState<string>('');
  const [exportStatusMsg, setExportStatusMsg] = useState('');

  const [selectedKotlinIdx, setSelectedKotlinIdx] = useState(0);
  const [copiedPath, setCopiedPath] = useState('');

  // Active recording refs so user can stop/finalize or cancel at any time
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const framePumpTimerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const canceledRef = useRef<boolean>(false);

  // Sync default custom duration when track changes
  useEffect(() => {
    if (!isRecording) {
      setCustomDurationSec(track.durationSec || 225);
    }
  }, [track.id, track.durationSec, isRecording]);

  // Compute target export duration in seconds based on selected rangeMode
  const plannedDurationSec =
    rangeMode === 'full-track'
      ? Math.max(1, track.durationSec || 225)
      : rangeMode === 'from-current'
      ? Math.max(
          5,
          Math.round((track.durationSec || 225) - Math.floor(currentTimeSec))
        )
      : Math.max(5, Math.min(track.durationSec || 600, customDurationSec));

  const estimatedMb = estimateExportSizeMb({
    ...exportConfig,
    durationSec: plannedDurationSec,
  });

  const cleanupTimers = () => {
    if (framePumpTimerRef.current !== null) {
      window.clearInterval(framePumpTimerRef.current);
      framePumpTimerRef.current = null;
    }
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupTimers();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === 'recording'
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore on unmount
        }
      }
    };
  }, []);

  const handleStopAndSaveNow = () => {
    canceledRef.current = false;
    cleanupTimers();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      try {
        mediaRecorderRef.current.requestData();
        mediaRecorderRef.current.stop();
      } catch {
        setIsRecording(false);
        onRecordingStateChange?.(false);
      }
    }
  };

  const handleCancelExport = () => {
    canceledRef.current = true;
    cleanupTimers();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    setIsRecording(false);
    onRecordingStateChange?.(false);
    setRecordProgress(0);
    setElapsedExportSec(0);
    setExportStatusMsg('Video export canceled.');
  };

  const handleStartVideoExport = () => {
    const sourceCanvas = getCanvasElement();
    if (!sourceCanvas) {
      setExportStatusMsg('Visualizer stage canvas is initializing...');
      return;
    }

    const totalSecToRecord = plannedDurationSec;
    setTargetExportSec(totalSecToRecord);
    setElapsedExportSec(0);
    setCapturedBytes(0);
    setRecordedVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    canceledRef.current = false;

    // If exporting Full Track, seek to 00:00 so the entire song is recorded from the start
    if (rangeMode === 'full-track') {
      onSeek(0);
    }
    onEnsurePlaying();
    onRecordingStateChange?.(true);
    setIsRecording(true);
    setRecordProgress(1);

    const { width: targetW, height: targetH, videoBitsPerSecond } =
      getExportCanvasDimensions(
        exportConfig.resolution,
        exportConfig.aspectRatio
      );

    setExportStatusMsg(
      `Recording full ${formatDuration(totalSecToRecord)} video (${targetW}×${targetH} @ ${exportConfig.fps} FPS)...`
    );

    try {
      // Capture directly from the mounted live DOM visualizer canvas so every frame is hardware/DOM-synced
      const stream = sourceCanvas.captureStream(exportConfig.fps);
      if (exportConfig.includeAudio) {
        const audioStream = getAudioStream();
        if (audioStream) {
          audioStream.getAudioTracks().forEach((at) => {
            stream.addTrack(at);
          });
        }
      }

      const chunks: BlobPart[] = [];
      let totalBytes = 0;

      // Prefer VP8 over VP9 for real-time capture so software encoding never starves 60fps canvas rendering
      const mimeCandidates = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const chosenMime =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ||
        'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType: chosenMime,
        videoBitsPerSecond: Math.min(videoBitsPerSecond, 4_500_000),
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
          totalBytes += ev.data.size;
          setCapturedBytes(totalBytes);
        }
      };

      const startedAtMs = performance.now();

      recorder.onstop = async () => {
        cleanupTimers();
        setIsRecording(false);
        onRecordingStateChange?.(false);

        if (canceledRef.current || chunks.length === 0) {
          return;
        }

        const recordedDurationSec = Math.max(
          1,
          Math.round((performance.now() - startedAtMs) / 1000)
        );
        const rawWebmBlob = new Blob(chunks, { type: 'video/webm' });
        const safeTitle = track.title.replace(/[^a-zA-Z0-9_-]+/g, '_');

        let finalBlob: Blob = rawWebmBlob;
        let finalExt: 'mp4' | 'webm' = 'webm';

        if (exportFormat === 'mp4') {
          setIsTranscoding(true);
          setExportStatusMsg(
            'Finalizing & encoding universal MP4 (H.264 + AAC)...'
          );
          try {
            const response = await fetch('/api/transcode-mp4', {
              method: 'POST',
              headers: { 'Content-Type': 'video/webm' },
              body: rawWebmBlob,
            });
            if (response.ok) {
              const mp4ArrayBuffer = await response.arrayBuffer();
              finalBlob = new Blob([mp4ArrayBuffer], { type: 'video/mp4' });
              finalExt = 'mp4';
            }
          } catch {
            // Fallback to recorded container if offline
          } finally {
            setIsTranscoding(false);
          }
        }

        const url = URL.createObjectURL(finalBlob);
        const fileName = `${safeTitle}_NovaBeat_${exportConfig.resolution}_${exportConfig.fps}fps.${finalExt}`;

        setRecordedVideoUrl(url);
        setRecordedFileName(fileName);
        setRecordProgress(100);
        const finalSizeMb = Math.max(
          0.1,
          Math.round((finalBlob.size / (1024 * 1024)) * 10) / 10
        );
        setExportStatusMsg(
          `Full ${finalExt.toUpperCase()} video exported (${formatDuration(
            recordedDurationSec
          )} recorded · ${finalSizeMb} MB). Ready to watch or download!`
        );

        // Trigger automatic download so the user gets their file immediately
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      // Emit data chunks every 500ms so large full-length videos stream smoothly into memory
      recorder.start(500);

      progressTimerRef.current = window.setInterval(() => {
        const elapsedSec = (performance.now() - startedAtMs) / 1000;
        setElapsedExportSec(elapsedSec);

        const prog = computeExportProgress(elapsedSec, totalSecToRecord);
        setRecordProgress(prog.percent);

        if (prog.isComplete) {
          cleanupTimers();
          if (recorder.state === 'recording') {
            recorder.requestData();
            recorder.stop();
          }
        }
      }, 250);
    } catch {
      cleanupTimers();
      setIsRecording(false);
      onRecordingStateChange?.(false);
      setExportStatusMsg(
        'Browser MediaRecorder encountered an error initializing stream capture.'
      );
    }
  };

  const activeKotlinFile =
    ANDROID_KOTLIN_FILES[selectedKotlinIdx] || ANDROID_KOTLIN_FILES[0];

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(activeKotlinFile.content);
    setCopiedPath(activeKotlinFile.path);
    setTimeout(() => setCopiedPath(''), 2000);
  };

  const handleDownloadKotlinFile = () => {
    const blob = new Blob([activeKotlinFile.content], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeKotlinFile.path.split('/').pop() || 'NovaBeat.kt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Video Exporter, Android Source, and Studio Settings"
      className="flex flex-col justify-between h-full bg-[#090614]/90 border border-violet-500/15 rounded-2xl p-4 sm:p-5 overflow-y-auto"
    >
      <div>
        {/* Sub-Tabs */}
        <div
          role="tablist"
          aria-label="Export and Settings sections"
          className="grid grid-cols-3 gap-1 p-1 bg-[#120C24] border border-violet-500/15 rounded-xl mb-4"
        >
          <button
            role="tab"
            aria-selected={subTab === 'export'}
            type="button"
            onClick={() => setSubTab('export')}
            className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              subTab === 'export'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Video Export</span>
          </button>

          <button
            role="tab"
            aria-selected={subTab === 'android'}
            type="button"
            onClick={() => setSubTab('android')}
            className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              subTab === 'android'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Android Kotlin</span>
          </button>

          <button
            role="tab"
            aria-selected={subTab === 'settings'}
            type="button"
            onClick={() => setSubTab('settings')}
            className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              subTab === 'settings'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>DSP Settings</span>
          </button>
        </div>

        {/* TAB 1: FULL-TRACK VIDEO EXPORTER */}
        {subTab === 'export' && (
          <div className="space-y-3.5">
            {/* Preview Card or Recorded Video Playback */}
            {recordedVideoUrl && !isRecording ? (
              <div className="rounded-2xl overflow-hidden border border-emerald-500/40 bg-[#080511] p-2.5 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    Exported Video Preview
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {recordedFileName}
                  </span>
                </div>
                <video
                  src={recordedVideoUrl}
                  controls
                  className="w-full max-h-44 rounded-xl bg-black object-contain"
                />
              </div>
            ) : (
              <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-violet-500/30 bg-[#120A28]">
                <img
                  src={track.customBackdropUrl || track.coverUrl}
                  alt="Export preview frame"
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090614]/90 via-black/25 to-black/30 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    onClick={onEnsurePlaying}
                    aria-label="Preview visualizer playback"
                    className="w-11 h-11 rounded-full bg-black/65 border border-violet-400/50 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>
                  <span className="mt-2 text-xs font-semibold text-violet-200 bg-black/60 px-3 py-1 rounded-lg border border-violet-500/20">
                    {track.title} · Full Length {formatDuration(track.durationSec)}
                  </span>
                </div>
              </div>
            )}

            {/* Export Options Form */}
            <div className="space-y-2.5 bg-[#110B22] border border-violet-500/15 rounded-2xl p-3.5">
              {/* Export Duration Mode */}
              <div className="py-1 border-b border-violet-500/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="export-range-mode"
                    className="text-xs font-medium text-slate-200"
                  >
                    Export Length
                  </label>
                  <select
                    id="export-range-mode"
                    disabled={isRecording}
                    value={rangeMode}
                    onChange={(e) =>
                      setRangeMode(e.target.value as ExportRangeMode)
                    }
                    className="px-2.5 py-1.5 text-xs font-semibold bg-[#191130] border border-violet-500/25 rounded-lg text-white cursor-pointer"
                  >
                    <option value="full-track">
                      Full Song (00:00 → {formatDuration(track.durationSec)})
                    </option>
                    <option value="from-current">
                      From Current ({formatDuration(currentTimeSec)} →{' '}
                      {formatDuration(track.durationSec)})
                    </option>
                    <option value="custom-duration">
                      Custom Duration (Seconds)
                    </option>
                  </select>
                </div>

                {rangeMode === 'custom-duration' && (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-slate-400">
                      Clip Duration: {formatDuration(customDurationSec)} (
                      {customDurationSec}s)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[15, 30, 60, track.durationSec].map((presetSec) => (
                        <button
                          key={presetSec}
                          type="button"
                          onClick={() => setCustomDurationSec(presetSec)}
                          className={`px-2 py-1 text-[10px] font-mono rounded border cursor-pointer ${
                            customDurationSec === presetSec
                              ? 'bg-violet-600 text-white border-violet-400'
                              : 'bg-[#090614] text-slate-300 border-violet-500/20'
                          }`}
                        >
                          {presetSec === track.durationSec
                            ? 'Full'
                            : `${presetSec}s`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-1 border-b border-violet-500/10">
                <label
                  htmlFor="export-format"
                  className="text-xs font-medium text-slate-200"
                >
                  Video Format
                </label>
                <select
                  id="export-format"
                  disabled={isRecording || isTranscoding}
                  value={exportFormat}
                  onChange={(e) =>
                    setExportFormat(e.target.value as 'mp4' | 'webm')
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-[#191130] border border-violet-500/25 rounded-lg text-white cursor-pointer"
                >
                  <option value="mp4">MP4 (H.264 + AAC)</option>
                  <option value="webm">WebM (VP8 + Opus)</option>
                </select>
              </div>

              <div className="py-1 border-b border-violet-500/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="export-resolution"
                    className="text-xs font-medium text-slate-200"
                  >
                    Resolution
                  </label>
                  <select
                    id="export-resolution"
                    disabled={isRecording || isTranscoding}
                    value={exportConfig.resolution}
                    onChange={(e) => {
                      const nextRes = e.target
                        .value as ExportConfig['resolution'];
                      setExportConfig({
                        ...exportConfig,
                        resolution: nextRes,
                      });
                      const hasRewardPass =
                        monetization &&
                        monetization.rewardPassExpiresAtMs > Date.now();
                      if (
                        nextRes === '1440p' &&
                        monetization &&
                        !monetization.isProEntitled &&
                        !hasRewardPass
                      ) {
                        onOpenRewardedModal?.('rewarded-interstitial');
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#191130] border border-violet-500/25 rounded-lg text-white cursor-pointer"
                  >
                    <option value="720p">720p HD</option>
                    <option value="1080p">1080p Full HD</option>
                    <option value="1440p">
                      1440p QHD{' '}
                      {monetization?.isProEntitled ||
                      (monetization &&
                        monetization.rewardPassExpiresAtMs > Date.now())
                        ? '(Unlocked)'
                        : '(Pro / Rewarded Ad)'}
                    </option>
                  </select>
                </div>

                {monetization && !monetization.isProEntitled && (
                  <div className="flex items-center justify-between gap-2 text-[11px] bg-[#0B0718] border border-violet-500/20 rounded-lg px-2.5 py-1.5">
                    {monetization.rewardPassExpiresAtMs > Date.now() ? (
                      <span className="text-emerald-300 font-medium inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        30m 1440p QHD Reward Pass Active
                      </span>
                    ) : (
                      <span className="text-slate-300">
                        Unlock 1440p QHD via Rewarded Ad or Pro
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenRewardedModal?.('rewarded')}
                        className="px-2 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-200 font-medium cursor-pointer"
                      >
                        Watch Rewarded Ad
                      </button>
                      <button
                        type="button"
                        onClick={onOpenProModal}
                        className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-200 font-semibold cursor-pointer"
                      >
                        Go Pro
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-1 border-b border-violet-500/10">
                <label
                  htmlFor="export-fps"
                  className="text-xs font-medium text-slate-200"
                >
                  Frame Rate
                </label>
                <select
                  id="export-fps"
                  disabled={isRecording}
                  value={exportConfig.fps}
                  onChange={(e) =>
                    setExportConfig({
                      ...exportConfig,
                      fps: Number(e.target.value) as 30 | 60,
                    })
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-[#191130] border border-violet-500/25 rounded-lg text-white cursor-pointer"
                >
                  <option value={60}>60 FPS</option>
                  <option value={30}>30 FPS</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-violet-500/10">
                <label
                  htmlFor="export-aspect"
                  className="text-xs font-medium text-slate-200"
                >
                  Aspect Ratio
                </label>
                <select
                  id="export-aspect"
                  disabled={isRecording}
                  value={exportConfig.aspectRatio}
                  onChange={(e) =>
                    setExportConfig({
                      ...exportConfig,
                      aspectRatio: e.target
                        .value as ExportConfig['aspectRatio'],
                    })
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-[#191130] border border-violet-500/25 rounded-lg text-white cursor-pointer"
                >
                  <option value="16:9">16:9 Widescreen</option>
                  <option value="9:16">9:16 Vertical Reels</option>
                  <option value="1:1">1:1 Square Album</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-200">
                  Include Audio
                </span>
                <button
                  type="button"
                  role="switch"
                  disabled={isRecording}
                  aria-checked={exportConfig.includeAudio}
                  aria-label="Include audio in video export"
                  onClick={() =>
                    setExportConfig({
                      ...exportConfig,
                      includeAudio: !exportConfig.includeAudio,
                    })
                  }
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    exportConfig.includeAudio ? 'bg-violet-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      exportConfig.includeAudio
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Active Recording Controls or Start Export CTA */}
            {isRecording ? (
              <div className="p-4 bg-[#140C2B] border border-violet-400/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-violet-200">
                    Recording Full Visualizer Video...
                  </span>
                  <span className="font-mono tabular-nums text-cyan-300">
                    {formatDuration(elapsedExportSec)} /{' '}
                    {formatDuration(targetExportSec)} ({recordProgress}%)
                  </span>
                </div>

                <div className="w-full h-2.5 bg-violet-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-200"
                    style={{ width: `${Math.max(2, recordProgress)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                  <span>
                    Captured:{' '}
                    {Math.round((capturedBytes / (1024 * 1024)) * 100) / 100} MB
                  </span>
                  <span>
                    Remaining:{' '}
                    {formatDuration(
                      Math.max(0, targetExportSec - elapsedExportSec)
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleStopAndSaveNow}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/25 cursor-pointer transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Finish & Save Video Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelExport}
                    className="py-2.5 px-3 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/30 text-rose-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isTranscoding}
                  onClick={handleStartVideoExport}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xl shadow-violet-600/35 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Film className="w-4 h-4" />
                  <span>
                    {isTranscoding
                      ? 'Encoding MP4 (H.264 + AAC)...'
                      : `Export ${exportFormat.toUpperCase()} Video (${formatDuration(
                          plannedDurationSec
                        )})`}
                  </span>
                </button>

                <p className="text-xs text-slate-400 font-mono tabular-nums">
                  Format: {exportFormat.toUpperCase()} · Target Duration:{' '}
                  {formatDuration(plannedDurationSec)} · Estimated Size: ~
                  {estimatedMb} MB
                </p>

                {exportStatusMsg && (
                  <div className="p-3 bg-violet-950/50 border border-violet-500/30 rounded-xl text-xs text-violet-200 space-y-2">
                    <p>{exportStatusMsg}</p>
                    {recordedVideoUrl && (
                      <a
                        href={recordedVideoUrl}
                        download={
                          recordedFileName ||
                          `${track.title.replace(/\s+/g, '_')}_NovaBeat_${exportConfig.resolution}.${exportFormat}`
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Exported {exportFormat.toUpperCase()} Video
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NATIVE ANDROID STUDIO KOTLIN ARCHITECTURE */}
        {subTab === 'android' && (
          <div className="space-y-3">
            <div className="p-3 bg-[#110B22] border border-violet-500/20 rounded-xl">
              <p className="text-xs font-semibold text-white">
                Native Android Architecture (API 36 · Kotlin · Jetpack Compose · Media3 · Radix-2 FFT)
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Inspect or download the native Android Studio modules located in{' '}
                <code className="text-violet-300 font-mono">/android-project/</code>.
              </p>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {ANDROID_KOTLIN_FILES.map((file, idx) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedKotlinIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    selectedKotlinIdx === idx
                      ? 'bg-violet-600 text-white border-violet-400'
                      : 'bg-[#120C24] text-slate-300 border-violet-500/15 hover:text-white'
                  }`}
                >
                  {file.layer}: {file.path.split('/').pop()}
                </button>
              ))}
            </div>

            <div className="bg-[#07050E] border border-violet-500/25 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#120C24] border-b border-violet-500/20">
                <span className="text-xs font-mono text-violet-300 truncate">
                  {activeKotlinFile.path}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-violet-950/80 hover:bg-violet-900 text-violet-200 rounded-md cursor-pointer"
                  >
                    {copiedPath === activeKotlinFile.path ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadKotlinFile}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-md cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
              <pre className="p-3.5 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-72 leading-relaxed">
                <code>{activeKotlinFile.content}</code>
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: STUDIO DSP, NOVABEAT PRO BILLING & ADMOB CONFIGURATION */}
        {subTab === 'settings' && (
          <div className="space-y-3.5">
            {/* NovaBeat Pro Upgrade & Google Play Billing 9.1.0 Card */}
            {monetization && (
              <div className="p-4 bg-gradient-to-br from-[#160D2E] via-[#110B22] to-[#0E182B] border border-violet-500/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-white font-display">
                        {MONETIZATION_CONFIG.playBillingProduct.name}
                      </h3>
                      <p className="text-[11px] font-mono text-violet-300">
                        SKU: {MONETIZATION_CONFIG.playBillingProduct.productId} · Google Play Billing 9.1.0
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border ${
                      monetization.isProEntitled
                        ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                        : monetization.purchaseState === 'PENDING'
                        ? 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                        : 'bg-violet-950/70 border-violet-500/30 text-violet-200'
                    }`}
                  >
                    {monetization.isProEntitled
                      ? 'PRO UNLOCKED'
                      : monetization.purchaseState === 'PENDING'
                      ? 'PAYMENT PENDING'
                      : '$9.99 LIFETIME'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {MONETIZATION_CONFIG.playBillingProduct.description}
                </p>

                <p className="text-[11px] font-mono text-cyan-300">
                  {monetization.statusMessage}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onOpenProModal}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-violet-600 hover:from-amber-400 hover:to-violet-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>
                      {monetization.isProEntitled
                        ? 'Manage Pro License'
                        : 'Upgrade to NovaBeat Pro'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onRestorePurchases}
                    className="px-3 py-2 rounded-xl bg-[#191130] hover:bg-[#231842] border border-violet-500/25 text-violet-200 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restore Purchases</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenPrivacyOptions}
                    className="px-3 py-2 rounded-xl bg-[#191130] hover:bg-[#231842] border border-cyan-500/25 text-cyan-200 font-medium text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Ad Privacy (UMP)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Centralized AdMob 5-Format Configuration & Diagnostics */}
            {monetization && (
              <div className="p-3.5 bg-[#110B22] border border-violet-500/20 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      AdMob SDK Configuration (All 5 Ad Units)
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Switch between Official Google Test IDs and Production IDs
                    </p>
                  </div>
                  <select
                    aria-label="AdMob environment mode"
                    value={monetization.environment}
                    onChange={(e) =>
                      onSetAdEnvironment?.(e.target.value as AdEnvironmentMode)
                    }
                    className="px-2.5 py-1 text-xs font-mono bg-[#191130] border border-violet-500/30 rounded-lg text-white cursor-pointer"
                  >
                    <option value="test">Test IDs (Dev Default)</option>
                    <option value="production">Production IDs (Release)</option>
                  </select>
                </div>

                {(() => {
                  const units = resolveActiveAdUnits(monetization.environment);
                  return (
                    <div className="p-2.5 bg-[#090614] border border-violet-500/15 rounded-xl text-[10px] font-mono text-slate-300 space-y-1">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">App ID:</span>
                        <span className="text-violet-300 truncate">{units.appId}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Banner:</span>
                        <span className="text-cyan-300 truncate">{units.bannerAdUnitId}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Interstitial:</span>
                        <span className="text-cyan-300 truncate">{units.interstitialAdUnitId}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Rewarded Interstitial:</span>
                        <span className="text-cyan-300 truncate">{units.rewardedInterstitialAdUnitId}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Rewarded:</span>
                        <span className="text-cyan-300 truncate">{units.rewardedAdUnitId}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">App Open:</span>
                        <span className="text-cyan-300 truncate">{units.appOpenAdUnitId}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
                  <div className="p-2 rounded-lg bg-[#090614] border border-violet-500/15">
                    <span className="block text-slate-400">Actions (&gt;=2)</span>
                    <span className="text-violet-200 font-semibold">
                      {monetization.frequency.userActionsSinceLastInterstitial}/2
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#090614] border border-violet-500/15">
                    <span className="block text-slate-400">Daily Cap</span>
                    <span className="text-violet-200 font-semibold">
                      {getRecentInterstitialCount24h(
                        monetization.frequency.interstitialTimestampsMs,
                        Date.now()
                      )}
                      /6 day
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#090614] border border-violet-500/15">
                    <span className="block text-slate-400">Full-Screen Gap</span>
                    <span className="text-cyan-300 font-semibold">5m Min</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#090614] border border-violet-500/15">
                    <span className="block text-slate-400">App Open Cap</span>
                    <span className="text-cyan-300 font-semibold">1 / 4h</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {!monetization.isProEntitled && (
                    <button
                      type="button"
                      onClick={() => onOpenRewardedModal?.('rewarded')}
                      className="px-2.5 py-1.5 rounded-lg bg-[#191130] hover:bg-[#231842] border border-violet-500/25 text-[11px] font-medium text-violet-200 cursor-pointer"
                    >
                      Test Rewarded Ad
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onRecordUserAction?.();
                      setAdDiagnosticMsg(
                        'Recorded +1 user action toward Interstitial eligibility (>= 2 required).'
                      );
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#191130] hover:bg-[#231842] border border-cyan-500/25 text-[11px] font-medium text-cyan-200 cursor-pointer"
                  >
                    +1 User Action
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const res = onTriggerFullScreenAdCheck?.('interstitial');
                      if (res) setAdDiagnosticMsg(res.message);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#191130] hover:bg-[#231842] border border-violet-500/25 text-[11px] font-medium text-violet-200 cursor-pointer"
                  >
                    Test Interstitial Check
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const res = onTriggerFullScreenAdCheck?.('app-open');
                      if (res) setAdDiagnosticMsg(res.message);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#191130] hover:bg-[#231842] border border-violet-500/25 text-[11px] font-medium text-violet-200 cursor-pointer"
                  >
                    Test App Open Check
                  </button>
                  <button
                    type="button"
                    onClick={onToggleOfflineSimulation}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer ${
                      monetization.isOfflineSimulated
                        ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                        : 'bg-[#191130] border-violet-500/25 text-slate-300'
                    }`}
                  >
                    {monetization.isOfflineSimulated
                      ? 'Offline Simulated: ON'
                      : 'Simulate Network Failure'}
                  </button>
                </div>

                {adDiagnosticMsg && (
                  <p className="text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                    {adDiagnosticMsg}
                  </p>
                )}
              </div>
            )}

            {/* Legal, EULA & Privacy Policy Links (Requirement 9 & 8) */}
            {monetization && (
              <div className="p-3.5 bg-[#110B22] border border-violet-500/20 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Legal, EULA &amp; Privacy Policy
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Accepted EULA: v{monetization.acceptedEulaVersion || 'None'} · Current Required: v{monetization.requiredEulaVersion}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-950/70 border border-emerald-500/35 text-emerald-300 rounded">
                    UMP: {monetization.umpConsentStatus}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenLegalDocument?.('eula')}
                    className="px-3 py-1.5 rounded-xl bg-[#191130] hover:bg-[#231842] border border-violet-500/25 text-xs font-semibold text-violet-200 cursor-pointer"
                  >
                    End-User License Agreement (EULA)
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenLegalDocument?.('privacy')}
                    className="px-3 py-1.5 rounded-xl bg-[#191130] hover:bg-[#231842] border border-cyan-500/25 text-xs font-semibold text-cyan-200 cursor-pointer"
                  >
                    Privacy Policy
                  </button>

                  <button
                    type="button"
                    onClick={onSimulateMaterialEulaUpdate}
                    className="px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/30 text-[11px] font-medium text-amber-200 cursor-pointer"
                  >
                    Simulate Material EULA Update (v2.1.0)
                  </button>
                </div>
              </div>
            )}

            {/* Audio DSP Settings */}
            <div className="p-4 bg-[#110B22] border border-violet-500/15 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">
                    FFT Window Size (PCM Samples)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Higher sizes increase sub-bass frequency resolution
                  </p>
                </div>
                <select
                  aria-label="FFT window size"
                  value={settings.fftSize}
                  onChange={(e) =>
                    onUpdateSettings({
                      fftSize: Number(
                        e.target.value
                      ) as AppSettings['fftSize'],
                    })
                  }
                  className="px-3 py-1.5 text-xs font-mono bg-[#191130] border border-violet-500/25 rounded-lg text-white"
                >
                  <option value={512}>512 Samples</option>
                  <option value={1024}>1024 Samples</option>
                  <option value={2048}>2048 Samples</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-200 font-medium">
                    Sub-Bass Analog Boost (140Hz Low-Shelf)
                  </span>
                  <span className="font-mono text-violet-300">
                    +{settings.bassBoostDb} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={settings.bassBoostDb}
                  onChange={(e) =>
                    onUpdateSettings({ bassBoostDb: Number(e.target.value) })
                  }
                  aria-label="Sub-bass boost dB"
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-violet-500/10">
                <div>
                  <p className="text-xs font-semibold text-white">
                    Real-Time Frequency Peak HUD
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Display live Bass/Mid/Treble and dominant Hz overlay on stage
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showPeakTelemetry}
                  onChange={(e) =>
                    onUpdateSettings({
                      showPeakTelemetry: e.target.checked,
                    })
                  }
                  aria-label="Display live frequency HUD"
                  className="w-4 h-4 accent-violet-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-violet-500/10">
                <div>
                  <p className="text-xs font-semibold text-white">
                    Automatic Cloud Library Sync
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Persist personal audio tracks, custom images, and presets
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoCloudSync}
                  onChange={(e) =>
                    onUpdateSettings({ autoCloudSync: e.target.checked })
                  }
                  aria-label="Automatic cloud library sync"
                  className="w-4 h-4 accent-violet-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
