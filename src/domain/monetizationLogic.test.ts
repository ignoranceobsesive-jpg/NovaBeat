import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdFrequencyState,
  applyRewardedAdOutcome,
  CURRENT_EULA_VERSION,
  evaluateAdGuardrails,
  getLocalizedPlayStorePrice,
  isEulaAcceptanceRequired,
  MONETIZATION_CONFIG,
  PlayStorePurchaseRecord,
  reconcileProEntitlement,
  recordFullScreenAdImpression,
  resolveActiveAdUnits,
} from './monetizationConfig.ts';

const baseFrequency: AdFrequencyState = {
  lastFullScreenAdShownAtMs: 0,
  lastAppOpenShownAtMs: 0,
  interstitialTimestampsMs: [],
  userActionsSinceLastInterstitial: 3,
  isShowingFullScreenAd: false,
};

test('isEulaAcceptanceRequired requires acceptance on first launch and on material version updates', () => {
  assert.equal(isEulaAcceptanceRequired(null, CURRENT_EULA_VERSION), true);
  assert.equal(isEulaAcceptanceRequired('', CURRENT_EULA_VERSION), true);
  assert.equal(
    isEulaAcceptanceRequired(CURRENT_EULA_VERSION, CURRENT_EULA_VERSION),
    false
  );
  // Material EULA update from 2.0.0 to 2.1.0 requires renewed acceptance
  assert.equal(isEulaAcceptanceRequired('2.0.0', '2.1.0'), true);
});

test('EULA acceptance alone never constitutes UMP advertising consent', () => {
  const blockedWithoutUmp = evaluateAdGuardrails({
    format: 'banner',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: false,
    umpConsentCompleted: false,
    canRequestAds: false,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: baseFrequency,
    appOpenLoadedAtMs: 1000,
    nowMs: 50_000,
  });
  assert.equal(blockedWithoutUmp.allowed, false);

  const blockedWithoutEula = evaluateAdGuardrails({
    format: 'banner',
    isEulaAcceptedForCurrentVersion: false,
    isFirstLaunchSessionBeforeOnboardingComplete: true,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: baseFrequency,
    appOpenLoadedAtMs: 1000,
    nowMs: 50_000,
  });
  assert.equal(blockedWithoutEula.allowed, false);
});

test('resolveActiveAdUnits returns official test IDs in test mode and exact production IDs in production mode', () => {
  const testSet = resolveActiveAdUnits('test');
  assert.equal(testSet.appId, 'ca-app-pub-3940256099942544~3347511713');
  assert.equal(testSet.bannerAdUnitId, 'ca-app-pub-3940256099942544/9214589741');

  const prodSet = resolveActiveAdUnits('production');
  assert.equal(prodSet.appId, 'ca-app-pub-5715504294225066~1300287499');
  assert.equal(prodSet.bannerAdUnitId, 'ca-app-pub-5715504294225066/9565131181');
  assert.equal(
    prodSet.interstitialAdUnitId,
    'ca-app-pub-5715504294225066/2828991583'
  );
  assert.equal(
    prodSet.rewardedInterstitialAdUnitId,
    'ca-app-pub-5715504294225066/2999722838'
  );
  assert.equal(
    prodSet.rewardedAdUnitId,
    'ca-app-pub-5715504294225066/1167766414'
  );
  assert.equal(
    prodSet.appOpenAdUnitId,
    'ca-app-pub-5715504294225066/8569624611'
  );
});

test('reconcileProEntitlement ignores forged local boolean if Google Play has no purchase record', () => {
  const reconciled = reconcileProEntitlement(true, []);
  assert.equal(reconciled.isProEntitled, false);
  assert.equal(reconciled.purchaseState, 'NOT_PURCHASED');
});

