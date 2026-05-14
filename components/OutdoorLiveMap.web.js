import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import Constants from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const DEFAULT_ZOOM = 15;
const LOADER_CONFIG_FLAG = '__bodifyGoogleMapsLoaderConfigured';

const getApiKey = () => {
  const envApiKey = typeof process !== 'undefined'
    ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || process.env.GOOGLE_MAPS_WEB_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
    : '';
  if (envApiKey) return envApiKey;

  const extra = Constants.expoConfig?.extra || {};
  return extra.googleMapsWebApiKey || '';
};

const getMapId = () => {
  const envMapId = typeof process !== 'undefined'
    ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || process.env.GOOGLE_MAPS_MAP_ID || ''
    : '';
  if (envMapId) return envMapId;

  const extra = Constants.expoConfig?.extra || {};
  return extra.googleMapsMapId || 'DEMO_MAP_ID';
};

const getBoundsPayload = (points, fallbackPoint) => {
  const validPoints = Array.isArray(points) && points.length > 0
    ? points
    : (fallbackPoint ? [fallbackPoint] : []);
  return validPoints.map((point) => ({ lat: point.latitude, lng: point.longitude }));
};

const toLatLng = (point) => ({ lat: point.latitude, lng: point.longitude });

const hasGoogleMapsScript = () => {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]'));
};

