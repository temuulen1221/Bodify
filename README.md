# Bodify (Expo)

This repository contains Bodify — a cross-platform health & activity app built with Expo and React Native. Bodify helps users track daily activity on calendar, log workouts,meditation section, earn achievements, and interact with a personalized 3D avatar. The app combines native mobile features (sensors, camera, and optional wearable integrations) with social/competitive elements like leaderboards and rewards to motivate regular movement.

Key features include:

- Activity tracking and workout logging (steps, workouts, and sensor-based metrics)
- A customizable 3D avatar system using Three.js / VRM that reflects user selections 
  and can play simple animation clips
- Social features: leaderboards, achievements, and in-app rewards
- Integrations with Firebase for auth and data storage, ExerciseDB for exercise data, 
  Spoonacular for diet/recipes, and optional wearable device support
- Web support via `react-native-web` so parts of the app can run in a browser
- Calendar & scheduling (workout planner, reminders, sync with device calendar)
- Meditation & mindfulness sessions (guided sessions, timers, and progress tracking)
- Workout analysis and form feedback (pose detection for basic exercises)

## Quick start (Windows PowerShell)

1. Install dependencies

```powershell
npm install
```
2. Start the development server (Metro / Expo)

```powershell
npm run start
```
3. Open for web

```powershell
npm run web
```
Then open http://localhost:19006/avatar-web (Expo's default web URL) to see the dedicated VRM viewer.

Or run on Android/iOS emulators if configured:

```powershell
npm run android
npm run ios
```

Environment variables:

- Copy `.env.example` to `.env` and fill in your API keys (Spoonacular, ExerciseDB, Strava). Expo reads them via `app.config.js`.

Notes:
- This project uses file-based routing under the `app/` directory (Expo Router).
- If you need to reset the starter sample code, use `npm run reset-project`.

## Scripts

Key scripts from `package.json`:

- `npm run start` — start Expo dev server
- `npm run web` — start Expo for web (`expo start --web`)
- `npm run android` — run on Android device/emulator
- `npm run ios` — run on iOS simulator (macOS only)
- `npm run reset-project` — reset the `app` folder to starter example (see `scripts/reset-project.js`)
- `npm run lint` — run Expo linting
- `npm run install-icons` — installs or updates icon assets (see `scripts/install-icons.js`)

## Where to look

- `app/`: main routed screens and entry points
- `components/`: shared UI components, 3D avatar components (VrmAvatar.*, AvatarWeb.js)
- `app/avatar-web.tsx`: Expo Router screen that mounts AvatarWeb when running in the browser
- `assets/`: fonts, images, 3D models (`assets/models/*.glb`)
- `services/`: Firebase and other integrations
- `scripts/`: utility scripts used by the repo (reset, icon install, etc.)
- `android/`, `ios/`: native projects (Android present; iOS present if generated)

## APIs & Integrations

This project integrates with several external APIs, services and platform libraries. Below are the main integrations and where to find their usage in the codebase.

- Firebase (Auth, Firestore)
	- Purpose: authentication, user profiles, app data and persistence.
	- Implementation: `services/firebase.js` / `services/firebase.ts` (initialization and auth state). Firestore usage appears across `services/` and screens.
	- Package: `firebase`

ExerciseDB
	- Purpose: fetch exercise metadata, body parts, and searchable exercise lists from the ExerciseDB API (used by the Workout screen).
	- Implementation: `services/exercisedb.js` (RapidAPI-hosted ExerciseDB, requires `expo.extra.exerciseDbApiKey` in `app.json`).
	- Example endpoints: `https://exercisedb.p.rapidapi.com/exercises/bodyPartList`, `https://exercisedb.p.rapidapi.com/exercises/bodyPart/{part}`

Spoonacular (Diet)
	- Purpose: food search, nutrition details, recipe search and meal plan generation used by the Diet screens.
	- Implementation: `services/diet.js` (`spoonacular` API key currently in the file; consider moving this to `app.json` or secure storage).
	- Endpoints used: `https://api.spoonacular.com/food/ingredients/search`, `https://api.spoonacular.com/recipes/complexSearch`, `https://api.spoonacular.com/mealplanner/generate`

- Expo AuthSession & SecureStore
	- Purpose: OAuth flows and secure token storage for mobile/web.
	- Implementation: used in `services/strava.js` and any other OAuth helpers.
	- Packages: `expo-auth-session`, `expo-secure-store`

