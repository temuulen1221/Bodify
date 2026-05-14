import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useDispatch } from 'react-redux';
import BackButton from '../components/BackButton';
import { fetchGoogleRoute, fetchPlaceAutocomplete, resolvePlaceDestination } from '../services/googleRoutes';
import { requestLocationPermission } from '../services/locationPermissions';
import { addWorkoutSession } from '../store';
import { createWorkoutSessionRecord } from '../utils/workoutSessionXP';

const OutdoorLiveMap = Platform.OS === 'web'
  ? require('../components/OutdoorLiveMap.web').default
  : require('../components/OutdoorLiveMap').default;

const toNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const deg2rad = (deg) => deg * (Math.PI / 180);

const getDistanceInMeters = (start, end) => {
  if (!start || !end) return 0;
  const earthRadius = 6371e3;
  const dLat = deg2rad(end.latitude - start.latitude);
  const dLon = deg2rad(end.longitude - start.longitude);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(deg2rad(start.latitude)) * Math.cos(deg2rad(end.latitude))
    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const formatDuration = (elapsedMs) => {
  const totalSeconds = Math.max(0, Math.floor((Number(elapsedMs) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatPace = (distanceMeters, elapsedMs) => {
  if (distanceMeters < 30 || elapsedMs < 1000) return '--';
  const paceSecondsPerKm = (elapsedMs / 1000) / (distanceMeters / 1000);
  if (!Number.isFinite(paceSecondsPerKm) || paceSecondsPerKm <= 0) return '--';
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.round(paceSecondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
};

const formatAccuracy = (accuracy) => {
  const normalized = Number(accuracy);
  if (!Number.isFinite(normalized) || normalized <= 0) return 'Waiting';
  if (normalized <= 8) return 'Strong';
  if (normalized <= 20) return 'Good';
  return 'Weak';
};

const MAX_ROUTE_POINT_ACCURACY = 65;
const MIN_ROUTE_POINT_DISTANCE = 4;
const MAX_ROUTE_SPEED_MPS = 22;
const shouldRecordRoutePoint = (previousPoint, nextPoint) => {
  if (!nextPoint) return false;

  const accuracy = Number(nextPoint.accuracy);
  if (Number.isFinite(accuracy) && accuracy > MAX_ROUTE_POINT_ACCURACY) {
    return false;
  }

  if (!previousPoint) {
    return true;
  }

  const segmentMeters = getDistanceInMeters(previousPoint, nextPoint);
  if (segmentMeters < MIN_ROUTE_POINT_DISTANCE) {
    return false;
  }

  const elapsedSeconds = Math.max(1, ((nextPoint.timestamp || Date.now()) - (previousPoint.timestamp || Date.now())) / 1000);
  if ((segmentMeters / elapsedSeconds) > MAX_ROUTE_SPEED_MPS) {
    return false;
  }

  return true;
};

const formatRemainingDistance = (distanceMeters) => {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return '--';
  if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(2)} km away`;
  return `${Math.round(distanceMeters)} m away`;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatSpeed = (speedMps) => {
  if (!Number.isFinite(speedMps) || speedMps <= 0) return '--';
  return `${(speedMps * 3.6).toFixed(1)} km/h`;
};

const formatElevation = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  return `${Math.round(meters)} m`;
};

const formatEta = (durationSec) => {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return '--';
  const totalMinutes = Math.max(1, Math.round(durationSec / 60));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${totalMinutes} min`;
};

const getManeuverIconName = (maneuver) => {
  const normalized = String(maneuver || '').toLowerCase();
  if (normalized.includes('left')) return 'arrow-undo';
  if (normalized.includes('right')) return 'arrow-redo';
  if (normalized.includes('uturn')) return 'return-up-back';
  if (normalized.includes('merge')) return 'git-merge';
  if (normalized.includes('roundabout')) return 'sync-circle';
  return 'arrow-forward';
};


export default function OutdoorTracker() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const label = Array.isArray(params?.label) ? params.label[0] : params?.label || 'Outdoor';
  const type = Array.isArray(params?.type) ? params.type[0] : params?.type || 'cardio';
  const icon = Array.isArray(params?.icon) ? params.icon[0] : params?.icon || 'navigate';
  const caloriesPerMinute = toNumber(Array.isArray(params?.caloriesPerMinute) ? params.caloriesPerMinute[0] : params?.caloriesPerMinute, 8);
  const { height: windowHeight } = useWindowDimensions();
  const isShortScreen = windowHeight < 780;

  const [permissionState, setPermissionState] = useState('checking');
  const [trackerError, setTrackerError] = useState('');
  const [currentFix, setCurrentFix] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [trackingState, setTrackingState] = useState('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [destinationPoints, setDestinationPoints] = useState([]);
  const [destinationMode, setDestinationMode] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [elevationGainMeters, setElevationGainMeters] = useState(0);
  const [currentSpeedMps, setCurrentSpeedMps] = useState(0);
  const [mapReady, setMapReady] = useState(Platform.OS !== 'web');
  const [routeLoading, setRouteLoading] = useState(false);
  const [plannedRoute, setPlannedRoute] = useState(null);
  const [sheetSnapIndex, setSheetSnapIndex] = useState(1);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState('');
  const [finishSummary, setFinishSummary] = useState(null);

  const watchRef = useRef(null);
  const liveStartRef = useRef(null);
  const pausedElapsedRef = useRef(0);
  const lastPointRef = useRef(null);
  const lastRouteOriginRef = useRef(null);
  const lastRouteSignatureRef = useRef('');
  const routeRequestIdRef = useRef(0);
  const sheetTranslateRef = useRef(new Animated.Value(0));
  const sheetOffsetRef = useRef(0);
  const placeRequestIdRef = useRef(0);
  const placeSessionTokenRef = useRef(null);

  const collapsedSheetHeight = useMemo(() => (isShortScreen ? 148 : 166), [isShortScreen]);
  const expandedSheetHeight = useMemo(() => Math.min(windowHeight * 0.6, 448), [windowHeight]);
  const midSheetHeight = useMemo(() => Math.min(windowHeight * 0.42, 320), [windowHeight]);
  const destinationPoint = useMemo(() => (
    destinationPoints.length > 0 ? destinationPoints[destinationPoints.length - 1] : null
  ), [destinationPoints]);
  const routeWaypoints = useMemo(() => (
    destinationPoints.length > 1 ? destinationPoints.slice(0, -1) : []
  ), [destinationPoints]);
  const destinationSignature = useMemo(() => (
    destinationPoints
      .map((point) => `${Number(point.latitude).toFixed(5)},${Number(point.longitude).toFixed(5)}`)
      .join('|')
  ), [destinationPoints]);
  const sheetSnapOffsets = useMemo(() => {
    const collapsed = Math.max(0, expandedSheetHeight - collapsedSheetHeight);
    const mid = Math.max(0, expandedSheetHeight - midSheetHeight);
    return [collapsed, mid, 0];
  }, [collapsedSheetHeight, expandedSheetHeight, midSheetHeight]);

  const animateSheetToIndex = useCallback((nextIndex) => {
    const clampedIndex = clamp(nextIndex, 0, sheetSnapOffsets.length - 1);
    const nextValue = sheetSnapOffsets[clampedIndex];
    sheetOffsetRef.current = nextValue;
    setSheetSnapIndex(clampedIndex);
    Animated.spring(sheetTranslateRef.current, {
      toValue: nextValue,
      useNativeDriver: Platform.OS !== 'web',
      bounciness: 0,
      speed: 18,
    }).start();
  }, [sheetSnapOffsets]);

  useEffect(() => {
    const nextValue = sheetSnapOffsets[sheetSnapIndex] || 0;
    sheetOffsetRef.current = nextValue;
    sheetTranslateRef.current.setValue(nextValue);
  }, [sheetSnapIndex, sheetSnapOffsets]);

  const sheetPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
    onPanResponderMove: (_, gestureState) => {
      const nextValue = clamp(sheetOffsetRef.current + gestureState.dy, 0, sheetSnapOffsets[0]);
      sheetTranslateRef.current.setValue(nextValue);
    },
    onPanResponderRelease: (_, gestureState) => {
      const nextValue = clamp(sheetOffsetRef.current + gestureState.dy, 0, sheetSnapOffsets[0]);
      const nearestIndex = sheetSnapOffsets.reduce((bestIndex, offset, index) => (
        Math.abs(offset - nextValue) < Math.abs(sheetSnapOffsets[bestIndex] - nextValue) ? index : bestIndex
      ), 0);

      if (gestureState.vy < -0.35 && nearestIndex < sheetSnapOffsets.length - 1) {
        animateSheetToIndex(nearestIndex + 1);
        return;
      }
      if (gestureState.vy > 0.35 && nearestIndex > 0) {
        animateSheetToIndex(nearestIndex - 1);
        return;
      }

      animateSheetToIndex(nearestIndex);
    },
    onPanResponderTerminate: () => {
      animateSheetToIndex(sheetSnapIndex);
    },
  }), [animateSheetToIndex, sheetSnapIndex, sheetSnapOffsets]);

  useEffect(() => {
    if (Platform.OS === 'web' && mapReady && globalThis.google?.maps?.places?.AutocompleteSessionToken) {
      placeSessionTokenRef.current = new globalThis.google.maps.places.AutocompleteSessionToken();
      return;
    }

    placeSessionTokenRef.current = null;
  }, [mapReady]);

  const stopWatching = useCallback(() => {
    watchRef.current?.remove?.();
    watchRef.current = null;
  }, []);

  const ensurePermission = useCallback(async () => {
    setTrackerError('');

    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }
      setPermissionState(status);
      if (status !== 'granted') {
        setTrackerError('Location permission is required for live outdoor tracking.');
        return false;
      }

      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const initialPoint = {
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
        accuracy: initial.coords.accuracy,
        altitude: initial.coords.altitude,
        speed: initial.coords.speed,
        timestamp: initial.timestamp || Date.now(),
      };
      setCurrentFix(initialPoint);
      setRoutePoints((points) => (points.length > 0 ? points : [initialPoint]));
      lastPointRef.current = initialPoint;
      return true;
    } catch (error) {
      setPermissionState('denied');
      setTrackerError(String(error?.message || error));
      return false;
    }
  }, []);

  const handleLocationUpdate = useCallback((location) => {
    const nextPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      timestamp: location.timestamp || Date.now(),
    };

    setCurrentFix(nextPoint);

    const previousPoint = lastPointRef.current;
    if (!shouldRecordRoutePoint(previousPoint, nextPoint)) {
      return;
    }

    setRoutePoints((points) => [...points, nextPoint]);

    if (previousPoint) {
      const segmentMeters = getDistanceInMeters(previousPoint, nextPoint);
      const elapsedSeconds = Math.max(1, ((nextPoint.timestamp || Date.now()) - (previousPoint.timestamp || Date.now())) / 1000);
      setDistanceMeters((value) => value + segmentMeters);
      setCurrentSpeedMps(
        Number.isFinite(nextPoint.speed) && nextPoint.speed > 0
          ? nextPoint.speed
          : segmentMeters / elapsedSeconds
      );

      const altitudeDelta = Number(nextPoint.altitude) - Number(previousPoint.altitude);
      if (Number.isFinite(altitudeDelta) && altitudeDelta > 1.2) {
        setElevationGainMeters((value) => value + altitudeDelta);
      }
    } else {
      setCurrentSpeedMps(Number.isFinite(nextPoint.speed) && nextPoint.speed > 0 ? nextPoint.speed : 0);
    }

    lastPointRef.current = nextPoint;
  }, []);

  const startWatching = useCallback(async () => {
    stopWatching();
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 4,
      },
      handleLocationUpdate
    );
  }, [handleLocationUpdate, stopWatching]);

  const startTracking = useCallback(async () => {
    const granted = await ensurePermission();
    if (!granted) {
      const permissionResult = await requestLocationPermission({ force: true });
      if (permissionResult.location === 'granted') {
        const grantedAfterRetry = await ensurePermission();
        if (!grantedAfterRetry) return;
      } else {
        router.push({
          pathname: '/settings',
          params: { permission: 'location' },
        });
        return;
      }
    }

    if (trackingState === 'idle') {
      setDistanceMeters(0);
      setElevationGainMeters(0);
      setCurrentSpeedMps(0);
      pausedElapsedRef.current = 0;
      setElapsedMs(0);
      setRoutePoints((points) => (currentFix ? [currentFix] : points.slice(0, 1)));
      lastPointRef.current = currentFix;
    }

    setFollowUser(true);
    liveStartRef.current = Date.now();
    setTrackingState('tracking');
    animateSheetToIndex(0);
    await startWatching();
  }, [animateSheetToIndex, currentFix, ensurePermission, router, startWatching, trackingState]);

  const pauseTracking = useCallback(() => {
    if (trackingState !== 'tracking') return;
    pausedElapsedRef.current += Math.max(0, Date.now() - (liveStartRef.current || Date.now()));
    liveStartRef.current = null;
    setElapsedMs(pausedElapsedRef.current);
    setTrackingState('paused');
    animateSheetToIndex(1);
    stopWatching();
  }, [animateSheetToIndex, stopWatching, trackingState]);

  const resetTracking = useCallback(() => {
    stopWatching();
    liveStartRef.current = null;
    pausedElapsedRef.current = 0;
    lastPointRef.current = currentFix;
    setElapsedMs(0);
    setDistanceMeters(0);
    setElevationGainMeters(0);
    setCurrentSpeedMps(0);
    setRoutePoints(currentFix ? [currentFix] : []);
    setTrackingState('idle');
    setTrackerError('');
    setFollowUser(true);
    setDestinationPoints([]);
    setDestinationMode(false);
    setPlannedRoute(null);
    lastRouteOriginRef.current = null;
    lastRouteSignatureRef.current = '';
    setDestinationQuery('');
    setPlaceSuggestions([]);
    setPlaceSearchError('');
    animateSheetToIndex(1);
  }, [animateSheetToIndex, currentFix, stopWatching]);

  const handleMapPress = useCallback((point) => {
    if (!destinationMode || !point) return;

    setDestinationPoints((points) => [...points, point]);
    setFollowUser(false);
  }, [destinationMode]);

  const handleLocatePress = useCallback(() => {
    setFollowUser(true);
    setRecenterSignal((value) => value + 1);
  }, []);

  const handleDestinationToggle = useCallback(() => {
    setDestinationMode((value) => !value);
    setFollowUser(false);
  }, []);

  const handlePermissionBadgePress = useCallback(async () => {
    if (permissionState === 'granted') {
      return;
    }

    const result = await requestLocationPermission({ force: true });
    if (result.location === 'granted') {
      await ensurePermission();
      return;
    }

    router.push({
      pathname: '/settings',
      params: { permission: 'location' },
    });
  }, [ensurePermission, permissionState, router]);

  const handleClearDestination = useCallback(() => {
    setDestinationMode(false);
    setDestinationPoints([]);
    setDestinationQuery('');
    setPlaceSuggestions([]);
    setPlaceSearchError('');
  }, []);

  const handleSelectSuggestion = useCallback(async (suggestion) => {
    if (!suggestion?.id) return;

    setPlaceSearchLoading(true);
    setPlaceSearchError('');
    try {
      const resolvedPlace = await resolvePlaceDestination({
        placeId: suggestion.id,
        sessionToken: placeSessionTokenRef.current || undefined,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        title: suggestion.title || suggestion.description,
        subtitle: suggestion.subtitle || '',
      });
      setDestinationPoints((points) => [...points, {
        latitude: resolvedPlace.latitude,
        longitude: resolvedPlace.longitude,
      }]);
      setDestinationQuery(resolvedPlace.title || suggestion.title || suggestion.description || 'Destination');
      setPlaceSuggestions([]);
      setDestinationMode(false);
      setFollowUser(false);
      animateSheetToIndex(1);
    } catch (error) {
      setPlaceSearchError(error?.message || 'Unable to select destination.');
    } finally {
      setPlaceSearchLoading(false);
    }
  }, [animateSheetToIndex]);

  const finishTracking = useCallback(() => {
    if (hasSavedSession || finishSummary) return;

    const finalElapsed = trackingState === 'tracking'
      ? pausedElapsedRef.current + Math.max(0, Date.now() - (liveStartRef.current || Date.now()))
      : pausedElapsedRef.current;
    const durationMin = Math.max(1, Math.round((finalElapsed / 60000) * 10) / 10);
    const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;

    stopWatching();
    setElapsedMs(finalElapsed);
    setTrackingState('paused');

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sessionRecord = createWorkoutSessionRecord({
      title: `${label} Live Session`,
      type,
      durationMin,
      calories: Math.round(durationMin * caloriesPerMinute),
      distanceKm,
      notes: `Tracked live · pace ${formatPace(distanceMeters, finalElapsed)}`,
      createdAt: Date.now(),
    });
    setFinishSummary({
      date: dateKey,
      session: sessionRecord,
      xp: Math.max(0, Math.floor(Number(sessionRecord.awardedXP) || 0)),
      distanceKm,
      durationMin,
      calories: sessionRecord.calories,
    });
  }, [caloriesPerMinute, distanceMeters, finishSummary, hasSavedSession, label, stopWatching, trackingState, type]);

  const handleFinishCancel = useCallback(() => {
    setFinishSummary(null);
  }, []);

  const handleShareFinishSummary = useCallback(async () => {
    if (!finishSummary) return;

    const shareMessage = [
      `I just finished a ${label.toLowerCase()} session on Bodify.`,
      `+${finishSummary.xp} XP earned`,
      `${Number(finishSummary.distanceKm || 0).toFixed(1)} km`,
      `${formatDuration((Number(finishSummary.durationMin) || 0) * 60000)}`,
      `${Math.round(Number(finishSummary.calories) || 0)} cal`,
    ].join(' · ');

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'My Bodify workout',
          text: shareMessage,
        });
        return;
      }

      await Share.share({
        title: 'My Bodify workout',
        message: shareMessage,
      });
    } catch (error) {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareMessage);
          setTrackerError('Share sheet unavailable. Workout summary copied to clipboard.');
          return;
        } catch (_) {}
      }

      setTrackerError(error?.message || 'Unable to share workout summary.');
    }
  }, [finishSummary, label]);

  const handleFinishConfirm = useCallback(() => {
    if (!finishSummary?.session || !finishSummary?.date || hasSavedSession) return;

    setHasSavedSession(true);
    dispatch(
      addWorkoutSession({
        date: finishSummary.date,
        session: finishSummary.session,
      })
    );

    router.replace({
      pathname: '/Workout',
      params: {
        sessionSaved: '1',
        sessionSavedTitle: finishSummary.session.title || `${label} Live Session`,
      },
    });
  }, [dispatch, finishSummary, hasSavedSession, label, router]);

  useFocusEffect(useCallback(() => {
    ensurePermission();
    return undefined;
  }, [ensurePermission]));

  useEffect(() => {
    return () => stopWatching();
  }, [stopWatching]);

  useEffect(() => {
    if (trackingState !== 'tracking') return undefined;

    const interval = setInterval(() => {
      setElapsedMs(pausedElapsedRef.current + Math.max(0, Date.now() - (liveStartRef.current || Date.now())));
    }, 1000);

    return () => clearInterval(interval);
  }, [trackingState]);

  useEffect(() => {
    if (!destinationPoint || !currentFix || permissionState !== 'granted') {
      setRouteLoading(false);
      setPlannedRoute(null);
      lastRouteOriginRef.current = null;
      lastRouteSignatureRef.current = '';
      return undefined;
    }

    if (Platform.OS === 'web' && !mapReady) {
      return undefined;
    }

    const originChangedEnough = !lastRouteOriginRef.current
      || getDistanceInMeters(lastRouteOriginRef.current, currentFix) > 30;
    const destinationChanged = lastRouteSignatureRef.current !== destinationSignature;

    if (!originChangedEnough && !destinationChanged) {
      return undefined;
    }

    let cancelled = false;
    const requestId = routeRequestIdRef.current + 1;
    routeRequestIdRef.current = requestId;
    const timeoutId = setTimeout(async () => {
      setRouteLoading(true);
      try {
        const route = await fetchGoogleRoute({
          origin: currentFix,
          destination: destinationPoint,
          waypoints: routeWaypoints,
          activityType: type,
        });

        if (cancelled || routeRequestIdRef.current !== requestId) return;
        setPlannedRoute(route);
        lastRouteOriginRef.current = currentFix;
        lastRouteSignatureRef.current = destinationSignature;
      } catch (error) {
        if (cancelled || routeRequestIdRef.current !== requestId) return;
        setPlannedRoute((previousValue) => previousValue ? { ...previousValue, error: error?.message || 'Unable to load route.' } : null);
      } finally {
        if (!cancelled && routeRequestIdRef.current === requestId) {
          setRouteLoading(false);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [currentFix, destinationPoint, destinationSignature, mapReady, permissionState, routeWaypoints, type]);

  useEffect(() => {
    const trimmedQuery = destinationQuery.trim();
    if (trimmedQuery.length < 2) {
      setPlaceSuggestions([]);
      setPlaceSearchLoading(false);
      setPlaceSearchError('');
      return undefined;
    }

    if (Platform.OS === 'web' && !mapReady) {
      return undefined;
    }

    let cancelled = false;
    const requestId = placeRequestIdRef.current + 1;
    placeRequestIdRef.current = requestId;
    const timeoutId = setTimeout(async () => {
      setPlaceSearchLoading(true);
      setPlaceSearchError('');
      try {
        const suggestions = await fetchPlaceAutocomplete({
          query: trimmedQuery,
          locationBias: currentFix,
          sessionToken: placeSessionTokenRef.current || undefined,
        });
        if (cancelled || placeRequestIdRef.current !== requestId) return;
        setPlaceSuggestions(suggestions);
      } catch (error) {
        if (cancelled || placeRequestIdRef.current !== requestId) return;
        setPlaceSuggestions([]);
        setPlaceSearchError(error?.message || 'Unable to search destinations.');
      } finally {
        if (!cancelled && placeRequestIdRef.current === requestId) {
          setPlaceSearchLoading(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [currentFix, destinationQuery, mapReady]);

  const trackerStatusLabel = trackingState === 'tracking'
    ? 'GPS live'
    : trackingState === 'paused'
      ? 'Paused'
      : permissionState === 'granted'
        ? 'Ready'
        : 'Permission needed';

  const distanceKmLabel = (distanceMeters / 1000).toFixed(distanceMeters >= 1000 ? 2 : 1);
  const accuracyLabel = formatAccuracy(currentFix?.accuracy);
  const coordinatesLabel = currentFix
    ? `${currentFix.latitude.toFixed(5)}, ${currentFix.longitude.toFixed(5)}`
    : 'Waiting for location';
  const destinationDistanceMeters = currentFix && destinationPoint
    ? getDistanceInMeters(currentFix, destinationPoint)
    : 0;
  const mapOverlayTitle = destinationMode
    ? 'Tap the map to pin a destination'
    : followUser && currentFix
      ? 'Following your live location'
      : routePoints.length > 1
        ? 'Route path updating'
        : 'Map will draw as you move';
  const mapOverlayText = destinationMode
    ? 'Choose any point on the map to drop a destination pin.'
    : destinationPoint
      ? `Destination ${formatRemainingDistance(destinationDistanceMeters)} · ${coordinatesLabel}`
      : coordinatesLabel;
  const gpsSummary = permissionState === 'granted' ? `GPS ${accuracyLabel}` : 'GPS off';
  const routeStateSummary = trackingState === 'tracking'
    ? 'Recording route live'
    : trackingState === 'paused'
      ? 'Route paused'
      : destinationMode
        ? 'Tap map to add destination'
        : 'Ready to start';
  const destinationSummary = destinationPoint
    ? formatRemainingDistance(destinationDistanceMeters)
    : 'No destination';
  const stopCount = destinationPoints.length;
  const averageSpeedMps = elapsedMs > 0 ? distanceMeters / Math.max(1, elapsedMs / 1000) : 0;
  const liveSpeedLabel = formatSpeed(currentSpeedMps || averageSpeedMps);
  const averageSpeedLabel = formatSpeed(averageSpeedMps);
  const elevationLabel = formatElevation(elevationGainMeters);
  const etaLabel = formatEta(plannedRoute?.durationSec);
  const routeDistanceLabel = plannedRoute?.distanceMeters ? formatRemainingDistance(plannedRoute.distanceMeters) : destinationSummary;
  const routeSteps = plannedRoute?.steps || [];
  const gpsStatusCompact = permissionState === 'granted' ? accuracyLabel : 'Off';
  const routeStatusCompact = destinationMode
    ? 'Pinning'
    : trackingState === 'tracking'
      ? 'Live'
      : routePoints.length > 1
        ? 'Updating'
        : 'Ready';
  const destinationStatusCompact = destinationPoint
    ? (destinationDistanceMeters >= 1000 ? `${(destinationDistanceMeters / 1000).toFixed(1)} km` : `${Math.round(destinationDistanceMeters)} m`)
    : 'None';
  const routeSummaryTitle = routeLoading
    ? 'Loading best route'
    : plannedRoute?.summary
      ? plannedRoute.summary
      : destinationPoint
        ? `${stopCount > 1 ? `${stopCount} stops pinned` : 'Destination pinned'}`
        : 'No route planned';

  return (
    <View style={styles.container}>
      <View style={styles.mapStage}>
        <OutdoorLiveMap
          currentFix={currentFix}
          destinationPoint={destinationPoint}
          destinationPoints={destinationPoints}
          followUser={followUser}
          onMapPress={handleMapPress}
          onMapReady={() => setMapReady(true)}
          plannedRoutePoints={plannedRoute?.coordinates || []}
          recenterSignal={recenterSignal}
          routePoints={routePoints}
          style={styles.mapFullscreen}
        />

        <LinearGradient colors={['rgba(5,8,18,0.58)', 'rgba(5,8,18,0)']} style={styles.topFade} pointerEvents="none" />
        <LinearGradient colors={['rgba(5,8,18,0)', 'rgba(5,8,18,0.82)']} style={styles.bottomFade} pointerEvents="none" />

        <View style={styles.topBar}>
          <View style={styles.topBarShell}>
            <BackButton />
            <View style={styles.topBarCopy}>
              <Text style={styles.topBarTitle}>{label}</Text>
              <Text style={styles.topBarSubtitle}>{routeStateSummary}</Text>
            </View>
            {permissionState === 'granted' ? (
              <View style={styles.permissionChip}>
                <Ionicons name={icon} size={15} color="#dff8ff" />
                <Text style={styles.permissionChipText}>{trackerStatusLabel}</Text>
              </View>
            ) : (
              <Pressable onPress={handlePermissionBadgePress} style={({ pressed }) => [styles.permissionChip, styles.permissionChipAction, pressed && styles.buttonPressed]}>
                <Ionicons name="locate" size={15} color="#ffe7ce" />
                <Text style={styles.permissionChipText}>{trackerStatusLabel}</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.destinationSearchShell}>
            <View style={styles.destinationInputRow}>
              <Ionicons name="search" size={16} color="#88a3d9" />
              <TextInput
                value={destinationQuery}
                onChangeText={setDestinationQuery}
                placeholder="Search destination"
                placeholderTextColor="#6d80aa"
                style={styles.destinationInput}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {placeSearchLoading ? <Text style={styles.destinationSearchMeta}>...</Text> : null}
            </View>
            {placeSearchError ? <Text style={styles.destinationErrorText}>{placeSearchError}</Text> : null}
            {placeSuggestions.length > 0 ? (
              <View style={styles.destinationSuggestionsList}>
                {placeSuggestions.map((suggestion) => (
                  <Pressable key={suggestion.id} onPress={() => handleSelectSuggestion(suggestion)} style={({ pressed }) => [styles.destinationSuggestionRow, pressed && styles.buttonPressed]}>
                    <Ionicons name="location" size={16} color="#ffb347" />
                    <View style={styles.destinationSuggestionCopy}>
                      <Text style={styles.destinationSuggestionTitle}>{suggestion.title || suggestion.description}</Text>
                      {suggestion.subtitle ? <Text style={styles.destinationSuggestionSubtitle}>{suggestion.subtitle}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

        </View>

        <View style={styles.mapFabColumn}>
          <Pressable onPress={handleLocatePress} style={({ pressed }) => [styles.mapFab, followUser && styles.mapFabActive, pressed && styles.buttonPressed]}>
            <Ionicons name="locate" size={18} color={followUser ? '#06111f' : '#eaf7ff'} />
            <Text style={[styles.mapFabText, followUser && styles.mapFabTextActive]}>Locate</Text>
          </Pressable>
          <Pressable onPress={handleDestinationToggle} style={({ pressed }) => [styles.mapFab, destinationMode && styles.mapFabActive, pressed && styles.buttonPressed]}>
            <Ionicons name="pin" size={18} color={destinationMode ? '#06111f' : '#eaf7ff'} />
            <Text style={[styles.mapFabText, destinationMode && styles.mapFabTextActive]}>{destinationMode ? 'Tap map' : 'Pin'}</Text>
          </Pressable>
          {destinationPoint ? (
            <Pressable onPress={handleClearDestination} style={({ pressed }) => [styles.mapFab, styles.mapFabWarn, pressed && styles.buttonPressed]}>
              <Ionicons name="close" size={18} color="#ffe7ce" />
              <Text style={styles.mapFabText}>{stopCount > 1 ? 'Clear all' : 'Clear'}</Text>
            </Pressable>
          ) : null}
        </View>

        <Animated.View
          style={[
            styles.sessionSheet,
            {
              height: expandedSheetHeight,
              transform: [{ translateY: sheetTranslateRef.current }],
            },
          ]}
        >
          <LinearGradient colors={['rgba(8,12,26,0.82)', 'rgba(8,12,26,0.97)']} style={styles.sessionSheetFill}>
            <View {...sheetPanResponder.panHandlers}>
              <Pressable onPress={() => animateSheetToIndex((sheetSnapIndex + 1) % sheetSnapOffsets.length)}>
                <View style={styles.sheetHandle} />
              </Pressable>
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHeaderRow}>
                <View>
                  <Text style={styles.sheetEyebrow}>Live session</Text>
                  <Text style={styles.sheetTitle}>{label} Tracker</Text>
                </View>
                <View style={styles.headerActionRow}>
                  {trackingState === 'tracking' ? (
                    <Pressable onPress={pauseTracking} style={({ pressed }) => [styles.headerPauseAction, pressed && styles.buttonPressed]}>
                      <Ionicons name="pause" size={15} color="#f4fbff" />
                      <Text style={styles.headerPauseActionText}>Pause</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={startTracking} style={({ pressed }) => [styles.headerStartAction, pressed && styles.buttonPressed]}>
                      <Ionicons name={trackingState === 'paused' ? 'play' : 'radio'} size={15} color="#06111f" />
                      <Text style={styles.headerStartActionText}>{trackingState === 'paused' ? 'Resume' : 'Start'}</Text>
                    </Pressable>
                  )}

                  <Pressable
                    disabled={trackingState === 'tracking' || (distanceMeters < 20 && elapsedMs < 30000)}
                    onPress={finishTracking}
                    style={({ pressed }) => [
                      styles.headerFinishAction,
                      (trackingState === 'tracking' || (distanceMeters < 20 && elapsedMs < 30000)) && styles.finishActionDisabled,
                      pressed && trackingState !== 'tracking' && !(distanceMeters < 20 && elapsedMs < 30000) && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={15} color="#dff8ff" />
                    <Text style={styles.headerFinishActionText}>Finish</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.primaryMetricRow}>
                <View style={styles.primaryMetricCard}>
                  <Text style={styles.primaryMetricLabel}>Distance</Text>
                  <Text style={styles.primaryMetricValue}>{distanceKmLabel}<Text style={styles.primaryMetricUnit}> km</Text></Text>
                </View>
                <View style={styles.primaryMetricCard}>
                  <Text style={styles.primaryMetricLabel}>Time</Text>
                  <Text style={styles.primaryMetricValueCompact}>{formatDuration(elapsedMs)}</Text>
                </View>
                <View style={styles.primaryMetricCard}>
                  <Text style={styles.primaryMetricLabel}>Pace</Text>
                  <Text style={styles.primaryMetricValueCompact}>{formatPace(distanceMeters, elapsedMs)}</Text>
                </View>
              </View>

              <View style={styles.liveStrip}>
                <View style={styles.liveStripCard}>
                  <Text style={styles.liveStripLabel}>Speed</Text>
                  <Text style={styles.liveStripValue}>{liveSpeedLabel}</Text>
                </View>
                <View style={styles.liveStripCard}>
                  <Text style={styles.liveStripLabel}>Avg</Text>
                  <Text style={styles.liveStripValue}>{averageSpeedLabel}</Text>
                </View>
                <View style={styles.liveStripCard}>
                  <Text style={styles.liveStripLabel}>Climb</Text>
                  <Text style={styles.liveStripValue}>{elevationLabel}</Text>
                </View>
                <View style={styles.liveStripCard}>
                  <Text style={styles.liveStripLabel}>ETA</Text>
                  <Text style={styles.liveStripValue}>{etaLabel}</Text>
                </View>
              </View>

              <View style={styles.routeInfoRow}>
                <View style={styles.routeInfoCard}>
                  <Text style={styles.routeInfoLabel}>Route state</Text>
                  <Text style={styles.routeInfoValue}>{mapOverlayTitle}</Text>
                  <Text style={styles.routeInfoMeta}>{mapOverlayText}</Text>
                </View>
                <View style={styles.routeInfoCard}>
                  <Text style={styles.routeInfoLabel}>Accuracy</Text>
                  <Text style={styles.routeInfoValue}>{accuracyLabel}</Text>
                  <Text style={styles.routeInfoMeta}>{trackerStatusLabel}</Text>
                </View>
              </View>

              <View style={styles.routeSummaryCard}>
                <View style={styles.routeSummaryHeader}>
                  <View>
                    <Text style={styles.routeSummaryLabel}>Planned route</Text>
                    <Text style={styles.routeSummaryTitle}>{routeSummaryTitle}</Text>
                  </View>
                  <View style={styles.routeSummaryBadge}>
                    <Text style={styles.routeSummaryBadgeText}>{routeDistanceLabel}</Text>
                  </View>
                </View>
                <Text style={styles.routeSummaryMeta}>{routeLoading ? 'Refreshing route preview...' : `ETA ${etaLabel} ${destinationPoint ? `to ${stopCount > 1 ? `${stopCount} stops` : 'destination'}` : ''}`.trim()}</Text>
                {plannedRoute?.error ? <Text style={styles.routeSummaryError}>{plannedRoute.error}</Text> : null}
                {routeSteps.length > 0 ? (
                  <View style={styles.routeStepsList}>
                    {routeSteps.map((step, index) => (
                      <View key={step.id || `${index}`} style={styles.routeStepRow}>
                        <View style={styles.routeStepIndex}>
                          <Ionicons name={getManeuverIconName(step.maneuver)} size={14} color="#ffffff" />
                        </View>
                        <View style={styles.routeStepCopy}>
                          <Text style={styles.routeStepInstruction}>{step.instruction}</Text>
                          <Text style={styles.routeStepMeta}>{formatRemainingDistance(step.distanceMeters)} · {formatEta(step.durationSec)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              {trackerError ? <Text style={styles.errorText}>{trackerError}</Text> : null}

              <Pressable onPress={resetTracking} style={({ pressed }) => [styles.resetInlineButton, pressed && styles.buttonPressed]}>
                <Text style={styles.resetInlineText}>Reset route</Text>
              </Pressable>
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </View>

      <Modal
        visible={!!finishSummary}
        transparent
        animationType="fade"
        onRequestClose={handleFinishCancel}
      >
        <View style={styles.finishModalOverlay}>
          <View style={styles.finishModalCard}>
            <Text style={styles.finishModalEyebrow}>Session complete</Text>
            <Text style={styles.finishModalTitle}>Claim your track XP</Text>
            <Text style={styles.finishModalXP}>+{finishSummary?.xp || 0} XP</Text>
            <View style={styles.finishModalMetaRow}>
              <View style={styles.finishModalMetaPill}>
                <Text style={styles.finishModalMetaLabel}>Distance</Text>
                <Text style={styles.finishModalMetaValue}>{Number(finishSummary?.distanceKm || 0).toFixed(1)} km</Text>
              </View>
              <View style={styles.finishModalMetaPill}>
                <Text style={styles.finishModalMetaLabel}>Time</Text>
                <Text style={styles.finishModalMetaValue}>{formatDuration((Number(finishSummary?.durationMin) || 0) * 60000)}</Text>
              </View>
              <View style={styles.finishModalMetaPill}>
                <Text style={styles.finishModalMetaLabel}>Calories</Text>
                <Text style={styles.finishModalMetaValue}>{Math.round(Number(finishSummary?.calories) || 0)}</Text>
              </View>
            </View>
            <Text style={styles.finishModalNote}>XP is based on your tracked session length, calories, and workout type.</Text>
            <Pressable onPress={handleShareFinishSummary} style={({ pressed }) => [styles.finishModalShareAction, pressed && styles.buttonPressed]}>
              <Ionicons name="share-social" size={16} color="#dff8ff" />
              <Text style={styles.finishModalShareActionText}>Share to social</Text>
            </Pressable>
            <View style={styles.finishModalActionRow}>
              <Pressable onPress={handleFinishCancel} style={({ pressed }) => [styles.finishModalSecondaryAction, pressed && styles.buttonPressed]}>
                <Text style={styles.finishModalSecondaryActionText}>Back</Text>
              </Pressable>
              <Pressable onPress={handleFinishConfirm} style={({ pressed }) => [styles.finishModalPrimaryAction, pressed && styles.buttonPressed]}>
                <Ionicons name="flash" size={16} color="#06111f" />
                <Text style={styles.finishModalPrimaryActionText}>Claim XP</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050812',
  },
  mapStage: {
    flex: 1,
    backgroundColor: '#050812',
  },
  mapFullscreen: {
    ...StyleSheet.absoluteFillObject,
    height: undefined,
  },
  topFade: {
    ...StyleSheet.absoluteFillObject,
    height: 132,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 212,
  },
  topBar: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    gap: 6,
  },
  topBarShell: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(8,12,26,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(16px)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarCopy: {
    flex: 1,
  },
  topBarTitle: {
    color: '#f5fbff',
    fontSize: 15,
    fontWeight: '900',
  },
  topBarSubtitle: {
    color: '#9fb3ff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  destinationSearchShell: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(8,12,26,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  destinationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  destinationInput: {
    flex: 1,
    color: '#f4fbff',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 0,
  },
  destinationSearchMeta: {
    color: '#9fb3ff',
    fontSize: 12,
    fontWeight: '800',
  },
  destinationErrorText: {
    color: '#ffd1c9',
    fontSize: 11,
    fontWeight: '700',
  },
  destinationSuggestionsList: {
    gap: 6,
  },
  destinationSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  destinationSuggestionCopy: {
    flex: 1,
  },
  destinationSuggestionTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  destinationSuggestionSubtitle: {
    color: '#89a5d9',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  permissionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  permissionChipAction: {
    backgroundColor: 'rgba(255,179,71,0.14)',
    borderColor: 'rgba(255,179,71,0.26)',
  },
  permissionChipText: {
    color: '#f0f9ff',
    fontSize: 10,
    fontWeight: '900',
  },
  mapFabColumn: {
    position: 'absolute',
    right: 12,
    top: 108,
    gap: 6,
  },
  mapFab: {
    width: 48,
    minHeight: 48,
    borderRadius: 14,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,12,26,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 2,
  },
  mapFabActive: {
    backgroundColor: '#00eaff',
    borderColor: 'rgba(0,234,255,0.50)',
  },
  mapFabWarn: {
    borderColor: 'rgba(255,179,71,0.34)',
  },
  mapFabText: {
    color: '#eaf7ff',
    fontSize: 8,
    fontWeight: '800',
  },
  mapFabTextActive: {
    color: '#06111f',
  },
  sessionSheet: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  sessionSheetFill: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingBottom: 8,
  },
  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  sheetEyebrow: {
    color: '#88a3d9',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerStartAction: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#00eaff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerStartActionText: {
    color: '#06111f',
    fontSize: 10,
    fontWeight: '900',
  },
  headerPauseAction: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(122,92,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.32)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerPauseActionText: {
    color: '#f4fbff',
    fontSize: 10,
    fontWeight: '900',
  },
  headerFinishAction: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(64,223,155,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(64,223,155,0.30)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerFinishActionText: {
    color: '#dff8ff',
    fontSize: 10,
    fontWeight: '900',
  },
  primaryMetricRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  primaryMetricCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  primaryMetricLabel: {
    color: '#89a5d9',
    fontSize: 12,
    fontWeight: '800',
  },
  primaryMetricValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  primaryMetricUnit: {
    fontSize: 15,
    color: '#9fb3ff',
  },
  primaryMetricValueCompact: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
  },
  liveStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  liveStripCard: {
    flexGrow: 1,
    minWidth: 78,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  liveStripLabel: {
    color: '#89a5d9',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  liveStripValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 5,
  },
  secondaryMetricCard: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryMetricLabel: {
    color: '#89a5d9',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryMetricValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 5,
  },
  routeInfoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  routeInfoCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  routeInfoLabel: {
    color: '#89a5d9',
    fontSize: 11,
    fontWeight: '800',
  },
  routeInfoValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
  },
  routeInfoMeta: {
    color: '#9fb3ff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  routeSummaryCard: {
    marginTop: 8,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  routeSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  routeSummaryLabel: {
    color: '#89a5d9',
    fontSize: 11,
    fontWeight: '800',
  },
  routeSummaryTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 5,
  },
  routeSummaryBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,179,71,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,179,71,0.28)',
  },
  routeSummaryBadgeText: {
    color: '#ffe7ce',
    fontSize: 11,
    fontWeight: '800',
  },
  routeSummaryMeta: {
    color: '#9fb3ff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  routeSummaryError: {
    color: '#ffd1c9',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  routeStepsList: {
    gap: 8,
    marginTop: 10,
  },
  routeStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  routeStepIndex: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeStepCopy: {
    flex: 1,
  },
  routeStepInstruction: {
    color: '#f4fbff',
    fontSize: 11,
    fontWeight: '800',
  },
  routeStepMeta: {
    color: '#89a5d9',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  errorText: {
    color: '#ffd1c9',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  finishActionDisabled: {
    opacity: 0.45,
  },
  resetInlineButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resetInlineText: {
    color: '#9bb0d6',
    fontSize: 12,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  finishModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3,6,16,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  finishModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    backgroundColor: '#0b1224',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  finishModalEyebrow: {
    color: '#88a3d9',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  finishModalTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  finishModalXP: {
    color: '#00eaff',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 12,
  },
  finishModalMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  finishModalMetaPill: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  finishModalMetaLabel: {
    color: '#88a3d9',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  finishModalMetaValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
  },
  finishModalNote: {
    color: '#9fb3ff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 16,
  },
  finishModalShareAction: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishModalShareActionText: {
    color: '#dff8ff',
    fontSize: 13,
    fontWeight: '800',
  },
  finishModalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  finishModalSecondaryAction: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  finishModalSecondaryActionText: {
    color: '#f4fbff',
    fontSize: 13,
    fontWeight: '800',
  },
  finishModalPrimaryAction: {
    flex: 1.2,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#00eaff',
  },
  finishModalPrimaryActionText: {
    color: '#06111f',
    fontSize: 13,
    fontWeight: '900',
  },
});