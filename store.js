import { configureStore, createSlice } from '@reduxjs/toolkit';
import { saveAwardsState, saveUserState } from './services/storage';

const initialState = {
  level: 3,
  points: 255,
  pointsMax: 300,
  // Streaks
  streakCount: 0,
  lastWorkoutDate: null, // 'YYYY-MM-DD'
  // Profile fields
  avatarName: '',
  height: '',
  weight: '',
  bodyShape: 'athletic',
  photoUri: '',
  gender: 'male',
  avatar: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setPoints(state, action) {
      state.points = action.payload;
    },
    setLevel(state, action) {
      state.level = action.payload;
    },
    setPointsMax(state, action) {
      state.pointsMax = action.payload;
    },
    addXP(state, action) {
      // Adds XP and handles level-up when reaching pointsMax.
      const delta = Number(action.payload) || 0;
      if (!Number.isFinite(delta) || delta <= 0) return;
      let pts = (state.points || 0) + delta;
      let lvl = state.level || 1;
      let cap = state.pointsMax || 100;
      // Simple progression: each level increases cap by +10% rounded to nearest 10.
      const nextCap = (c) => {
        const inc = Math.round(c * 0.1 / 10) * 10; // 10% increment rounded to tens
        return c + Math.max(10, inc);
      };
      while (pts >= cap) {
        pts -= cap;
        lvl += 1;
        cap = nextCap(cap);
      }
      state.points = Math.floor(pts);
      state.level = lvl;
      state.pointsMax = cap;
    },
    registerWorkoutDay(state, action) {
      // Update streaks based on a completed workout on a given date (YYYY-MM-DD)
      const dateStr = action.payload;
      if (typeof dateStr !== 'string' || dateStr.length !== 10) return;
      const prev = state.lastWorkoutDate;
      state.lastWorkoutDate = dateStr;
      try {
        const d = new Date(dateStr);
        const prevD = prev ? new Date(prev) : null;
        const dayMs = 24 * 60 * 60 * 1000;
        if (prevD) {
          const diff = Math.floor((d.getTime() - prevD.getTime()) / dayMs);
          if (diff === 1) {
            state.streakCount = (state.streakCount || 0) + 1;
          } else if (diff > 1) {
            state.streakCount = 1; // reset streak
          } // diff <= 0 means same day or earlier, no change
        } else {
          state.streakCount = 1;
        }
      } catch (_) {
        // ignore date parse issues
      }
    },
    setProfile(state, action) {
      const { avatarName, height, weight, bodyShape, photoUri, gender } = action.payload || {};
      if (typeof avatarName === 'string') state.avatarName = avatarName;
      if (typeof height === 'string' || typeof height === 'number') state.height = String(height);
      if (typeof weight === 'string' || typeof weight === 'number') state.weight = String(weight);
      if (typeof bodyShape === 'string') state.bodyShape = bodyShape;
      if (typeof photoUri === 'string') state.photoUri = photoUri;
      if (typeof gender === 'string') state.gender = gender;
    },
    setAvatar(state, action) {
      state.avatar = action.payload;
    },
    hydrateUser(state, action) {
      // Merge persisted user subset safely
      const data = action.payload || {};
      const keys = [
        'level','points','pointsMax','streakCount','lastWorkoutDate',
        'avatarName','height','weight','bodyShape','photoUri','gender','avatar'
      ];
      keys.forEach((k) => {
        if (data[k] !== undefined) state[k] = data[k];
      });
    },
  },
});

