package studio.novabeat.visualizer.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.LoadAdError
import studio.novabeat.visualizer.monetization.MonetizationConfig
import studio.novabeat.visualizer.monetization.ProEntitlementState

data class LegalSectionItem(val heading: String, val body: String)

val NOVABEAT_ANDROID_EULA_SECTIONS = listOf(
    LegalSectionItem(
        "1. Scope of License & Agreement",
        "This End-User License Agreement (\"Agreement\") is a binding legal contract between you and NovaBeat Studio (\"NovaBeat\") for the use of the NovaBeat audio player, real-time FFT spectrum visualizer, multi-layer visual editor, and video export software."
    ),
    LegalSectionItem(
        "2. Personal Media, Audio & Artwork Responsibility",
        "You retain full ownership of your personal audio files and custom images and represent that you hold all necessary rights or permissions for any media you process or export using NovaBeat."
    ),
    LegalSectionItem(
        "3. Audio-Visual Output & Video Export Usage",
        "Procedural spectrum animations and visualizer presets rendered by NovaBeat may be exported as MP4 or WebM videos subject to applicable copyright laws."
    ),
    LegalSectionItem(
        "4. Free Ad-Supported Tier & NovaBeat Pro Lifetime License",
        "NovaBeat is offered as a free ad-supported edition and an optional one-time \"NovaBeat Pro\" lifetime upgrade processed through Google Play Billing. Purchasing NovaBeat Pro permanently disables all advertisements."
    ),
    LegalSectionItem(
        "5. Advertising & Privacy Separation",
        "Acceptance of this EULA governs software licensing only and does NOT constitute consent to personalized advertising tracking. Advertising privacy choices are managed separately via Google UMP."
    ),
    LegalSectionItem(
        "6. Disclaimer of Warranties & Photosensitivity Notice",
        "THE APPLICATION IS PROVIDED \"AS IS\". Audio-reactive visualizers produce rapid, high-contrast rhythmic light patterns that may affect photosensitive individuals."
    )
)

val NOVABEAT_ANDROID_PRIVACY_SECTIONS = listOf(
    LegalSectionItem(
        "1. Local-First Audio & Visual Processing",
        "NovaBeat processes your local audio files, PCM waveform samples, and FFT frequency spectra directly on your device."
    ),
    LegalSectionItem(
        "2. Google User Messaging Platform (UMP) & AdMob",
        "In the free tier, NovaBeat integrates Google AdMob and requests advertising consent separately through Google’s User Messaging Platform (UMP SDK 3.1.0)."
    ),
    LegalSectionItem(
        "3. Google Play Billing & Entitlement Verification",
        "One-time purchases of \"NovaBeat Pro\" (novabeat_pro_lifetime) are processed by Google Play Billing Library 9.1.0."
    ),
    LegalSectionItem(
        "4. Managing Your Privacy Choices",
        "You can review or update your advertising consent preferences at any time from Settings → Manage Ad Privacy Options (UMP)."
    )
)

/**
 * First-Launch Legal & Privacy Onboarding Dialog (EULA).
 * Shown before entering the main application on fresh installs or after a material EULA update.
 * Strictly decoupled from UMP advertising consent.
 */
