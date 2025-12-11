import { initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth, onAuthStateChanged } from 'firebase/auth';
import { enableIndexedDbPersistence, Firestore, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDzePvt6wOKjSkqeU6LdbJusok097PRPqE",
  authDomain: "bodify-37337.firebaseapp.com",
  projectId: "bodify-37337",
  storageBucket: "bodify-37337.appspot.com",
  messagingSenderId: "351839980449",
  appId: "1:351839980449:web:8e0439d58fea92891a99e0",
  measurementId: "G-6VTBN7VDQ9",
};

const app = initializeApp(firebaseConfig);

let auth: Auth;
let currentUserId: string | null = null;
try {
  // Attempt to use React Native persistence when available; load helper dynamically to avoid type issues
  // @ts-ignore
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  let getReactNativePersistence: any = null;
  try {
    // try to require the helper from firebase/auth
    // @ts-ignore
    const authModule = require('firebase/auth');
    getReactNativePersistence = authModule.getReactNativePersistence;
  } catch (e) {
    // ignore
  }

  if (getReactNativePersistence) {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } else {
    auth = getAuth(app);
  }
} catch (e) {
  auth = getAuth(app);
}

// Initialize Firestore with long polling to better handle networking constraints in RN/Expo environments
let db: Firestore;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: true,
  });
} catch (e) {
  // Fallback to default initialization if enhanced config fails
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fallback = require('firebase/firestore').getFirestore;
  db = fallback(app);
}

// Attempt to enable IndexedDB persistence (web only) for offline caching; ignore failures (multi-tab, unsupported)
try {
  // This will throw on native platforms; guarded by feature detect
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch(() => {});
  }
} catch (_) {}

// Keep a lightweight module-level user id mirror for places that import currentUserId
// Note: prefer using auth.currentUser where possible for real-time state, but
// this is maintained for compatibility with existing imports in JS files.
onAuthStateChanged(auth, (user) => {
  currentUserId = user?.uid ?? null;
});

export { app, auth, currentUserId, db };

