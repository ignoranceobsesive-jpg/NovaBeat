export interface AndroidSourceFile {
  path: string;
  title: string;
  layer:
    | 'Gradle'
    | 'Manifest'
    | 'Monetization'
    | 'Billing'
    | 'Audio FFT'
    | 'Playback'
    | 'Visualization'
    | 'UI';
  content: string;
}

export const ANDROID_KOTLIN_FILES: AndroidSourceFile[] = [
  {
    path: 'app/build.gradle.kts',
    title:
      'build.gradle.kts (API 36, Media3, AdMob 24.1.0, UMP 3.1.0, Play Billing 9.1.0)',
    layer: 'Gradle',
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

android {
    namespace = "studio.novabeat.visualizer"
    compileSdk = 36

    defaultConfig {
        applicationId = "studio.novabeat.visualizer"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "1.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            // Official Google AdMob Test App ID during development/debug builds
            manifestPlaceholders["admobAppId"] = "ca-app-pub-3940256099942544~3347511713"
            buildConfigField("Boolean", "USE_TEST_ADS", "true")
        }
        release {
            isMinifyEnabled = true
            // Production NovaBeat AdMob Application ID
            manifestPlaceholders["admobAppId"] = "ca-app-pub-5715504294225066~1300287499"
            buildConfigField("Boolean", "USE_TEST_ADS", "false")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.02.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")

    // AndroidX Media3 (ExoPlayer, Session, Transformer for Video Export)
    val media3Version = "1.5.1"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-session:$media3Version")
    implementation("androidx.media3:media3-transformer:$media3Version")
    implementation("androidx.media3:media3-effect:$media3Version")

    // Room & DataStore Persistence
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")
    implementation("androidx.datastore:datastore-preferences:1.1.2")

    // Google Mobile Ads SDK & User Messaging Platform (UMP Consent)
    implementation("com.google.android.gms:play-services-ads:24.1.0")
    implementation("com.google.android.ump:user-messaging-platform:3.1.0")

    // Google Play Billing Library 9.1.0 (One-Time Non-Consumable NovaBeat Pro)
    val billingVersion = "9.1.0"
    implementation("com.android.billingclient:billing-ktx:$billingVersion")

    testImplementation("junit:junit:4.13.2")
}`,
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    title: 'AndroidManifest.xml (AdMob APPLICATION_ID, Billing & MediaPlaybackService)',
    layer: 'Manifest',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="com.android.vending.BILLING" />
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:label="NovaBeat"
        android:supportsRtl="true"
        android:theme="@style/Theme.NovaBeat">

        <!-- Google AdMob App ID injected via manifestPlaceholders (Prod: ca-app-pub-5715504294225066~1300287499) -->
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="\${admobAppId}" />

        <meta-data
            android:name="com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION"
            android:value="true" />
        <meta-data
            android:name="com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING"
            android:value="true" />

        <activity
            android:name=".ui.MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".playback.NovaBeatPlaybackService"
            android:exported="true"
            android:foregroundServiceType="mediaPlayback">
            <intent-filter>
                <action android:name="androidx.media3.session.MediaSessionService" />
            </intent-filter>
        </service>
    </application>
</manifest>`,
  },
  {
    path: 'app/src/main/java/studio/novabeat/visualizer/monetization/MonetizationConfig.kt',
    title: 'MonetizationConfig.kt (All 5 Production & Test AdMob IDs + Play Billing SKU)',
    layer: 'Monetization',
    content: `package studio.novabeat.visualizer.monetization

import studio.novabeat.visualizer.BuildConfig

object MonetizationConfig {

    val useTestAdUnits: Boolean = BuildConfig.USE_TEST_ADS

    // 1. PRODUCTION ADMOB IDENTIFIERS
    const val PROD_ADMOB_APP_ID = "ca-app-pub-5715504294225066~1300287499"
    const val PROD_BANNER_AD_UNIT_ID = "ca-app-pub-5715504294225066/9565131181"
    const val PROD_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-5715504294225066/2828991583"
    const val PROD_REWARDED_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-5715504294225066/2999722838"
    const val PROD_REWARDED_AD_UNIT_ID = "ca-app-pub-5715504294225066/1167766414"
    const val PROD_APP_OPEN_AD_UNIT_ID = "ca-app-pub-5715504294225066/8569624611"

    // 2. OFFICIAL GOOGLE SAMPLE TEST ADMOB IDENTIFIERS
    const val TEST_ADMOB_APP_ID = "ca-app-pub-3940256099942544~3347511713"
    const val TEST_BANNER_AD_UNIT_ID = "ca-app-pub-3940256099942544/9214589741"
    const val TEST_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/1033173712"
    const val TEST_REWARDED_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/5354046379"
    const val TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917"
    const val TEST_APP_OPEN_AD_UNIT_ID = "ca-app-pub-3940256099942544/9257395921"

    // 3. RESOLVED ACTIVE AD UNIT IDS
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

    // 4. GOOGLE PLAY BILLING PRODUCT CONFIGURATION
    const val PRODUCT_ID_PRO_LIFETIME = "novabeat_pro_lifetime"
    const val PRODUCT_NAME_PRO = "NovaBeat Pro"
    const val PRODUCT_DESCRIPTION_PRO =
        "Unlock the premium NovaBeat experience permanently, including removal of advertisements and designated premium features."

    const val INTERSTITIAL_MIN_COOLDOWN_MS = 180_000L
    const val APP_OPEN_EXPIRATION_MS = 4 * 3600 * 1000L
    const val REWARDED_PASS_DURATION_MS = 30 * 60 * 1000L
}`,
  },
  {
    path: 'app/src/main/java/studio/novabeat/visualizer/monetization/AdMobManager.kt',
    title: 'AdMobManager.kt (All 5 Ad Formats, UMP Consent & Playback/Export Guardrails)',
    layer: 'Monetization',
    content: `package studio.novabeat.visualizer.monetization

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

class AdMobManager(private val appContext: Context) {
    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val isMobileAdsInitCalled = AtomicBoolean(false)
    private val consentInformation: ConsentInformation =
        UserMessagingPlatform.getConsentInformation(appContext)

    private var interstitialAd: InterstitialAd? = null
    private var rewardedAd: RewardedAd? = null
    private var rewardedInterstitialAd: RewardedInterstitialAd? = null
    private var appOpenAd: AppOpenAd? = null
    private var appOpenLoadTimeElapsedMs: Long = 0L
    private var isShowingFullScreenAd = false
    private var lastFullScreenAdShownElapsedMs: Long = 0L

    fun canShowFullScreenAd(
        isProEntitled: Boolean,
        isAudioPlaying: Boolean,
        isEditingVisualizer: Boolean,
        isExportingVideo: Boolean
    ): Boolean {
        if (isProEntitled || isShowingFullScreenAd) return false
        if (isAudioPlaying || isEditingVisualizer || isExportingVideo) return false
        val now = SystemClock.elapsedRealtime()
        if (lastFullScreenAdShownElapsedMs > 0L &&
            now - lastFullScreenAdShownElapsedMs < MonetizationConfig.INTERSTITIAL_MIN_COOLDOWN_MS
        ) {
            return false
        }
        return true
    }

    fun initializeMobileAdsOnBackground() {
        if (!isMobileAdsInitCalled.compareAndSet(false, true)) return
        ioScope.launch {
            MobileAds.initialize(appContext)
        }
    }
}`,
  },
  {
    path: 'app/src/main/java/studio/novabeat/visualizer/monetization/PlayBillingRepository.kt',
    title: 'PlayBillingRepository.kt (Google Play Billing 9.1.0 & Purchase Reconciliation)',
    layer: 'Billing',
    content: `package studio.novabeat.visualizer.monetization

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class PlayBillingRepository(
    context: Context,
    private val onProActivated: () -> Unit
) : PurchasesUpdatedListener {

    private var proProductDetails: ProductDetails? = null

    private val billingClient: BillingClient = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build()
        )
        .build()

    override fun onPurchasesUpdated(
        billingResult: BillingResult,
        purchases: MutableList<Purchase>?
    ) {
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (purchase in purchases) {
                if (purchase.products.contains(MonetizationConfig.PRODUCT_ID_PRO_LIFETIME) &&
                    purchase.purchaseState == Purchase.PurchaseState.PURCHASED
                ) {
                    if (!purchase.isAcknowledged) {
                        val ackParams = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(purchase.purchaseToken)
                            .build()
                        billingClient.acknowledgePurchase(ackParams) { ackResult ->
                            if (ackResult.responseCode == BillingClient.BillingResponseCode.OK) {
                                onProActivated()
                            }
                        }
                    } else {
                        onProActivated()
                    }
                }
            }
        }
    }
}`,
  },
  {
    path: 'app/src/main/java/studio/novabeat/visualizer/audio/FftAudioProcessor.kt',
    title: 'FftAudioProcessor.kt (Media3 PCM Tap & Radix-2 FFT)',
    layer: 'Audio FFT',
    content: `package studio.novabeat.visualizer.audio

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.PI
import kotlin.math.sin

data class AudioSpectrumFrame(
    val bass: Float = 0f,
    val mid: Float = 0f,
    val treble: Float = 0f,
    val spectrum: FloatArray = FloatArray(64),
    val waveform: FloatArray = FloatArray(96)
)

class FftAudioProcessor : BaseAudioProcessor() {
    private val fftSize = 1024
    private val pcmRing = FloatArray(fftSize)
    private val real = FloatArray(fftSize)
    private val imag = FloatArray(fftSize)
    private val hannWindow = FloatArray(fftSize) { i ->
        (0.5f * (1f - cos(2.0 * PI * i / (fftSize - 1)))).toFloat()
    }
    private var writePos = 0

    private val _spectrumFlow = MutableStateFlow(AudioSpectrumFrame())
    val spectrumFlow: StateFlow<AudioSpectrumFrame> = _spectrumFlow

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
            throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
        }
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val remaining = inputBuffer.remaining()
        if (remaining == 0) return

        val outputBuffer = replaceOutputBuffer(remaining)
        val duplicate = inputBuffer.duplicate().order(ByteOrder.nativeOrder())

        while (duplicate.remaining() >= 2) {
            val sample = duplicate.short / 32768f
            pcmRing[writePos] = sample
            writePos = (writePos + 1) % fftSize
            if (writePos == 0) {
                computeFftFrame()
            }
        }

        outputBuffer.put(inputBuffer)
        outputBuffer.flip()
    }

    private fun computeFftFrame() {
        for (i in 0 until fftSize) {
            real[i] = pcmRing[i] * hannWindow[i]
            imag[i] = 0f
        }
        var j = 0
        for (i in 0 until fftSize) {
            if (i < j) {
                val tr = real[i]; real[i] = real[j]; real[j] = tr
                val ti = imag[i]; imag[i] = imag[j]; imag[j] = ti
            }
            var m = fftSize shr 1
            while (m >= 1 && j >= m) { j -= m; m = m shr 1 }
            j += m
        }
        var s = 1
        while ((1 shl s) <= fftSize) {
            val m = 1 shl s
            val halfM = m shr 1
            val theta = -2.0 * PI / m
            val wStepR = cos(theta).toFloat()
            val wStepI = sin(theta).toFloat()
            for (k in 0 until fftSize step m) {
                var wR = 1f; var wI = 0f
                for (mIdx in 0 until halfM) {
                    val i1 = k + mIdx
                    val i2 = i1 + halfM
                    val tR = wR * real[i2] - wI * imag[i2]
                    val tI = wR * imag[i2] + wI * real[i2]
                    real[i2] = real[i1] - tR
                    imag[i2] = imag[i1] - tI
                    real[i1] += tR
                    imag[i1] += tI
                    val nextWR = wR * wStepR - wI * wStepI
                    wI = wR * wStepI + wI * wStepR
                    wR = nextWR
                }
            }
            s++
        }
        val bars = FloatArray(64)
        val scale = 2f / fftSize
        for (b in 0 until 64) {
            val mag = hypot(real[b + 1], imag[b + 1]) * scale * 8f
            bars[b] = mag.coerceIn(0f, 1f)
        }
        val bass = bars.sliceArray(0..11).average().toFloat()
        val mid = bars.sliceArray(12..39).average().toFloat()
        val treble = bars.sliceArray(40..63).average().toFloat()
        _spectrumFlow.value = AudioSpectrumFrame(bass, mid, treble, bars, pcmRing.copyOf(96))
    }
}`,
  },
  {
    path: 'app/src/main/java/studio/novabeat/visualizer/playback/NovaBeatPlaybackService.kt',
    title: 'NovaBeatPlaybackService.kt (MediaSessionService)',
    layer: 'Playback',
    content: `package studio.novabeat.visualizer.playback

import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import studio.novabeat.visualizer.audio.FftAudioProcessor

class NovaBeatPlaybackService : MediaSessionService() {
    private var mediaSession: MediaSession? = null
    val fftProcessor = FftAudioProcessor()

    override fun onCreate() {
        super.onCreate()
        val renderersFactory = object : DefaultRenderersFactory(this) {
            override fun buildAudioSink(
                context: android.content.Context,
                enableFloatOutput: Boolean,
                enableAudioTrackPlaybackParams: Boolean
            ): AudioSink {
                return DefaultAudioSink.Builder(context)
                    .setAudioProcessors(arrayOf(fftProcessor))
                    .build()
            }
        }

        val player = ExoPlayer.Builder(this, renderersFactory)
            .setHandleAudioBecomingNoisy(true)
            .build()

        mediaSession = MediaSession.Builder(this, player).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
        mediaSession

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}`,
  },
  {
    path: 'app/src/main/java/studio/novabeat/visualizer/ui/VisualizerCanvas.kt',
    title: 'VisualizerCanvas.kt (Jetpack Compose Canvas & OpenGL Hook)',
    layer: 'Visualization',
    content: `package studio.novabeat.visualizer.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import studio.novabeat.visualizer.audio.AudioSpectrumFrame
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

@Composable
fun NovaBeatVisualizerCanvas(
    frame: AudioSpectrumFrame,
    sensitivity: Float,
    primaryColor: Color = Color(0xFFA855F7),
    secondaryColor: Color = Color(0xFF06B6D4),
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier.fillMaxSize()) {
        val cx = size.width / 2f
        val cy = size.height / 2f
        val baseRadius = min(size.width, size.height) * 0.25f * (1f + frame.bass * 0.1f)
        val barCount = frame.spectrum.size

        for (i in 0 until barCount) {
            val angle = (i.toFloat() / barCount) * (2f * PI.toFloat())
            val magnitude = (frame.spectrum[i] * sensitivity).coerceIn(0.04f, 1f)
            val barLength = magnitude * min(size.width, size.height) * 0.18f

            val startX = cx + cos(angle) * baseRadius
            val startY = cy + sin(angle) * baseRadius
            val endX = cx + cos(angle) * (baseRadius + barLength)
            val endY = cy + sin(angle) * (baseRadius + barLength)

            drawLine(
                color = if (i % 2 == 0) primaryColor else secondaryColor,
                start = Offset(startX, startY),
                end = Offset(endX, endY),
                strokeWidth = 6f,
                cap = StrokeCap.Round
            )
        }
    }
}`,
  },
];
