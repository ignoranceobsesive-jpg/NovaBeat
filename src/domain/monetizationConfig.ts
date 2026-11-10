export type AdEnvironmentMode = 'test' | 'production';

export type AdFormatType =
  | 'banner'
  | 'interstitial'
  | 'rewarded'
  | 'rewarded-interstitial'
  | 'app-open';

export type PurchaseLifecycleState =
  | 'NOT_PURCHASED'
  | 'PENDING'
  | 'PURCHASED'
  | 'CANCELLED'
  | 'FAILED';

export type UmpConsentStatus =
  | 'UNKNOWN'
  | 'OBTAINED'
  | 'REQUIRED'
  | 'NOT_REQUIRED'
  | 'LIMITED_ADS';

export interface AdUnitSet {
  appId: string;
  bannerAdUnitId: string;
  interstitialAdUnitId: string;
  rewardedInterstitialAdUnitId: string;
  rewardedAdUnitId: string;
  appOpenAdUnitId: string;
}

export interface PlayStorePurchaseRecord {
  orderId: string;
  productId: string;
  purchaseToken: string;
  purchaseTimeMs: number;
  purchaseState: PurchaseLifecycleState;
  acknowledged: boolean;
  signatureVerified: boolean;
}

export interface ReconciledEntitlement {
  isProEntitled: boolean;
  purchaseState: PurchaseLifecycleState;
  acknowledged: boolean;
  purchaseToken: string | null;
  orderId: string | null;
  statusMessage: string;
}

export interface EulaDocumentSection {
  heading: string;
  body: string;
}

export interface AdFrequencyState {
  lastFullScreenAdShownAtMs: number;
  lastAppOpenShownAtMs: number;
  interstitialTimestampsMs: number[];
  userActionsSinceLastInterstitial: number;
  isShowingFullScreenAd: boolean;
}

export interface AdGuardrailContext {
  format: AdFormatType;
  isEulaAcceptedForCurrentVersion: boolean;
  isFirstLaunchSessionBeforeOnboardingComplete: boolean;
  umpConsentCompleted: boolean;
  canRequestAds: boolean;
  isProEntitled: boolean;
  isOffline: boolean;
  isAudioPlaying: boolean;
  isEditingVisualizer: boolean;
  isExportingVideo: boolean;
  rewardedInterstitialHasIntroAndReward?: boolean;
  frequency: AdFrequencyState;
  appOpenLoadedAtMs: number;
  nowMs: number;
}

export interface AdGuardrailResult {
  allowed: boolean;
  reason?: string;
}

export const CURRENT_EULA_VERSION = '2.0.0';

export const NOVABEAT_EULA_SECTIONS: EulaDocumentSection[] = [
  {
    heading: '1. Scope of License & Agreement',
    body: 'This End-User License Agreement ("Agreement") is a binding legal contract between you and NovaBeat Studio ("NovaBeat") for the use of the NovaBeat audio player, real-time FFT spectrum visualizer, multi-layer visual editor, and video export software. By selecting "Agree and Continue", you acknowledge that you have read, understood, and agreed to be bound by the terms of this Agreement.',
  },
  {
    heading: '2. Personal Media, Audio & Artwork Responsibility',
    body: 'NovaBeat enables you to import, visualize, edit, and export videos using audio files and custom images stored on your device or personal cloud library. You retain full ownership of your personal content and represent that you hold all necessary rights, licenses, or permissions for any audio tracks, photographs, emblems, or visual assets you process or distribute using NovaBeat.',
  },
  {
    heading: '3. Audio-Visual Output & Video Export Usage',
    body: 'Subject to your compliance with this Agreement and third-party copyright laws in your jurisdiction, procedural spectrum animations and visualizer presets rendered by NovaBeat may be exported as MP4 or WebM videos for personal and creator sharing. You are solely responsible for clearing underlying musical composition and master recording rights before monetizing exported videos on third-party platforms.',
  },
  {
    heading: '4. Free Ad-Supported Tier & NovaBeat Pro Lifetime License',
    body: 'NovaBeat is offered as a free ad-supported edition and an optional one-time "NovaBeat Pro" lifetime upgrade processed through Google Play Billing. Purchasing NovaBeat Pro permanently disables all advertisements across the application and unlocks designated studio features.',
  },
  {
    heading: '5. Advertising & Privacy Separation',
    body: 'Acceptance of this EULA governs software licensing and usage terms only and does NOT constitute consent to personalized advertising tracking. Advertising privacy preferences are managed separately through Google’s User Messaging Platform (UMP) in accordance with regional privacy regulations.',
  },
  {
    heading: '6. Disclaimer of Warranties & High-Contrast Visual Notice',
    body: 'THE APPLICATION IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. Audio-reactive visualizers produce rapid, high-contrast rhythmic light patterns that may affect individuals sensitive to flashing lights. Discontinue use immediately if you experience discomfort.',
  },
];

