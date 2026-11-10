package studio.novabeat.visualizer.monetization

import android.app.Activity
import android.content.Context
import android.os.SystemClock
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.appopen.AppOpenAd
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

data class AdRuntimeState(
    val isEulaAccepted: Boolean = false,
    val isFirstLaunchSessionBeforeOnboardingComplete: Boolean = true,
    val sdkInitialized: Boolean = false,
    val canRequestAds: Boolean = false,
    val privacyOptionsRequired: Boolean = false,
    val bannerLoaded: Boolean = false,
    val interstitialReady: Boolean = false,
    val rewardedReady: Boolean = false,
    val rewardedInterstitialReady: Boolean = false,
    val appOpenReady: Boolean = false,
    val userActionsSinceLastInterstitial: Int = 0,
    val interstitialImpressions24h: Int = 0,
    val rewardPassExpiresAtElapsedMs: Long = 0L,
    val lastAdError: String? = null
)

/**
 * Manages UMP Consent (strictly decoupled from EULA acceptance), background MobileAds
 * initialization, and all 5 AdMob formats: Banner, Interstitial, Rewarded,
 * Rewarded Interstitial, and App Open.
 * Enforces strict frequency caps and playback/editing/export non-interruption guardrails.
 */
class AdMobManager(private val appContext: Context) {

    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val isMobileAdsInitCalled = AtomicBoolean(false)
    private val freqPrefs =
        appContext.getSharedPreferences("novabeat_ad_frequency_prefs", Context.MODE_PRIVATE)

    private var consentInformation: ConsentInformation =
        UserMessagingPlatform.getConsentInformation(appContext)

    private var interstitialAd: InterstitialAd? = null
    private var isInterstitialLoading = false

    private var rewardedAd: RewardedAd? = null
    private var isRewardedLoading = false

    private var rewardedInterstitialAd: RewardedInterstitialAd? = null
    private var isRewardedInterstitialLoading = false

    private var appOpenAd: AppOpenAd? = null
    private var isAppOpenLoading = false
    private var appOpenLoadTimeElapsedMs: Long = 0L

    private var isShowingFullScreenAd = false
    private var isProActive = false
    private var lastFullScreenAdShownEpochMs: Long =
        freqPrefs.getLong("last_fullscreen_epoch_ms", 0L)
    private var lastAppOpenShownEpochMs: Long =
        freqPrefs.getLong("last_app_open_epoch_ms", 0L)
    private var userActionsSinceLastInterstitial: Int =
        freqPrefs.getInt("user_actions_since_interstitial", 0)
    private val interstitialTimestampsEpochMs: MutableList<Long> = loadInterstitialTimestamps()

    private val _state = MutableStateFlow(
        AdRuntimeState(
            userActionsSinceLastInterstitial = userActionsSinceLastInterstitial,
            interstitialImpressions24h = getRecentInterstitialCount24h(System.currentTimeMillis())
        )
    )
    val state: StateFlow<AdRuntimeState> = _state

    private fun loadInterstitialTimestamps(): MutableList<Long> {
        val raw = freqPrefs.getString("interstitial_timestamps_csv", "") ?: ""
        if (raw.isBlank()) return mutableListOf()
        val cutoff = System.currentTimeMillis() - 24 * 3600 * 1000L
        return raw.split(",")
            .mapNotNull { it.trim().toLongOrNull() }
            .filter { it >= cutoff }
            .toMutableList()
    }

    private fun persistFrequencyState() {
        val cutoff = System.currentTimeMillis() - 24 * 3600 * 1000L
        interstitialTimestampsEpochMs.removeAll { it < cutoff }
        freqPrefs.edit()
            .putLong("last_fullscreen_epoch_ms", lastFullScreenAdShownEpochMs)
            .putLong("last_app_open_epoch_ms", lastAppOpenShownEpochMs)
            .putInt("user_actions_since_interstitial", userActionsSinceLastInterstitial)
            .putString(
                "interstitial_timestamps_csv",
                interstitialTimestampsEpochMs.joinToString(",")
            )
            .apply()
        _state.value = _state.value.copy(
            userActionsSinceLastInterstitial = userActionsSinceLastInterstitial,
            interstitialImpressions24h = interstitialTimestampsEpochMs.size
        )
    }