Google Authentication
	- Purpose: let users sign in with their Google account and persist session via Firebase Auth.
	- Implementation: `app/login.js` uses `expo-auth-session/providers/google` to obtain an ID token, then exchanges it for a Firebase credential using `GoogleAuthProvider.credential(idToken)` and signs in with `signInWithCredential(auth, credential)`. Firebase initialization is in `services/firebase.js` / `services/firebase.ts`.
	- Notes: `app/login.js` contains platform-specific client IDs for web/expo/android; make sure those client IDs match your OAuth client configuration in Google Cloud Console.

- Expo device modules (camera, sensors, location, file system)
	- Purpose: hardware access for camera selfies, sensor/step data, location, and file caching.
	- Implementation: referenced in `services/` (e.g. `sensor.js`) and platform screens.
	- Packages in `package.json`: `expo-camera`, `expo-sensors`, `expo-location`, `expo-file-system`, etc.

- Three / VRM / Web player
	- Purpose: 3D avatar rendering using Three.js and VRM support.
	- Implementation: `components/VrmAvatar.web.tsx`, `components/VrmAvatar.native.tsx` (WebView wrapper), `web-player/player.html` (embedded player loads `three` and `@pixiv/three-vrm` via CDN).
	- Packages: `three`, `@pixiv/three-vrm`, `@react-three/fiber`, `@react-three/drei`, `expo-three`

- React Native WebView
	- Purpose: embed the web-based 3D player into native apps.
	- Implementation: `components/VrmAvatar.native.tsx` and any WebView wrappers.
	- Package: `react-native-webview`

- Other notable libraries
	- `react-redux` / `@reduxjs/toolkit` — global state (`store.js`)
	- `lottie-react-native` — UI animations
	- `react-native-unity-view` — optional Unity integration (native)
	- `react-native-vector-icons` / `@expo/vector-icons` — icons

## Default 3D avatar models

By default the app references two GLB models in the assets folder. Update these if you want custom avatars:

- Male default: `assets/models/q.glb`
- Female default: `assets/models/w.glb`

Files to edit if you change models:

- `components/avatar.js` — native/Expo GL avatar (search for "Default model selection")
- `components/AvatarWeb.js` — web avatar; update `modelUrl` assignment

Both components will attempt to play an `idle` animation clip automatically if present in the GLB.

### Web VRM preview route

1. Run `npm run web` (or `npx expo start --web`).
2. Open http://localhost:19006/avatar-web in your browser (adjust the port if Metro is bound elsewhere).
3. Edit `app/avatar-web.tsx` or `components/AvatarWeb.js` to load a different model, tweak props, or inspect loader logs in the browser console.

On native platforms the same route renders a short message explaining that the viewer is web-only; use `components/avatar.js` for the Expo GL avatar there.

## Development notes

- The project uses Expo SDK 54 and React 19 per `package.json` dependencies. Keep the Expo CLI up to date.
- Web builds rely on `react-dom` and `react-native-web` (listed as optional dependencies in `package.json`).
- If you hit Metro resolver issues on Windows, try clearing cache:

```powershell
npx expo start -c
```

### Squat Pose Detection (MediaPipe)

An experimental squat detector counts reps using the MediaPipe Pose Landmarker (lite) model loaded via CDN. It runs client-side only.

Implementation summary:

- Inline HTML (see `app/Squat.tsx`) embedded via `srcDoc` (web) or a `WebView` (native) loads MediaPipe Tasks Vision.
- Knee angle (average of left & right) is smoothed (moving average of last 8 frames).
- Down phase triggers after 3 consecutive smoothed frames below 100°; up phase (rep completion) needs 4 consecutive frames above 160°.
- A rep increments the counter and posts `{ type: 'reps', payload: { reps } }` to the host.

XP & Missions:

- Saving a squat session awards immediate XP: 1 XP per 5 reps (rounded down to nearest 5).
- Weekly squat mission accumulates reps by ISO week; reaching 100 reps awards a 100 XP bonus once per week.

Future improvements:

- Form feedback (depth not sufficient, asymmetry warnings).
- Multi-exercise expansion (push-ups, lunges, planks) with per-exercise state machines.
- Offline model bundling instead of CDN.
- User setting to disable camera tracking, and privacy notice.

---

## Planned features & roadmap

See `ROADMAP.md` for a short list of planned features (3D avatar mini-games, AI assistant, AR interactions) and implementation notes.

## Contributing

If you plan to contribute:

1. Create a branch for your change.
2. Run linting using `npm run lint` and add tests if you modify business logic.
3. Open a PR describing the change and any testing steps.

## License

This repository doesn't include a license file. Add one if you plan to make the code public.

---

If you'd like, I can also:

- Add a short developer setup section for Android emulator installation on Windows.
- Add a CONTRIBUTING.md and a minimal LICENSE file.
- Expand the folder overview into a visual tree.

Tell me which of those you'd like next.
