import 'dotenv/config';

const projectId = '42c679e1-c672-49c0-a06a-171f5da81de4';

export default ({ config }) => ({
  expo: {
    name: 'Bodify',
    slug: 'bodify',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'bodify',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription:
          'Camera access is needed to perform real-time squat pose detection and count your reps.',
        NSMicrophoneUsageDescription:
          '(Optional) Microphone access would allow future voice or sound feedback features.',
        NSLocationWhenInUseUsageDescription:
          'Location access is needed to track live outdoor workouts on the map and verify movement in real time.',
      },
    },
    android: {
      package: 'com.temuulen1221.bodify',
      googleServicesFile: './google-services.json',
      permissions: ['CAMERA', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? '',
        },
      },
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/icons/icon/icon/android/mipmap-xxxhdpi/ic_launcher_foreground.png',
        backgroundImage: './assets/icons/icon/icon/android/mipmap-xxxhdpi/ic_launcher.png',
        monochromeImage: './assets/icons/icon/icon/android/mipmap-xxxhdpi/ic_launcher_round.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      '@react-native-google-signin/google-signin',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      'expo-asset',
      'expo-font',
      'expo-audio',
      'expo-secure-store',
      'expo-video',
      'expo-web-browser',
    ],
    extra: {
      ...config?.extra,
      stravaClientId: process.env.STRAVA_CLIENT_ID ?? '',
      stravaClientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
      spoonacularApiKey: process.env.SPOONACULAR_API_KEY ?? '',
      exerciseDbApiKey: process.env.EXERCISEDB_API_KEY ?? '',
      exerciseDbApiHost: process.env.EXERCISEDB_API_HOST ?? 'exercisedb.p.rapidapi.com',
      exerciseDbBaseUrl: process.env.EXERCISEDB_BASE_URL ?? 'https://exercisedb.p.rapidapi.com',
      googleMapsWebApiKey:
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY
        ?? process.env.GOOGLE_MAPS_WEB_API_KEY
        ?? process.env.GOOGLE_MAPS_API_KEY
        ?? '',
      googleMapsAndroidApiKey:
        process.env.GOOGLE_MAPS_ANDROID_API_KEY
        ?? process.env.GOOGLE_MAPS_API_KEY
        ?? '',
      googleMapsMapId:
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID
        ?? process.env.GOOGLE_MAPS_MAP_ID
        ?? 'c0c3039e62caaa3a94c86a3d',
      router: {},
      eas: {
        projectId,
      },
    },
    experiments: {
      typedRoutes: true,
    },
    owner: 'temuulen1221',
  },
});
