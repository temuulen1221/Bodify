import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithEmailAndPassword, signInWithPopup, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenFrame from '../components/ScreenFrame';
import { auth, db } from '../services/firebase';
import { hasCompletedAvatarSetup, loadUserState } from '../services/storage';
import { COLORS, GRADIENTS } from '../utils/constants';

const DEFAULT_LEVEL_CAP = 100;

WebBrowser.maybeCompleteAuthSession();

// Lazy-load @react-native-google-signin/google-signin to avoid crashing in Expo Go,
// where the native TurboModule 'RNGoogleSignin' does not exist.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getGoogleSignin = (): any => {
  if (Constants?.appOwnership === 'expo') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch {
    return null;
  }
};

const persistGoogleUser = async (signedInUser: User) => {
  if (!signedInUser?.uid) return;

  const userRef = doc(db, 'users', signedInUser.uid);
  const snapshot = await getDoc(userRef);
  const baseProfile = {
    email: signedInUser.email || '',
    displayName: signedInUser.displayName || '',
    photoURL: signedInUser.photoURL || '',
    provider: 'google',
    lastLoginAt: serverTimestamp(),
  };

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...baseProfile,
      createdAt: serverTimestamp(),
      points: 0,
      pointsMax: DEFAULT_LEVEL_CAP,
      totalXP: 0,
      energy: 0,
      discountTickets: 0,
      streakShields: 0,
      ownedShopItems: [],
      streakCount: 0,
      bestStreak: 0,
      lastWorkoutDate: null,
      recentRewards: [],
      lastRewardAt: null,
      lastLevelUpAt: null,
      lastLevelUpReward: null,
      lastLevelUpModalSeenAt: null,
      achievements: [],
      progress: 0,
      avatarName: signedInUser.displayName || '',
      height: '',
      weight: '',
      bodyShape: '',
      photoUri: signedInUser.photoURL || '',
      gender: '',
      level: 1,
      dailyStepGoal: 10000,
      weeklyWorkoutGoal: 5,
      targetWeight: '',
      dailyQuests: [],
      avatarSetupComplete: false,
    }, { merge: true });
    return;
  }

  await setDoc(userRef, baseProfile, { merge: true });
};

const resolvePostLoginRoute = async (signedInUser: User | null): Promise<string> => {
  if (!signedInUser?.uid) return '/Avatar';

  const [localUser, snapshot] = await Promise.all([
    loadUserState().catch(() => null),
    getDoc(doc(db, 'users', signedInUser.uid)).catch(() => null),
  ]);
  const remoteUser = snapshot?.exists?.() ? snapshot.data() : {};
  const hasAvatar = hasCompletedAvatarSetup(remoteUser) || hasCompletedAvatarSetup(localUser);
  return hasAvatar ? '/(tabs)/Home' : '/Avatar';
};

const getWebAutofillValue = (placeholder: string): string => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return '';

  const matchingInput = Array.from(document.querySelectorAll('input')).find(
    (input) => input.getAttribute('placeholder') === placeholder
  );

  return matchingInput?.value?.trim?.() || '';
};

