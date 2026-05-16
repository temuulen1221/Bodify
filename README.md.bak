# Bodify

Bodify is an Expo and React Native fitness app with activity tracking, guided workouts, achievements, social screens, and an AI-enabled avatar experience. This repository contains the main mobile and web app, Firebase Functions used by backend-assisted features, and a separate CharacterStudio subproject used for avatar-related work.

## Repository layout

- `app/`: Expo Router routes and screens
- `components/`: shared UI, charts, avatar components, and hooks
- `services/`: Firebase, AI, maps, storage, permissions, and API integrations
- `assets/`: fonts, images, sounds, animations, and avatar models
- `functions/`: Firebase Functions project
- `CharacterStudio/`: separate Vite-based avatar tooling project bundled in this repo
- `tests/`: automated tests for the main app

## Requirements

- Node.js 20 or newer recommended
- npm 10 or newer recommended
- Expo CLI available through `npx`
- Android Studio for Android emulator workflows
- Xcode only if you plan to run iOS locally on macOS

## Quick start

1. Install dependencies at the repository root.

```powershell
npm install
```

2. Copy the example environment file and fill in the values you need.

```powershell
Copy-Item .env.example .env
```

3. Start Expo.

```powershell
npm run start
```

4. For the browser build, use:

```powershell
npm run web
```

## Environment variables

The root app expects configuration in `.env`. Start from `.env.example`.

- `EXPO_PUBLIC_GEMINI_API_KEY`: optional client-side Gemini access for web-only or fallback flows
- `EXPO_PUBLIC_USE_DIRECT_GEMINI_FALLBACK`: set to `true` only if you intentionally want client-side fallback behavior
- `EXPO_PUBLIC_FUNCTIONS_REGION`: Firebase Functions region
- `EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST`: local emulator hostname for web development
- `EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT`: local emulator port
- `SPOONACULAR_API_KEY`: required for diet features
- `EXERCISEDB_API_KEY`: required for exercise catalog features
- `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`: required for Strava integration
- `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY`: recommended for web maps
- `GOOGLE_MAPS_ANDROID_API_KEY`: recommended for Android maps

Do not commit `.env` or any service-account credentials.

## Scripts

Main app scripts from `package.json`:

- `npm run start`: start Expo
- `npm run web`: start Expo web
- `npm run android`: run Android build via Expo
- `npm run ios`: run iOS build via Expo on macOS
- `npm run lint`: run Expo lint
- `npm test`: run Jest
- `npm run tts:proxy`: run the local TTS proxy script
- `npm run install-icons`: update icon assets

Firebase Functions commands live in `functions/package.json`. CharacterStudio has its own scripts in `CharacterStudio/package.json`.

## Working with subprojects

This repository is not a single-package app only.

- The root `package.json` is the main Bodify app.
- `functions/` is a separate Firebase Functions package.
- `CharacterStudio/` is a separate Vite project with its own lockfile and dependencies.

If you clone the repo and need those subprojects, install dependencies in each relevant directory.

## Notes for contributors

- The app uses Expo Router with file-based routes under `app/`.
- The Android native folder is checked in.
- Generated folders such as `node_modules/`, `.expo/`, and `dist/` are intentionally ignored.
- Firebase client config in the app is public client configuration, not a server secret.

## Current status

This repository is under active development. Before a public push, verify the working tree only contains intentional changes and confirm all required API keys and OAuth settings are documented for other developers.

## Related docs

- `ROADMAP.md`

## License

No license file is included yet. If you plan to publish this repository publicly, add the license you want before inviting outside use or contribution.