    fun getRecentInterstitialCount24h(nowEpochMs: Long): Int {
        val cutoff = nowEpochMs - 24 * 3600 * 1000L
        return interstitialTimestampsEpochMs.count { it >= cutoff }
    }

    fun recordUserAction() {
        userActionsSinceLastInterstitial += 1
        persistFrequencyState()
    }

    fun setOnboardingStatus(
        isEulaAccepted: Boolean,
        isFirstLaunchSessionBeforeOnboardingComplete: Boolean
    ) {
        _state.value = _state.value.copy(
            isEulaAccepted = isEulaAccepted,
            isFirstLaunchSessionBeforeOnboardingComplete = isFirstLaunchSessionBeforeOnboardingComplete
        )
    }

    /**
     * Step 1: Request UMP consent and initialize MobileAds SDK on a background thread.
     * Must ONLY be called after the user has accepted the current EULA version.
     */
    fun gatherConsentAndInitialize(
        activity: Activity,
        isEulaAccepted: Boolean,
        isProEntitled: Boolean,
        onComplete: () -> Unit = {}
    ) {
        isProActive = isProEntitled
        _state.value = _state.value.copy(isEulaAccepted = isEulaAccepted)

        // Never request UMP consent or initialize ads before EULA acceptance or for Pro users
        if (!isEulaAccepted) {
            onComplete()
            return
        }
        if (isProEntitled) {
            destroyAllAds()
            onComplete()
            return
        }

        val params = ConsentRequestParameters.Builder()
            .setTagForUnderAgeOfConsent(false)
            .build()

        consentInformation.requestConsentInfoUpdate(
            activity,
            params,
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
                    updateConsentState(lastError = formError?.message)
                    if (consentInformation.canRequestAds() && !isProActive) {
                        initializeMobileAdsOnBackground()
                    }
                    onComplete()
                }
            },
            { requestError ->
                updateConsentState(lastError = requestError.message)
                if (consentInformation.canRequestAds() && !isProActive) {
                    initializeMobileAdsOnBackground()
                }
                onComplete()
            }
        )
    }

    private fun updateConsentState(lastError: String? = null) {
        val privacyRequired =
            consentInformation.privacyOptionsRequirementStatus ==
                ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
        val canRequest =
            _state.value.isEulaAccepted && !isProActive && consentInformation.canRequestAds()
        _state.value = _state.value.copy(
            canRequestAds = canRequest,
            privacyOptionsRequired = privacyRequired,
            isFirstLaunchSessionBeforeOnboardingComplete = false,
            lastAdError = lastError
        )
    }

    fun showPrivacyOptionsForm(activity: Activity, onDismiss: (String?) -> Unit) {
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { formError ->
            updateConsentState(formError?.message)
            onDismiss(formError?.message)
        }
    }

    private fun initializeMobileAdsOnBackground() {
        if (isProActive || !_state.value.isEulaAccepted) return
        if (!isMobileAdsInitCalled.compareAndSet(false, true)) {
            preloadAllFormats()
            return
        }
        ioScope.launch {
            MobileAds.initialize(appContext) {
                if (!isProActive && _state.value.isEulaAccepted) {
                    _state.value = _state.value.copy(sdkInitialized = true, canRequestAds = true)
                    preloadAllFormats()
                }
            }
        }
    }

    fun preloadAllFormats() {
        if (isProActive || !_state.value.isEulaAccepted || !_state.value.canRequestAds) return
        loadInterstitial()
        loadRewarded()
        loadRewardedInterstitial()
        loadAppOpen()
    }

    /**
     * Shared full-screen guardrail predicate:
     * Full-screen ads must NEVER interrupt active music playback, visualizer editing,
     * or ongoing video export, and must respect the 5-minute full-screen interval.
     */
    fun canShowFullScreenAd(
        isProEntitled: Boolean,
        isAudioPlaying: Boolean,
        isEditingVisualizer: Boolean,
        isExportingVideo: Boolean,
        enforceFiveMinuteCooldown: Boolean = true
    ): Boolean {
        if (isProEntitled || isProActive) return false
        if (!_state.value.isEulaAccepted || !_state.value.canRequestAds) return false
        if (isShowingFullScreenAd) return false
        if (isAudioPlaying || isEditingVisualizer || isExportingVideo) return false
        if (enforceFiveMinuteCooldown) {
            val nowEpoch = System.currentTimeMillis()
            if (lastFullScreenAdShownEpochMs > 0L &&
                nowEpoch - lastFullScreenAdShownEpochMs < MonetizationConfig.FULL_SCREEN_MIN_INTERVAL_MS
            ) {
                return false
            }
        }
        return true
    }

    // -------------------------------------------------------------------------
    // Interstitial Format (ca-app-pub-5715504294225066/2828991583)
    // -------------------------------------------------------------------------
    fun loadInterstitial() {
        if (isProActive || !_state.value.isEulaAccepted || !_state.value.canRequestAds) return
        if (isInterstitialLoading || interstitialAd != null) return
        isInterstitialLoading = true
        InterstitialAd.load(
            appContext,
            MonetizationConfig.interstitialAdUnitId,
            AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    isInterstitialLoading = false
                    if (isProActive) {
                        interstitialAd = null
                        return
                    }
                    interstitialAd = ad
                    _state.value = _state.value.copy(interstitialReady = true, lastAdError = null)
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    interstitialAd = null
                    isInterstitialLoading = false
                    _state.value = _state.value.copy(
                        interstitialReady = false,
                        lastAdError = error.message
                    )
                }
            }
        )
    }

    fun showInterstitialIfAppropriate(
        activity: Activity,
        isProEntitled: Boolean,
        isAudioPlaying: Boolean,
        isEditingVisualizer: Boolean,
        isExportingVideo: Boolean,
        onDismissed: () -> Unit = {}
    ): Boolean {
        if (!canShowFullScreenAd(isProEntitled, isAudioPlaying, isEditingVisualizer, isExportingVideo)) {
            onDismissed()
            return false
        }
        if (userActionsSinceLastInterstitial < MonetizationConfig.MIN_USER_ACTIONS_BETWEEN_INTERSTITIALS) {
            onDismissed()
            return false
        }
        val nowEpoch = System.currentTimeMillis()
        if (getRecentInterstitialCount24h(nowEpoch) >= MonetizationConfig.MAX_INTERSTITIALS_PER_DAY) {
            onDismissed()
            return false
        }
        val ad = interstitialAd ?: run {
            loadInterstitial()
            onDismissed()
            return false
        }
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() {
                val shownAt = System.currentTimeMillis()
                isShowingFullScreenAd = true
                lastFullScreenAdShownEpochMs = shownAt
                userActionsSinceLastInterstitial = 0
                interstitialTimestampsEpochMs.add(shownAt)
                persistFrequencyState()
            }

            override fun onAdDismissedFullScreenContent() {
                isShowingFullScreenAd = false
                interstitialAd = null
                _state.value = _state.value.copy(interstitialReady = false)
                loadInterstitial()
                onDismissed()
            }

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                isShowingFullScreenAd = false
                interstitialAd = null
                _state.value = _state.value.copy(
                    interstitialReady = false,
                    lastAdError = adError.message
                )
                onDismissed()
            }
        }
        ad.show(activity)
        return true
    }

    // -------------------------------------------------------------------------
    // Rewarded Format (ca-app-pub-5715504294225066/1167766414)
    // -------------------------------------------------------------------------
    fun loadRewarded() {
        if (isProActive || !_state.value.isEulaAccepted || !_state.value.canRequestAds) return
        if (isRewardedLoading || rewardedAd != null) return
        isRewardedLoading = true
        RewardedAd.load(
            appContext,
            MonetizationConfig.rewardedAdUnitId,
            AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) {
                    isRewardedLoading = false
                    if (isProActive) {
                        rewardedAd = null
                        return
                    }
                    rewardedAd = ad
                    _state.value = _state.value.copy(rewardedReady = true, lastAdError = null)
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    rewardedAd = null
                    isRewardedLoading = false
                    _state.value = _state.value.copy(
                        rewardedReady = false,
                        lastAdError = error.message
                    )
                }
            }
        )
    }

    fun showRewardedAd(
        activity: Activity,
        isProEntitled: Boolean,
        isAudioPlaying: Boolean,
        isEditingVisualizer: Boolean,
        isExportingVideo: Boolean,
        onRewardEarned: () -> Unit,
        onClosedWithoutReward: () -> Unit
    ) {
        if (!canShowFullScreenAd(
                isProEntitled = isProEntitled,
                isAudioPlaying = isAudioPlaying,
                isEditingVisualizer = isEditingVisualizer,
                isExportingVideo = isExportingVideo,
                enforceFiveMinuteCooldown = false
            )
        ) {
            onClosedWithoutReward()
            return
        }
        val ad = rewardedAd ?: run {
            loadRewarded()
            onClosedWithoutReward()
            return
        }
        var earned = false
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() {
                isShowingFullScreenAd = true
            }

            override fun onAdDismissedFullScreenContent() {
                isShowingFullScreenAd = false
                rewardedAd = null
                _state.value = _state.value.copy(rewardedReady = false)
                loadRewarded()
                if (!earned) onClosedWithoutReward()
            }

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                isShowingFullScreenAd = false
                rewardedAd = null
                _state.value = _state.value.copy(
                    rewardedReady = false,
                    lastAdError = adError.message
                )
                onClosedWithoutReward()
            }
        }
        ad.show(activity) { _ ->
            earned = true
            val baseElapsed = maxOf(SystemClock.elapsedRealtime(), _state.value.rewardPassExpiresAtElapsedMs)
            val expiresAt = baseElapsed + MonetizationConfig.REWARDED_PASS_DURATION_MS
            _state.value = _state.value.copy(rewardPassExpiresAtElapsedMs = expiresAt)
            onRewardEarned()
        }
    }

    // -------------------------------------------------------------------------
    // Rewarded Interstitial Format (ca-app-pub-5715504294225066/2999722838)
    // -------------------------------------------------------------------------
    fun loadRewardedInterstitial() {
        if (isProActive || !_state.value.isEulaAccepted || !_state.value.canRequestAds) return
        if (isRewardedInterstitialLoading || rewardedInterstitialAd != null) return
        isRewardedInterstitialLoading = true
        RewardedInterstitialAd.load(
            appContext,
            MonetizationConfig.rewardedInterstitialAdUnitId,
            AdRequest.Builder().build(),
            object : RewardedInterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedInterstitialAd) {
                    isRewardedInterstitialLoading = false
                    if (isProActive) {
                        rewardedInterstitialAd = null
                        return
                    }
                    rewardedInterstitialAd = ad
                    _state.value = _state.value.copy(rewardedInterstitialReady = true)
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    rewardedInterstitialAd = null
                    isRewardedInterstitialLoading = false
                    _state.value = _state.value.copy(
                        rewardedInterstitialReady = false,
                        lastAdError = error.message
                    )
                }
            }
        )
    }

    /**
     * Shows a Rewarded Interstitial ONLY after the introductory disclosure dialog with
     * an explicit skip option (`introConfirmedByUser = true`) and shared 5-minute full-screen check.
     */
    fun showRewardedInterstitialAd(
        activity: Activity,
        introConfirmedByUser: Boolean,
        isProEntitled: Boolean,
        isAudioPlaying: Boolean,
        isEditingVisualizer: Boolean,
        isExportingVideo: Boolean,
        onRewardEarned: () -> Unit,
        onSkippedOrFailed: () -> Unit
    ) {
        if (!introConfirmedByUser ||
            !canShowFullScreenAd(
                isProEntitled = isProEntitled,
                isAudioPlaying = isAudioPlaying,
                isEditingVisualizer = isEditingVisualizer,
                isExportingVideo = isExportingVideo,
                enforceFiveMinuteCooldown = true
            )
        ) {
            onSkippedOrFailed()
            return
        }
        val ad = rewardedInterstitialAd ?: run {
            loadRewardedInterstitial()
            onSkippedOrFailed()
            return
        }
        var earned = false
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() {
                val shownAt = System.currentTimeMillis()
                isShowingFullScreenAd = true
                lastFullScreenAdShownEpochMs = shownAt
                persistFrequencyState()
            }

            override fun onAdDismissedFullScreenContent() {
                isShowingFullScreenAd = false
                rewardedInterstitialAd = null
                _state.value = _state.value.copy(rewardedInterstitialReady = false)
                loadRewardedInterstitial()
                if (!earned) onSkippedOrFailed()
            }

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                isShowingFullScreenAd = false
                rewardedInterstitialAd = null
                _state.value = _state.value.copy(
                    rewardedInterstitialReady = false,
                    lastAdError = adError.message
                )
                onSkippedOrFailed()
            }
        }
        ad.show(activity) { _ ->
            earned = true
            val baseElapsed = maxOf(SystemClock.elapsedRealtime(), _state.value.rewardPassExpiresAtElapsedMs)
            val expiresAt = baseElapsed + MonetizationConfig.REWARDED_PASS_DURATION_MS
            _state.value = _state.value.copy(rewardPassExpiresAtElapsedMs = expiresAt)
            onRewardEarned()
        }
    }

    // -------------------------------------------------------------------------
    // App Open Format (ca-app-pub-5715504294225066/8569624611)
    // -------------------------------------------------------------------------
    fun loadAppOpen() {
        if (isProActive || !_state.value.isEulaAccepted || !_state.value.canRequestAds) return
        if (isAppOpenLoading || isAppOpenAdAvailable()) return
        isAppOpenLoading = true
        AppOpenAd.load(
            appContext,
            MonetizationConfig.appOpenAdUnitId,
            AdRequest.Builder().build(),
            object : AppOpenAd.AppOpenAdLoadCallback() {
                override fun onAdLoaded(ad: AppOpenAd) {
                    isAppOpenLoading = false
                    if (isProActive) {
                        appOpenAd = null
                        return
                    }
                    appOpenAd = ad
                    appOpenLoadTimeElapsedMs = SystemClock.elapsedRealtime()
                    _state.value = _state.value.copy(appOpenReady = true)
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    appOpenAd = null
                    isAppOpenLoading = false
                    _state.value = _state.value.copy(
                        appOpenReady = false,
                        lastAdError = error.message
                    )
                }
            }
        )
    }

    private fun isAppOpenAdAvailable(): Boolean {
        val ad = appOpenAd ?: return false
        val ageMs = SystemClock.elapsedRealtime() - appOpenLoadTimeElapsedMs
        return ad != null && ageMs < MonetizationConfig.APP_OPEN_EXPIRATION_MS
    }

    fun showAppOpenIfAppropriate(
        activity: Activity,
        isProEntitled: Boolean,
        isAudioPlaying: Boolean,
        isEditingVisualizer: Boolean,
        isExportingVideo: Boolean
    ): Boolean {
        // Never show App Open on first-ever launch before onboarding & consent complete
        if (_state.value.isFirstLaunchSessionBeforeOnboardingComplete) {
            return false
        }
        if (!canShowFullScreenAd(isProEntitled, isAudioPlaying, isEditingVisualizer, isExportingVideo)) {
            return false
        }
        val nowEpoch = System.currentTimeMillis()
        // Maximum 1 App Open impression per 4 hours
        if (lastAppOpenShownEpochMs > 0L &&
            nowEpoch - lastAppOpenShownEpochMs < MonetizationConfig.APP_OPEN_MIN_INTERVAL_MS
        ) {
            return false
        }
        if (!isAppOpenAdAvailable()) {
            loadAppOpen()
            return false
        }
        val ad = appOpenAd ?: return false
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() {
                val shownAt = System.currentTimeMillis()
                isShowingFullScreenAd = true
                lastFullScreenAdShownEpochMs = shownAt
                lastAppOpenShownEpochMs = shownAt
                persistFrequencyState()
            }

            override fun onAdDismissedFullScreenContent() {
                isShowingFullScreenAd = false
                appOpenAd = null
                _state.value = _state.value.copy(appOpenReady = false)
                loadAppOpen()
            }

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                isShowingFullScreenAd = false
                appOpenAd = null
                _state.value = _state.value.copy(appOpenReady = false)
                loadAppOpen()
            }
        }
        ad.show(activity)
        return true
    }

    fun destroyAllAds() {
        isProActive = true
        isShowingFullScreenAd = false
        interstitialAd = null
        rewardedAd = null
        rewardedInterstitialAd = null
        appOpenAd = null
        appOpenLoadTimeElapsedMs = 0L
        _state.value = _state.value.copy(
            canRequestAds = false,
            bannerLoaded = false,
            interstitialReady = false,
            rewardedReady = false,
            rewardedInterstitialReady = false,
            appOpenReady = false
        )
    }
}
