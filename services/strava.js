import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/mobile/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN_STORAGE_KEY = 'strava_token';

const makeRedirectUri = () => AuthSession.makeRedirectUri({ scheme: Constants.expoConfig?.scheme || 'bodify' });

const getClientId = () => (
  Constants.expoConfig?.extra?.stravaClientId
  || Constants.expoConfig?.stravaClientId
  || (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID : '')
  || (typeof process !== 'undefined' ? process.env.STRAVA_CLIENT_ID : '')
  || ''
);

const getClientSecret = () => (
  Constants.expoConfig?.extra?.stravaClientSecret
  || Constants.expoConfig?.stravaClientSecret
  || (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET : '')
  || (typeof process !== 'undefined' ? process.env.STRAVA_CLIENT_SECRET : '')
  || ''
);

export function getStravaConfigStatus() {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  return {
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    ready: Boolean(clientId && clientSecret),
  };
}

const parseStoredToken = (rawToken) => {
  if (!rawToken) return null;
  try {
    const token = JSON.parse(rawToken);
    if (!token || typeof token !== 'object') return null;
    return token;
  } catch (_) {
    return null;
  }
};

const isTokenUsable = (token) => {
  return Boolean(token?.access_token && token?.refresh_token);
};

export async function signInWithStrava() {
  const clientId = getClientId();
  if (!clientId) throw new Error('Missing Strava clientId. Set expo.extra.stravaClientId in app.json');

  const redirectUri = makeRedirectUri();
  const authUrl = `${STRAVA_AUTH_URL}?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=auto&scope=read,activity:read_all,profile:read_all`;
  const result = await AuthSession.startAsync({ authUrl });
  if (result.type !== 'success' || !result.params?.code) {
    throw new Error('Strava auth cancelled');
  }
  return exchangeToken(result.params.code, redirectUri);
}

async function exchangeToken(code, redirectUri) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('Missing Strava credentials. Set stravaClientId and stravaClientSecret in expo config.');
  }

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri })
  });
  if (!res.ok) {
    const errorPayload = await res.text().catch(() => '');
    throw new Error(`Strava token exchange failed (${res.status}). ${errorPayload || ''}`.trim());
  }
  const json = await res.json();
  await storeToken(json);
  return json;
}

async function refreshTokenIfNeeded(token) {
  if (!isTokenUsable(token)) {
    throw new Error('Strava token missing required fields. Please reconnect Strava.');
  }
  if (!token?.expires_at || token.expires_at * 1000 > Date.now() + 60_000) return token;

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('Missing Strava credentials. Set stravaClientId and stravaClientSecret in expo config.');
  }

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: token.refresh_token })
  });
  if (!res.ok) {
    const errorPayload = await res.text().catch(() => '');
    throw new Error(`Strava token refresh failed (${res.status}). ${errorPayload || ''}`.trim());
  }
  const json = await res.json();
  await storeToken(json);
  return json;
}

export async function getStoredToken() {
  const raw = await SecureStore.getItemAsync(STRAVA_TOKEN_STORAGE_KEY);
  return parseStoredToken(raw);
}

async function storeToken(token) {
  await SecureStore.setItemAsync(STRAVA_TOKEN_STORAGE_KEY, JSON.stringify(token));
}

export async function clearStoredToken() {
  await SecureStore.deleteItemAsync(STRAVA_TOKEN_STORAGE_KEY);
}

export async function getStravaConnectionStatus() {
  const token = await getStoredToken();
  if (!token) {
    return { connected: false, expiresAt: 0, athlete: null };
  }

  const expiresAtMs = Number(token?.expires_at || 0) * 1000;
  return {
    connected: isTokenUsable(token),
    expiresAt: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
    athlete: token?.athlete || null,
  };
}

async function ensureAccessToken() {
  let token = await getStoredToken();
  if (!token) throw new Error('No Strava token stored');
  token = await refreshTokenIfNeeded(token);

  if (!token?.access_token) {
    throw new Error('Strava access token missing. Please reconnect Strava.');
  }
  return token;
}

export async function fetchRecentActivities(limit = 10) {
  const normalizedLimit = Math.max(1, Math.min(50, Number(limit) || 10));
  let token = await ensureAccessToken();
  let res = await fetch(`${STRAVA_API}/athlete/activities?per_page=${normalizedLimit}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  // Handle edge-case token invalidation even if expires_at looked valid.
  if (res.status === 401) {
    token = await refreshTokenIfNeeded({ ...token, expires_at: 0 });
    res = await fetch(`${STRAVA_API}/athlete/activities?per_page=${normalizedLimit}`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
  }

  if (!res.ok) {
    const errorPayload = await res.text().catch(() => '');
    throw new Error(`Strava activities failed (${res.status}). ${errorPayload || ''}`.trim());
  }

  return res.json();
}
