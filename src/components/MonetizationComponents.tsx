import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  FileText,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import {
  AdEnvironmentMode,
  AdFormatType,
  AdFrequencyState,
  CURRENT_EULA_VERSION,
  evaluateAdGuardrails,
  getLocalizedPlayStorePrice,
  getRecentInterstitialCount24h,
  isEulaAcceptanceRequired,
  MONETIZATION_CONFIG,
  NOVABEAT_EULA_SECTIONS,
  NOVABEAT_PRIVACY_POLICY_SECTIONS,
  PurchaseLifecycleState,
  resolveActiveAdUnits,
  UmpConsentStatus,
} from '../domain/monetizationConfig';

export interface MonetizationRuntimeState {
  environment: AdEnvironmentMode;
  acceptedEulaVersion: string | null;
  acceptedEulaAtMs: number | null;
  requiredEulaVersion: string;
  isFirstLaunchSessionBeforeOnboardingComplete: boolean;
  umpConsentCompleted: boolean;
  umpConsentStatus: UmpConsentStatus;
  canRequestAds: boolean;
  sdkInitialized: boolean;
  isOfflineSimulated: boolean;
  isProEntitled: boolean;
  purchaseState: PurchaseLifecycleState;
  purchaseOrderId: string | null;
  purchaseToken: string | null;
  statusMessage: string;
  rewardPassExpiresAtMs: number;
  frequency: AdFrequencyState;
  appOpenLoadedAtMs: number;
}

/**
 * Original NovaBeat SVG Brand Emblem (Neon Spectrum Waveform Logo)
 */
export const NovaBeatLogoMark: React.FC<{ className?: string }> = ({
  className = 'w-11 h-11',
}) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="nbLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="50%" stopColor="#ec4899" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <rect
      x="2"
      y="2"
      width="60"
      height="60"
      rx="16"
      fill="#0D081D"
      stroke="url(#nbLogoGrad)"
      strokeWidth="2.5"
    />
    <rect x="12" y="26" width="4" height="12" rx="2" fill="url(#nbLogoGrad)" />
    <rect x="20" y="18" width="4" height="28" rx="2" fill="url(#nbLogoGrad)" />
    <rect x="28" y="11" width="5" height="42" rx="2.5" fill="url(#nbLogoGrad)" />
    <rect x="37" y="16" width="4" height="32" rx="2" fill="url(#nbLogoGrad)" />
    <rect x="45" y="23" width="4" height="18" rx="2" fill="url(#nbLogoGrad)" />
    <rect x="52" y="28" width="3" height="8" rx="1.5" fill="url(#nbLogoGrad)" />
  </svg>
);

interface FirstLaunchEulaModalProps {
  isOpen: boolean;
  requiredVersion: string;
  previousAcceptedVersion: string | null;
  onAcceptEula: () => void;
  onOpenPrivacyPolicy: () => void;
}

/**
 * First-Launch Legal & Privacy Onboarding Screen (EULA).
 * Shown before entering the main application on first launch or after a material EULA update.
 * Strictly decoupled from UMP advertising consent.
 */
