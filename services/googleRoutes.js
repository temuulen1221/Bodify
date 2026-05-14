import Constants from 'expo-constants';
import { Platform } from 'react-native';

const stripHtml = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const OPENSTREETMAP_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const GOOGLE_ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const normalizeTravelMode = (activityType) => {
  const normalized = String(activityType || '').toLowerCase();
  if (normalized.includes('cycle') || normalized.includes('bike')) {
    return 'BICYCLING';
  }
  return 'WALKING';
};

const normalizeRoutesTravelMode = (activityType) => {
  const normalized = String(activityType || '').toLowerCase();
  if (normalized.includes('cycle') || normalized.includes('bike')) {
    return 'BICYCLE';
  }
  return 'WALK';
};

const getRoutesRoutingPreference = (travelMode) => (
  travelMode === 'DRIVE' || travelMode === 'TWO_WHEELER'
    ? 'TRAFFIC_UNAWARE'
    : undefined
);

const getApiKey = () => {
  const envApiKey = typeof process !== 'undefined'
    ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || process.env.GOOGLE_MAPS_WEB_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_ANDROID_API_KEY || ''
    : '';

  if (envApiKey) return envApiKey;

  const extra = Constants.expoConfig?.extra || {};
  return extra.googleMapsWebApiKey || extra.googleMapsAndroidApiKey || '';
};

const decodePolyline = (encoded) => {
  if (!encoded) return [];

  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    latitude += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    longitude += deltaLng;

    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return coordinates;
};

const parseDurationSeconds = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value || '').trim();
  if (!normalized) return 0;

  const match = normalized.match(/^([\d.]+)s$/i);
  if (match) {
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) ? seconds : 0;
  }

  const seconds = Number(normalized);
  return Number.isFinite(seconds) ? seconds : 0;
};

const normalizePlacePrediction = (prediction) => ({
  id: prediction?.place_id || prediction?.placeId || prediction?.placePrediction?.placeId || prediction?.reference || prediction?.id || '',
  title: prediction?.structured_formatting?.main_text
    || prediction?.mainText?.toString?.()
    || prediction?.structuredFormat?.mainText?.text
    || prediction?.description
    || prediction?.text?.toString?.()
    || prediction?.text?.text
    || '',
  subtitle: prediction?.structured_formatting?.secondary_text
    || prediction?.secondaryText?.toString?.()
    || prediction?.structuredFormat?.secondaryText?.text
    || '',
  description: prediction?.description || prediction?.text?.toString?.() || prediction?.text?.text || '',
  latitude: Number(prediction?.latitude),
  longitude: Number(prediction?.longitude),
});

const buildFallbackPlacePrediction = (place) => {
  const title = String(place?.name || place?.display_name || 'Destination')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)[0] || 'Destination';
  const description = String(place?.display_name || title);
  const subtitle = description.startsWith(title)
    ? description.slice(title.length).replace(/^,\s*/, '')
    : description;

  return {
    id: `nominatim:${place?.place_id || description}`,
    title,
    subtitle,
    description,
    latitude: Number(place?.lat),
    longitude: Number(place?.lon),
  };
};

const isGooglePlacesAuthorizationError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('request_denied')
    || message.includes('api key is not authorized')
    || message.includes('not allowed to use the place service')
    || message.includes('apitargetblockedmaperror')
    || message.includes('places_api')
    || message.includes('places autocomplete request denied');
};

