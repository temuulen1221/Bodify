import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from "expo-router";
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { LogBox, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider, useDispatch } from 'react-redux';
import BadgeLevelUpModal from '../components/BadgeLevelUpModal';
import ErrorBoundary from '../components/ErrorBoundary';
import LevelUpRewardModal from '../components/LevelUpRewardModal';
import { ensureBackgroundStepTaskRegistered } from '../services/backgroundSteps';
import { auth } from '../services/firebase';
import { startGlobalStepTracking } from '../services/stepsService';
import { loadAwardsState, loadRemoteUserState, loadStepsState, loadUserState, mergeHydratedUserState } from '../services/storage';
import store, { hydrateQuests, hydrateSteps, hydrateUser, hydrateWorkouts } from '../store';

// Suppress known benign warnings
LogBox.ignoreLogs([
  'expo-background-fetch: This library is deprecated',
]);

const HOME_FRAME_WIDTH = 414;

const GradientHeader = ({ title }: { title: string }) => {
  const { width: windowWidth } = useWindowDimensions();
  const frameWidth = Math.min(windowWidth, HOME_FRAME_WIDTH);

  return (
    <View style={styles.headerShell}>
      <LinearGradient
        colors={["#5421FF", "#6A00FF", "#00E7FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerFrame, { width: frameWidth }]}
      >
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleText}>
            {title}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
};

// Mobile frame base dimensions (default iPhone 13). Adjustable via query ?frame=w,h or localStorage 'frameSize'.
const DEFAULT_BASE_WIDTH = 390;
const DEFAULT_BASE_HEIGHT = 844;

const WebMobileFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [useMobileFrame, setUseMobileFrame] = useState(false);
  const [scale, setScale] = useState(1);
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : DEFAULT_BASE_WIDTH);
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : DEFAULT_BASE_HEIGHT);
  const [baseSize, setBaseSize] = useState({ w: DEFAULT_BASE_WIDTH, h: DEFAULT_BASE_HEIGHT });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const parseFrameSize = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const frameParamRaw = params.get('frame');
        const useFrame = !!frameParamRaw;
        setUseMobileFrame(useFrame);
        if (!useFrame) {
          return;
        }
        const frameParam = frameParamRaw; // e.g. 1 or 428,926
        let w = DEFAULT_BASE_WIDTH;
        let h = DEFAULT_BASE_HEIGHT;
        if (frameParam && frameParam !== '1') {
          const parts = frameParam.split(',').map(p => parseInt(p.trim(), 10));
          if (parts.length === 2 && parts.every(n => Number.isFinite(n) && n > 200)) {
            w = parts[0]; h = parts[1];
          }
        } else if (window.localStorage.getItem('frameSize')) {
          const saved = window.localStorage.getItem('frameSize');
          const parts = saved?.split(',').map(p => parseInt(p.trim(), 10)) || [];
          if (parts.length === 2 && parts.every(n => Number.isFinite(n) && n > 200)) {
            w = parts[0]; h = parts[1];
          }
        }
        setBaseSize({ w, h });
      } catch (_) {}
    };

    const recalc = () => {
      if (!useMobileFrame) {
        setScale(1);
        return;
      }
      const wWin = window.innerWidth;
      const hWin = window.innerHeight;
      setVw(wWin); setVh(hWin);
      // Allow scaling UP so the frame fills more space (choose uniform scale to fit viewport).
      const sW = wWin / baseSize.w;
      const sH = hWin / baseSize.h;
      const s = Math.min(sW, sH); // may be >1
      setScale(s);
    };

    parseFrameSize();
    recalc();
  window.addEventListener('resize', recalc);
    // Expose quick resize shortcuts (press 1/2/3 to change device preset)
    const keyHandler = (e: KeyboardEvent) => {
      const presets: Record<string, [number, number]> = {
        '1': [360, 800],        // small Android
        '2': [390, 844],        // iPhone 13
        '3': [428, 926],        // iPhone 13 Pro Max
        '4': [412, 915],        // Pixel 7
      };
      if (presets[e.key]) {
        const [w, h] = presets[e.key];
        setBaseSize({ w, h });
        window.localStorage.setItem('frameSize', `${w},${h}`);
        setTimeout(recalc, 30);
      } else if (e.key === '0') {
        // Reset to default
        setBaseSize({ w: DEFAULT_BASE_WIDTH, h: DEFAULT_BASE_HEIGHT });
        window.localStorage.removeItem('frameSize');
        setTimeout(recalc, 30);
      }
    };
    if (useMobileFrame) {
      window.addEventListener('keydown', keyHandler);
    }
    return () => {
      window.removeEventListener('resize', recalc);
      if (useMobileFrame) {
        window.removeEventListener('keydown', keyHandler);
      }
    };
  }, [useMobileFrame]);

  if (Platform.OS !== 'web') {
    return <>{children}</>; // native platforms unchanged
  }

  if (!useMobileFrame) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#f5f7fa',
        }}
      >
        {children}
      </div>
    );
  }

  // Frame style: center, apply scale transform, preserve aspect
  return (
    <div
      style={{
        width: baseSize.w,
        height: baseSize.h,
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        // allocate available space so scroll gestures work
        display: 'flex',
        flexDirection: 'column',
        marginLeft: 'auto',
        marginRight: 'auto',
        // Provide breathing room background
        background: '#f5f7fa',
        boxShadow: '0 0 32px rgba(0,0,0,0.25)',
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {children}
      {/* Minimal on-screen size helper */}
      <div style={{position:'absolute', top:4, right:8, fontSize:11, fontFamily:'system-ui', color:'#fff', background:'rgba(0,0,0,0.35)', padding:'4px 8px', borderRadius:12, pointerEvents:'none'}}>
        {`${baseSize.w}x${baseSize.h} @ ${scale.toFixed(2)} (keys 1-4 switch, 0 reset)`}
      </div>
    </div>
  );
};

export default function RootLayout() {
  const StoreBootstrapper: React.FC = () => {
    const dispatch = useDispatch();
    useEffect(() => {
      let stopStepTracking = () => {};
      let didCancel = false;
      const authUnsubscribe = onAuthStateChanged(auth, async () => {
        try {
          const [localData, remoteData] = await Promise.all([
            loadUserState(),
            loadRemoteUserState(),
          ]);
          if (didCancel) return;
          const mergedUser = mergeHydratedUserState(localData as any, remoteData as any);
          if (Object.keys(mergedUser).length > 0) {
            dispatch(hydrateUser(mergedUser));
          }
        } catch (error) {
          console.warn('[layout] Failed to hydrate merged user state', error);
        }
      });

      (async () => {
        const [data, remoteData] = await Promise.all([
          loadUserState(),
          loadRemoteUserState(),
        ]);
        const mergedUser = mergeHydratedUserState(data as any, remoteData as any);
        if (Object.keys(mergedUser).length > 0) dispatch(hydrateUser(mergedUser));
        const awards = await loadAwardsState();
        if (awards?.quests) dispatch(hydrateQuests(awards.quests));
        if (awards?.workouts) dispatch(hydrateWorkouts(awards.workouts));
        const steps = await loadStepsState();
        if (steps) dispatch(hydrateSteps(steps));
        // Register background step tracking task (no-op on web)
        try { if (Platform.OS !== 'web') await ensureBackgroundStepTaskRegistered(); } catch {}
        stopStepTracking = startGlobalStepTracking(dispatch);
      })();

      return () => {
        didCancel = true;
        authUnsubscribe();
        stopStepTracking();
      };
    }, [dispatch]);
    return null;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ErrorBoundary>
    <Provider store={store}>
      <WebMobileFrame>
        <StoreBootstrapper />
        <LevelUpRewardModal />
        <BadgeLevelUpModal />
        <Stack
          screenOptions={{
            header: ({ options }) => <GradientHeader title={options.title || ''} />,
            headerTitle: '',
            headerTintColor: '#fff',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="Avatar" options={{ headerShown: false }} />
          <Stack.Screen name="Leaderboard" options={{ headerShown: false }} />
          <Stack.Screen name="Profile" options={{ headerShown: false }} />
          <Stack.Screen name="SocialProfile" options={{ headerShown: false }} />
          <Stack.Screen name="Rest" options={{ headerShown: false }} />
          <Stack.Screen name="Shop" options={{ headerShown: false }} />
          <Stack.Screen name="Theme" options={{ headerShown: false }} />
          <Stack.Screen name="Workout" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="outdoor-tracker" options={{ headerShown: false }} />
          <Stack.Screen name="ai-avatar-demo" options={{ headerShown: false }} />
          <Stack.Screen name="avatar-web" options={{ title: 'Web Avatar' }} />
          <Stack.Screen name="Squat" options={{ title: 'Squat (Legacy)' }} />
          <Stack.Screen name="Pose" options={{ headerShown: false }} />
          <Stack.Screen name="battle-replay" options={{ title: 'Battle Replay' }} />
        </Stack>
      </WebMobileFrame>
    </Provider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  headerFrame: {
    minHeight: 88,
    justifyContent: 'flex-end',
  },
  headerTitleWrap: {
    paddingBottom: 12,
  },
  headerTitleText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 22,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? { textShadow: '0px 1px 6px rgba(0,231,255,0.5)' }
      : {
          textShadowColor: 'rgba(0,231,255,0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 6,
        }),
  },
});
