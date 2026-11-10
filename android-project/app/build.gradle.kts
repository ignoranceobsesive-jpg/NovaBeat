plugins {
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
}
