<p align="center">
  <img src="assets/icons/icon/icon/android/mipmap-xxxhdpi/ic_launcher_foreground.png" alt="Bodify app icon" width="200" />
</p>

<h1 align="center">Bodify</h1>

<p align="center">
  <strong>Avatar-first fitness for iOS, Android, and web.</strong><br/>
  Train with a reactive 3D coach, complete missions, and turn real workouts into game-like progression.
</p>

## Overview

**Bodify** is a gamified fitness app built with Expo and React Native. It combines workout tracking, an AI-powered avatar coach, progression systems, and social mechanics into a single cross-platform experience.

Instead of treating exercise like a static checklist, Bodify makes activity feel interactive: your avatar reacts to workouts, your stats evolve over time, and sessions feed into quests, XP, streaks, and rewards.

## Why Bodify?

- **Avatar-first experience** — a 3D VRM/FBX avatar guides, reacts, and reinforces progress.
- **AI-powered coaching** — Gemini-backed live coaching with voice support and gesture-aware responses.
- **Game-style progression** — XP, levels, streaks, badges, quests, unlocks, and rewards.
- **Multiple fitness modes** — guided reps, pose-aware workouts, and outdoor tracking for cardio activities.
- **Cross-platform architecture** — one app experience across iOS, Android, and web.

## Feature highlights

| Area | Highlights |
|---|---|
| **AI Avatar Coach** | Live Gemini-powered voice coaching, gesture inference, animated avatar states, reactive feedback |
| **Workouts** | Guided sessions, rep counting, squat/push-up pose detection, outdoor modes for running/cycling/hiking |
| **Activity Tracking** | Pedometer steps, GPS mapping, weekly/monthly charts, Strava integration |
| **Progression** | XP, levels, streaks, badge systems, reward loops |
| **Quests & Rewards** | Daily and weekly quests, unlock flows, reward modals, in-app shop concepts |
| **Social** | Leaderboards, user profiles, activity feed |
| **Diet** | Meal lookup and nutrition tracking via Spoonacular |
| **Exercise Catalog** | Searchable exercise database powered by ExerciseDB / RapidAPI |
| **Battle Replay** | Replay workout sessions as battle-style animations |

## Tech stack

- **Expo SDK 52** with **Expo Router**
- **React Native**, **React 19**, **TypeScript**
- **Redux Toolkit** for state management
- **Firebase** for Auth, Firestore, Functions, and Storage
- **Google Gemini** via Live API and Functions proxy
- **Three.js** + **@pixiv/three-vrm** for 3D avatars
- **CharacterStudio** as an embedded Vite-based avatar customization subproject

## Repository structure

```text
app/                   Expo Router screens and routes
components/            Shared UI, charts, avatar components, hooks
services/              Firebase, AI, sensors, maps, and API clients
utils/                 Pure helpers for gamification, pose, and workout logic
hooks/                 Custom React hooks
screens/               Legacy screen components being migrated to app/
functions/             Firebase Functions subproject
CharacterStudio/       Vite-based avatar tooling subproject
assets/                Fonts, images, sounds, animations, VRM/FBX models
tests/                 Jest test suites
```

## Getting started

### Prerequisites

Make sure you have:

- **Node.js 20+**
- **npm 10+**
- **Android Studio** for Android emulation
- **Xcode** for iOS simulation on macOS
- **Expo CLI** available through `npx expo`

### Installation

```bash
npm install
```

### Environment setup

```bash
cp .env.example .env
```

Then fill in the values you need for the services you plan to use.

### Run locally

```bash
npm run start
npm run web
npm run android
npm run ios
```

## Environment variables

Copy `.env.example` to `.env` and configure the keys relevant to your setup.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_GEMINI_API_KEY` | Web/fallback Gemini access |
| `EXPO_PUBLIC_FUNCTIONS_REGION` | Firebase Functions region |
| `EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST/PORT` | Local Functions emulator |
| `SPOONACULAR_API_KEY` | Meal and diet search |
| `EXERCISEDB_API_KEY` | Exercise catalog via RapidAPI |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava OAuth and sync |
| `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` | Web maps |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Android maps |

> Never commit `.env` files, OAuth secrets, or service-account credentials.

## Available scripts

| Command | Description |
|---|---|
| `npm run start` | Start the Expo dev server |
| `npm run web` | Run the web app locally |
| `npm run android` | Launch Android build |
| `npm run ios` | Launch iOS build on macOS |
| `npm run lint` | Run lint checks |
| `npm test` | Run the Jest test suite |
| `npm run tts:proxy` | Start the local TTS proxy |
| `npm run install-icons` | Refresh icon assets |

### Subproject scripts

```bash
# Firebase Functions
cd functions && npm run serve
cd functions && npm run deploy

# CharacterStudio
cd CharacterStudio && npm run dev
cd CharacterStudio && npm test
```

## Testing

Bodify uses **Jest + ts-jest** with `react-test-renderer` for UI-focused tests in a Node environment.

```bash
npm test
npx jest --no-coverage --testPathPattern="store"
npx jest --no-coverage --verbose
```

### Covered areas

| Suite | Tests |
|---|---|
| Redux store (slices, thunks, selectors) | 46 |
| Avatar / workout helpers | 52 |
| Badge system | 32 |
| Level accent | 27 |
| Battle script | 27 |
| Workout session | 27 |
| Gamification / XP calculations | ~20 |
| API clients (diet, ExerciseDB) | 24 |
| UI render (GoogleLogo, BackButton, StepsWidget) | 18 |

## Integrations

| Provider | Status |
|---|---|
| Strava | Live — OAuth + activity sync |
| Garmin | Placeholder UI |
| Fitbit | Placeholder UI |
| Apple Health | Placeholder UI |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commit style, and PR expectations.

Before opening a PR:

- Run `npm test`
- Run `npm run lint`
- Follow Expo Router conventions under `app/`
- Do not delete the checked-in `android/` native folder

Additional notes:

- `node_modules/`, `.expo/`, `dist/`, and `android/app/build/` are gitignored.
- Firebase client configuration is public client-side config, not a secret.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the longer-term product and engineering plan.

### Near-term focus

- Home loop rebuild with daily missions and stronger AI-led calls to action
- Avatar cosmetic unlocks and relationship progression
- Guided workouts with avatar-led countdowns and post-workout recaps
- AI coach memory, caching, and fallback hardening

## License

MIT
