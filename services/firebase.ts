import { initializeApp } from 'firebase/app';
import { Auth, browserLocalPersistence, getAuth, initializeAuth, onAuthStateChanged, setPersistence } from 'firebase/auth';
import { Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { connectFunctionsEmulator, Functions, getFunctions } from 'firebase/functions';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

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
const functionsRegion = process.env.EXPO_PUBLIC_FUNCTIONS_REGION || 'us-central1';
const defaultFunctionsEmulatorPort = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT || 5001);
const isWeb = Platform.OS === 'web';

const resolveFunctionsEmulatorConfig = () => {
  const configuredHost = String(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST || '').trim();
  const configuredPort = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT || 0);
  if (configuredHost && Number.isFinite(configuredPort) && configuredPort > 0) {
    return { host: configuredHost, port: configuredPort };
  }

  if (!__DEV__ || !isWeb || typeof window === 'undefined') {
    return null;
  }

  const hostname = String(window.location?.hostname || '').trim();
  const isLocalWebHost = hostname === 'localhost' || hostname === '127.0.0.1' || /^192\.168\.\d+\.\d+$/.test(hostname);
  if (!isLocalWebHost || !Number.isFinite(defaultFunctionsEmulatorPort) || defaultFunctionsEmulatorPort <= 0) {
    return null;
  }

  return { host: hostname, port: defaultFunctionsEmulatorPort };
};

const getFunctionsEmulatorHttpBaseUrl = () => {
  const emulatorConfig = resolveFunctionsEmulatorConfig();
  if (!emulatorConfig) return '';
  return `http://${emulatorConfig.host}:${emulatorConfig.port}/${firebaseConfig.projectId}/${functionsRegion}`;
};

let auth: Auth;
let currentUserId: string | null = null;
try {
  if (isWeb) {
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('[firebase] Failed to enable browser auth persistence', error);
    });
  } else {
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
  }
} catch (e) {
  auth = getAuth(app);
}

// Initialize Firestore with long polling to better handle networking constraints in RN/Expo environments
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: true,
    ...(isWeb && typeof window !== 'undefined'
      ? {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        }
      : {}),
  });
} catch (e) {
  // Fallback to default initialization if enhanced config fails
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fallback = require('firebase/firestore').getFirestore;
  db = fallback(app);
}

storage = getStorage(app);

functions = getFunctions(app, functionsRegion);
try {
  const emulatorConfig = resolveFunctionsEmulatorConfig();
  if (emulatorConfig) {
    connectFunctionsEmulator(functions, emulatorConfig.host, emulatorConfig.port);
  }
} catch (_) {}

// Keep a lightweight module-level user id mirror for places that import currentUserId
// Note: prefer using auth.currentUser where possible for real-time state, but
// this is maintained for compatibility with existing imports in JS files.
onAuthStateChanged(auth, (user) => {
  currentUserId = user?.uid ?? null;
});

export { app, auth, currentUserId, db, functions, getFunctionsEmulatorHttpBaseUrl, storage };

