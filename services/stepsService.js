import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { setStepsForDate } from '../store';
import { auth, db } from './firebase';

const STEP_CACHE_PREFIX = 'steps:';
const FIRESTORE_HISTORY_LIMIT = 420;
const FIRESTORE_SYNC_DEBOUNCE_MS = 1200;

function formatDateKey(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function startOfToday(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function writeTodayToCache(dateKey, steps) {
  try {
    await AsyncStorage.setItem(`${STEP_CACHE_PREFIX}${dateKey}`, String(steps));
  } catch {}
}

async function readTodayFromCache(dateKey) {
  try {
    const raw = await AsyncStorage.getItem(`${STEP_CACHE_PREFIX}${dateKey}`);
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  } catch {
    return null;
  }
}

async function writeTodayToFirestore(dateKey, steps) {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  try {
    const ref = doc(db, 'users', userId, 'metrics', 'steps', dateKey);
    await setDoc(ref, { date: dateKey, steps, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn('[stepsService] Firestore sync failed', e?.message || e);
  }
}

export async function hydrateRemoteStepsHistory(dispatch, userId) {
  if (!userId) return;

  try {
    const stepsCol = collection(db, 'users', userId, 'metrics', 'steps');
    const snapshot = await getDocs(query(stepsCol, orderBy('date', 'desc'), limit(FIRESTORE_HISTORY_LIMIT)));
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const date = data.date || docSnap.id;
      const steps = Number(data.steps || 0);
      if (typeof date === 'string' && date.length === 10 && Number.isFinite(steps) && steps >= 0) {
        dispatch(setStepsForDate({ date, steps }));
      }
    });
  } catch (e) {
    console.warn('[stepsService] Remote history hydration failed', e?.message || e);
  }
}

export function startGlobalStepTracking(dispatch) {
  if (Platform.OS === 'web') {
    return () => {};
  }

  let pedometerSubscription = null;
  let authUnsubscribe = null;
  let dayTimer = null;
  let cacheTimer = null;
  let syncTimer = null;
  let stopped = false;
  let pedometerAvailable = false;
  let currentDateKey = formatDateKey();
  let baseTodaySteps = 0;
  let liveSessionSteps = 0;

  const publish = (steps) => {
    const normalizedSteps = Math.max(0, Math.floor(Number(steps) || 0));
    dispatch(setStepsForDate({ date: currentDateKey, steps: normalizedSteps }));
    writeTodayToCache(currentDateKey, normalizedSteps);

    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      writeTodayToFirestore(currentDateKey, normalizedSteps);
    }, FIRESTORE_SYNC_DEBOUNCE_MS);
  };

  const refreshTodaySteps = async ({ resetLive = false } = {}) => {
    currentDateKey = formatDateKey();
    if (resetLive) liveSessionSteps = 0;

    const cachedSteps = await readTodayFromCache(currentDateKey);
    if (cachedSteps != null) {
      baseTodaySteps = cachedSteps;
      publish(baseTodaySteps + liveSessionSteps);
    }

    if (!pedometerAvailable) return;

    try {
      const result = await Pedometer.getStepCountAsync(startOfToday(), new Date());
      baseTodaySteps = Math.max(cachedSteps ?? 0, result?.steps ?? 0);
      publish(baseTodaySteps + liveSessionSteps);
    } catch (e) {
      if (cachedSteps == null) {
        baseTodaySteps = 0;
        publish(0);
      }
      console.warn('[stepsService] Failed to refresh today steps', e?.message || e);
    }
  };

  const initialize = async () => {
    pedometerAvailable = await Pedometer.isAvailableAsync().catch(() => false);
    await refreshTodaySteps({ resetLive: true });

    if (pedometerAvailable) {
      try {
        pedometerSubscription = Pedometer.watchStepCount((result) => {
          liveSessionSteps = Math.max(0, Number(result?.steps) || 0);
          publish(baseTodaySteps + liveSessionSteps);
        });
      } catch (e) {
        console.warn('[stepsService] Failed to start step watcher', e?.message || e);
      }
    }

    dayTimer = setInterval(() => {
      const nextDateKey = formatDateKey();
      if (nextDateKey !== currentDateKey) {
        refreshTodaySteps({ resetLive: true });
      }
    }, 60 * 1000);

    cacheTimer = setInterval(async () => {
      const cachedSteps = await readTodayFromCache(currentDateKey);
      const currentSteps = baseTodaySteps + liveSessionSteps;
      if (cachedSteps != null && cachedSteps > currentSteps) {
        baseTodaySteps = cachedSteps;
        liveSessionSteps = 0;
        publish(baseTodaySteps);
      }
    }, 30 * 1000);
  };

  authUnsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!stopped && user?.uid) {
      await hydrateRemoteStepsHistory(dispatch, user.uid);
      publish(baseTodaySteps + liveSessionSteps);
    }
  });

  initialize();

  return () => {
    stopped = true;
    if (syncTimer) clearTimeout(syncTimer);
    if (dayTimer) clearInterval(dayTimer);
    if (cacheTimer) clearInterval(cacheTimer);
    try { pedometerSubscription?.remove?.(); } catch {}
    try { authUnsubscribe?.(); } catch {}
  };
}