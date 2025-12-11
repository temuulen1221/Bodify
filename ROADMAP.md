# Roadmap

## Implementation Plan (M1–M4+)

```
───────────────────────────────────────────────────────────────────────────────────────────────
 FEATURE                              | DIFF.   | PRIORITY | TIMELINE | DESCRIPTION
───────────────────────────────────────────────────────────────────────────────────────────────

 CORE APP STRUCTURE
───────────────────────────────────────────────────────────────────────────────────────────────
 Basic UI Screens                     | Easy    | Must      | M1       | Home, Workout, Avatar, Profile screens
 Navigation Setup                     | Easy    | Must      | M1       | Tab + stack navigation for main pages
XP & Level System                     | Easy    | Must      | M1       | Basic progression: XP gain, level up
Save Progress (AsyncStorage)          | Easy    | Must      | M1       | Save XP, level, streak locally

 MOVEMENT / POSE DETECTION
───────────────────────────────────────────────────────────────────────────────────────────────
 Basic Pose Detection (1–2 moves)     | Medium  | Must      | M1–M2    | Use MoveNet/MediaPipe for squats/jacks
 Simple Rep Counting                  | Medium  | Must      | M2       | Count reps using up/down pose logic
 Basic Form Check (squat depth)       | Medium  | Should    | M2–M3    | Compare keypoints for simple correctness

 AVATAR / VISUAL FEEDBACK
───────────────────────────────────────────────────────────────────────────────────────────────
 WebView VRM Avatar                   | Medium  | Must      | M2       | Display VRM avatar in WebView
 Avatar Level-Based Changes           | Medium  | Should    | M2–M3    | Change avatar look based on level
 Full 3D Avatar (in-app R3F)          | Hard    | Future    | M4+      | Native 3D integration, advanced animations

 GAMIFICATION & MOTIVATION
───────────────────────────────────────────────────────────────────────────────────────────────
 Daily/Weekly Missions                | Medium  | Must      | M2       | Small tasks: 15 squats, 1 min plank
 Streak System                        | Medium  | Should    | M2–M3    | Count consistent workout days
 Notifications (Daily Reminder)       | Medium  | Should    | M3       | Expo notifications for reminders
 Advanced Progression Tree            | Hard    | Future    | M4+      | Complex game systems (skills, perks)

 EXERCISE VARIETY
───────────────────────────────────────────────────────────────────────────────────────────────
 Add 3–4 Exercise Types               | Medium  | Should    | M3       | Basic detection: plank, high knees, steps
 Multi-Exercise Accurate Detection    | Hard    | Future    | M4+      | Refined models for several movements
 Advanced Form Coaching               | Hard    | Future    | After M4 | Biomechanics-based posture corrections

 SOCIAL / SHARING
───────────────────────────────────────────────────────────────────────────────────────────────
 Share Avatar / Progress              | Medium  | Should    | M3       | Simple screenshot share
 Online Leaderboard (basic)           | Hard    | Future    | M4+      | Needs backend for ranking
 Friend System / Group Challenges     | Hard    | Future    | After M4 | Multi-user syncing + real-time data
───────────────────────────────────────────────────────────────────────────────────────────────
```

## Now (work i can start on or are already implementing)

- Improve avatar customization UI
  - Add clothing/colors, presets, and save/load profiles to Firestore.
  - Implement incremental UI in `components/Avatar*` and persist using Redux + Firestore.
  - Priority: High

- ExerciseDB improvements
  - Add better caching and pagination (services/exercisedb.js -> local caching + optimistic UI).
  - Priority: Medium

- Move sensitive API keys out of source
  - Move Spoonacular API key into `app.json` `expo.extra` or use environment variables / secure store.
  - Priority: High

- Smart onboarding & personalized goals
  - Purpose: quicker time-to-value and better retention by asking goals, baseline activity, and preferred avatar style during first run.
  - Implementation: add `app/onboarding/*` screens that save preferences to Firestore and initialize recommended plans. Integrate with `store.js` and optional user tutorial flows.
  - Priority: High

## Next (planned features within the next months development cycles)

- 3D avatar mini-games
  - Short casual mini-games (balance, step challenges, dance-offs) to drive engagement.
  - Tech: implement as small WebGL/Three scenes integrated via `components/VrmAvatar.web.tsx` or separate `components/Game*` using `@react-three/fiber` and `three`.
  - Data: send scores to Firestore leaderboards and reward with in-app badges.
  - Priority: High

- AI Assistant (in-app)
  - Provide a conversational assistant to help with workouts, meal suggestions, and avatar tips.
  - Tech: integrate a small LLM API (self-hosted or third-party) via a backend functions layer or serverless endpoint to avoid exposing keys in the client.
  - UX: show assistant in a side sheet or chat screen; optionally allow voice input via `expo-speech`/
  - Priority: Medium

 - Push notifications & re-engagement
  - Purpose: nudge users for streaks, new seasonal quests, or friend challenges.
  - Implementation: use Expo Push Notifications for cross-platform delivery. Server-side triggers (Cloud Functions or cron jobs) to send notifications. Add opt-in settings in user profile.
  - Priority: High

 - Workout analysis (pose/form detection)
  - Purpose: provide feedback on exercise form and detect reps automatically to improve coaching quality.
  - Implementation: start with a single exercise (e.g., squat) using MediaPipe or TensorFlow.js pose detection in a WebView or on-device via native modules. Provide a feedback loop in UI and store metrics in Firestore for longitudinal tracking.
  - Priority: Medium

 - Health integrations: Google Fit & Apple Health
  - Purpose: richer and more reliable activity data sync (steps, workouts, heart rate) and to export/import user data.
  - Implementation: implement platform-specific connectors. On Android, integrate Google Fit APIs; on iOS, integrate HealthKit. For initial work, use libraries that wrap these SDKs, or create a small native module and bridge. Consider privacy and permission flows carefully.
  - Priority: Medium
  

## Later (big, exploratory items)

- Multiplayer mini-games (real-time)
  - Low-latency game server (WebRTC or socket-based) that pairs users for challenges.
  - Consider using a managed real-time service for scale.
  - Priority: Low

- Advanced personalization with ML
  - Use on-device or cloud ML to personalize recommendations, detect workout form, or auto-suggest meal plans.
  - Priority: Low

- Native SDK integrations
  - Deeper wearable integrations (Google Fit, Apple Health) with more data sync capabilities.
  - Priority: Low

-Real-time AR interactions
  Value: cutting-edge, differentiator (place avatar in AR, try accessories in real space).
    Implementation options:
    Use ARCore/ARKit via native (bare) Expo workflow OR
    Build richer AR in Unity and connect via react-native-unity-view.
    Needs: native/AR expertise, potential offline assets, CORS & network considerations, maybe custom servers for multi-user sync (WebRTC).
    Priority: medium

- Achievements & Seasonal Quests
  - Purpose: recurring content and time-limited goals to re-engage users (seasonal events, holiday quests, weekly challenges).
  - Implementation: design a quest/achievement schema in Firestore, client rule triggers (local or backend) to award badges, and a UI to surface active quests and progress. Consider scheduled Cloud Functions to rotate seasonal content.
  - Priority: High
    
 More development ideas coming soon...
