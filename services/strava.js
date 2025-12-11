import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/mobile/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API = 'https://www.strava.com/api/v3';

const makeRedirectUri = () => AuthSession.makeRedirectUri({ scheme: Constants.expoConfig?.scheme || 'bodify' });

export async function signInWithStrava() {
  const clientId = Constants.expoConfig?.extra?.stravaClientId || Constants.expoConfig?.stravaClientId;
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
  const clientId = Constants.expoConfig?.extra?.stravaClientId;
  const clientSecret = Constants.expoConfig?.extra?.stravaClientSecret;
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri })
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`);
  const json = await res.json();
  await storeToken(json);
  return json;
}

async function refreshTokenIfNeeded(token) {
  if (!token?.expires_at || token.expires_at * 1000 > Date.now() + 60_000) return token; // still valid
  const clientId = Constants.expoConfig?.extra?.stravaClientId;
  const clientSecret = Constants.expoConfig?.extra?.stravaClientSecret;
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: token.refresh_token })
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
  const json = await res.json();
  await storeToken(json);
  return json;
}

export async function getStoredToken() {
  const raw = await SecureStore.getItemAsync('strava_token');
  return raw ? JSON.parse(raw) : null;
}

async function storeToken(token) {
  await SecureStore.setItemAsync('strava_token', JSON.stringify(token));
}

export async function fetchRecentActivities(limit = 10) {
  let token = await getStoredToken();
  if (!token) throw new Error('No Strava token stored');
  token = await refreshTokenIfNeeded(token);
  const res = await fetch(`${STRAVA_API}/athlete/activities?per_page=${limit}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!res.ok) throw new Error(`Strava activities failed: ${res.status}`);
  return res.json();
}