test('reconcileProEntitlement never grants Pro access for PENDING, CANCELLED, or unacknowledged purchases', () => {
  const pendingPurchase: PlayStorePurchaseRecord = {
    orderId: 'GPA.3311-2200-1100-00001',
    productId: 'novabeat_pro_lifetime',
    purchaseToken: 'tok_pending_123',
    purchaseTimeMs: 1700000000000,
    purchaseState: 'PENDING',
    acknowledged: false,
    signatureVerified: true,
  };
  const pendingResult = reconcileProEntitlement(true, [pendingPurchase]);
  assert.equal(pendingResult.isProEntitled, false);
  assert.equal(pendingResult.purchaseState, 'PENDING');

  const unacknowledgedPurchase: PlayStorePurchaseRecord = {
    ...pendingPurchase,
    purchaseState: 'PURCHASED',
    acknowledged: false,
  };
  const unackResult = reconcileProEntitlement(false, [unacknowledgedPurchase]);
  assert.equal(unackResult.isProEntitled, false);

  const verifiedPurchase: PlayStorePurchaseRecord = {
    ...pendingPurchase,
    purchaseState: 'PURCHASED',
    acknowledged: true,
    signatureVerified: true,
  };
  const activeResult = reconcileProEntitlement(false, [verifiedPurchase]);
  assert.equal(activeResult.isProEntitled, true);
  assert.equal(activeResult.purchaseState, 'PURCHASED');
  assert.equal(activeResult.acknowledged, true);
});

test('evaluateAdGuardrails disables all 5 ad formats when user owns NovaBeat Pro', () => {
  const formats = [
    'banner',
    'interstitial',
    'rewarded',
    'rewarded-interstitial',
    'app-open',
  ] as const;

  for (const format of formats) {
    const res = evaluateAdGuardrails({
      format,
      isEulaAcceptedForCurrentVersion: true,
      isFirstLaunchSessionBeforeOnboardingComplete: false,
      umpConsentCompleted: true,
      canRequestAds: true,
      isProEntitled: true,
      isOffline: false,
      isAudioPlaying: false,
      isEditingVisualizer: false,
      isExportingVideo: false,
      rewardedInterstitialHasIntroAndReward: true,
      frequency: baseFrequency,
      appOpenLoadedAtMs: 1000,
      nowMs: 500_000,
    });
    assert.equal(res.allowed, false);
  }
});

test('Interstitial enforces 5-minute interval, max 6 per day, >= 2 user actions, and blocks during playback/export', () => {
  const now = 1_000_000_000;

  // 1. Blocked during active music playback
  const duringPlayback = evaluateAdGuardrails({
    format: 'interstitial',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: false,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: true,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: baseFrequency,
    appOpenLoadedAtMs: now - 10_000,
    nowMs: now,
  });
  assert.equal(duringPlayback.allowed, false);

  // 2. Blocked when fewer than 2 user actions occurred since last interstitial
  const onlyOneAction = evaluateAdGuardrails({
    format: 'interstitial',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: false,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: { ...baseFrequency, userActionsSinceLastInterstitial: 1 },
    appOpenLoadedAtMs: now - 10_000,
    nowMs: now,
  });
  assert.equal(onlyOneAction.allowed, false);

  // 3. Blocked during 5-minute (300,000ms) interval after any full-screen ad
  const withinFiveMin = evaluateAdGuardrails({
    format: 'interstitial',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: false,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: {
      ...baseFrequency,
      lastFullScreenAdShownAtMs: now - 4 * 60 * 1000, // 4m ago (< 5m)
    },
    appOpenLoadedAtMs: now - 10_000,
    nowMs: now,
  });
  assert.equal(withinFiveMin.allowed, false);

  // 4. Blocked when 6 interstitials have already been shown in the last 24 hours
  const sixInLast24h = evaluateAdGuardrails({
    format: 'interstitial',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: false,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: {
      ...baseFrequency,
      interstitialTimestampsMs: [
        now - 3600_000 * 1,
        now - 3600_000 * 2,
        now - 3600_000 * 3,
        now - 3600_000 * 4,
        now - 3600_000 * 5,
        now - 3600_000 * 6,
      ],
    },
    appOpenLoadedAtMs: now - 10_000,
    nowMs: now,
  });
  assert.equal(sixInLast24h.allowed, false);

  // 5. Allowed when idle, >= 2 actions, > 5m interval, and < 6 today
  const allowedBreak = evaluateAdGuardrails({
    format: 'interstitial',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: false,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: {
      ...baseFrequency,
      lastFullScreenAdShownAtMs: now - 6 * 60 * 1000,
      userActionsSinceLastInterstitial: 2,
      interstitialTimestampsMs: [now - 3600_000 * 2],
    },
    appOpenLoadedAtMs: now - 10_000,
    nowMs: now,
  });
  assert.equal(allowedBreak.allowed, true);
});

