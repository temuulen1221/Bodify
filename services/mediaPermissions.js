import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoCamera from 'expo-camera';
import { Platform } from 'react-native';

const MEDIA_PERMISSIONS_REQUESTED_KEY = 'bodify.mediaPermissionsRequested';
const cameraModule = ExpoCamera.Camera || ExpoCamera;
const getCameraPermission = cameraModule.getCameraPermissionsAsync?.bind(cameraModule);
const getMicrophonePermission = cameraModule.getMicrophonePermissionsAsync?.bind(cameraModule);
const requestCameraPermission = cameraModule.requestCameraPermissionsAsync?.bind(cameraModule);
const requestMicrophonePermission = cameraModule.requestMicrophonePermissionsAsync?.bind(cameraModule);

const normalizeStatus = (permission) => {
  if (permission?.granted) return 'granted';
  if (permission?.canAskAgain === false) return 'blocked';
  if (typeof permission?.status === 'string' && permission.status.length > 0) {
    return permission.status.toLowerCase();
  }
  return 'unknown';
};

const readStoredFlag = async () => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(MEDIA_PERMISSIONS_REQUESTED_KEY) === 'true';
    }
    return (await AsyncStorage.getItem(MEDIA_PERMISSIONS_REQUESTED_KEY)) === 'true';
  } catch (_) {
    return false;
  }
};

const writeStoredFlag = async (value) => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(MEDIA_PERMISSIONS_REQUESTED_KEY, value ? 'true' : 'false');
      return;
    }
    await AsyncStorage.setItem(MEDIA_PERMISSIONS_REQUESTED_KEY, value ? 'true' : 'false');
  } catch (_) {}
};

const buildPermissionResult = async () => {
  try {
    if (!getCameraPermission || !getMicrophonePermission) {
      throw new Error('Camera permission API is not available in this build.');
    }

    const [cameraPermission, microphonePermission, requestedBefore] = await Promise.all([
      getCameraPermission(),
      getMicrophonePermission(),
      readStoredFlag(),
    ]);

    return {
      camera: normalizeStatus(cameraPermission),
      microphone: normalizeStatus(microphonePermission),
      requestedBefore,
      available: true,
    };
  } catch (error) {
    return {
      camera: 'unknown',
      microphone: 'unknown',
      requestedBefore: await readStoredFlag(),
      available: false,
      error: error?.message || 'Unable to inspect media permissions.',
    };
  }
};

export const getMediaPermissionsStatus = async () => buildPermissionResult();

export const requestMediaPermissions = async ({ force = false } = {}) => {
  const requestedBefore = await readStoredFlag();
  if (requestedBefore && !force) {
    return buildPermissionResult();
  }

  try {
    if (!requestCameraPermission || !requestMicrophonePermission) {
      throw new Error('Camera permission request API is not available in this build.');
    }

    const [cameraPermission, microphonePermission] = await Promise.all([
      requestCameraPermission(),
      requestMicrophonePermission(),
    ]);
    await writeStoredFlag(true);

    return {
      camera: normalizeStatus(cameraPermission),
      microphone: normalizeStatus(microphonePermission),
      requestedBefore: true,
      available: true,
    };
  } catch (error) {
    await writeStoredFlag(true);
    return {
      camera: 'unknown',
      microphone: 'unknown',
      requestedBefore: true,
      available: false,
      error: error?.message || 'Unable to request media permissions.',
    };
  }
};

export const ensureInitialMediaPermissions = async () => requestMediaPermissions({ force: false });