export default function OutdoorLiveMap({
  routePoints = [],
  plannedRoutePoints = [],
  currentFix = null,
  followUser = true,
  recenterSignal = 0,
  destinationPoint = null,
  destinationPoints = [],
  onMapPress,
  style,
  onMapReady,
}) {
  const [containerNode, setContainerNode] = useState(null);
  const [loadError, setLoadError] = useState('');
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const polylineRef = useRef(null);
  const plannedPolylineRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const stopMarkersRef = useRef([]);
  const guidePolylineRef = useRef(null);
  const googleRef = useRef(null);
  const onMapPressRef = useRef(onMapPress);
  const onMapReadyRef = useRef(onMapReady);
  const boundsPayload = useMemo(() => getBoundsPayload(routePoints, currentFix), [routePoints, currentFix]);
  const plannedBoundsPayload = useMemo(() => getBoundsPayload(plannedRoutePoints), [plannedRoutePoints]);
  const apiKey = getApiKey();
  const mapId = getMapId();

  useEffect(() => {
    onMapPressRef.current = onMapPress;
  }, [onMapPress]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (!apiKey || !containerNode) {
      return undefined;
    }

    let cancelled = false;

    const setupMap = async () => {
      setLoadError('');
      if (hasGoogleMapsScript()) {
        globalThis[LOADER_CONFIG_FLAG] = true;
      }

      if (!globalThis[LOADER_CONFIG_FLAG]) {
        setOptions({ key: apiKey, v: 'weekly' });
        globalThis[LOADER_CONFIG_FLAG] = true;
      }
      const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
        importLibrary('maps'),
        importLibrary('marker'),
        importLibrary('places'),
      ]);
      const google = window.google;
      if (cancelled || !containerNode) return;

      googleRef.current = google;
      mapRef.current = new Map(containerNode, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        ...(mapId ? { mapId } : {}),
        disableDefaultUI: true,
        clickableIcons: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        ...(!mapId ? { styles: MAP_STYLE } : {}),
      });

      polylineRef.current = new google.maps.Polyline({
        map: mapRef.current,
        strokeColor: '#00eaff',
        strokeOpacity: 1,
        strokeWeight: 5,
      });

      plannedPolylineRef.current = new google.maps.Polyline({
        map: mapRef.current,
        strokeColor: '#ffb347',
        strokeOpacity: 1,
        strokeWeight: 4,
      });

      guidePolylineRef.current = new google.maps.Polyline({
        map: mapRef.current,
        strokeColor: '#ffb347',
        strokeOpacity: 0.9,
        strokeWeight: 3,
      });

      markerRef.current = new AdvancedMarkerElement({
        map: mapRef.current,
        title: 'Current location',
        content: new PinElement({
          background: '#7a5cff',
          borderColor: '#d9d0ff',
          glyphColor: '#ffffff',
          scale: 1.05,
        }),
      });

      destinationMarkerRef.current = new AdvancedMarkerElement({
        map: mapRef.current,
        title: 'Destination',
        content: new PinElement({
          background: '#ffb347',
          borderColor: '#ffe2b8',
          glyphColor: '#0c1329',
          scale: 1,
        }),
      });

      mapRef.current.addListener('click', (event) => {
        if (!event?.latLng) return;
        onMapPressRef.current?.({
          latitude: event.latLng.lat(),
          longitude: event.latLng.lng(),
        });
      });

      onMapReadyRef.current?.();
    };

    setupMap().catch((error) => {
      if (!cancelled) {
        setLoadError(String(error?.message || error || 'Google Maps failed to load.'));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiKey, containerNode]);

  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    const marker = markerRef.current;
    const polyline = polylineRef.current;
    const plannedPolyline = plannedPolylineRef.current;
    const destinationMarker = destinationMarkerRef.current;
    const stopMarkers = stopMarkersRef.current;
    const guidePolyline = guidePolylineRef.current;

    if (!google || !map || !marker || !polyline || !plannedPolyline || !destinationMarker || !guidePolyline) return;

    const path = boundsPayload;
    polyline.setPath(path);
    plannedPolyline.setPath(plannedBoundsPayload);
    guidePolyline.setPath(currentFix && destinationPoint ? [toLatLng(currentFix), toLatLng(destinationPoint)] : []);

    if (currentFix) {
      marker.position = toLatLng(currentFix);
      marker.map = map;
    } else if (path.length > 0) {
      marker.position = path[path.length - 1];
      marker.map = map;
    } else {
      marker.map = null;
    }

    if (destinationPoint) {
      destinationMarker.position = toLatLng(destinationPoint);
      destinationMarker.map = map;
    } else {
      destinationMarker.map = null;
    }

    stopMarkers.forEach((markerInstance) => {
      markerInstance.map = null;
    });
    stopMarkersRef.current = [];

    const intermediateStops = Array.isArray(destinationPoints) ? destinationPoints.slice(0, -1) : [];
    intermediateStops.forEach((point, index) => {
      const markerInstance = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: toLatLng(point),
        title: `Stop ${index + 1}`,
        content: new google.maps.marker.PinElement({
          background: '#1f2945',
          borderColor: '#8eb2ff',
          glyphColor: '#dff8ff',
          glyph: `${index + 1}`,
          scale: 0.9,
        }),
      });
      stopMarkersRef.current.push(markerInstance);
    });

    if (currentFix && (followUser || recenterSignal > 0)) {
      map.panTo(toLatLng(currentFix));
      if (map.getZoom() < DEFAULT_ZOOM) {
        map.setZoom(DEFAULT_ZOOM);
      }
      return;
    }

    if (path.length > 0 || plannedBoundsPayload.length > 0 || destinationPoints.length > 0) {
      const pointsToFit = [
        ...path,
        ...plannedBoundsPayload,
        ...destinationPoints.map(toLatLng),
      ];
      if (pointsToFit.length === 1) {
        map.setCenter(pointsToFit[0]);
        map.setZoom(DEFAULT_ZOOM);
      } else {
        const bounds = new google.maps.LatLngBounds();
        pointsToFit.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, 48);
      }
    } else {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  }, [boundsPayload, currentFix, destinationPoint, destinationPoints, followUser, plannedBoundsPayload, recenterSignal]);

  if (!apiKey || loadError) {
    return (
      <View style={[styles.wrapper, styles.fallback]}>
        <Text style={styles.fallbackTitle}>{apiKey ? 'Google Maps failed to load' : 'Google Maps key missing'}</Text>
        <Text style={styles.fallbackText}>{loadError || 'Set the web Google Maps API key to render the realtime map.'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      <div ref={setContainerNode} style={styles.domMap} />
    </View>
  );
}

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#11162d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9fb3ff' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#11162d' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a355e' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#7082b8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2240' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#28356c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1b2b58' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#071423' }] },
];

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    width: '100%',
    height: '100%',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  domMap: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c1329',
    paddingHorizontal: 20,
  },
  fallbackTitle: {
    color: '#f4fbff',
    fontSize: 14,
    fontWeight: '800',
  },
  fallbackText: {
    color: '#9fb3ff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
});