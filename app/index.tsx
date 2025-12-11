import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect as useReactEffect, useState } from 'react';
import SplashScreen from '../components/SplashScreen';
import { auth } from '../services/firebase';
// Removed direct imports for LoginScreen and SignUpScreen, navigation is now handled by expo-router




const AppWithSplash = () => {
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();

  useReactEffect(() => {
    if (!showSplash) {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          router.replace('/(tabs)/Home');
        } else {
          router.replace('/login');
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