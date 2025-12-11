import { startAsync } from 'expo-auth-session';
import { useState } from 'react';

const clientId = 'TnxdTWAAmz3lX9N59xgcExCYx0kBmAzHGP-BLL_6OVU';
const redirectUri = 'https://bodify.expo.app/';
const scopes = ['heart', 'default'];
const authorizationEndpoint = 'https://hub.vroid.com/oauth/authorize';
const tokenEndpoint = 'https://hub.vroid.com/oauth/token';

export function useVroidAuth() {
  const [accessToken, setAccessToken] = useState(null);
  const [avatars, setAvatars] = useState([]);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(null);

  const signIn = async () => {
    const authUrl = `${authorizationEndpoint}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes.join(' ')}`;
  const result = await startAsync({ authUrl });

    if (result.type === 'success' && result.params.code) {
      // Exchange code for access token
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=authorization_code&code=${result.params.code}&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&client_secret=fEZJ27abVSknhcFJFhLYQIMYKR3EEk5LKHGl0RJcioA`
      });
      if (!response.ok) throw new Error('Failed to get access token');
      const data = await response.json();
      setAccessToken(data.access_token);

      // Fetch user's avatars from VRoid Hub
      const avatarRes = await fetch('https://hub.vroid.com/api/characters/me', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });
      if (!avatarRes.ok) throw new Error('Failed to fetch avatars');
      const avatarData = await avatarRes.json();
      setAvatars(avatarData.characters || []);
    } else {
      throw new Error('Authentication failed');
    }
  };

  const selectAvatar = (modelUrl) => {
    setSelectedAvatarUrl(modelUrl);
  };

  return { accessToken, avatars, selectedAvatarUrl, signIn, selectAvatar };
}