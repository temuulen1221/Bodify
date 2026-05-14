import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import type { Href } from 'expo-router';
import { Tabs, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import ScreenFrame from '../../components/ScreenFrame';

const USE_NATIVE_DRIVER = false;

function FancyTabBar(props: BottomTabBarProps) {
  const { state, navigation } = props;
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current; // 0 closed, 1 open
  const sweep = useRef(new Animated.Value(0)).current; // animated glow sweep 0..1
  const ringPulse = useRef(new Animated.Value(0.25)).current; // 0..1 opacity pulse

  const toggleOpen = () => {
    const to = open ? 0 : 1;
    setOpen(!open);
    Animated.spring(anim, {
      toValue: to,
      useNativeDriver: USE_NATIVE_DRIVER,
      friction: 7,
      tension: 140,
    }).start();
  };

  // Cyberpunk glow sweep animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 5000, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(sweep, { toValue: 0, duration: 5000, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    ).start();
  }, [sweep]);

  // Subtle pulsing ring around FAB
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 0.4, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(ringPulse, { toValue: 0.18, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    ).start();
  }, [ringPulse]);

  const navigateTo = (href: Href) => {
    router.replace(href);
  };

  const activeColor = '#00E7FF';
  const inactiveColor = 'rgba(0,231,255,0.6)';
  const frameWidth = Math.min(windowWidth, 414);
  const frameHeight = Math.min(windowHeight, 896);
  const frameBottomInset = Math.max(0, (windowHeight - frameHeight) / 2);
  const barWidthPx = Math.min(frameWidth - 24, 370);
  const shadowWidthPx = Math.max(0, barWidthPx - 18);
  const glowWidthPx = Math.max(0, barWidthPx - 6);

  const leftRoute = useMemo(() => state.routes[0], [state.routes]);
  const centerRoute = useMemo(() => state.routes[1], [state.routes]);
  const rightRoute = useMemo(() => state.routes[2], [state.routes]);

  // Floating actions positions (orbit around the center FAB)
  const actionOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const radius = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 68] }); // tighter orbit around FAB
  // Angles for left/top/right in radians (210°, 270°, 330°)
  const ANG_LEFT = (210 * Math.PI) / 180;
  const ANG_TOP = (270 * Math.PI) / 180;
  const ANG_RIGHT = (330 * Math.PI) / 180;
  const LEFT_COS = Math.cos(ANG_LEFT);
  const LEFT_SIN = Math.sin(ANG_LEFT);
  const TOP_COS = Math.cos(ANG_TOP);
  const TOP_SIN = Math.sin(ANG_TOP);
  const RIGHT_COS = Math.cos(ANG_RIGHT);
  const RIGHT_SIN = Math.sin(ANG_RIGHT);

  const isFocused = (key?: string) => (key ? state.routes[state.index].key === key : false);

  // Dimensions for the notched bar
  const BAR_HEIGHT = 56;
  const BAR_RADIUS = 28;
  const NOTCH_RADIUS = 24;
  const NOTCH_DEPTH = 16; // deeper notch for cyber look

  const [barWidth, setBarWidth] = useState(0);

  const barPath = (width: number) => {
    if (!width) return '';
    const w = width;
    const h = BAR_HEIGHT;
    const r = BAR_RADIUS;
    const cx = w / 2;
    const cy = NOTCH_RADIUS - NOTCH_DEPTH; // slightly above the bar top to create a notch
    const nr = NOTCH_RADIUS;
    // Rounded-rect outer path
    const outer = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    // Circle subpath for notch (even-odd will subtract it)
    const circle = `M ${cx} ${cy} m ${-nr},0 a ${nr} ${nr} 0 1 0 ${nr * 2} 0 a ${nr} ${nr} 0 1 0 ${-nr * 2} 0`;
    return `${outer} ${circle}`;
  };

  return (
    <View style={[styles.root, { bottom: frameBottomInset, paddingBottom: Math.max(insets.bottom, 10), pointerEvents: 'box-none' }]}
    >
      {/* Bottom bar background */}
      <View style={[styles.barShadow, { width: shadowWidthPx, pointerEvents: 'none' }]} />
      <View style={[styles.barGlow, { width: glowWidthPx, pointerEvents: 'none' }]} />
      <View style={[styles.bar, { width: barWidthPx }]} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {/* Notched SVG background */}
        {barWidth > 0 && (
          <Svg style={StyleSheet.absoluteFill} width={barWidth} height={BAR_HEIGHT} viewBox={`0 0 ${barWidth} ${BAR_HEIGHT}`}>
            <Defs>
              <SvgLinearGradient id="barGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopOpacity={1} stopColor="#5421FF" />
                <Stop offset="0.65" stopOpacity={1} stopColor="#6A00FF" />
                <Stop offset="1" stopOpacity={1} stopColor="#00E7FF" />
              </SvgLinearGradient>
            </Defs>
            <Path d={barPath(barWidth)} fill="url(#barGrad)" fillRule="evenodd" stroke="rgba(0,231,255,0.35)" strokeWidth={StyleSheet.hairlineWidth} />
          </Svg>
        )}
        {/* Animated glow sweep */}
        {barWidth > 0 && (
          <Animated.View
            style={[
              styles.glowSweep,
              { pointerEvents: 'none' },
              {
                transform: [
                  {
                    translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-barWidth * 0.5, barWidth * 0.5] }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["rgba(0,231,255,0)", "rgba(0,231,255,0.35)", "rgba(0,231,255,0)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
        {/* Left Tab (Calendar) */}
        <Pressable
          style={styles.tabItem}
          onPress={() => {
            navigateTo('/(tabs)/Calendar');
          }}
          onLongPress={() => navigateTo('/(tabs)/Calendar')}
        >
          <Ionicons
            name="calendar-outline"
            size={22}
            color={isFocused(leftRoute.key) ? activeColor : inactiveColor}
          />
        </Pressable>

        {/* Center FAB */}
        <View style={[styles.centerSlot, { pointerEvents: 'box-none' }]}>
          <Animated.View
            style={{
              transform: [
                { translateY: Animated.multiply(anim, -2) },
                { scale: Animated.add(1, Animated.multiply(anim, 0.02)) },
              ],
            }}
          >
            <Pressable
              onPress={() => {
                // Navigate Home on tap, also close actions if open
                navigateTo('/(tabs)/Home');
                if (open) toggleOpen();
              }}
              onLongPress={toggleOpen}
              style={styles.fabOuter}
            >
              <Animated.View style={[styles.fabRing, { opacity: ringPulse }]} />
              <LinearGradient colors={["#8A00FF", "#FF00E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
                {open ? (
                  <Ionicons name="close" size={22} color="#fff" />
                ) : (
                  <Ionicons name="home" size={22} color="#fff" />
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>

        {/* Right Tab (Workout/People) */}
        <Pressable
          style={styles.tabItem}
          onPress={() => {
            navigateTo('/(tabs)/Workout');
          }}
          onLongPress={() => navigateTo('/(tabs)/Workout')}
        >
          <MaterialCommunityIcons
            name="dumbbell"
            size={22}
            color={isFocused(rightRoute.key) ? activeColor : inactiveColor}
          />
        </Pressable>
      </View>

      {/* Floating Actions (rendered last to appear above bar background) */}
      {open ? <View style={styles.actionsLayer}>
        {/* Left action (up-left) */}
        <Animated.View
          style={[
            styles.actionWrapper,
            {
              transform: [
                { translateX: Animated.multiply(radius, LEFT_COS) },
                { translateY: Animated.multiply(radius, LEFT_SIN) },
                { translateY: -6 },
                { scale: Animated.add(0.8, Animated.multiply(0.2, anim)) },
              ],
              opacity: actionOpacity,
            },
          ]}
        >
          <Pressable onPress={() => { router.push('/(tabs)/diet' as Href); if (open) toggleOpen(); }} style={styles.actionPressable}>
            <LinearGradient colors={["#5421FF", "#6A00FF", "#00E7FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionCircle}>
              <Ionicons name="nutrition-outline" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
        {/* Middle action (top) */}
        <Animated.View
          style={[
            styles.actionWrapper,
            {
              transform: [
                { translateX: Animated.multiply(radius, TOP_COS) },
                { translateY: Animated.multiply(radius, TOP_SIN) },
                { translateY: -6 },
                { scale: Animated.add(0.8, Animated.multiply(0.2, anim)) },
              ],
              opacity: actionOpacity,
            },
          ]}
        >
          <Pressable onPress={() => { router.push('/(tabs)/social' as Href); if (open) toggleOpen(); }} style={styles.actionPressable}>
            <LinearGradient colors={["#5421FF", "#6A00FF", "#00E7FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionCircle}>
              <MaterialCommunityIcons name="account-group-outline" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
        {/* Right action (up-right) */}
        <Animated.View
          style={[
            styles.actionWrapper,
            {
              transform: [
                { translateX: Animated.multiply(radius, RIGHT_COS) },
                { translateY: Animated.multiply(radius, RIGHT_SIN) },
                { translateY: -6 },
                { scale: Animated.add(0.8, Animated.multiply(0.2, anim)) },
              ],
              opacity: actionOpacity,
            },
          ]}
        >
          <Pressable onPress={() => { router.push('/(tabs)/achievements' as Href); if (open) toggleOpen(); }} style={styles.actionPressable}>
            <LinearGradient colors={["#5421FF", "#6A00FF", "#00E7FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionCircle}>
              <Ionicons name="trophy-outline" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View> : null}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <ScreenFrame backgroundColor="#0b1020" shadow={false}>
      <Tabs
        tabBar={(props) => <FancyTabBar {...(props as BottomTabBarProps)} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="Calendar" options={{ title: 'Calendar' }} />
        <Tabs.Screen name="Home" options={{ title: 'Home' }} />
        <Tabs.Screen name="Workout" options={{ title: 'Workout' }} />
        {/* Hidden routes for floating actions */}
          <Tabs.Screen name="diet" options={{ href: null }} />
        <Tabs.Screen name="social" options={{ href: null }} />
        <Tabs.Screen name="achievements" options={{ href: null }} />
      </Tabs>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0, 
    bottom: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  actionsLayer: {
    position: 'absolute',
  bottom: 56, // anchor actions layer near FAB center; orbits offset from here
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  actionWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -28, // half of actionCircle width
    marginTop: -28, // half of actionCircle height
  },
  actionPressable: {
    boxShadow: '0px 8px 10px #0004D',
    elevation: 8,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barShadow: {
    position: 'absolute',
    bottom: 22,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.25)',
  boxShadow: '0px 10px 16px #00040',
  },
  barGlow: {
    position: 'absolute',
    bottom: 22,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(106,0,255,0.25)',
  boxShadow: '0px 0px 24px #6A00FFE6',
  },
  bar: {
    position: 'absolute',
    bottom: 24,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    overflow: 'visible',
  },
  glowSweep: {
    position: 'absolute',
    left: '50%',
    top: 0,
    width: 140,
    height: 56,
    borderRadius: 28,
  },
  tabItem: {
    width: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSlot: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(0,231,255,0.6)',
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '800',
  },
});
