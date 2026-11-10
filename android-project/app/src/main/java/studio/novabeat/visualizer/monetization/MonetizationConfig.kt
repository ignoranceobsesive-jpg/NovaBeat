package studio.novabeat.visualizer.monetization

import studio.novabeat.visualizer.BuildConfig

/**
 * Centralized Monetization, EULA & Advertising Configuration for NovaBeat.
 * Separates official Google development/test identifiers from release production identifiers
 * without requiring changes to application logic.
 */
object MonetizationConfig {

    val useTestAdUnits: Boolean = BuildConfig.USE_TEST_ADS

    // =========================================================================
    // 0. EULA VERSIONING & FIRST-LAUNCH ONBOARDING
    // =========================================================================
    const val CURRENT_EULA_VERSION = "2.0.0"

    // =========================================================================
    // 1. PRODUCTION ADMOB IDENTIFIERS (Account: ca-app-pub-5715504294225066)
    // =========================================================================
    const val PROD_ADMOB_APP_ID = "ca-app-pub-5715504294225066~1300287499"
    const val PROD_BANNER_AD_UNIT_ID = "ca-app-pub-5715504294225066/9565131181"
    const val PROD_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-5715504294225066/2828991583"
    const val PROD_REWARDED_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-5715504294225066/2999722838"
    const val PROD_REWARDED_AD_UNIT_ID = "ca-app-pub-5715504294225066/1167766414"
    const val PROD_APP_OPEN_AD_UNIT_ID = "ca-app-pub-5715504294225066/8569624611"

    // =========================================================================
    // 2. OFFICIAL GOOGLE SAMPLE TEST ADMOB IDENTIFIERS (For Development/Debug)
    // =========================================================================
    const val TEST_ADMOB_APP_ID = "ca-app-pub-3940256099942544~3347511713"
    const val TEST_BANNER_AD_UNIT_ID = "ca-app-pub-3940256099942544/9214589741"
    const val TEST_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/1033173712"
    const val TEST_REWARDED_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/5354046379"
    const val TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917"
    const val TEST_APP_OPEN_AD_UNIT_ID = "ca-app-pub-3940256099942544/9257395921"

    // =========================================================================
    // 3. RESOLVED ACTIVE AD UNIT IDS
    // =========================================================================
    val activeAppId: String
        get() = if (useTestAdUnits) TEST_ADMOB_APP_ID else PROD_ADMOB_APP_ID

    val bannerAdUnitId: String
        get() = if (useTestAdUnits) TEST_BANNER_AD_UNIT_ID else PROD_BANNER_AD_UNIT_ID

    val interstitialAdUnitId: String
        get() = if (useTestAdUnits) TEST_INTERSTITIAL_AD_UNIT_ID else PROD_INTERSTITIAL_AD_UNIT_ID

    val rewardedInterstitialAdUnitId: String
        get() = if (useTestAdUnits) TEST_REWARDED_INTERSTITIAL_AD_UNIT_ID else PROD_REWARDED_INTERSTITIAL_AD_UNIT_ID

    val rewardedAdUnitId: String
        get() = if (useTestAdUnits) TEST_REWARDED_AD_UNIT_ID else PROD_REWARDED_AD_UNIT_ID

    val appOpenAdUnitId: String
        get() = if (useTestAdUnits) TEST_APP_OPEN_AD_UNIT_ID else PROD_APP_OPEN_AD_UNIT_ID

    // =========================================================================
    // 4. GOOGLE PLAY BILLING PRODUCT CONFIGURATION
    // =========================================================================
    const val PRODUCT_ID_PRO_LIFETIME = "novabeat_pro_lifetime"
    const val PRODUCT_NAME_PRO = "NovaBeat Pro"
    const val PRODUCT_DESCRIPTION_PRO =
        "Unlock the premium NovaBeat experience permanently, including removal of advertisements and designated premium features."

    // =========================================================================
    // 5. FREQUENCY CAPPING & LIFECYCLE GUARDRAILS
    // =========================================================================
    const val FULL_SCREEN_MIN_INTERVAL_MS = 5 * 60 * 1000L // Minimum 5-minute interval between full-screen ads
    const val MAX_INTERSTITIALS_PER_DAY = 6 // Maximum 6 interstitial impressions per user per day
    const val MIN_USER_ACTIONS_BETWEEN_INTERSTITIALS = 2 // Minimum 2 user actions before an interstitial
    const val APP_OPEN_MIN_INTERVAL_MS = 4 * 3600 * 1000L // Maximum 1 App Open impression per 4 hours
    const val APP_OPEN_EXPIRATION_MS = 4 * 3600 * 1000L // 4 hours max cache validity for App Open ads
    const val REWARDED_PASS_DURATION_MS = 30 * 60 * 1000L // 30 minutes temporary Pro Export & Shader unlock
}