const getFriendlyLoginError = (error: unknown): string => {
  const code = (error as { code?: string })?.code || '';

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Incorrect email or password. If this account was created with Google, use Sign in with Google.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many login attempts. Wait a moment and try again.';
  }

  return (error as Error)?.message || 'Could not log in.';
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [didStartGoogle, setDidStartGoogle] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isExpoGo = Constants?.appOwnership === 'expo';
  const appExtra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const redirectUri = makeRedirectUri((Platform.OS === 'web'
    ? { scheme: 'bodify' }
    : { native: 'bodify://redirect', scheme: 'bodify', path: 'redirect' }) as any);

  const webClientId = appExtra.googleWebClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '351839980449-tmdig61k3mom0b5rpnncsg149hvb0da9.apps.googleusercontent.com';
  const androidClientId = appExtra.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined;
  const iosClientId = appExtra.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;

  // In Expo Go: use the generic `clientId` key so expo-auth-session uses the web OAuth client.
  // The library selects by platform (iosClientId/androidClientId) and throws if that key is missing,
  // BUT it falls back to `clientId` before the invariant check — so passing `clientId` bypasses
  // the native-ID requirement while still using the web client, which supports the proxy redirect.
  // In real builds: pass all platform-specific IDs so the correct native OAuth flow is used.
  const googleClientIds = isExpoGo
    ? { clientId: webClientId }
    : {
        webClientId,
        ...(androidClientId ? { androidClientId } : {}),
        ...(iosClientId ? { iosClientId } : {}),
      };

  const [request, response, promptAsync] = Google.useAuthRequest({
    ...googleClientIds,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    // In Expo Go the auth proxy handles the code exchange; auto-exchange breaks the proxy flow.
    shouldAutoExchangeCode: !isExpoGo && Platform.OS !== 'web',
    selectAccount: true,
  });

  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    const GoogleSignin = getGoogleSignin();
    if (!GoogleSignin) return; // Not available in Expo Go — skip native configure
    GoogleSignin.configure({
      webClientId,
      ...(iosClientId ? { iosClientId } : {}),
    });
  }, [iosClientId, webClientId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) return;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace(await resolvePostLoginRoute(currentUser) as any);
      } catch (error) {
        console.warn('[login] Failed to resolve post-login route', error);
        router.replace('/Avatar');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const signInWithGoogle = async () => {
      try {
        if (response?.type === 'success') {
          const successResponse = response as any;
          const idToken = response.authentication?.idToken || successResponse.params?.id_token;
          if (!idToken) {
            throw new Error('Google sign-in did not return an ID token. Verify the Android OAuth client, redirect URI, and SHA-1 fingerprint in Google Cloud or Firebase.');
          }
          const credential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, credential);
          await persistGoogleUser(userCredential?.user);
          router.replace(await resolvePostLoginRoute(userCredential?.user) as any);
        }
      } catch (err) {
        console.warn('Google sign-in failed:', err, '\nResponse:', JSON.stringify(response));
        const errAny = err as any;
        const message = (errAny?.message || String(err)) || 'Unknown error';
        const responseAny = response as any;
        const errorParam = responseAny?.params?.error || responseAny?.error || '';
        Alert.alert('Sign-in failed', `${errorParam ? errorParam + ': ' : ''}${message}`);
      } finally {
        setDidStartGoogle(false);
      }
    };
    if (didStartGoogle && Platform.OS !== 'web') signInWithGoogle();
  }, [response, didStartGoogle, router]);

  const handleLogin = async () => {
    const resolvedEmail = (email || getWebAutofillValue('Email')).trim();
    const resolvedPassword = password || getWebAutofillValue('Password');

    setError('');

    if (!resolvedEmail || !resolvedPassword) {
      setError('Enter your email and password to log in. If your browser autofilled them, click into the fields once and try again.');
      return;
    }

    try {
      setLoading(true);
      setEmail(resolvedEmail);
      setPassword(resolvedPassword);

      const userCredential = await signInWithEmailAndPassword(auth, resolvedEmail, resolvedPassword);
      router.replace(await resolvePostLoginRoute(userCredential?.user) as any);
    } catch (err) {
      const message = getFriendlyLoginError(err);
      setError(message);
      if (Platform.OS !== 'web') {
        Alert.alert('Login failed', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // expo-auth-session removed useProxy in SDK 50; no redirect URI works with Google in Expo Go.
    // Google Sign-In requires a development build (EAS Build) on iOS/Android.
    if (isExpoGo) {
      Alert.alert(
        'Google Sign-In Unavailable',
        'Google Sign-In is not supported in Expo Go. Please use email/password, or install a development build to enable Google Sign-In.',
      );
      return;
    }
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        provider.addScope('openid');
        provider.addScope('profile');
        provider.addScope('email');
        const result = await signInWithPopup(auth, provider);
        await persistGoogleUser(result?.user);
        router.replace(await resolvePostLoginRoute(result?.user) as any);
        return;
      }

      if (Platform.OS === 'android') {
        try {
          const GoogleSignin = getGoogleSignin();
          if (!GoogleSignin) throw Object.assign(new Error('Native Google Sign-In not available'), { code: 'UNAVAILABLE' });
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const nativeResponse = await GoogleSignin.signIn();
          const googleUser = nativeResponse?.data ?? nativeResponse;
          const tokenResponse = await GoogleSignin.getTokens().catch(() => null);
          const idToken = tokenResponse?.idToken || (googleUser as any)?.idToken || null;
          const accessToken = tokenResponse?.accessToken || null;

          if (!idToken && !accessToken) {
            throw new Error('Google sign-in did not return usable Google tokens. Verify the Firebase Android app registration and Google sign-in configuration.');
          }

          const credential = idToken
            ? GoogleAuthProvider.credential(idToken)
            : GoogleAuthProvider.credential(null, accessToken);
          const userCredential = await signInWithCredential(auth, credential);
          await persistGoogleUser(userCredential?.user);
          router.replace(await resolvePostLoginRoute(userCredential?.user) as any);
          return;
        } catch (nativeErr) {
          // Native Google Sign-In failed (commonly DEVELOPER_ERROR when SHA-1 is not
          // registered in Firebase). Fall through to the expo-auth-session PKCE flow.
          const errCode = (nativeErr as any)?.code;
          if (errCode !== 'SIGN_IN_CANCELLED' && errCode !== 'SIGN_IN_REQUIRED') {
            console.warn('[Google] Native sign-in failed, falling back to browser flow:', nativeErr);
          }
          if (errCode === 'SIGN_IN_CANCELLED') return;
        }
      }

      setDidStartGoogle(true);
      await promptAsync({ windowName: 'oauth', preferEphemeralSession: false, showInRecents: true });
    } catch (err) {
      setDidStartGoogle(false);
      Alert.alert('Sign-in failed', (err as Error)?.message || 'Google sign-in failed.');
    }
  };

  return (
    <ScreenFrame>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <LinearGradient colors={GRADIENTS.futuristic as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
            <Image
              source={require('../assets/icons/icon/icon/android/mipmap-xxxhdpi/ic_launcher_foreground.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Log in to your Bodify account</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) setError('');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholderTextColor="rgba(255,255,255,0.65)"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (error) setError('');
              }}
              secureTextEntry
              autoComplete="current-password"
              placeholderTextColor="rgba(255,255,255,0.65)"
            />
            <TouchableOpacity style={[styles.button, loading ? styles.buttonDisabled : null]} onPress={handleLogin} activeOpacity={0.9} disabled={loading}>
              <LinearGradient colors={GRADIENTS.neonAccent as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonInner}>
                <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[styles.googleButton, isExpoGo ? { opacity: 0.45 } : null]}
              onPress={handleGoogleLogin}
              disabled={isExpoGo || (Platform.OS !== 'web' ? !request : false)}
              activeOpacity={0.7}
            >
              <View style={styles.googleButtonContent}>
                <Image source={require('../assets/icons/google.png')} style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>
                  {isExpoGo ? 'Google Sign-In (dev build only)' : 'Sign in with Google'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/signup')} style={styles.switchLink}>
              <Text style={styles.switchText}>Don&apos;t have an account? Sign Up </Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
          <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/Avatar')}>
            <Text style={styles.avatarButtonText}>Avatar</Text>
          </TouchableOpacity>
        </LinearGradient>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 24,
    padding: 28,
    width: '90%',
    maxWidth: 380,
      boxShadow: `0px 10px 20px ${COLORS.neonPurple}59`,
    elevation: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.35)'
  },
  logo: { width: 72, height: 72, marginBottom: 18, borderRadius: 16 },
  subtitle: {
    fontSize: 14,
    color: '#E8F9FF',
    textAlign: 'center',
    marginBottom: 18,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    color: '#fff',
  boxShadow: '0px 1px 8px rgba(0,231,255,0.45)',
  },
  input: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    borderColor: 'rgba(0,231,255,0.45)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    fontSize: 16,
    color: '#fff',
    marginBottom: 14,
  },
  errorText: {
    color: '#FFD7E0',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
    width: '100%',
  },
  button: { paddingVertical: 0, paddingHorizontal: 0, borderRadius: 24, marginBottom: 18, alignSelf: 'stretch' },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonInner: {
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 8px 16px ${COLORS.neonMagenta}59`,
    elevation: 10,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginBottom: 18,
    marginTop: 4,
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 220,
  },
  googleButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: 28 },
  googleIcon: { width: 26, height: 26, marginRight: 12, resizeMode: 'contain' },
  googleButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.2 },
  switchLink: { marginTop: 8 },
  switchText: { color: COLORS.neonCyan, fontSize: 14 },
  
  // daraan ustgah towch
  avatarButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0,231,255,0.8)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: `0px 4px 8px ${COLORS.neonPurple}4D`,
    elevation: 5,
  },
  avatarButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
