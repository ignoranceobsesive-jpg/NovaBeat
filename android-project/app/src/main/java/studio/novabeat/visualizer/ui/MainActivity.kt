package studio.novabeat.visualizer.ui

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import studio.novabeat.visualizer.audio.AudioSpectrumFrame
import studio.novabeat.visualizer.monetization.AdMobManager
import studio.novabeat.visualizer.monetization.MonetizationConfig
import studio.novabeat.visualizer.monetization.PlayBillingRepository

class MainActivity : ComponentActivity() {

    private lateinit var adMobManager: AdMobManager
    private lateinit var billingRepository: PlayBillingRepository

    private var isAudioPlaying: Boolean = false
    private var isEditingVisualizer: Boolean = false
    private var isExportingVideo: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val legalPrefs = getSharedPreferences("novabeat_legal_prefs", Context.MODE_PRIVATE)
        val initialAcceptedEula = legalPrefs.getString("accepted_eula_version", null)
        val isInitialEulaCurrent =
            initialAcceptedEula == MonetizationConfig.CURRENT_EULA_VERSION

        adMobManager = AdMobManager(applicationContext)
        adMobManager.setOnboardingStatus(
            isEulaAccepted = isInitialEulaCurrent,
            isFirstLaunchSessionBeforeOnboardingComplete = !isInitialEulaCurrent
        )

        billingRepository = PlayBillingRepository(
            context = applicationContext,
            onProActivated = {
                // Immediately disable & destroy all advertisements upon Pro activation
                adMobManager.destroyAllAds()
            }
        )

        // Connect to Google Play Billing 9.1.0 and reconcile `novabeat_pro_lifetime`
        billingRepository.startConnectionAndReconcile()

        // Only request UMP consent and initialize MobileAds on startup if the current EULA
        // has already been accepted on a previous launch.
        if (isInitialEulaCurrent) {
            adMobManager.gatherConsentAndInitialize(
                activity = this,
                isEulaAccepted = true,
                isProEntitled = billingRepository.entitlement.value.isProEntitled
            )
        }

        setContent {
            val entitlement by billingRepository.entitlement.collectAsState()
            val adState by adMobManager.state.collectAsState()

            var acceptedEulaVersion by remember { mutableStateOf(initialAcceptedEula) }
            var activeLegalDoc by remember { mutableStateOf<String?>(null) }

            val isEulaRequired =
                acceptedEulaVersion != MonetizationConfig.CURRENT_EULA_VERSION

            Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                NovaBeatVisualizerCanvas(
                    frame = AudioSpectrumFrame(),
                    sensitivity = 0.7f,
                    modifier = Modifier.weight(1f)
                )

                NovaBeatProUpgradeCard(
                    entitlement = entitlement,
                    privacyOptionsRequired = adState.privacyOptionsRequired,
                    onPurchaseClick = {
                        adMobManager.recordUserAction()
                        billingRepository.launchProPurchaseFlow(this@MainActivity)
                    },
                    onRestoreClick = {
                        adMobManager.recordUserAction()
                        billingRepository.reconcilePurchasesWithGooglePlay()
                    },
                    onOpenPrivacyOptions = {
                        adMobManager.showPrivacyOptionsForm(this@MainActivity) {}
                    },
                    onOpenEulaClick = { activeLegalDoc = "eula" },
                    onOpenPrivacyPolicyClick = { activeLegalDoc = "privacy" }
                )

                NovaBeatAdaptiveBannerAd(
                    isEulaAccepted = !isEulaRequired,
                    isProEntitled = entitlement.isProEntitled,
                    canRequestAds = adState.canRequestAds,
                    isExportingVideo = isExportingVideo,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            if (isEulaRequired) {
                NovaBeatFirstLaunchEulaDialog(
                    requiredVersion = MonetizationConfig.CURRENT_EULA_VERSION,
                    previousAcceptedVersion = acceptedEulaVersion,
                    onAcceptEula = {
                        legalPrefs.edit()
                            .putString("accepted_eula_version", MonetizationConfig.CURRENT_EULA_VERSION)
                            .putLong("accepted_eula_at_epoch_ms", System.currentTimeMillis())
                            .apply()
                        acceptedEulaVersion = MonetizationConfig.CURRENT_EULA_VERSION

                        // Trigger separate Google UMP consent flow AFTER EULA acceptance
                        adMobManager.gatherConsentAndInitialize(
                            activity = this@MainActivity,
                            isEulaAccepted = true,
                            isProEntitled = entitlement.isProEntitled
                        )
                    },
                    onOpenPrivacyPolicy = {
                        activeLegalDoc = "privacy"
                    }
                )
            }

            NovaBeatLegalDocumentDialog(
                documentType = activeLegalDoc,
                onDismiss = { activeLegalDoc = null }
            )
        }
    }

    override fun onResume() {
        super.onResume()
        val legalPrefs = getSharedPreferences("novabeat_legal_prefs", Context.MODE_PRIVATE)
        val isEulaCurrent =
            legalPrefs.getString("accepted_eula_version", null) ==
                MonetizationConfig.CURRENT_EULA_VERSION

        // Reconcile Pro entitlement with Google Play on every foreground resume
        billingRepository.reconcilePurchasesWithGooglePlay { isPro ->
            if (!isPro && isEulaCurrent) {
                adMobManager.showAppOpenIfAppropriate(
                    activity = this,
                    isProEntitled = false,
                    isAudioPlaying = isAudioPlaying,
                    isEditingVisualizer = isEditingVisualizer,
                    isExportingVideo = isExportingVideo
                )
            }
        }
    }

    override fun onDestroy() {
        billingRepository.endConnection()
        super.onDestroy()
    }
}
