# Roadmap

This roadmap reflects only net-new implementation work from the current Bodify state onward.

For the detailed planning source and PDF export, see:

- `docs/BODIFY_PRODUCT_IMPLEMENTATION_PLAN.md`
- `docs/BODIFY_PRODUCT_IMPLEMENTATION_PLAN.pdf`
- `docs/BODIFY_ENGINEERING_TICKETS.md`

## Product Direction

Bodify should evolve into an avatar-first fitness game with an AI companion.

The target loop is:

1. Avatar greets the user and frames the day.
2. Home screen presents one clear next action.
3. User completes a short guided workout or mission.
4. Avatar reacts with coaching, rewards, and progression.
5. User returns for streaks, unlocks, and relationship progress.

## In Scope Now

### 1. Home Loop Upgrade

- Rebuild the home screen around a main CTA.
- Add daily mission, streak risk, reward preview, and AI quick actions.
- Add a reward reveal moment after mission or workout completion.

### 2. Avatar Progression System

- Add avatar setup and preferences.
- Add cosmetic unlocks and progression states.
- Add relationship or bond mechanics.
- Add contextual avatar reactions across key flows.

### 3. AI Coach Upgrade

- Shift from generic chat to action-oriented coaching.
- Add coaching modes and compact memory.
- Add response caching, pruning, retry, and rate limiting.
- Improve fallback behavior for weak network or audio conditions.

### 4. Guided Workout Experience

- Add avatar-led countdown, encouragement, and recap.
- Add a recommended daily workout.
- Add post-workout summary and reward screen.
- Integrate existing rep counting and pose work into a guided flow.

### 5. Retention and Social Layer

- Add weekly leaderboard and async challenge loop.
- Add progress sharing and milestone cards.
- Add notifications and seasonal quest rotation.

## 8-Week Build Plan

### Weeks 1-2

- Upgrade the home loop.
- Add mission surface and AI quick actions.
- Design reward reveal and completion state.

### Weeks 3-4

- Build avatar setup.
- Add cosmetics and bond state.
- Improve avatar reaction quality.

### Weeks 5-6

- Upgrade AI coaching modes and memory.
- Add Gemini cost and reliability controls.
- Connect AI to workout and recovery recommendations.

### Weeks 7-8

- Add guided workout recap and reward screens.
- Add leaderboard, async challenges, and share flows.
- Add notifications and seasonal quests.

## Out Of Scope For This Roadmap

- Rebuilding existing base screens from scratch.
- Full realtime multiplayer systems.
- Full biomechanics-grade form analysis.
- Large RPG perk trees.
- AR as a near-term MVP requirement.

## Success Criteria

- Avatar becomes the primary guidance and reward surface.
- Users always have one obvious next action on launch.
- AI drives action, not passive conversation.
- Workout completion feels rewarding and game-like.
- The app feels differentiated from a standard utility fitness tracker.

