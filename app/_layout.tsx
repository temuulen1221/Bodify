import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <Provider store={store}>
      <Stack
        screenOptions={{
          header: ({ options }) => <GradientHeader title={options.title || ''} />,
          headerTitle: '',
          headerTintColor: '#fff',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: true, title: 'Sign Up' }} />
        <Stack.Screen name="login" options={{ headerShown: true, title: 'Login' }} />
    <Stack.Screen name="Leaderboard" options={{ headerShown: true, title: 'Leaderboard' }} />
    <Stack.Screen name="Workout" options={{ headerShown: true, title: 'Workout' }} />
        <Stack.Screen name="Rest" options={{ headerShown: true, title: 'Rest' }} />
        <Stack.Screen name="Shop" options={{ headerShown: true, title: 'Shop' }} />
        <Stack.Screen name="Theme" options={{ headerShown: true, title: 'Theme' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