test('App Open enforces max 1 per 4 hours, blocks on first launch before onboarding, and never stacks', () => {
  const now = 2_000_000_000;

  // Blocked on first launch before onboarding completes
  const firstLaunchBlock = evaluateAdGuardrails({
    format: 'app-open',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: true,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: baseFrequency,
    appOpenLoadedAtMs: now - 10_000,
    nowMs: now,
  });
  assert.equal(firstLaunchBlock.allowed, false);

  // Record an App Open impression and verify 4-hour cap blocks subsequent App Open within 4h
  const afterAppOpen = recordFullScreenAdImpression(
    baseFrequency,
    'app-open',
    now
  );
  const dismissedFreq = { ...afterAppOpen, isShowingFullScreenAd: false };

  const twoHoursLater = now + 2 * 3600 * 1000;
  const blockedWithinFourHours = evaluateAdGuardrails({
    format: 'app-open',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: false,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: dismissedFreq,
    appOpenLoadedAtMs: twoHoursLater - 10_000,
    nowMs: twoHoursLater,
  });
  assert.equal(blockedWithinFourHours.allowed, false);
});

test('applyRewardedAdOutcome grants 30-minute pass only on completed reward callback and never on skip', () => {
  const skipped = applyRewardedAdOutcome(false, 0, 10_000);
  assert.equal(skipped.granted, false);
  assert.equal(skipped.rewardPassExpiresAtMs, 0);

  const completed = applyRewardedAdOutcome(true, 0, 10_000);
  assert.equal(completed.granted, true);
  assert.equal(
    completed.rewardPassExpiresAtMs,
    10_000 + MONETIZATION_CONFIG.guardrails.rewardedPassDurationMs
  );
});

test('getLocalizedPlayStorePrice returns localized currency formatting', () => {
  assert.equal(getLocalizedPlayStorePrice('en-US').formattedPrice, '$9.99');
  assert.equal(getLocalizedPlayStorePrice('en-GB').formattedPrice, '£8.49');
  assert.equal(getLocalizedPlayStorePrice('de-DE').formattedPrice, '€9.49');
  assert.equal(getLocalizedPlayStorePrice('en-IN').formattedPrice, '₹799.00');
});

test('evaluateAdGuardrails blocks rewarded and rewarded-interstitial during active playback or editing and enforces shared 5-minute cooldown', () => {
  const nowMs = 1_000_000;
  const blockedDuringPlayback = evaluateAdGuardrails({
    format: 'rewarded',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: false,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: true,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: { ...baseFrequency },
    appOpenLoadedAtMs: nowMs,
    nowMs,
  });
  assert.equal(blockedDuringPlayback.allowed, false);

  const freqAfterRewardedInterstitial = recordFullScreenAdImpression(
    { ...baseFrequency },
    'rewarded-interstitial',
    nowMs
  );
  assert.equal(freqAfterRewardedInterstitial.lastFullScreenAdShownAtMs, nowMs);

  const dismissedFreq: AdFrequencyState = {
    ...freqAfterRewardedInterstitial,
    isShowingFullScreenAd: false,
    userActionsSinceLastInterstitial: 3,
  };

  // Interstitial 2 minutes after a Rewarded Interstitial must be blocked by the shared 5-minute interval
  const blockedInterstitialWithin5Min = evaluateAdGuardrails({
    format: 'interstitial',
    isEulaAcceptedForCurrentVersion: true,
    isFirstLaunchSessionBeforeOnboardingComplete: false,
    umpConsentCompleted: true,
    canRequestAds: true,
    isProEntitled: false,
    isOffline: false,
    isAudioPlaying: false,
    isEditingVisualizer: false,
    isExportingVideo: false,
    frequency: dismissedFreq,
    appOpenLoadedAtMs: nowMs,
    nowMs: nowMs + 2 * 60_000,
  });
  assert.equal(blockedInterstitialWithin5Min.allowed, false);
});