const fetchFallbackPlaceAutocomplete = async ({ query, locationBias }) => {
  const params = new URLSearchParams({
    q: String(query || '').trim(),
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
  });

  if (locationBias) {
    params.set('lat', `${locationBias.latitude}`);
    params.set('lon', `${locationBias.longitude}`);
  }

  const response = await fetch(`${OPENSTREETMAP_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to search destinations.');
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload.map(buildFallbackPlacePrediction).filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) : [];
};

const parseLegStep = (step, index) => ({
  id: `${index}`,
  instruction: stripHtml(step?.instructions || step?.html_instructions || 'Continue'),
  distanceMeters: Number(step?.distance?.value || 0),
  durationSec: Number(step?.duration?.value || 0),
  maneuver: step?.maneuver || '',
});

const normalizeStep = (step, index) => ({
  id: `${index}`,
  instruction: stripHtml(step?.instructions || step?.html_instructions || 'Continue'),
  distanceMeters: Number(step?.distance?.value || 0),
  durationSec: Number(step?.duration?.value || 0),
  maneuver: step?.maneuver || '',
});

const normalizeRoutesStep = (step, index) => ({
  id: `${index}`,
  instruction: stripHtml(step?.navigationInstruction?.instructions || 'Continue'),
  distanceMeters: Number(step?.distanceMeters || 0),
  durationSec: parseDurationSeconds(step?.staticDuration),
  maneuver: String(step?.maneuver || '').toLowerCase(),
});

const normalizeWaypoint = (point) => {
  if (!point) return null;
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
};

const buildRoutePayload = (route) => {
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  const totalDistanceMeters = legs.reduce((sum, leg) => sum + Number(leg?.distance?.value || 0), 0);
  const totalDurationSec = legs.reduce((sum, leg) => sum + Number(leg?.duration?.value || 0), 0);
  const steps = legs
    .flatMap((leg) => (Array.isArray(leg?.steps) ? leg.steps : []))
    .slice(0, 6)
    .map(normalizeStep);

  return {
    coordinates: decodePolyline(route?.overview_polyline?.points),
    distanceMeters: totalDistanceMeters,
    durationSec: totalDurationSec,
    summary: route?.summary || '',
    steps,
    source: 'google',
  };
};

const buildRoutesApiPayload = (route) => {
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  const steps = legs
    .flatMap((leg) => (Array.isArray(leg?.steps) ? leg.steps : []))
    .slice(0, 6)
    .map(normalizeRoutesStep);

  return {
    coordinates: decodePolyline(route?.polyline?.encodedPolyline),
    distanceMeters: Number(route?.distanceMeters || 0),
    durationSec: parseDurationSeconds(route?.duration),
    summary: route?.description || '',
    steps,
    routeToken: route?.routeToken || '',
    source: 'google-routes-api',
  };
};

const buildRoutesApiWaypoint = (point) => ({
  location: {
    latLng: {
      latitude: point.latitude,
      longitude: point.longitude,
    },
  },
});

const fetchRouteViaRoutesApi = async ({ origin, destination, waypoints = [], activityType }) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Google Maps API key is missing.');
  }
  const travelMode = normalizeRoutesTravelMode(activityType);

  const normalizedWaypoints = waypoints
    .map(normalizeWaypoint)
    .filter(Boolean);

  const response = await fetch(GOOGLE_ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'routes.description',
        'routes.distanceMeters',
        'routes.duration',
        'routes.polyline.encodedPolyline',
        'routes.routeToken',
        'routes.legs.steps.distanceMeters',
        'routes.legs.steps.staticDuration',
        'routes.legs.steps.maneuver',
        'routes.legs.steps.navigationInstruction.instructions',
      ].join(','),
    },
    body: JSON.stringify({
      origin: buildRoutesApiWaypoint(origin),
      destination: buildRoutesApiWaypoint(destination),
      intermediates: normalizedWaypoints.map(buildRoutesApiWaypoint),
      travelMode,
      ...(getRoutesRoutingPreference(travelMode) ? { routingPreference: getRoutesRoutingPreference(travelMode) } : {}),
      computeAlternativeRoutes: false,
      languageCode: 'en-US',
      units: 'METRIC',
      polylineQuality: 'HIGH_QUALITY',
      polylineEncoding: 'ENCODED_POLYLINE',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error?.status || 'Unable to load route.';
    throw new Error(message);
  }

  const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;
  if (!route) {
    throw new Error('No route found for this destination.');
  }

  return buildRoutesApiPayload(route);
};

const fetchRouteViaDirectionsService = async ({ origin, destination, waypoints = [], activityType }) => {
  const google = globalThis.google;
  if (!google?.maps?.DirectionsService) {
    throw new Error('Google DirectionsService is not ready yet.');
  }

  const directionsService = new google.maps.DirectionsService();
  const result = await directionsService.route({
    origin: { lat: origin.latitude, lng: origin.longitude },
    destination: { lat: destination.latitude, lng: destination.longitude },
    waypoints: waypoints
      .map(normalizeWaypoint)
      .filter(Boolean)
      .map((point) => ({
        location: { lat: point.latitude, lng: point.longitude },
        stopover: true,
      })),
    travelMode: normalizeTravelMode(activityType),
  });

  const route = result?.routes?.[0];
  if (!route || !Array.isArray(route?.legs) || route.legs.length === 0) {
    throw new Error('No route found for this destination.');
  }

  return buildRoutePayload(route);
};

const fetchRouteViaRestApi = async ({ origin, destination, waypoints = [], activityType }) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Google Maps API key is missing.');
  }

  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: normalizeTravelMode(activityType).toLowerCase(),
    key: apiKey,
  });

  const normalizedWaypoints = waypoints
    .map(normalizeWaypoint)
    .filter(Boolean)
    .map((point) => `${point.latitude},${point.longitude}`);

  if (normalizedWaypoints.length > 0) {
    params.set('waypoints', normalizedWaypoints.join('|'));
  }

  const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
  const payload = await response.json();

  if (payload?.status !== 'OK') {
    throw new Error(payload?.error_message || payload?.status || 'Unable to load route.');
  }

  const route = payload?.routes?.[0];
  if (!route || !Array.isArray(route?.legs) || route.legs.length === 0) {
    throw new Error('No route found for this destination.');
  }

  return buildRoutePayload(route);
};

export const fetchGoogleRoute = async ({ origin, destination, waypoints = [], activityType }) => {
  if (!origin || !destination) {
    return null;
  }

  try {
    return await fetchRouteViaRoutesApi({ origin, destination, waypoints, activityType });
  } catch (_) {
    if (Platform.OS === 'web') {
      return fetchRouteViaDirectionsService({ origin, destination, waypoints, activityType });
    }

    return fetchRouteViaRestApi({ origin, destination, waypoints, activityType });
  }
};

export const fetchPlaceAutocomplete = async ({ query, locationBias, sessionToken }) => {
  const trimmedQuery = String(query || '').trim();
  if (trimmedQuery.length < 2) {
    return [];
  }

  if (Platform.OS === 'web') {
    try {
      const google = globalThis.google;
      const AutocompleteSuggestion = google?.maps?.places?.AutocompleteSuggestion;
      if (AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmedQuery,
          sessionToken,
          origin: locationBias
            ? { lat: locationBias.latitude, lng: locationBias.longitude }
            : undefined,
          locationBias: locationBias
            ? {
              center: { lat: locationBias.latitude, lng: locationBias.longitude },
              radius: 30000,
            }
            : undefined,
        });

        return Array.isArray(response?.suggestions)
          ? response.suggestions
            .map((suggestion) => normalizePlacePrediction(suggestion?.placePrediction))
            .filter((suggestion) => suggestion.id)
            .slice(0, 5)
          : [];
      }

      const AutocompleteService = google?.maps?.places?.AutocompleteService;
      if (!AutocompleteService) {
        throw new Error('Google Places is not ready yet.');
      }

      const service = new AutocompleteService();
      const response = await service.getPlacePredictions({
        input: trimmedQuery,
        sessionToken,
        locationBias: locationBias
          ? {
            center: { lat: locationBias.latitude, lng: locationBias.longitude },
            radius: 30000,
          }
          : undefined,
      });

      return Array.isArray(response?.predictions) ? response.predictions.slice(0, 5).map(normalizePlacePrediction) : [];
    } catch (error) {
      if (!isGooglePlacesAuthorizationError(error)) {
        throw error;
      }

      return fetchFallbackPlaceAutocomplete({ query: trimmedQuery, locationBias });
    }
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return fetchFallbackPlaceAutocomplete({ query: trimmedQuery, locationBias });
  }

  const params = new URLSearchParams({
    input: trimmedQuery,
    key: apiKey,
  });

  if (locationBias) {
    params.set('location', `${locationBias.latitude},${locationBias.longitude}`);
    params.set('radius', '30000');
  }

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`);
  const payload = await response.json();

  if (!['OK', 'ZERO_RESULTS'].includes(payload?.status)) {
    const error = new Error(payload?.error_message || payload?.status || 'Unable to search places.');
    if (isGooglePlacesAuthorizationError(error)) {
      return fetchFallbackPlaceAutocomplete({ query: trimmedQuery, locationBias });
    }
    throw error;
  }

  return Array.isArray(payload?.predictions) ? payload.predictions.slice(0, 5).map(normalizePlacePrediction) : [];
};