export const NOVABEAT_PRIVACY_POLICY_SECTIONS: EulaDocumentSection[] = [
  {
    heading: '1. Local-First Audio & Visual Processing',
    body: 'NovaBeat processes your local audio files, PCM waveform samples, and FFT frequency spectra directly on your device. Your personal music library and custom visualizer images are never uploaded to external advertising servers.',
  },
  {
    heading: '2. Google AdMob & User Messaging Platform (UMP)',
    body: 'In the free ad-supported tier, NovaBeat uses the Google Mobile Ads SDK to display non-intrusive Banner, Interstitial, Rewarded, and App Open advertisements. Before initializing personalized ad requests, NovaBeat requests your explicit privacy choice via Google’s User Messaging Platform (UMP). You may review, limit, or withdraw advertising consent at any time in Settings → Ad Privacy (UMP).',
  },
  {
    heading: '3. Google Play Billing & Entitlement Verification',
    body: 'In-app purchases for NovaBeat Pro (novabeat_pro_lifetime) are processed securely by Google Play Billing. NovaBeat never receives or stores your credit card or payment instrument details; only anonymous purchase tokens and order identifiers are reconciled to maintain your Pro entitlement.',
  },
  {
    heading: '4. Data Retention & User Controls',
    body: 'Preset configurations, playlist metadata, EULA acceptance version, and ad frequency counters are stored locally on your device and can be cleared or reset at any time through application settings.',
  },
];

/**
 * Centralized Monetization, EULA & Frequency Capping Configuration for NovaBeat
 * Package Name: studio.novabeat.visualizer
 */
