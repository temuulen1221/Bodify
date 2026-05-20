import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenFrame from '../components/ScreenFrame';
import { auth, db } from '../services/firebase';
import { COLORS, GRADIENTS } from '../utils/constants';

const DEFAULT_LEVEL_CAP = 100;

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidEmail = (e: string) => /.+@.+\..+/.test(String(e || '').trim());

  const handleSignUp = async () => {
    try {
      setError('');
      const e = email.trim();
      if (!isValidEmail(e)) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please make sure both password fields match.');
        setLoading(false);
        return;
      }
      setLoading(true);
      // Check if email is already taken
  const methods = await fetchSignInMethodsForEmail(auth, e);
      if (methods && methods.length > 0) {
        setError('This email is already in use.');
        setLoading(false);
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, e, password);
      const uid = cred?.user?.uid;
      if (uid) {
        // Create or merge minimal user profile document with default resources
        await setDoc(
          doc(db, 'users', uid),
          {
            email: cred.user.email || e,
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
            avatarName: '',
            height: '',
            weight: '',
            bodyShape: '',
            photoUri: '',
            gender: '',
            level: 1,
            dailyStepGoal: 10000,
            weeklyWorkoutGoal: 5,
            targetWeight: '',
            dailyQuests: [],
            avatarSetupComplete: false
          },
          { merge: true }
        );
      }
      // Proceed to avatar setup
      router.replace('/Avatar');
    } catch (err) {
  setError((err as Error)?.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenFrame>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient colors={GRADIENTS.futuristic as [string, string, ...string[]]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.gradientBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
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
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholderTextColor="rgba(255,255,255,0.65)"
            />
            <TouchableOpacity style={[styles.button, (loading ? { opacity: 0.7 } : null)]} onPress={handleSignUp} activeOpacity={0.9} disabled={loading}>
              <LinearGradient colors={GRADIENTS.neonAccent as [string, string, ...string[]]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.buttonInner}>
                <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Sign Up'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            {!!error && (
                              <>
                                {typeof error === 'string' && (
                                  <Text style={styles.errorText}>{error}</Text>
                                )}
                              </>
            )}
            <TouchableOpacity onPress={() => router.replace('/login')} style={styles.switchLink}>
              <Text style={styles.switchText}>Already have an account ? Login </Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'bold',
    flexWrap: 'wrap',
    maxWidth: 340,
    alignSelf: 'center',
  },
   errorHint: {
     color: 'rgba(255,255,255,0.7)',
     fontSize: 13,
     marginTop: 2,
     marginBottom: 8,
     textAlign: 'center',
     fontWeight: '400',
     lineHeight: 18,
   },
  gradientBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 56,
    width: '98%',
    maxWidth: 600,
    minWidth: 340,
    ...require('../utils/shadow').makeShadow(COLORS.neonPurple, 0, 10, 20, 0.35),
    elevation: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.35)'
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#fff',
    textShadow: '0px 1px 8px rgba(0,231,255,0.45)',
  },
  input: {
    width: '100%',
    maxWidth: 480,
    minWidth: 260,
    height: 52,
    borderColor: 'rgba(0,231,255,0.45)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(222, 211, 211, 0.08)',
    fontSize: 18,
    color: '#fff',
    marginBottom: 18,
  },
  button: { paddingVertical: 0, paddingHorizontal: 0, borderRadius: 24, marginBottom: 18, alignSelf: 'stretch' },
  buttonInner: { paddingVertical: 14, borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.neonMagenta, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchLink: {
    marginTop: 8,
  },
  switchText: { color: COLORS.neonCyan, fontSize: 15 },
});
