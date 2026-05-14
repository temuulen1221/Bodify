import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

const LOCATION_PERMISSION_REQUESTED_KEY = 'bodify.locationPermissionRequested';

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
      return window.localStorage.getItem(LOCATION_PERMISSION_REQUESTED_KEY) === 'true';
    }
    return (await AsyncStorage.getItem(LOCATION_PERMISSION_REQUESTED_KEY)) === 'true';
  } catch (_) {
    return false;
  }
};

const writeStoredFlag = async (value) => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCATION_PERMISSION_REQUESTED_KEY, value ? 'true' : 'false');
      return;
    }
    await AsyncStorage.setItem(LOCATION_PERMISSION_REQUESTED_KEY, value ? 'true' : 'false');
  } catch (_) {}
};

const buildPermissionResult = async () => {
  try {
    const [permission, requestedBefore] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      readStoredFlag(),
    ]);

    return {
      location: normalizeStatus(permission),
      requestedBefore,
      available: true,
      canAskAgain: permission?.canAskAgain !== false,
    };
  } catch (error) {
    return {
      location: 'unknown',
      requestedBefore: await readStoredFlag(),
      available: false,
      canAskAgain: false,
      error: error?.message || 'Unable to inspect location permission.',
    };
  }
};

export const getLocationPermissionStatus = async () => buildPermissionResult();

export const requestLocationPermission = async ({ force = false } = {}) => {
  const requestedBefore = await readStoredFlag();
  if (requestedBefore && !force) {
    return buildPermissionResult();
  }

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    await writeStoredFlag(true);

    return {
      location: normalizeStatus(permission),
      requestedBefore: true,
      available: true,
      canAskAgain: permission?.canAskAgain !== false,
    };
  } catch (error) {
    await writeStoredFlag(true);
    return {
      location: 'unknown',
      requestedBefore: true,
      available: false,
      canAskAgain: false,
      error: error?.message || 'Unable to request location permission.',
    };
  }
};