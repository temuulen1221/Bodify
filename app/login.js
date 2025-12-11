import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../services/firebase';
import { COLORS, GRADIENTS } from '../utils/constants';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [didStartGoogle, setDidStartGoogle] = useState(false);

  // Use system browser except inside Expo Go
  const isExpoGo = Constants?.appOwnership === 'expo';
  const useProxy = Platform.OS === 'web' ? false : isExpoGo;
  const redirectUri = makeRedirectUri({ useProxy, scheme: 'bodify' });

  const googleClientIds = {
    webClientId: '395792534119-gv8ldff77a88kiuauikhjepr44e3n1e0.apps.googleusercontent.com',
    expoClientId: '395792534119-omb37fsn45c3o1ek79b7dcqjl0g87qda.apps.googleusercontent.com',
    androidClientId: '395792534119-umrkv075vdca1vn9rmqk1prp2341n1tk.apps.googleusercontent.com',
  };

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    ...googleClientIds,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
  });

  useEffect(() => {
    const signInWithGoogle = async () => {
      try {
        if (response?.type === 'success') {
          const idToken = response.params?.id_token;
          if (!idToken) return;
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
          router.replace('/(tabs)/Home');
        }
      } catch (err) {
        console.warn('Google sign-in failed:', err, '\nResponse:', JSON.stringify(response));
        const message = (err && (err.message || String(err))) || 'Unknown error';
        const errorParam = response?.params?.error || response?.error || '';
        Alert.alert('Sign-in failed', `${errorParam ? errorParam + ': ' : ''}${message}`);
      } finally {
        setDidStartGoogle(false);
      }
    };
    if (didStartGoogle) signInWithGoogle();
  }, [response, didStartGoogle, router]);

  const handleLogin = async () => {
    if (email && password) {
      try {
        // Use Firebase Auth to sign in and persist session
          await signInWithEmailAndPassword(auth, email, password);
        router.replace('/(tabs)/Home');
      } catch (err) {
        Alert.alert('Login failed', err?.message || 'Could not log in.');
      }
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={GRADIENTS.futuristic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientBg}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Image source={require('../assets/images/icon.png')} style={styles.logo} />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Log in to your Bodify account</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="rgba(255,255,255,0.65)"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="rgba(255,255,255,0.65)"
            />
            <TouchableOpacity style={styles.button} onPress={handleLogin} activeOpacity={0.9}>
              <LinearGradient colors={GRADIENTS.neonAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonInner}>
                <Text style={styles.buttonText}>Login</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => {
                setDidStartGoogle(true);
                promptAsync({ useProxy, redirectUri, windowName: 'oauth', prefersEphemeralSession: false, showInRecents: true });
              }}
              disabled={!request}
              activeOpacity={0.7}
            >
              <View style={styles.googleButtonContent}>
                <Image source={require('../assets/icons/google.png')} style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
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
  button: { paddingVertical: 0, paddingHorizontal: 0, borderRadius: 24, marginBottom: 18, alignSelf: 'stretch' },
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