export const { setPoints, setLevel, setPointsMax, addXP, registerWorkoutDay, setProfile, setAvatar, hydrateUser } = userSlice.actions;
// --- Quests slice to track daily completions and XP awards (YYYY-MM-DD => true) ---
const questsSlice = createSlice({
  name: 'quests',
  initialState: {
    dailyCompletion: {},
    // xpAwardedByDate: { 'YYYY-MM-DD': { 'quest_0': true, 'quest_1': true } }
    xpAwardedByDate: {},
    // Weekly squat tracking: { 'YYYY-WW': number }
    weeklySquatRepsByWeek: {},
    // Weekly XP awarded flags: { 'YYYY-WW': true }
    weeklyXPAwardedByWeek: {},
  },
  reducers: {
    markDayComplete(state, action) {
      const dateStr = action.payload; // expected 'YYYY-MM-DD'
      if (typeof dateStr === 'string' && dateStr.length === 10) {
        state.dailyCompletion[dateStr] = true;
      }
    },
    resetDay(state, action) {
      const dateStr = action.payload;
      if (state.dailyCompletion[dateStr]) delete state.dailyCompletion[dateStr];
    },
    markQuestXPAwarded(state, action) {
      const { date, key } = action.payload || {};
      if (!date || typeof date !== 'string' || date.length !== 10) return;
      if (typeof key !== 'string' || key.length === 0) return;
      if (!state.xpAwardedByDate[date]) state.xpAwardedByDate[date] = {};
      state.xpAwardedByDate[date][key] = true;
    },
    addWeeklySquatReps(state, action) {
      const { date, reps } = action.payload || {};
      if (!date || typeof date !== 'string' || date.length !== 10) return;
      const n = Number(reps);
      if (!Number.isFinite(n) || n <= 0) return;
      // Compute ISO week number (simplified): week starts Monday.
      const d = new Date(date + 'T00:00:00');
      // Thursday trick to ensure week number matches ISO
      const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0
      target.setUTCDate(target.getUTCDate() - dayNr + 3); // move to Thursday
      const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
      const week = 1 + Math.floor(diff / 7);
      const weekKey = `${target.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
      state.weeklySquatRepsByWeek[weekKey] = (state.weeklySquatRepsByWeek[weekKey] || 0) + n;
    },
    markWeeklyXPAwarded(state, action) {
      const { weekKey } = action.payload || {};
      if (!weekKey || typeof weekKey !== 'string') return;
      state.weeklyXPAwardedByWeek[weekKey] = true;
    },
    hydrateQuests(state, action) {
      const data = action.payload || {};
      const dc = data.dailyCompletion; const xa = data.xpAwardedByDate;
      if (dc && typeof dc === 'object') state.dailyCompletion = dc;
      if (xa && typeof xa === 'object') state.xpAwardedByDate = xa;
      if (data.weeklySquatRepsByWeek && typeof data.weeklySquatRepsByWeek === 'object') {
        state.weeklySquatRepsByWeek = data.weeklySquatRepsByWeek;
      }
      if (data.weeklyXPAwardedByWeek && typeof data.weeklyXPAwardedByWeek === 'object') {
        state.weeklyXPAwardedByWeek = data.weeklyXPAwardedByWeek;
      }
    },
  },
});

export const { markDayComplete, resetDay, markQuestXPAwarded, addWeeklySquatReps, markWeeklyXPAwarded, hydrateQuests } = questsSlice.actions;

// --- Workouts slice to track per-day completed workout sessions and XP awards ---
const workoutsSlice = createSlice({
  name: 'workouts',
  initialState: {
    // sessionsByDate: { 'YYYY-MM-DD': [{ id, title, durationMin, calories, notes }] }
    sessionsByDate: {},
    // xpAwardedSessionIdsByDate: { 'YYYY-MM-DD': { [sessionId]: true } }
    xpAwardedSessionIdsByDate: {},
  },
  reducers: {
    addWorkoutSession(state, action) {
      const { date, session } = action.payload || {};
      if (!date || typeof date !== 'string' || date.length !== 10) return;
      if (!state.sessionsByDate[date]) state.sessionsByDate[date] = [];
      const safe = session || {};
      state.sessionsByDate[date].push({
        id: safe.id ?? `${Date.now()}`,
        title: safe.title ?? 'Workout',
        durationMin: safe.durationMin ?? 30,
        calories: safe.calories ?? 200,
        notes: safe.notes ?? '',
        type: safe.type ?? 'general',
      });
    },
    clearDayWorkouts(state, action) {
      const date = action.payload;
      if (state.sessionsByDate[date]) delete state.sessionsByDate[date];
    },
    markSessionXPAwarded(state, action) {
      const { date, sessionId } = action.payload || {};
      if (!date || typeof date !== 'string' || date.length !== 10) return;
      if (!sessionId || typeof sessionId !== 'string') return;
      if (!state.xpAwardedSessionIdsByDate[date]) state.xpAwardedSessionIdsByDate[date] = {};
      state.xpAwardedSessionIdsByDate[date][sessionId] = true;
    },
    hydrateWorkouts(state, action) {
      const data = action.payload || {};
      const sbd = data.sessionsByDate; const awarded = data.xpAwardedSessionIdsByDate;
      if (sbd && typeof sbd === 'object') state.sessionsByDate = sbd;
      if (awarded && typeof awarded === 'object') state.xpAwardedSessionIdsByDate = awarded;
    },
  },
});

export const { addWorkoutSession, clearDayWorkouts, markSessionXPAwarded, hydrateWorkouts } = workoutsSlice.actions;

// --- Steps slice to track daily step counts ---
const stepsSlice = createSlice({
  name: 'steps',
  initialState: {
    // stepsByDate: { 'YYYY-MM-DD': number }
    stepsByDate: {},
  },
  reducers: {
    setStepsForDate(state, action) {
      const { date, steps } = action.payload || {};
      if (!date || typeof date !== 'string' || date.length !== 10) return;
      const n = Number(steps);
      if (!Number.isFinite(n) || n < 0) return;
      state.stepsByDate[date] = Math.floor(n);
    },
    clearStepsForDate(state, action) {
      const date = action.payload;
      if (state.stepsByDate[date] != null) delete state.stepsByDate[date];
    },
  },
});

export const { setStepsForDate, clearStepsForDate } = stepsSlice.actions;

const store = configureStore({
  reducer: {
    user: userSlice.reducer,
    quests: questsSlice.reducer,
    workouts: workoutsSlice.reducer,
    steps: stepsSlice.reducer,
    pose: createSlice({
      name: 'pose',
      initialState: {
        currentExercise: 'squat', // 'squat' | 'pushup' | 'lunge'
        currentReps: 0,
        startedAt: null,
        cameraTrackingEnabled: true,
        privacyAccepted: false,
        formFeedback: '',
      },
      reducers: {
        setPoseExercise(state, action) { const e = String(action.payload||''); if (e) state.currentExercise = e; },
        incrementPoseRep(state) { state.currentReps = (state.currentReps||0) + 1; },
        resetPoseSession(state) { state.currentReps = 0; state.startedAt = Date.now(); },
        setCameraTrackingEnabled(state, action) { state.cameraTrackingEnabled = !!action.payload; },
        acceptPrivacy(state) { state.privacyAccepted = true; },
        setFormFeedback(state, action) { state.formFeedback = String(action.payload||''); },
      }
    }).reducer,
  },
});

// Seed one sample workout for today if empty (dev convenience)
try {
  const d = new Date();
  const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const state = store.getState();
  if (!state.workouts.sessionsByDate[todayKey] || state.workouts.sessionsByDate[todayKey].length === 0) {
    store.dispatch(
      addWorkoutSession({
        date: todayKey,
        session: { title: 'Full Body Circuit', durationMin: 40, calories: 350, type: 'strength' },
      })
    );
  }
  if (state.steps.stepsByDate[todayKey] == null) {
    store.dispatch(setStepsForDate({ date: todayKey, steps: 7342 }));
  }
} catch (_) {
  // no-op in environments where store state isn't accessible yet
}

export default store;

// Export pose actions (need slice instance; recreate for actions only without redefinition of store)
// To avoid refactor overhead, create a temporary slice just to extract action creators identically.
const _poseSliceForActions = createSlice({
  name: '_poseActions',
  initialState: {},
  reducers: {
    setPoseExercise(state, action) {},
    incrementPoseRep(state) {},
    resetPoseSession(state) {},
    setCameraTrackingEnabled(state, action) {},
    acceptPrivacy(state) {},
    setFormFeedback(state, action) {},
  }
});
export const { setPoseExercise, incrementPoseRep, resetPoseSession, setCameraTrackingEnabled, acceptPrivacy, setFormFeedback } = _poseSliceForActions.actions;

// --- Persistence subscription: save a lightweight user subset on changes ---
try {
  let lastSavedJson = '';
  let lastAwardsJson = '';
  store.subscribe(() => {
    const state = store.getState();
    const user = state.user || {};
    const subset = {
      level: user.level,
      points: user.points,
      pointsMax: user.pointsMax,
      streakCount: user.streakCount,
      lastWorkoutDate: user.lastWorkoutDate,
      avatarName: user.avatarName,
      height: user.height,
      weight: user.weight,
      bodyShape: user.bodyShape,
      photoUri: user.photoUri,
      gender: user.gender,
    };
    const json = JSON.stringify(subset);
    if (json !== lastSavedJson) {
      lastSavedJson = json;
      saveUserState(subset);
    }

    // Persist awards markers for quests/workouts
    const awardsSubset = {
      quests: {
        dailyCompletion: state.quests?.dailyCompletion ?? {},
        xpAwardedByDate: state.quests?.xpAwardedByDate ?? {},
        weeklySquatRepsByWeek: state.quests?.weeklySquatRepsByWeek ?? {},
        weeklyXPAwardedByWeek: state.quests?.weeklyXPAwardedByWeek ?? {},
      },
      workouts: {
        xpAwardedSessionIdsByDate: state.workouts?.xpAwardedSessionIdsByDate ?? {},
      },
    };
    const awardsJson = JSON.stringify(awardsSubset);
    if (awardsJson !== lastAwardsJson) {
      lastAwardsJson = awardsJson;
      saveAwardsState(awardsSubset);
    }
  });
} catch (_) {
  // ignore subscription errors in non-standard environments
}