@Composable
fun NovaBeatFirstLaunchEulaDialog(
    requiredVersion: String,
    previousAcceptedVersion: String?,
    onAcceptEula: () -> Unit,
    onOpenPrivacyPolicy: () -> Unit
) {
    var showFullEula by remember { mutableStateOf(false) }
    val isMaterialUpdate =
        !previousAcceptedVersion.isNullOrBlank() && previousAcceptedVersion != requiredVersion

    Dialog(
        onDismissRequest = { /* Mandatory EULA onboarding cannot be dismissed without accepting */ },
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false,
            usePlatformDefaultWidth = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(24.dp),
            color = Color(0xFF0E0920)
        ) {
            Column(
                modifier = Modifier
                    .border(1.dp, Color(0x66A855F7), RoundedCornerShape(24.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "NovaBeat",
                            color = Color.White,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Music Player · FFT Visualizer · Video Studio",
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp
                        )
                    }
                    Text(
                        text = "EULA v$requiredVersion",
                        color = Color(0xFFD8B4FE),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                if (isMaterialUpdate) {
                    Text(
                        text = "Updated End-User License Agreement (v$previousAcceptedVersion → v$requiredVersion). Please review and accept the updated terms to continue.",
                        color = Color(0xFFFDE68A),
                        fontSize = 12.sp
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "End-User License Agreement",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    TextButton(onClick = { showFullEula = !showFullEula }) {
                        Text(
                            text = if (showFullEula) "Hide Complete EULA" else "Read Complete EULA",
                            color = Color(0xFF67E8F9),
                            fontSize = 12.sp
                        )
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 240.dp)
                        .background(Color(0xFF080512), RoundedCornerShape(14.dp))
                        .border(1.dp, Color(0x33A855F7), RoundedCornerShape(14.dp))
                        .padding(12.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (showFullEula) {
                        NOVABEAT_ANDROID_EULA_SECTIONS.forEach { section ->
                            Text(
                                text = section.heading,
                                color = Color(0xFFDDD6FE),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = section.body,
                                color = Color(0xFFCBD5E1),
                                fontSize = 12.sp
                            )
                        }
                    } else {
                        Text(
                            text = "• Personal Media Ownership: You retain all rights to your local audio files and personal artwork imported into NovaBeat.\n" +
                                "• Video Exports & Visualizers: Procedural FFT spectrum animations may be exported as MP4 or WebM videos.\n" +
                                "• Photosensitivity Notice: Audio-reactive visualizers produce dynamic high-contrast light patterns.\n" +
                                "• Separate Advertising Consent: Accepting this EULA does not grant advertising tracking consent (managed separately via Google UMP).",
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Review how local audio, Play Billing & UMP privacy work:",
                        color = Color(0xFF94A3B8),
                        fontSize = 11.sp,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedButton(onClick = onOpenPrivacyPolicy) {
                        Text("Privacy Policy", fontSize = 12.sp)
                    }
                }

                Button(
                    onClick = onAcceptEula,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Agree and Continue",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

/**
 * Full-Text EULA and Privacy Policy Dialog accessible from Onboarding and Settings.
 */
@Composable
fun NovaBeatLegalDocumentDialog(
    documentType: String?,
    onDismiss: () -> Unit
) {
    if (documentType == null) return
    val isEula = documentType == "eula"
    val sections = if (isEula) NOVABEAT_ANDROID_EULA_SECTIONS else NOVABEAT_ANDROID_PRIVACY_SECTIONS

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            shape = RoundedCornerShape(20.dp),
            color = Color(0xFF110B22)
        ) {
            Column(
                modifier = Modifier
                    .border(1.dp, Color(0x55A855F7), RoundedCornerShape(20.dp))
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = if (isEula) {
                        "NovaBeat End-User License Agreement (v${MonetizationConfig.CURRENT_EULA_VERSION})"
                    } else {
                        "NovaBeat Privacy Policy & UMP Notice"
                    },
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 320.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    sections.forEach { section ->
                        Text(
                            text = section.heading,
                            color = Color(0xFFDDD6FE),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = section.body,
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp
                        )
                    }
                }

                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Close Document")
                }
            }
        }
    }
}

/**
 * Adaptive AdMob Banner bar displayed in non-disruptive sections (Music Library & Home).
 * Uses Anchored Adaptive Banner sizing and hides automatically for Pro users, before EULA/UMP consent,
 * during video export, or if ad loading fails.
 */
@Composable
fun NovaBeatAdaptiveBannerAd(
    isEulaAccepted: Boolean,
    isProEntitled: Boolean,
    canRequestAds: Boolean,
    isExportingVideo: Boolean = false,
    modifier: Modifier = Modifier
) {
    var bannerFailed by remember { mutableStateOf(false) }

    if (!isEulaAccepted || isProEntitled || !canRequestAds || isExportingVideo || bannerFailed) {
        return
    }

    val configuration = LocalConfiguration.current
    val adWidthDp = configuration.screenWidthDp.coerceAtLeast(320)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF0B0719), RoundedCornerShape(12.dp))
            .border(1.dp, Color(0x33A855F7), RoundedCornerShape(12.dp))
            .padding(vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        AndroidView(
            factory = { context ->
                AdView(context).apply {
                    setAdSize(
                        AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(
                            context,
                            adWidthDp
                        )
                    )
                    adUnitId = MonetizationConfig.bannerAdUnitId
                    adListener = object : AdListener() {
                        override fun onAdLoaded() {
                            bannerFailed = false
                        }

                        override fun onAdFailedToLoad(error: LoadAdError) {
                            bannerFailed = true
                        }
                    }
                    loadAd(AdRequest.Builder().build())
                }
            }
        )
    }
}

/**
 * NovaBeat Pro Lifetime (`novabeat_pro_lifetime`) Upgrade Card, Restore Purchases & Legal Links Sheet.
 */
@Composable
fun NovaBeatProUpgradeCard(
    entitlement: ProEntitlementState,
    privacyOptionsRequired: Boolean,
    onPurchaseClick: () -> Unit,
    onRestoreClick: () -> Unit,
    onOpenPrivacyOptions: () -> Unit,
    onOpenEulaClick: () -> Unit = {},
    onOpenPrivacyPolicyClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF110B22), RoundedCornerShape(16.dp))
            .border(1.dp, Color(0x55A855F7), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = entitlement.productTitle,
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = if (entitlement.isProEntitled) "UNLOCKED" else entitlement.localizedPrice,
                color = Color(0xFF22D3EE),
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        Text(
            text = entitlement.productDescription,
            color = Color(0xFFCBD5E1),
            fontSize = 13.sp
        )

        entitlement.statusMessage?.let { msg ->
            Text(
                text = msg,
                color = if (entitlement.isProEntitled) Color(0xFF34D399) else Color(0xFFFBBF24),
                fontSize = 12.sp
            )
        }

        if (!entitlement.isProEntitled) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onPurchaseClick,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Upgrade to Pro (${entitlement.localizedPrice})")
                }
                OutlinedButton(onClick = onRestoreClick) {
                    Text("Restore Purchases")
                }
            }
        }

        if (privacyOptionsRequired) {
            OutlinedButton(
                onClick = onOpenPrivacyOptions,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Manage Ad Privacy & Consent Options (UMP)")
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = onOpenEulaClick,
                modifier = Modifier.weight(1f)
            ) {
                Text("Read EULA (v${MonetizationConfig.CURRENT_EULA_VERSION})", fontSize = 12.sp)
            }
            OutlinedButton(
                onClick = onOpenPrivacyPolicyClick,
                modifier = Modifier.weight(1f)
            ) {
                Text("Privacy Policy", fontSize = 12.sp)
            }
        }
    }
}
