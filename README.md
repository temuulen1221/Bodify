# Bodify

**Bodify** is an avatar-first fitness game for iOS, Android, and web — built with Expo and React Native. Your 3D avatar reacts to workouts, tracks your progress, and coaches you through missions powered by Google Gemini AI.

---

## Features

| Category | What's included |
|---|---|
| **AI Avatar Coach** | Live Gemini-powered voice coaching, gesture inference, animated VRM/FBX avatar with idle and reaction states |
| **Workouts** | Guided sessions with rep counting, pose detection (squat/push-up), outdoor modes for running, cycling, and hiking |
| **Activity Tracking** | Pedometer steps, GPS live map, weekly/monthly charts, Strava integration |
| **Progression** | XP, leveling, streak tracking, badge system across fitness categories |
| **Quests & Rewards** | Daily/weekly quests, badge unlocks, reward modals, shop |
| **Social** | Leaderboard, social profiles, activity feed |
| **Diet** | Meal search and tracking via Spoonacular API |
| **Exercise Catalog** | Search and browse exercises via ExerciseDB / RapidAPI |
| **Battle Replay** | Replay recorded workout sessions as battle animations |

---

## Tech stack

- **Expo SDK 52** · Expo Router (file-based routes) · React Native
- **React 19** · TypeScript · Redux Toolkit
- **Firebase** (Auth, Firestore, Functions, Storage)
- **Google Gemini** (Live API + Functions proxy)
- **Three.js / @pixiv/three-vrm** for 3D avatar rendering
- **CharacterStudio** — embedded Vite sub-project for avatar customisation

---

## Repository layout

```
app/                   Expo Router screens and routes
components/            Shared UI, charts, avatar components, hooks
services/              Firebase, AI, sensors, maps, API clients
utils/                 Pure helpers — gamification, pose, workout logic
hooks/                 Custom React hooks
screens/               Legacy screen components (being migrated to app/)
functions/             Firebase Functions (separate npm package)
CharacterStudio/       Vite-based avatar tooling (separate package)
assets/                Fonts, images, sounds, animations, VRM/FBX models
tests/                 Jest test suites (353 tests, 18 suites)
```

---

## Getting started

### Prerequisites

- **Node.js 20+** and **npm 10+**
- **Expo CLI** — available via `npx expo`
- **Android Studio** for Android emulator
- **Xcode** (macOS only) for iOS simulator

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
# then fill in the values — see Environment variables below
```

### Run

```bash
npm run start          # Expo dev server (scan QR for device)
npm run web            # Browser build at http://localhost:8081
npm run android        # Android emulator
npm run ios            # iOS simulator (macOS only)
```

---

## Environment variables

Copy `.env.example` to `.env` and supply the keys you need.

| Variable | Required for |
|---|---|
| `EXPO_PUBLIC_GEMINI_API_KEY` | Web/fallback Gemini access |
| `EXPO_PUBLIC_FUNCTIONS_REGION` | Firebase Functions region |
| `EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST/PORT` | Local Functions emulator |
| `SPOONACULAR_API_KEY` | Diet / meal search |
| `EXERCISEDB_API_KEY` | Exercise catalog (RapidAPI) |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava wearable sync |
| `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` | Web maps |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Android maps |

> **Never commit `.env` or any service-account / OAuth credentials.**

---

## Scripts

| Command | Description |
|---|---|
| `npm run start` | Start Expo dev server |
| `npm run web` | Start Expo web build |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS (macOS) |
| `npm run lint` | Expo lint |
| `npm test` | Run Jest (353 tests) |
| `npm run tts:proxy` | Start local TTS proxy server |
| `npm run install-icons` | Refresh icon assets |

### Subproject scripts

```bash
# Firebase Functions
cd functions && npm run serve      # local emulator
cd functions && npm run deploy     # deploy to Firebase

# CharacterStudio
cd CharacterStudio && npm run dev  # Vite dev server
cd CharacterStudio && npm test     # Vitest tests
```

---

## Testing

The test suite uses **Jest + ts-jest** with `react-test-renderer` for UI render tests. No DOM required — all tests run in a Node environment.

```bash
npm test                                          # all 353 tests
npx jest --no-coverage --testPathPattern="store"  # single suite
npx jest --no-coverage --verbose                  # with test names
```

**Coverage areas:**

| Suite | Tests |
|---|---|
| Redux store (slices, thunks, selectors) | 46 |
| Avatar / workout helpers | 52 |
| Badge system | 32 |
| Level accent | 27 |
| Battle script | 27 |
| Workout session | 27 |
| Gamification / XP calculations | ~20 |
| API clients (diet, exercisedb) | 24 |
| UI render (GoogleLogo, BackButton, StepsWidget) | 18 |

---

## Wearable integrations

| Provider | Status |
|---|---|
| Strava | Live — OAuth + activity sync |
| Garmin | UI placeholder (coming soon) |
| Fitbit | UI placeholder (coming soon) |
| Apple Health | UI placeholder (coming soon) |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch conventions, commit style, and PR guidelines.

- Routes live under `app/` using Expo Router file conventions.
- The Android native folder (`android/`) is checked in — do not delete it.
- `node_modules/`, `.expo/`, `dist/`, and `android/app/build/` are gitignored.
- Firebase client config is public client-side configuration, not a secret.
- Run `npm test` and `npm run lint` before opening a PR.

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full product and engineering plan.

**Near-term focus:**
- Home loop rebuild with daily missions and AI-framed CTA
- Avatar cosmetic unlocks and relationship progression
- Guided workout experience with avatar-led countdown and post-workout recap
- AI coach memory, caching, and fallback hardening

---

## License

MIT