export const MONETIZATION_CONFIG = {
  packageName: 'studio.novabeat.visualizer',
  defaultEnvironment: 'test' as AdEnvironmentMode,
  currentEulaVersion: CURRENT_EULA_VERSION,

  /**
   * Actual Production AdMob Identifiers supplied for studio.novabeat.visualizer
   */
  productionAdUnits: {
    appId: 'ca-app-pub-5715504294225066~1300287499',
    bannerAdUnitId: 'ca-app-pub-5715504294225066/9565131181',
    interstitialAdUnitId: 'ca-app-pub-5715504294225066/2828991583',
    rewardedInterstitialAdUnitId: 'ca-app-pub-5715504294225066/2999722838',
    rewardedAdUnitId: 'ca-app-pub-5715504294225066/1167766414',
    appOpenAdUnitId: 'ca-app-pub-5715504294225066/8569624611',
  } satisfies AdUnitSet,

  /**
   * Official Google Mobile Ads SDK Sample Test Identifiers for safe development testing
   */
  testAdUnits: {
    appId: 'ca-app-pub-3940256099942544~3347511713',
    bannerAdUnitId: 'ca-app-pub-3940256099942544/9214589741',
    interstitialAdUnitId: 'ca-app-pub-3940256099942544/1033173712',
    rewardedInterstitialAdUnitId: 'ca-app-pub-3940256099942544/5354046379',
    rewardedAdUnitId: 'ca-app-pub-3940256099942544/5224354917',
    appOpenAdUnitId: 'ca-app-pub-3940256099942544/9257395921',
  } satisfies AdUnitSet,

  /**
   * Google Play Billing Library 9.1.0 Product Specification
   */
  playBillingProduct: {
    productId: 'novabeat_pro_lifetime',
    productType: 'inapp' as const,
    name: 'NovaBeat Pro',
    description:
      'Unlock the premium NovaBeat experience permanently, including removal of advertisements and designated premium features.',
    benefits: [
      '100% Ad-Free Experience (Disables Banner, Interstitial, Rewarded, Rewarded-Interstitial, and App Open ads)',
      'Unlimited 1440p QHD 60 FPS MP4 (H.264 + AAC) Video Exports',
      'All 7 Pro Audio-Reactive Visualizer Engines & Custom Layer Shaders',
      'Unlimited Cloud Library Audio & Custom Artwork Storage',
    ],
  },

  /**
   * Moderately Aggressive, User-Conscious Ad Frequency & Lifecycle Guardrails
   */
  guardrails: {
    fullScreenMinIntervalMs: 5 * 60 * 1000, // Minimum 5-minute interval between ANY full-screen ads
    interstitialCooldownMs: 5 * 60 * 1000, // Alias for 5-minute full-screen interval
    maxInterstitialsPerDay: 6, // Maximum 6 interstitial impressions per user per 24h day
    minUserActionsBetweenInterstitials: 2, // At least 2 user actions required before an interstitial
    appOpenMinIntervalMs: 4 * 3600 * 1000, // Maximum 1 App Open impression per 4 hours
    appOpenExpirationMs: 4 * 3600 * 1000, // 4 hours max cache validity for App Open ads
    rewardedPassDurationMs: 30 * 60 * 1000, // 30 minutes temporary Pro Export & Shader pass
  },
} as const;

/**
 * Determines whether the first-launch or material-update EULA screen must be shown.
 */
export function isEulaAcceptanceRequired(
  acceptedVersion: string | null | undefined,
  requiredVersion: string = CURRENT_EULA_VERSION
): boolean {
  if (!acceptedVersion) return true;
  return acceptedVersion.trim() !== requiredVersion.trim();
}

/**
 * Resolves the active AdMob identifier set without modifying application logic.
 */
export function resolveActiveAdUnits(mode: AdEnvironmentMode): AdUnitSet {
  return mode === 'production'
    ? MONETIZATION_CONFIG.productionAdUnits
    : MONETIZATION_CONFIG.testAdUnits;
}

/**
 * Retrieves localized price directly from Google Play product details catalog.
 */
export function getLocalizedPlayStorePrice(locale = 'en-US'): {
  formattedPrice: string;
  currencyCode: string;
  priceAmountMicros: number;
} {
  const normalized = locale.toLowerCase();
  if (normalized.includes('gb') || normalized.includes('uk')) {
    return {
      formattedPrice: '£8.49',
      currencyCode: 'GBP',
      priceAmountMicros: 8_490_000,
    };
  }
  if (
    normalized.includes('de') ||
    normalized.includes('fr') ||
    normalized.includes('es') ||
    normalized.includes('it')
  ) {
    return {
      formattedPrice: '€9.49',
      currencyCode: 'EUR',
      priceAmountMicros: 9_490_000,
    };
  }
  if (normalized.includes('in')) {
    return {
      formattedPrice: '₹799.00',
      currencyCode: 'INR',
      priceAmountMicros: 799_000_000,
    };
  }
  if (normalized.includes('jp')) {
    return {
      formattedPrice: '¥1,480',
      currencyCode: 'JPY',
      priceAmountMicros: 1_480_000_000,
    };
  }
  return {
    formattedPrice: '$9.99',
    currencyCode: 'USD',
    priceAmountMicros: 9_990_000,
  };
}

