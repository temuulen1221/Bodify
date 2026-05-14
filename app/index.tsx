import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect as useReactEffect, useState } from 'react';
import SplashScreen from '../components/SplashScreen';
import { auth, db } from '../services/firebase';
import { hasCompletedAvatarSetup, loadUserState } from '../services/storage';
// Removed direct imports for LoginScreen and SignUpScreen, navigation is now handled by expo-router




const AppWithSplash = () => {
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();

  useReactEffect(() => {
    if (!showSplash) {
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace('/login');
          return;
        }

        try {
          const [localUser, snapshot] = await Promise.all([
            loadUserState().catch(() => null),
            getDoc(doc(db, 'users', user.uid)).catch(() => null),
          ]);
          const remoteUser = snapshot?.exists?.() ? snapshot.data() : {};
          const hasAvatar = hasCompletedAvatarSetup(remoteUser) || hasCompletedAvatarSetup(localUser);
          router.replace(hasAvatar ? '/(tabs)/Home' : '/Avatar');
        } catch (error) {
          console.warn('[index] Failed to resolve post-auth route', error);
          router.replace('/Avatar');
        }
      });
      return () => unsub();
    }
  }, [showSplash, router]);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }
  // Optionally, render nothing while redirecting
  return null;
};

export default AppWithSplash;