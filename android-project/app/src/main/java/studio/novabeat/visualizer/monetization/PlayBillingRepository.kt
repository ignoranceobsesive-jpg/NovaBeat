package studio.novabeat.visualizer.monetization

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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

enum class ProPurchaseStatus {
    NOT_PURCHASED,
    PENDING,
    PURCHASED,
    CANCELLED,
    ERROR
}

data class ProEntitlementState(
    val isConnected: Boolean = false,
    val isProEntitled: Boolean = false,
    val status: ProPurchaseStatus = ProPurchaseStatus.NOT_PURCHASED,
    val localizedPrice: String = "$9.99",
    val productTitle: String = MonetizationConfig.PRODUCT_NAME_PRO,
    val productDescription: String = MonetizationConfig.PRODUCT_DESCRIPTION_PRO,
    val purchaseToken: String? = null,
    val statusMessage: String? = null
)

/**
 * Official Google Play Billing Library 9.1.0 Repository for `novabeat_pro_lifetime`.
 * Persists verified entitlement in SharedPreferences for offline startup resilience,
 * while reconciling directly with Google Play whenever connected.
 * Never grants Pro access for PENDING or CANCELLED purchases.
 */
class PlayBillingRepository(
    context: Context,
    private val onProActivated: () -> Unit
) : PurchasesUpdatedListener {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val prefs =
        context.applicationContext.getSharedPreferences("novabeat_billing_prefs", Context.MODE_PRIVATE)
    private var proProductDetails: ProductDetails? = null

    private val initialCachedPro = prefs.getBoolean("verified_pro_entitled", false)
    private val initialCachedToken = prefs.getString("verified_purchase_token", null)

    private val _entitlement = MutableStateFlow(
        ProEntitlementState(
            isProEntitled = initialCachedPro,
            status = if (initialCachedPro) ProPurchaseStatus.PURCHASED else ProPurchaseStatus.NOT_PURCHASED,
            purchaseToken = initialCachedToken,
            statusMessage = if (initialCachedPro) {
                "NovaBeat Pro Lifetime active (offline cache)."
            } else {
                null
            }
        )
    )
    val entitlement: StateFlow<ProEntitlementState> = _entitlement

    private val billingClient: BillingClient = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build()
        )
        .build()

    init {
        if (initialCachedPro) {
            onProActivated()
        }
    }

    fun startConnectionAndReconcile() {
        if (billingClient.isReady) {
            queryProductDetails()
            reconcilePurchasesWithGooglePlay()
            return
        }
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    _entitlement.value = _entitlement.value.copy(isConnected = true)
                    queryProductDetails()
                    reconcilePurchasesWithGooglePlay()
                } else {
                    // Preserve cached verified Pro entitlement when Play Store is unreachable offline
                    _entitlement.value = _entitlement.value.copy(
                        isConnected = false,
                        statusMessage = "Google Play Billing unavailable (${result.debugMessage})."
                    )
                }
            }

            override fun onBillingServiceDisconnected() {
                _entitlement.value = _entitlement.value.copy(isConnected = false)
            }
        })
    }

    private fun queryProductDetails() {
        val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(MonetizationConfig.PRODUCT_ID_PRO_LIFETIME)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        )
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        billingClient.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                val details = productDetailsList.firstOrNull()
                proProductDetails = details
                val formattedPrice = details?.oneTimePurchaseOfferDetails?.formattedPrice ?: "$9.99"
                _entitlement.value = _entitlement.value.copy(
                    localizedPrice = formattedPrice,
                    productTitle = details?.name ?: MonetizationConfig.PRODUCT_NAME_PRO,
                    productDescription = details?.description ?: MonetizationConfig.PRODUCT_DESCRIPTION_PRO
                )
            }
        }
    }

    /**
     * Reconciles active ownership of `novabeat_pro_lifetime` directly with Google Play.
     * Called on startup, on activity resume, and when user taps "Restore Purchases".
     */
    fun reconcilePurchasesWithGooglePlay(onRestoredCallback: ((Boolean) -> Unit)? = null) {
        if (!billingClient.isReady) {
            startConnectionAndReconcile()
            onRestoredCallback?.invoke(_entitlement.value.isProEntitled)
            return
        }
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build()

        billingClient.queryPurchasesAsync(params) { billingResult, purchasesList ->
            if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                onRestoredCallback?.invoke(_entitlement.value.isProEntitled)
                return@queryPurchasesAsync
            }

            val matchingPurchase = purchasesList.firstOrNull { purchase ->
                purchase.products.contains(MonetizationConfig.PRODUCT_ID_PRO_LIFETIME)
            }

            if (matchingPurchase == null) {
                prefs.edit()
                    .putBoolean("verified_pro_entitled", false)
                    .remove("verified_purchase_token")
                    .apply()
                _entitlement.value = _entitlement.value.copy(
                    isProEntitled = false,
                    status = ProPurchaseStatus.NOT_PURCHASED,
                    purchaseToken = null
                )
                onRestoredCallback?.invoke(false)
                return@queryPurchasesAsync
            }

            handleVerifiedPurchaseObject(matchingPurchase, onRestoredCallback)
        }
    }

    fun launchProPurchaseFlow(activity: Activity) {
        val details = proProductDetails
        if (!billingClient.isReady || details == null) {
            _entitlement.value = _entitlement.value.copy(
                status = ProPurchaseStatus.ERROR,
                statusMessage = "Connecting to Google Play Store. Please try again in a moment."
            )
            startConnectionAndReconcile()
            return
        }

        val productDetailsParamsList = listOf(
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details)
                .build()
        )
        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(productDetailsParamsList)
            .build()

        billingClient.launchBillingFlow(activity, flowParams)
    }

    override fun onPurchasesUpdated(
        billingResult: BillingResult,
        purchases: MutableList<Purchase>?
    ) {
        when (billingResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                if (purchases.isNullOrEmpty()) return
                for (purchase in purchases) {
                    if (purchase.products.contains(MonetizationConfig.PRODUCT_ID_PRO_LIFETIME)) {
                        handleVerifiedPurchaseObject(purchase, null)
                    }
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                _entitlement.value = _entitlement.value.copy(
                    status = ProPurchaseStatus.CANCELLED,
                    statusMessage = "Purchase cancelled. No charges were made."
                )
            }
            else -> {
                _entitlement.value = _entitlement.value.copy(
                    status = ProPurchaseStatus.ERROR,
                    statusMessage = "Purchase failed (${billingResult.debugMessage})."
                )
            }
        }
    }

    private fun handleVerifiedPurchaseObject(
        purchase: Purchase,
        onRestoredCallback: ((Boolean) -> Unit)?
    ) {
        when (purchase.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> {
                if (!purchase.isAcknowledged) {
                    val ackParams = AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.purchaseToken)
                        .build()
                    scope.launch {
                        billingClient.acknowledgePurchase(ackParams) { ackResult ->
                            if (ackResult.responseCode == BillingClient.BillingResponseCode.OK) {
                                grantProEntitlement(purchase.purchaseToken)
                                onRestoredCallback?.invoke(true)
                            }
                        }
                    }
                } else {
                    grantProEntitlement(purchase.purchaseToken)
                    onRestoredCallback?.invoke(true)
                }
            }
            Purchase.PurchaseState.PENDING -> {
                // CRITICAL: Never grant Pro entitlement while payment is PENDING
                prefs.edit().putBoolean("verified_pro_entitled", false).apply()
                _entitlement.value = _entitlement.value.copy(
                    isProEntitled = false,
                    status = ProPurchaseStatus.PENDING,
                    purchaseToken = purchase.purchaseToken,
                    statusMessage = "Payment is pending confirmation from Google Play. Pro features will unlock automatically once completed."
                )
                onRestoredCallback?.invoke(false)
            }
            else -> {
                prefs.edit().putBoolean("verified_pro_entitled", false).apply()
                _entitlement.value = _entitlement.value.copy(
                    isProEntitled = false,
                    status = ProPurchaseStatus.NOT_PURCHASED
                )
                onRestoredCallback?.invoke(false)
            }
        }
    }

    private fun grantProEntitlement(token: String) {
        prefs.edit()
            .putBoolean("verified_pro_entitled", true)
            .putString("verified_purchase_token", token)
            .apply()
        _entitlement.value = _entitlement.value.copy(
            isProEntitled = true,
            status = ProPurchaseStatus.PURCHASED,
            purchaseToken = token,
            statusMessage = "NovaBeat Pro Lifetime unlocked! All advertisements have been permanently disabled."
        )
        onProActivated()
    }

    fun endConnection() {
        if (billingClient.isReady) {
            billingClient.endConnection()
        }
    }
}
