// Background step tracking using expo-background-fetch and expo-task-manager
// Runs periodically (OS scheduled) to pull today's step count and persist it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import { Pedometer } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { currentUserId, db } from './firebase';

const TASK_NAME = 'BODIFY_BACKGROUND_STEP_FETCH';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Define the task at the module level (required by TaskManager)
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    const res = await Pedometer.getStepCountAsync(startOfToday(), new Date());
    const steps = res?.steps ?? 0;
    const key = todayKey();

    // cache locally for UI pickup
    try {
      await AsyncStorage.setItem(`steps:${key}`, String(steps));
    } catch {}

    // sync to Firestore if signed in
    try {
      if (currentUserId) {
        const ref = doc(db, 'users', currentUserId, 'metrics', 'steps', key);
        await setDoc(ref, { steps, date: key, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (e) {
      // swallow network errors; will retry next run
      console.warn('[BG Steps] Firestore update failed', e?.message);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.warn('[BG Steps] Task error', e?.message);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function ensureBackgroundStepTaskRegistered() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, {
        minimumInterval: 15 * 60, // 15 minutes on Android, iOS varies
        stopOnTerminate: false,   // Android: continue after app is killed
        startOnBoot: true,        // Android: start on device boot
      });
    }

    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.warn('[BG Steps] Background fetch unavailable (denied/restricted).');
    }
  } catch (e) {
    console.warn('[BG Steps] Registration failed', e?.message);
  }
}
