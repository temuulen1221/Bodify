import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

type AvatarWebComponent = typeof import('../components/AvatarWeb').default;

let WebAvatar: AvatarWebComponent | null = null;
if (Platform.OS === 'web') {
  // Lazy require so native bundles never evaluate the web-only component.
  WebAvatar = require('../components/AvatarWeb').default;
}

const DEFAULT_PROFILE = {
  height: '172',
  weight: '68',
  gender: 'male',
};

const WebOnlyMessage = () => (
  <View style={styles.fallbackContainer}>
    <Text style={styles.heading}>Open on Web</Text>
    <Text style={styles.body}>
      The VRM/GLB viewer runs inside a WebGL canvas. Start Expo with
      {' `expo start --web` '}and visit the{' '}
      <Text style={styles.bold}>/avatar-web</Text> route in a desktop browser.
    </Text>
  </View>
);

export default function AvatarWebScreen() {
  if (Platform.OS !== 'web' || !WebAvatar) {
    return <WebOnlyMessage />;
  }

  const avatarProps = useMemo(
    () => ({
      ...DEFAULT_PROFILE,
      rotationSpeed: 0.15,
      sizeMultiplier: 1.05,
      alignFootToBottom: true,
      bottomPadding: 0.08,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Web VRM Avatar Preview</Text>
      <Text style={[styles.body, styles.bodyIntro]}>
        Uses Three.js + @react-three/fiber. Replace the model props below to test custom VRM or GLB
        files bundled under `assets/models/`.
      </Text>
      <View style={styles.canvasShell}>
        <WebAvatar {...avatarProps} />
      </View>
      <Text style={styles.footerNote}>
        Tip: open the browser devtools console to see loader logs from `components/AvatarWeb.js`.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 960,
    marginHorizontal: 'auto',
    padding: 24,
  },
  canvasShell: {
    width: '100%',
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#020409',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginVertical: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: '#222',
  },
  bodyIntro: {
    marginBottom: 4,
  },
  footerNote: {
    fontSize: 14,
    color: '#444',
    marginTop: 8,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  bold: {
    fontWeight: '600',
  },
});
