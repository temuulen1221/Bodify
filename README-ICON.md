Icon installation
=================

This project includes a set of app icons under `assets/icons/...` that need to be copied into the Android native resources and into `assets/images` for Expo.

To install the icons, run from the project root:

    npm run install-icons

What the script does:
- Copies PNGs from `assets/icons/icon/icon/android` into `android/app/src/main/res/mipmap-*` folders when available.
- Copies key images (launcher foreground/background) into `assets/images/` so Expo can pick them up.

After running the script, rebuild the Android app (Android Studio or `expo run:android` / EAS build) to see the new launcher icon.
