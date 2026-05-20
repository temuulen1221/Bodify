import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const DEFAULT_DELTA = 0.01;

const getRegionFromPoints = (points, fallbackPoint) => {
  const validPoints = Array.isArray(points) && points.length > 0
    ? points
    : (fallbackPoint ? [fallbackPoint] : []);

  if (validPoints.length === 0) {
    return null;
  }

  const latitudes = validPoints.map((point) => point.latitude);
  const longitudes = validPoints.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, DEFAULT_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, DEFAULT_DELTA),
  };
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
  const mapRef = useRef(null);
  const provider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
  const [geoFallback, setGeoFallback] = useState(null);

  useEffect(() => {
    if (currentFix || geoFallback) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoFallback({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { timeout: 8000, maximumAge: 60000 },
    );
  }, [currentFix, geoFallback]);

  const region = useMemo(
    () => getRegionFromPoints(routePoints, currentFix || geoFallback),
    [routePoints, currentFix, geoFallback],
  );
  const markerPoint = currentFix || routePoints[routePoints.length - 1] || null;

  useEffect(() => {
    if (!mapRef.current || !currentFix || !followUser) return;

    mapRef.current.animateToRegion({
      latitude: currentFix.latitude,
      longitude: currentFix.longitude,
      latitudeDelta: DEFAULT_DELTA,
      longitudeDelta: DEFAULT_DELTA,
    }, 300);
  }, [currentFix, followUser]);

  useEffect(() => {
    if (!mapRef.current || !currentFix || !recenterSignal) return;

    mapRef.current.animateToRegion({
      latitude: currentFix.latitude,
      longitude: currentFix.longitude,
      latitudeDelta: DEFAULT_DELTA,
      longitudeDelta: DEFAULT_DELTA,
    }, 300);
  }, [currentFix, recenterSignal]);

  useEffect(() => {
    if (!mapRef.current || followUser) return;

    const coordinates = [
      ...routePoints,
      ...(currentFix ? [currentFix] : []),
      ...destinationPoints,
    ];

    if (coordinates.length === 0) return;

    if (coordinates.length === 1) {
      mapRef.current.animateToRegion({
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      }, 300);
      return;
    }

    mapRef.current.fitToCoordinates(coordinates, {
      animated: true,
      edgePadding: { top: 44, right: 44, bottom: 44, left: 44 },
    });
  }, [currentFix, destinationPoints, followUser, routePoints]);

  return (
    <View style={[styles.wrapper, style]}>
      <MapView
        ref={mapRef}
        provider={provider}
        style={styles.map}
        initialRegion={region}
        mapPadding={{ top: 24, right: 24, bottom: 24, left: 24 }}
        showsCompass={false}
        showsScale={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        customMapStyle={provider ? MAP_STYLE : undefined}
        onPress={(event) => onMapPress?.(event.nativeEvent.coordinate)}
        onMapReady={onMapReady}
      >
        {plannedRoutePoints.length > 1 ? (
          <Polyline
            coordinates={plannedRoutePoints}
            strokeColor="#ffb347"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {routePoints.length > 1 ? (
          <Polyline
            coordinates={routePoints}
            strokeColor="#00eaff"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {markerPoint ? (
          <Marker coordinate={markerPoint} title="Current location" pinColor="#7a5cff" />
        ) : null}
        {currentFix && destinationPoint ? (
          <Polyline
            coordinates={[currentFix, destinationPoint]}
            strokeColor="#ffb347"
            strokeWidth={3}
            lineDashPattern={[8, 8]}
          />
        ) : null}
        {destinationPoints.slice(0, -1).map((point, index) => (
          <Marker
            key={`stop-${index}`}
            coordinate={point}
            title={`Stop ${index + 1}`}
            pinColor="#8eb2ff"
          />
        ))}
        {destinationPoint ? (
          <Marker coordinate={destinationPoint} title="Destination" pinColor="#ffb347" />
        ) : null}
      </MapView>
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
    width: '100%',
    height: 220,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});