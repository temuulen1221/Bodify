import React from 'react';
import Avatar from './avatar';
import { useVroidAuth } from './useVroidAuth';

export default function AvatarVroidExample() {
  const { accessToken, avatars, selectedAvatarUrl, signIn, selectAvatar } = useVroidAuth();
  const [error, setError] = React.useState(null);

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h2>VRoid Avatar Integration</h2>
      <button style={{ padding: '10px 20px', fontSize: 16, marginBottom: 20 }} onClick={async () => {
        try {
          await signIn();
          setError(null);
        } catch (_e) {
          setError('Sign in failed. Please try again.');
        }
      }}>
        Sign in with VRoid Hub
      </button>
      {accessToken && <div style={{ color: 'green', marginBottom: 8 }}>Signed in</div>}
      {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
      {avatars.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3>Select your VRoid avatar:</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {avatars.map((avatar) => (
              <li key={avatar.id} style={{ marginBottom: 10 }}>
                <button style={{ padding: '8px 16px', fontSize: 15 }} onClick={() => selectAvatar(avatar.model_url)}>
                  {avatar.name || 'Avatar'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {selectedAvatarUrl && (
        <div>
          <h3>Selected Avatar Preview:</h3>
          <div style={{ width: '100%', height: 400, border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden', background: '#f9f9f9' }}>
            <Avatar model={selectedAvatarUrl} />
          </div>
        </div>
      )}
    </div>
  );
}