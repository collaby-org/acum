# ACUM TV — Android TV WebView Wrapper

A minimal Android TV APK for Sony/TCL (and other Leanback-certified) TVs that
wraps the ACUM TV web app in a WebView.

## Project structure

```
android-tv/
├── build.gradle
├── settings.gradle
├── gradle/wrapper/gradle-wrapper.properties
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/collaby/acumtv/MainActivity.kt
│       └── res/
│           ├── drawable-xhdpi/banner.png          (320x180 leanback banner)
│           ├── mipmap-anydpi-v26/ic_launcher.xml   (adaptive icon)
│           ├── drawable/ic_launcher_background.xml
│           ├── drawable/ic_launcher_foreground.xml
│           ├── values/strings.xml
│           ├── values/colors.xml
│           └── xml/network_security_config.xml
└── README.md
```

## Prerequisites

- Android SDK with NDK, build-tools, platform-tools, and a recent build-tools
  version installed.
- An Android device/emulator running Android TV (API 21+), or a physical
  Sony/TCL Android TV for testing.
- Java JDK (JDK 17 recommended for AGP 8.x).

> `./gradlew` is not pre-bundled. Generate the Gradle wrapper once Gradle is
> installed, then it will download the Gradle distribution automatically:
> `gradle wrapper` (or let Android Studio generate it).

## Build

```bash
cd android-tv
./gradlew assembleRelease
```

The release APK is produced at:

```
app/build/outputs/apk/release/app-release.apk
```

## Install

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

Launch "ACUM TV" from the Android TV home screen (Leanback launcher).

## Store publishing

- Publish via the **Google Play Console**.
- One-time developer fee: **$25**.
- Because `android.software.leanback` is declared `required="true"`, the app
  will only be discoverable on Android TV / Google TV devices.

## Important: WebView URL

Open `app/src/main/java/com/collaby/acumtv/MainActivity.kt` and update
`webViewUrl` to your actual Vercel deployment URL before building:

```kotlin
private val webViewUrl = "https://acum.vercel.app/tv"
```

The placeholder above points at `https://acum.vercel.app/tv` — replace it
with your real deployment (e.g. `https://acum-yourname.vercel.app/tv`).

`network-security-config.xml` permits cleartext traffic for
`acum.vercel.app` (subdomains included) for development. Serve over HTTPS and
drop cleartext in production.

## Controls

- D-pad / remote directional keys are forwarded to the WebView so the web app
  can handle them via JavaScript keyboard events.
- BACK navigates back in WebView history; if there is no history, the app
  returns to the TV home screen.

## License

See the repository LICENSE file.