export const resolvePlaceDestination = async ({ placeId, sessionToken, latitude, longitude, title, subtitle }) => {
  const normalizedLatitude = Number(latitude);
  const normalizedLongitude = Number(longitude);

  if (Number.isFinite(normalizedLatitude) && Number.isFinite(normalizedLongitude)) {
    return {
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      title: title || 'Destination',
      subtitle: subtitle || '',
    };
  }

  if (!placeId) {
    throw new Error('Place id is missing.');
  }

  if (Platform.OS === 'web') {
    const google = globalThis.google;
    const Place = google?.maps?.places?.Place;
    if (Place) {
      const place = new Place({ id: placeId });
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });

      if (!place.location) {
        throw new Error('Destination location is missing.');
      }

      return {
        latitude: place.location.lat(),
        longitude: place.location.lng(),
        title: place.displayName || place.formattedAddress || 'Destination',
        subtitle: place.formattedAddress || '',
      };
    }

    const PlacesService = google?.maps?.places?.PlacesService;
    if (!PlacesService) {
      throw new Error('Google Places is not ready yet.');
    }

    const serviceNode = globalThis.document?.createElement?.('div');
    const placesService = new PlacesService(serviceNode);
    const result = await new Promise((resolve, reject) => {
      placesService.getDetails({
        placeId,
        fields: ['geometry.location', 'name', 'formatted_address'],
        sessionToken,
      }, (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          reject(new Error(status || 'Unable to resolve destination.'));
          return;
        }
        resolve(place);
      });
    });

    return {
      latitude: result.geometry.location.lat(),
      longitude: result.geometry.location.lng(),
      title: result.name || result.formatted_address || 'Destination',
      subtitle: result.formatted_address || '',
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Google Maps API key is missing.');
  }

  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'geometry,name,formatted_address',
    key: apiKey,
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
  const payload = await response.json();

  if (payload?.status !== 'OK') {
    throw new Error(payload?.error_message || payload?.status || 'Unable to resolve destination.');
  }

  const result = payload?.result;
  const location = result?.geometry?.location;
  if (!location) {
    throw new Error('Destination location is missing.');
  }

  return {
    latitude: location.lat,
    longitude: location.lng,
    title: result?.name || result?.formatted_address || 'Destination',
    subtitle: result?.formatted_address || '',
  };
};