export const FirstLaunchEulaModal: React.FC<FirstLaunchEulaModalProps> = ({
  isOpen,
  requiredVersion,
  previousAcceptedVersion,
  onAcceptEula,
  onOpenPrivacyPolicy,
}) => {
  const [showFullEula, setShowFullEula] = useState<boolean>(false);

  if (!isOpen) return null;

  const isMaterialUpdate =
    Boolean(previousAcceptedVersion) &&
    previousAcceptedVersion !== requiredVersion;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NovaBeat End-User License Agreement Onboarding"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05030B]/95 backdrop-blur-xl p-4 overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-gradient-to-b from-[#130C29] via-[#0D081D] to-[#090614] border border-violet-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-violet-950/60 space-y-5 my-auto">
        {/* Brand Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-violet-500/20">
          <NovaBeatLogoMark className="w-14 h-14 shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
                NovaBeat
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-violet-950 text-violet-200 border border-violet-500/35 rounded-md">
                EULA v{requiredVersion}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Music Player · Real-Time FFT Visualizer · Multi-Layer Video Studio
            </p>
          </div>
        </div>

        {isMaterialUpdate && (
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">
                Updated End-User License Agreement (v{previousAcceptedVersion} → v
                {requiredVersion})
              </p>
              <p className="mt-0.5 text-amber-200/90">
                Our licensing terms have been materially updated. Please review and accept the updated agreement to continue using NovaBeat.
              </p>
            </div>
          </div>
        )}

        {/* Original EULA Summary & Expandable Full Text */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-400" />
              <span>End-User License Agreement (EULA)</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowFullEula((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer"
            >
              <span>
                {showFullEula ? 'Hide Complete EULA' : 'Read Complete EULA'}
              </span>
              {showFullEula ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="p-4 bg-[#080512] border border-violet-500/25 rounded-2xl text-xs text-slate-300 space-y-3 max-h-64 overflow-y-auto leading-relaxed">
            <p className="text-slate-200 font-medium">
              Welcome to NovaBeat. Before entering the studio, please review our software license agreement and privacy commitments:
            </p>

            {showFullEula ? (
              <div className="space-y-3 pt-1">
                {NOVABEAT_EULA_SECTIONS.map((sec) => (
                  <div key={sec.heading} className="space-y-1">
                    <h3 className="text-xs font-bold text-violet-200">
                      {sec.heading}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {sec.body}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2 list-disc list-inside text-slate-300">
                <li>
                  <strong className="text-white">Personal Media Ownership:</strong>{' '}
                  You retain all rights to your local audio files and personal artwork imported into NovaBeat, and are responsible for having permission to use any media you export.
                </li>
                <li>
                  <strong className="text-white">Video Exports &amp; Visualizers:</strong>{' '}
                  Procedural FFT spectrum animations rendered in NovaBeat may be exported as MP4 or WebM videos subject to applicable music copyright laws.
                </li>
                <li>
                  <strong className="text-white">Photosensitivity Notice:</strong>{' '}
                  Audio-reactive visualizers produce dynamic high-contrast light patterns.
                </li>
                <li>
                  <strong className="text-white">Separate Advertising Consent:</strong>{' '}
                  Accepting this EULA does not grant advertising tracking consent. Advertising privacy preferences are managed separately via Google UMP.
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Privacy Policy Link & UMP Separation Notice */}
        <div className="p-3.5 bg-[#0B0719] border border-violet-500/20 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Review how local audio, Play Billing, and AdMob UMP privacy options are handled:
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenPrivacyPolicy}
            className="px-3 py-1.5 rounded-lg bg-violet-950/90 hover:bg-violet-900 border border-violet-500/35 text-violet-200 font-semibold whitespace-nowrap cursor-pointer"
          >
            Privacy Policy
          </button>
        </div>

        {/* Primary CTA: Agree and Continue */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onAcceptEula}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-violet-600/35 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Agree and Continue</span>
          </button>
          <p className="text-[11px] text-center text-slate-400">
            By selecting &ldquo;Agree and Continue&rdquo;, you accept the NovaBeat EULA (v
            {requiredVersion}). You can review the EULA and Privacy Policy anytime in Settings.
          </p>
        </div>
      </div>
    </div>
  );
};

interface LegalDocumentModalProps {
  documentType: 'eula' | 'privacy' | null;
  onClose: () => void;
}

/**
 * Full-text EULA and Privacy Policy Reader Modal (accessible from Onboarding and Settings).
 */
export const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({
  documentType,
  onClose,
}) => {
  if (!documentType) return null;

  const isEula = documentType === 'eula';
  const sections = isEula
    ? NOVABEAT_EULA_SECTIONS
    : NOVABEAT_PRIVACY_POLICY_SECTIONS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        isEula
          ? 'NovaBeat End-User License Agreement'
          : 'NovaBeat Privacy Policy'
      }
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-lg bg-[#110B22] border border-violet-500/40 rounded-2xl p-6 shadow-2xl max-h-[88vh] flex flex-col space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-violet-500/20">
          <div className="flex items-center gap-2.5">
            <NovaBeatLogoMark className="w-8 h-8" />
            <div>
              <h3 className="text-base font-bold text-white font-display">
                {isEula
                  ? `NovaBeat End-User License Agreement (v${CURRENT_EULA_VERSION})`
                  : 'NovaBeat Privacy Policy & UMP Notice'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Package: {MONETIZATION_CONFIG.packageName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legal document"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {sections.map((section) => (
            <div
              key={section.heading}
              className="p-3.5 bg-[#090614] border border-violet-500/20 rounded-xl space-y-1"
            >
              <h4 className="text-xs font-bold text-violet-200">
                {section.heading}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {section.body}
              </p>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-violet-500/15 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer"
          >
            Close Document
          </button>
        </div>
      </div>
    </div>
  );
};

interface AdaptiveBannerAdBarProps {
  monetization: MonetizationRuntimeState;
  isExportingVideo: boolean;
  onOpenProModal: () => void;
  onOpenRewardedModal: () => void;
  placementLabel?: string;
}

/**
 * Non-disruptive Adaptive AdMob Banner displayed in the Music Library & Home workspace.
 * Strictly hidden before EULA + UMP consent completion, for NovaBeat Pro owners,
 * during video export, or when offline.
 */
export const AdaptiveBannerAdBar: React.FC<AdaptiveBannerAdBarProps> = ({
  monetization,
  isExportingVideo,
  onOpenProModal,
  onOpenRewardedModal,
  placementLabel = 'Library Adaptive Banner',
}) => {
  const [bannerError, setBannerError] = useState<string | null>(null);
  const activeUnits = resolveActiveAdUnits(monetization.environment);

  const isEulaCurrent = !isEulaAcceptanceRequired(
    monetization.acceptedEulaVersion,
    monetization.requiredEulaVersion
  );

  const guardrail = evaluateAdGuardrails({
    format: 'banner',
    isEulaAcceptedForCurrentVersion: isEulaCurrent,
    isFirstLaunchSessionBeforeOnboardingComplete:
      monetization.isFirstLaunchSessionBeforeOnboardingComplete,
    umpConsentCompleted: monetization.umpConsentCompleted,
    canRequestAds: monetization.canRequestAds,
    isProEntitled: monetization.isProEntitled,
    isOffline: monetization.isOfflineSimulated,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo,
    frequency: monetization.frequency,
    appOpenLoadedAtMs: monetization.appOpenLoadedAtMs,
    nowMs: Date.now(),
  });

  useEffect(() => {
    if (monetization.isOfflineSimulated) {
      setBannerError(
        'Ad network unreachable (offline mode). Banner hidden gracefully.'
      );
    } else {
      setBannerError(null);
    }
  }, [monetization.isOfflineSimulated]);

  // Pro entitlement or incomplete onboarding/UMP disables every advertisement
  if (
    monetization.isProEntitled ||
    !isEulaCurrent ||
    !monetization.umpConsentCompleted ||
    !monetization.canRequestAds ||
    isExportingVideo ||
    bannerError ||
    !guardrail.allowed
  ) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Sponsored AdMob Adaptive Banner"
      className="mt-3 px-3 py-2 rounded-xl bg-[#0D081D] border border-violet-500/20 flex flex-wrap items-center justify-between gap-2"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-violet-950 text-violet-300 border border-violet-500/30 rounded">
          AdMob Banner
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">
            Studio Audio Gear &amp; Mastering Plugins — {placementLabel}
          </p>
          <p className="text-[10px] font-mono text-slate-400 truncate">
            Unit: {activeUnits.bannerAdUnitId} ({monetization.environment.toUpperCase()} · UMP:{' '}
            {monetization.umpConsentStatus})
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenRewardedModal}
          className="px-2.5 py-1 text-[11px] font-medium text-cyan-200 bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/30 rounded-lg transition-colors cursor-pointer"
        >
          Watch Ad · 30m 1440p Pass
        </button>
        <button
          type="button"
          onClick={onOpenProModal}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-lg transition-colors cursor-pointer"
        >
          <Crown className="w-3 h-3 text-amber-400" />
          <span>Remove Ads</span>
        </button>
      </div>
    </div>
  );
};

interface RewardedAdDialogProps {
  isOpen: boolean;
  format: 'rewarded' | 'rewarded-interstitial';
  monetization: MonetizationRuntimeState;
  onClose: () => void;
  onRewardEarned: () => void;
  onRewardSkipped: () => void;
  onOpenProUpgrade: () => void;
}

/**
 * User-initiated Rewarded Ad & Rewarded Interstitial modal.
 * Never shown to Pro users (who already own all features ad-free).
 */
export const RewardedAdDialog: React.FC<RewardedAdDialogProps> = ({
  isOpen,
  format,
  monetization,
  onClose,
  onRewardEarned,
  onRewardSkipped,
  onOpenProUpgrade,
}) => {
  const [stage, setStage] = useState<
    'intro' | 'playing' | 'completed' | 'skipped'
  >('intro');
  const [secondsLeft, setSecondsLeft] = useState<number>(3);
  const activeUnits = resolveActiveAdUnits(monetization.environment);

  useEffect(() => {
    if (isOpen) {
      setStage('intro');
      setSecondsLeft(3);
    }
  }, [isOpen]);

  useEffect(() => {
    if (stage !== 'playing') return;
    if (secondsLeft <= 0) {
      setStage('completed');
      onRewardEarned();
      return;
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [stage, secondsLeft, onRewardEarned]);

  // Pro users must never receive rewarded or rewarded-interstitial advertisements
  if (!isOpen || monetization.isProEntitled) return null;

  const unitId =
    format === 'rewarded-interstitial'
      ? activeUnits.rewardedInterstitialAdUnitId
      : activeUnits.rewardedAdUnitId;

  const handleStartWatching = () => {
    if (monetization.isOfflineSimulated || !monetization.canRequestAds) {
      return;
    }
    setSecondsLeft(3);
    setStage('playing');
  };

  const handleSkipAd = () => {
    setStage('skipped');
    onRewardSkipped();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rewarded Advertisement Unlock"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md bg-[#110B22] border border-violet-500/35 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-violet-500/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white font-display">
              {format === 'rewarded-interstitial'
                ? 'Unlock 1440p QHD Export (Rewarded Interstitial)'
                : 'Unlock 30-Minute Studio Pass (Rewarded Ad)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              if (stage === 'playing') {
                handleSkipAd();
              } else {
                onClose();
              }
            }}
            aria-label="Close rewarded ad dialog"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {stage === 'intro' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-[#090614] border border-cyan-500/25 rounded-xl space-y-1.5">
              <p className="text-xs font-semibold text-cyan-200">
                Reward: 30 Minutes of 1440p QHD Export &amp; Pro Visualizer Shaders
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Watch a short sponsored video to temporarily unlock 1440p QHD 60 FPS video export and Pro shader effects for 30 minutes, or skip to continue with standard 1080p.
              </p>
              <p className="text-[11px] font-mono text-slate-400 pt-1">
                AdMob Unit: {unitId} ({monetization.environment.toUpperCase()})
              </p>
            </div>

            {monetization.isOfflineSimulated && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-200">
                <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Network unavailable. Rewarded ad cannot be loaded while offline.
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                disabled={
                  monetization.isOfflineSimulated || !monetization.canRequestAds
                }
                onClick={handleStartWatching}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Watch Rewarded Ad (3s)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onRewardSkipped();
                  onClose();
                }}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#191130] hover:bg-[#231842] border border-violet-500/25 text-slate-300 font-medium text-xs cursor-pointer"
              >
                Skip (No Reward)
              </button>
            </div>

            <div className="pt-2 border-t border-violet-500/15 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Want permanent access &amp; zero ads?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProUpgrade();
                }}
                className="text-amber-300 hover:text-amber-200 font-semibold cursor-pointer"
              >
                Get NovaBeat Pro →
              </button>
            </div>
          </div>
        )}

        {stage === 'playing' && (
          <div className="p-5 bg-[#080512] border border-violet-500/30 rounded-xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950 border border-violet-500/30 text-xs font-mono text-violet-200">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reward granted in {secondsLeft}s...</span>
            </div>
            <p className="text-sm font-semibold text-white">
              NovaBeat Studio Partner Showcase ({monetization.environment.toUpperCase()} Ad Unit)
            </p>
            <p className="text-xs font-mono text-slate-400">{unitId}</p>
            <button
              type="button"
              onClick={handleSkipAd}
              className="px-4 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-200 text-xs font-semibold cursor-pointer"
            >
              Skip / Cancel Ad (Forfeit Reward)
            </button>
          </div>
        )}

        {stage === 'completed' && (
          <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-xl space-y-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-white">
              onUserEarnedReward Confirmed!
            </p>
            <p className="text-xs text-emerald-200">
              1440p QHD Ultra Export &amp; Pro Visualizer Shaders are now unlocked for 30 minutes.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl cursor-pointer"
            >
              Continue to Studio
            </button>
          </div>
        )}

        {stage === 'skipped' && (
          <div className="p-4 bg-amber-950/50 border border-amber-500/35 rounded-xl space-y-3 text-center">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-white">
              Ad Closed Before Completion
            </p>
            <p className="text-xs text-amber-200">
              Because the rewarded advertisement was skipped before completion, no reward pass was granted.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs rounded-xl cursor-pointer"
            >
              Return to Studio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface NovaBeatProModalProps {
  isOpen: boolean;
  monetization: MonetizationRuntimeState;
  isBusy: boolean;
  onClose: () => void;
  onExecutePurchase: (
    outcome: 'PURCHASED' | 'PENDING' | 'CANCELLED' | 'FAILED'
  ) => void;
  onCompletePendingPurchase: () => void;
  onRestorePurchases: () => void;
  onResetPurchasesForTest: () => void;
  onOpenPrivacyOptions: () => void;
}

/**
 * Official Google Play Billing 9.1.0 Upgrade Sheet for `novabeat_pro_lifetime` (NovaBeat Pro).
 */
export const NovaBeatProModal: React.FC<NovaBeatProModalProps> = ({
  isOpen,
  monetization,
  isBusy,
  onClose,
  onExecutePurchase,
  onCompletePendingPurchase,
  onRestorePurchases,
  onResetPurchasesForTest,
  onOpenPrivacyOptions,
}) => {
  const [selectedLocale, setSelectedLocale] = useState('en-US');
  const priceInfo = getLocalizedPlayStorePrice(selectedLocale);
  const product = MONETIZATION_CONFIG.playBillingProduct;

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NovaBeat Pro Upgrade and Google Play Billing"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg bg-[#100A20] border border-violet-500/35 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-violet-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-violet-600 flex items-center justify-center shadow-md">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-display">
                  {product.name}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-violet-950 text-violet-200 border border-violet-500/30 rounded">
                  {product.productId}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Google Play Billing Library 9.1.0 · One-Time Non-Consumable
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close NovaBeat Pro modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Description & Localized Price */}
        <div className="p-4 bg-[#090614] border border-violet-500/25 rounded-xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-violet-300">
                Lifetime License (One-Time Purchase)
              </span>
              <p className="text-2xl font-bold text-white font-display mt-0.5">
                {monetization.isProEntitled
                  ? 'OWNED · ACTIVE'
                  : priceInfo.formattedPrice}
              </p>
            </div>

            <div className="text-right">
              <label
                htmlFor="play-locale-select"
                className="block text-[10px] text-slate-400 mb-1"
              >
                Play Store Region Price
              </label>
              <select
                id="play-locale-select"
                value={selectedLocale}
                onChange={(e) => setSelectedLocale(e.target.value)}
                className="px-2.5 py-1 text-xs bg-[#150E2A] border border-violet-500/30 rounded-lg text-slate-200 cursor-pointer"
              >
                <option value="en-US">USD ($9.99)</option>
                <option value="en-GB">GBP (£8.49)</option>
                <option value="de-DE">EUR (€9.49)</option>
                <option value="en-IN">INR (₹799.00)</option>
                <option value="ja-JP">JPY (¥1,480)</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {product.description}
          </p>

          <ul className="space-y-1.5 pt-1">
            {product.benefits.map((benefit) => (
              <li
                key={benefit}
                className="flex items-start gap-2 text-xs text-slate-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Live Status Banner */}
        <div
          className={`p-3.5 rounded-xl border text-xs space-y-1 ${
            monetization.isProEntitled
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : monetization.purchaseState === 'PENDING'
              ? 'bg-amber-950/50 border-amber-500/40 text-amber-200'
              : monetization.purchaseState === 'CANCELLED' ||
                monetization.purchaseState === 'FAILED'
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              : 'bg-[#150E2A] border-violet-500/20 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between font-semibold">
            <span>
              Entitlement Status: {monetization.purchaseState}
              {monetization.isProEntitled ? ' (Acknowledged)' : ''}
            </span>
            {monetization.purchaseOrderId && (
              <span className="font-mono text-[11px]">
                {monetization.purchaseOrderId}
              </span>
            )}
          </div>
          <p>{monetization.statusMessage}</p>
        </div>

        {/* Purchase Actions */}
        {!monetization.isProEntitled ? (
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={isBusy || monetization.isOfflineSimulated}
              onClick={() => onExecutePurchase('PURCHASED')}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-violet-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xl shadow-violet-600/30 cursor-pointer disabled:opacity-50"
            >
              <Crown className="w-4 h-4" />
              <span>
                {isBusy
                  ? 'Connecting to Google Play Billing...'
                  : `Buy NovaBeat Pro (${priceInfo.formattedPrice})`}
              </span>
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isBusy || monetization.isOfflineSimulated}
                onClick={onRestorePurchases}
                className="py-2 px-3 rounded-xl bg-[#181030] hover:bg-[#221742] border border-violet-500/25 text-violet-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restore Purchases</span>
              </button>

              <button
                type="button"
                disabled={isBusy || monetization.isOfflineSimulated}
                onClick={() => onExecutePurchase('PENDING')}
                className="py-2 px-3 rounded-xl bg-[#181030] hover:bg-[#221742] border border-amber-500/25 text-amber-200 font-medium text-xs cursor-pointer disabled:opacity-50"
              >
                Test Pending State
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => onExecutePurchase('CANCELLED')}
                className="col-span-2 sm:col-span-1 py-2 px-3 rounded-xl bg-[#181030] hover:bg-[#221742] border border-rose-500/25 text-rose-200 font-medium text-xs cursor-pointer disabled:opacity-50"
              >
                Test Cancel Flow
              </button>
            </div>

            {monetization.purchaseState === 'PENDING' && (
              <button
                type="button"
                onClick={onCompletePendingPurchase}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs cursor-pointer"
              >
                Complete Pending Google Play Payment &amp; Acknowledge Now
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onRestorePurchases}
              className="py-2 px-3.5 rounded-xl bg-[#181030] hover:bg-[#221742] border border-violet-500/25 text-violet-200 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-Verify with Google Play</span>
            </button>

            <button
              type="button"
              onClick={onResetPurchasesForTest}
              className="py-2 px-3.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/30 text-rose-200 font-medium text-xs cursor-pointer"
            >
              Reset Entitlement (Test Free Tier)
            </button>
          </div>
        )}

        {/* UMP Privacy & Consent Footer */}
        <div className="pt-3 border-t border-violet-500/15 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>UMP Consent: {monetization.umpConsentStatus}</span>
          </span>
          <button
            type="button"
            onClick={onOpenPrivacyOptions}
            className="text-violet-300 hover:text-white underline cursor-pointer"
          >
            Manage Ad Privacy Options
          </button>
        </div>
      </div>
    </div>
  );
};

interface UmpConsentDialogProps {
  isOpen: boolean;
  consentStatus: UmpConsentStatus;
  onSelectConsent: (status: UmpConsentStatus, canRequestAds: boolean) => void;
  onClose: () => void;
  onOpenPrivacyPolicy?: () => void;
}

/**
 * Google User Messaging Platform (UMP) Privacy & Consent Management Dialog.
 * Strictly separate from EULA acceptance; Personalized/Contextual AdMob requests
 * are only initialized after the user completes this choice.
 */
export const UmpConsentDialog: React.FC<UmpConsentDialogProps> = ({
  isOpen,
  consentStatus,
  onSelectConsent,
  onClose,
  onOpenPrivacyPolicy,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Google User Messaging Platform Ad Privacy Consent"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md bg-[#110B22] border border-violet-500/35 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-violet-500/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white font-display">
              Ad Privacy &amp; UMP Consent Options
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close privacy options"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Separate from the NovaBeat EULA, Google’s User Messaging Platform (UMP SDK 3.1.0) lets you control how advertisements are requested in the free tier. Personalized ads are never initialized before you make a selection below.
        </p>

        <div className="p-3 bg-[#090614] border border-violet-500/20 rounded-xl flex items-center justify-between text-xs text-slate-300">
          <span>
            Current UMP Status:{' '}
            <strong className="font-mono text-cyan-300">{consentStatus}</strong>
          </span>
          {onOpenPrivacyPolicy && (
            <button
              type="button"
              onClick={onOpenPrivacyPolicy}
              className="text-violet-300 hover:text-white underline cursor-pointer"
            >
              Privacy Policy
            </button>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              onSelectConsent('OBTAINED', true);
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs cursor-pointer"
          >
            Consent to Personalized &amp; Standard Ads (OBTAINED)
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectConsent('LIMITED_ADS', true);
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-[#191130] hover:bg-[#231842] border border-violet-500/25 text-slate-200 font-semibold text-xs cursor-pointer"
          >
            Non-Personalized / Contextual Ads Only (LIMITED_ADS)
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectConsent('REQUIRED', false);
              onClose();
            }}
            className="w-full py-2 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/30 text-rose-200 font-medium text-xs cursor-pointer"
          >
            Decline / Withdraw Ad Consent (Disable Ad Requests)
          </button>
        </div>
      </div>
    </div>
  );
};

interface FullScreenAdOverlayProps {
  activeFormat: Extract<AdFormatType, 'interstitial' | 'app-open'> | null;
  monetization: MonetizationRuntimeState;
  onDismiss: () => void;
  onUpgradePro: () => void;
}

/**
 * Non-intrusive Full-Screen Interstitial / App Open Ad modal shown ONLY when all guardrails pass
 * (never during active audio playback, visualizer editing, or video export, and never for Pro users).
 */
export const FullScreenAdOverlay: React.FC<FullScreenAdOverlayProps> = ({
  activeFormat,
  monetization,
  onDismiss,
  onUpgradePro,
}) => {
  if (!activeFormat || monetization.isProEntitled) return null;

  const activeUnits = resolveActiveAdUnits(monetization.environment);
  const unitId =
    activeFormat === 'app-open'
      ? activeUnits.appOpenAdUnitId
      : activeUnits.interstitialAdUnitId;

  const dailyInterstitialCount = getRecentInterstitialCount24h(
    monetization.frequency.interstitialTimestampsMs,
    Date.now()
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`AdMob ${activeFormat} Advertisement`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-md bg-[#110B22] border border-violet-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-1 text-[10px] font-mono uppercase bg-violet-950 text-violet-300 border border-violet-500/30 rounded-md">
            AdMob {activeFormat === 'app-open' ? 'App Open Ad' : 'Interstitial Ad'}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close advertisement"
            className="px-3 py-1 rounded-lg bg-[#1C1236] hover:bg-violet-600 text-xs font-semibold text-white cursor-pointer"
          >
            Close Ad ✕
          </button>
        </div>

        <div className="p-6 bg-gradient-to-br from-[#1A0E36] via-[#0D071E] to-[#081C29] border border-violet-500/25 rounded-xl space-y-2">
          <p className="text-base font-bold text-white font-display">
            NovaBeat Acoustic Mastering Suite
          </p>
          <p className="text-xs text-slate-300">
            Displayed safely at a natural transition while playback, editing, and exporting are idle.
          </p>
          <p className="text-[11px] font-mono text-cyan-300 pt-2">
            Unit ID: {unitId}
          </p>
          <p className="text-[10px] font-mono text-slate-400">
            {activeFormat === 'interstitial'
              ? `Daily Interstitial Count: ${dailyInterstitialCount}/${MONETIZATION_CONFIG.guardrails.maxInterstitialsPerDay} · Min Interval: 5m`
              : 'App Open Cap: Max 1 per 4 hours'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onDismiss();
              onUpgradePro();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-200 text-xs font-semibold cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Remove All Ads with NovaBeat Pro</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer"
          >
            Continue to App
          </button>
        </div>
      </div>
    </div>
  );
};