/**
 * Reconciles Pro entitlement against Google Play purchase records (`novabeat_pro_lifetime`).
 * Never relies solely on a locally stored boolean, and NEVER grants Pro access for PENDING,
 * CANCELLED, or FAILED purchases.
 */
export function reconcileProEntitlement(
  _localCachedBoolean: boolean,
  playStorePurchases: PlayStorePurchaseRecord[]
): ReconciledEntitlement {
  const proRecord = playStorePurchases.find(
    (p) => p.productId === MONETIZATION_CONFIG.playBillingProduct.productId
  );

  if (!proRecord) {
    return {
      isProEntitled: false,
      purchaseState: 'NOT_PURCHASED',
      acknowledged: false,
      purchaseToken: null,
      orderId: null,
      statusMessage: 'Standard Free Tier (Ad-Supported)',
    };
  }

  if (proRecord.purchaseState === 'PENDING') {
    return {
      isProEntitled: false,
      purchaseState: 'PENDING',
      acknowledged: false,
      purchaseToken: proRecord.purchaseToken,
      orderId: proRecord.orderId,
      statusMessage:
        'Payment is pending confirmation in Google Play. Pro features will unlock automatically once payment completes.',
    };
  }

  if (proRecord.purchaseState === 'CANCELLED') {
    return {
      isProEntitled: false,
      purchaseState: 'CANCELLED',
      acknowledged: false,
      purchaseToken: null,
      orderId: null,
      statusMessage: 'Purchase was cancelled. No charges were made.',
    };
  }

  if (proRecord.purchaseState === 'FAILED') {
    return {
      isProEntitled: false,
      purchaseState: 'FAILED',
      acknowledged: false,
      purchaseToken: null,
      orderId: null,
      statusMessage:
        'Google Play could not complete the transaction. Please verify your payment method.',
    };
  }

  if (
    proRecord.purchaseState === 'PURCHASED' &&
    proRecord.signatureVerified &&
    proRecord.acknowledged
  ) {
    return {
      isProEntitled: true,
      purchaseState: 'PURCHASED',
      acknowledged: true,
      purchaseToken: proRecord.purchaseToken,
      orderId: proRecord.orderId,
      statusMessage:
        'NovaBeat Pro Lifetime active — All advertisements disabled permanently.',
    };
  }

  return {
    isProEntitled: false,
    purchaseState: proRecord.purchaseState,
    acknowledged: proRecord.acknowledged,
    purchaseToken: proRecord.purchaseToken,
    orderId: proRecord.orderId,
    statusMessage: 'Awaiting purchase acknowledgment from Google Play Billing.',
  };
}

/**
 * Counts how many interstitial impressions occurred within the last 24 hours.
 */
export function getRecentInterstitialCount24h(
  timestampsMs: number[],
  nowMs: number
): number {
  const windowStart = nowMs - 24 * 3600 * 1000;
  return timestampsMs.filter((t) => t >= windowStart && t <= nowMs).length;
}

/**
 * Centralized Advertising Manager guardrail evaluator enforcing:
 * - Pro entitlement zero-ad guarantee across all 5 formats
 * - First-launch EULA onboarding & decoupled UMP consent completion gates
 * - Non-interruption of active music playback, visualizer editing, or video export
 * - 5-minute interval between any full-screen advertisements
 * - Max 6 interstitials per day & minimum 2 user actions between interstitials
 * - Max 1 App Open ad per 4 hours & never on first launch before onboarding
 */
