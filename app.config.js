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
      },
    },
    android: {
      package: 'com.temuulen1221.bodify',
      permissions: ['CAMERA'],
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
