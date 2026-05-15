import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BackButton from '../components/BackButton';
import ScreenFrame from '../components/ScreenFrame';
import { getLocationPermissionStatus, requestLocationPermission } from '../services/locationPermissions';
import { getMediaPermissionsStatus, requestMediaPermissions } from '../services/mediaPermissions';

const formatPermissionLabel = (value: any) => {
  switch (String(value || '').toLowerCase()) {
    case 'granted':
      return 'Granted';
    case 'blocked':
      return 'Blocked';
    case 'denied':
      return 'Denied';
    case 'undetermined':
      return 'Not asked';
    default:
      return 'Unknown';
  }
};

export default function SettingsScreen() {
  const [permissionState, setPermissionState] = useState({
    camera: 'unknown',
    microphone: 'unknown',
    location: 'unknown',
    requestedBefore: false,
    locationRequestedBefore: false,
    locationCanAskAgain: true,
    error: '',
    locationError: '',
  });
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsRefreshing, setPermissionsRefreshing] = useState(false);

  const permissionTarget = Array.isArray(params?.permission) ? params.permission[0] : params?.permission || '';
  const locationFocused = permissionTarget === 'location';

  useEffect(() => {
    let cancelled = false;

    const loadPermissions = async () => {
      const [mediaResult, locationResult] = await Promise.all([
        getMediaPermissionsStatus(),
        getLocationPermissionStatus(),
      ]);
      if (cancelled) return;
      setPermissionState({
        ...mediaResult,
        location: locationResult.location,
        locationRequestedBefore: locationResult.requestedBefore,
        locationCanAskAgain: locationResult.canAskAgain,
        locationError: locationResult.error || '',
      } as any);
      setPermissionsLoading(false);
    };

    loadPermissions();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPermissions = async (force = false) => {
    setPermissionsRefreshing(true);
    const [mediaResult, locationResult] = await Promise.all([
      force ? requestMediaPermissions({ force: true }) : getMediaPermissionsStatus(),
      getLocationPermissionStatus(),
    ]);
    setPermissionState({
      ...mediaResult,
      location: locationResult.location,
      locationRequestedBefore: locationResult.requestedBefore,
      locationCanAskAgain: locationResult.canAskAgain,
      locationError: locationResult.error || '',
    } as any);
    setPermissionsRefreshing(false);
  };

  const refreshLocationPermission = async (force = false) => {
    setPermissionsRefreshing(true);
    const [mediaResult, locationResult] = await Promise.all([
      getMediaPermissionsStatus(),
      force ? requestLocationPermission({ force: true }) : getLocationPermissionStatus(),
    ]);
    setPermissionState({
      ...mediaResult,
      location: locationResult.location,
      locationRequestedBefore: locationResult.requestedBefore,
      locationCanAskAgain: locationResult.canAskAgain,
      locationError: locationResult.error || '',
    } as any);
    setPermissionsRefreshing(false);
  };

  const openSystemSettings = async () => {
    if (Platform.OS === 'web') {
      await refreshLocationPermission(true);
      return;
    }

    try {
      await Linking.openSettings();
    } catch (_) {
      await refreshLocationPermission(true);
    }
  };

  const cameraDenied = ['denied', 'blocked'].includes(String(permissionState.camera || '').toLowerCase());
  const microphoneDenied = ['denied', 'blocked'].includes(String(permissionState.microphone || '').toLowerCase());
  const locationDenied = ['denied', 'blocked'].includes(String(permissionState.location || '').toLowerCase());
  const hasDeniedPermission = cameraDenied || microphoneDenied;

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.container}>
        <LinearGradient colors={["#5421FF", "#6A00FF", "#00E7FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View style={{ marginBottom: 12 }}>
            <BackButton />
          </View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Customize your Bodify experience</Text>
          <View style={styles.separator} />

          <Pressable style={styles.row} onPress={() => router.push('/Avatar')}>
            <Text style={styles.rowText}>Edit Avatar</Text>
          </Pressable>
          <Pressable style={styles.row}><Text style={styles.rowText}>Notifications</Text></Pressable>
          <Pressable style={styles.row}><Text style={styles.rowText}>Theme</Text></Pressable>
          <Pressable style={styles.row}><Text style={styles.rowText}>Privacy</Text></Pressable>

          <View style={styles.permissionSection}>
            <Text style={styles.sectionTitle}>Device Permissions</Text>
            <Text style={styles.sectionSubtitle}>Camera, microphone, and outdoor GPS access can be updated here.</Text>

            <View style={[styles.permissionCard, locationFocused && styles.permissionCardFocused]}>
              <View style={styles.permissionRow}>
                <View>
                  <Text style={styles.permissionTitle}>Camera</Text>
                  <Text style={styles.permissionValue}>{permissionsLoading ? 'Checking...' : formatPermissionLabel(permissionState.camera)}</Text>
                </View>
              </View>

              <View style={styles.permissionDivider} />

              <View style={styles.permissionRow}>
                <View>
                  <Text style={styles.permissionTitle}>Microphone</Text>
                  <Text style={styles.permissionValue}>{permissionsLoading ? 'Checking...' : formatPermissionLabel(permissionState.microphone)}</Text>
                </View>
              </View>

              <View style={styles.permissionDivider} />

              <View style={styles.permissionRow}>
                <View>
                  <Text style={styles.permissionTitle}>Location</Text>
                  <Text style={styles.permissionValue}>{permissionsLoading ? 'Checking...' : formatPermissionLabel(permissionState.location)}</Text>
                </View>
                <Pressable
                  style={[styles.inlinePermissionButton, locationDenied && styles.inlinePermissionButtonPrimary]}
                  onPress={() => (locationDenied && !permissionState.locationCanAskAgain ? openSystemSettings() : refreshLocationPermission(true))}
                >
                  <Text style={styles.inlinePermissionButtonText}>{locationDenied && !permissionState.locationCanAskAgain ? 'Open settings' : 'Enable'}</Text>
                </Pressable>
              </View>

              <Text style={styles.permissionMeta}>
                {permissionState.requestedBefore ? 'Permission prompt has been shown before on this device.' : 'Permission prompt has not been shown yet on this device.'}
              </Text>

              <Text style={styles.permissionMeta}>
                {permissionState.locationRequestedBefore ? 'Location permission prompt has been shown before for outdoor tracking.' : 'Location permission prompt has not been shown yet for outdoor tracking.'}
              </Text>

              {hasDeniedPermission ? (
                <View style={styles.permissionHint}>
                  <Text style={styles.permissionHintTitle}>Access is currently blocked</Text>
                  <Text style={styles.permissionHintText}>
                    If tapping Request again does not reopen the prompt, update this site or app permission in your browser or device settings, then refresh this screen.
                  </Text>
                </View>
              ) : null}

              {locationDenied ? (
                <View style={[styles.permissionHint, styles.permissionHintLocation]}>
                  <Text style={styles.permissionHintTitle}>Outdoor GPS is off</Text>
                  <Text style={styles.permissionHintText}>
                    Tap Enable to request location again. If the browser or device has blocked it already, use Open settings and allow location access for Bodify.
                  </Text>
                </View>
              ) : null}

              {permissionState.error ? <Text style={styles.permissionError}>{permissionState.error}</Text> : null}
              {permissionState.locationError ? <Text style={styles.permissionError}>{permissionState.locationError}</Text> : null}

              <View style={styles.permissionActions}>
                <Pressable style={styles.permissionButton} onPress={() => refreshPermissions(false)}>
                  <Text style={styles.permissionButtonText}>{permissionsRefreshing ? 'Refreshing...' : 'Refresh status'}</Text>
                </Pressable>
                <Pressable style={[styles.permissionButton, styles.permissionButtonPrimary]} onPress={() => refreshPermissions(true)}>
                  <Text style={styles.permissionButtonText}>Request again</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 120, backgroundColor: '#05020B' },
  card: { borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textShadowColor: 'rgba(0,231,255,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  subtitle: { color: 'rgba(255,255,255,0.8)', marginTop: 6, marginBottom: 12 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 6 },
  row: { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: 'rgba(0,231,255,0.35)', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, marginTop: 10 },
  rowText: { color: '#fff', fontWeight: '600' },
  permissionSection: { marginTop: 18 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: 'rgba(255,255,255,0.78)', marginTop: 6, lineHeight: 19 },
  permissionCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(8,10,18,0.34)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.28)',
  },
  permissionCardFocused: {
    borderColor: 'rgba(255,179,71,0.7)',
    shadowColor: '#ffb347',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  permissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  permissionTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  permissionValue: { color: 'rgba(232,249,255,0.82)', marginTop: 4, fontWeight: '600' },
  inlinePermissionButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  inlinePermissionButtonPrimary: {
    backgroundColor: 'rgba(255,179,71,0.14)',
    borderColor: 'rgba(255,179,71,0.36)',
  },
  inlinePermissionButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  permissionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.16)', marginVertical: 12 },
  permissionMeta: { color: 'rgba(255,255,255,0.74)', marginTop: 14, lineHeight: 18 },
  permissionHint: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,109,91,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,109,91,0.32)',
  },
  permissionHintLocation: {
    backgroundColor: 'rgba(255,179,71,0.12)',
    borderColor: 'rgba(255,179,71,0.32)',
  },
  permissionHintTitle: { color: '#FFF2ED', fontSize: 13, fontWeight: '800' },
  permissionHintText: { color: 'rgba(255,242,237,0.86)', marginTop: 5, lineHeight: 18, fontWeight: '500' },
  permissionError: { color: '#FFE3E3', marginTop: 10, lineHeight: 18, fontWeight: '600' },
  permissionActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  permissionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  permissionButtonPrimary: {
    backgroundColor: 'rgba(0,231,255,0.16)',
    borderColor: 'rgba(0,231,255,0.36)',
  },
  permissionButtonText: { color: '#fff', fontWeight: '700' },
});