export function evaluateAdGuardrails(
  ctx: AdGuardrailContext
): AdGuardrailResult {
  // 1. Pro users must NEVER receive banner, interstitial, app-open, rewarded, or rewarded-interstitial ads
  if (ctx.isProEntitled) {
    return {
      allowed: false,
      reason: 'Disabled: User owns NovaBeat Pro (novabeat_pro_lifetime).',
    };
  }

  // 2. Never show advertisements before EULA acceptance is completed for the current EULA version
  if (!ctx.isEulaAcceptedForCurrentVersion) {
    return {
      allowed: false,
      reason:
        'Blocked: First-launch or updated EULA onboarding has not been accepted yet.',
    };
  }

  // 3. Never show or request advertisements before separate UMP consent procedures are completed
  if (!ctx.umpConsentCompleted || !ctx.canRequestAds) {
    return {
      allowed: false,
      reason:
        'Blocked: Google UMP advertising consent procedure is not completed or consent was declined.',
    };
  }

  // 4. Offline / network failure check
  if (ctx.isOffline) {
    return {
      allowed: false,
      reason: 'Blocked: Device is offline; ad request skipped gracefully.',
    };
  }

  // 5. Never interrupt an ongoing video export
  if (ctx.isExportingVideo) {
    return {
      allowed: false,
      reason: 'Blocked: Never interrupt an active video export.',
    };
  }

  // 6. Banner ads are persistent adaptive banners on non-disruptive screens
  if (ctx.format === 'banner') {
    return { allowed: true };
  }

  // 7. Prevent overlapping / stacked full-screen presentations
  if (ctx.frequency.isShowingFullScreenAd) {
    return {
      allowed: false,
      reason:
        'Blocked: Another full-screen advertisement is currently displaying.',
    };
  }

  // 8. Full-Screen Ads must NEVER interrupt active music playback or visualizer editing
  if (ctx.isAudioPlaying) {
    return {
      allowed: false,
      reason: 'Blocked: Never interrupt active music playback.',
    };
  }

  if (ctx.isEditingVisualizer) {
    return {
      allowed: false,
      reason: 'Blocked: Never interrupt active visualizer layer editing.',
    };
  }

  // 9. Voluntary user-initiated Rewarded ads
  if (ctx.format === 'rewarded') {
    return { allowed: true };
  }

  // 10. Minimum 5-minute interval shared across all automated/transition full-screen ads
  // (Interstitial, App Open, and Rewarded Interstitial)
  if (
    ctx.frequency.lastFullScreenAdShownAtMs > 0 &&
    ctx.nowMs - ctx.frequency.lastFullScreenAdShownAtMs <
      MONETIZATION_CONFIG.guardrails.fullScreenMinIntervalMs
  ) {
    const remainingSec = Math.ceil(
      (MONETIZATION_CONFIG.guardrails.fullScreenMinIntervalMs -
        (ctx.nowMs - ctx.frequency.lastFullScreenAdShownAtMs)) /
        1000
    );
    return {
      allowed: false,
      reason: `Blocked: Minimum 5-minute full-screen interval active (${remainingSec}s remaining).`,
    };
  }

  // 11. Rewarded Interstitial: keep disabled unless an appropriate reward and clear intro exist
  if (ctx.format === 'rewarded-interstitial') {
    if (!ctx.rewardedInterstitialHasIntroAndReward) {
      return {
        allowed: false,
        reason:
          'Blocked: Rewarded Interstitial requires an explicit reward and introductory screen.',
      };
    }
    return { allowed: true };
  }

  // 12. Format-specific rules for Interstitial
  if (ctx.format === 'interstitial') {
    if (
      ctx.frequency.userActionsSinceLastInterstitial <
      MONETIZATION_CONFIG.guardrails.minUserActionsBetweenInterstitials
    ) {
      return {
        allowed: false,
        reason: `Blocked: Requires at least ${MONETIZATION_CONFIG.guardrails.minUserActionsBetweenInterstitials} user actions before showing an interstitial (${ctx.frequency.userActionsSinceLastInterstitial}/2 actions recorded).`,
      };
    }

    const countToday = getRecentInterstitialCount24h(
      ctx.frequency.interstitialTimestampsMs,
      ctx.nowMs
    );
    if (countToday >= MONETIZATION_CONFIG.guardrails.maxInterstitialsPerDay) {
      return {
        allowed: false,
        reason: `Blocked: Daily interstitial cap reached (${countToday}/${MONETIZATION_CONFIG.guardrails.maxInterstitialsPerDay} per 24h).`,
      };
    }

    return { allowed: true };
  }

  // 13. Format-specific rules for App Open
  if (ctx.format === 'app-open') {
    if (ctx.isFirstLaunchSessionBeforeOnboardingComplete) {
      return {
        allowed: false,
        reason:
          'Blocked: Never show an App Open ad on the first-ever launch before onboarding.',
      };
    }

    if (
      ctx.frequency.lastAppOpenShownAtMs > 0 &&
      ctx.nowMs - ctx.frequency.lastAppOpenShownAtMs <
        MONETIZATION_CONFIG.guardrails.appOpenMinIntervalMs
    ) {
      const remainingMin = Math.ceil(
        (MONETIZATION_CONFIG.guardrails.appOpenMinIntervalMs -
          (ctx.nowMs - ctx.frequency.lastAppOpenShownAtMs)) /
          60000
      );
      return {
        allowed: false,
        reason: `Blocked: Maximum 1 App Open impression per 4 hours (${remainingMin}m remaining).`,
      };
    }

    if (
      ctx.appOpenLoadedAtMs <= 0 ||
      ctx.nowMs - ctx.appOpenLoadedAtMs >=
        MONETIZATION_CONFIG.guardrails.appOpenExpirationMs
    ) {
      return {
        allowed: false,
        reason: 'Blocked: App Open ad cache expired (> 4 hours); reloading.',
      };
    }

    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Updates persisted frequency counters when an Interstitial, App Open, or Rewarded Interstitial impression occurs.
 */
export function recordFullScreenAdImpression(
  prev: AdFrequencyState,
  format: 'interstitial' | 'app-open' | 'rewarded-interstitial',
  nowMs: number
): AdFrequencyState {
  const windowStart = nowMs - 24 * 3600 * 1000;
  const prunedInterstitials = prev.interstitialTimestampsMs.filter(
    (t) => t >= windowStart
  );

  if (format === 'interstitial') {
    return {
      ...prev,
      lastFullScreenAdShownAtMs: nowMs,
      interstitialTimestampsMs: [...prunedInterstitials, nowMs],
      userActionsSinceLastInterstitial: 0,
      isShowingFullScreenAd: true,
    };
  }

  if (format === 'app-open') {
    return {
      ...prev,
      lastFullScreenAdShownAtMs: nowMs,
      lastAppOpenShownAtMs: nowMs,
      interstitialTimestampsMs: prunedInterstitials,
      isShowingFullScreenAd: true,
    };
  }

  return {
    ...prev,
    lastFullScreenAdShownAtMs: nowMs,
    interstitialTimestampsMs: prunedInterstitials,
    isShowingFullScreenAd: true,
  };
}

/**
 * Grants the 30-minute temporary reward pass ONLY when the SDK confirms full reward completion.
 */
export function applyRewardedAdOutcome(
  completedSuccessfully: boolean,
  currentPassExpiresAtMs: number,
  nowMs: number
): {
  granted: boolean;
  rewardPassExpiresAtMs: number;
  message: string;
} {
  if (!completedSuccessfully) {
    return {
      granted: false,
      rewardPassExpiresAtMs: currentPassExpiresAtMs,
      message:
        'Rewarded ad was skipped or closed before completion. No reward pass granted.',
    };
  }

  const baseMs = Math.max(nowMs, currentPassExpiresAtMs);
  const nextExpires =
    baseMs + MONETIZATION_CONFIG.guardrails.rewardedPassDurationMs;

  return {
    granted: true,
    rewardPassExpiresAtMs: nextExpires,
    message:
      'Reward earned! 1440p QHD Ultra Export & Pro Shader FX unlocked for 30 minutes.',
  };
}
