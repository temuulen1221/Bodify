VRM Avatar integration

This project includes a cross-platform VRM avatar component that uses:

- Web: `@react-three/fiber` + `three` + `@pixiv/three-vrm` for first-class canvas rendering.
- Native (iOS/Android): `react-native-webview` that embeds a small HTML player using three + three-vrm.

Files:
- `components/VrmAvatar.web.tsx` — web renderer using react-three-fiber.
- `components/VrmAvatar.native.tsx` — native wrapper (WebView) rendering `web-player/player.html` inline.
- `web-player/player.html` — standalone HTML player (can be served or embedded).
- `app/vrm-demo.tsx` — quick demo screen that loads a sample VRM.

How to run:
1. Install dependencies:

```powershell
npm install
npx expo install react-native-webview
```

2. Start expo:

```powershell
npx expo start
```

3. Open the `VRM Demo` route (if using Expo Router) or open `app/vrm-demo.tsx` as the root screen.

Notes:
- The web path uses dynamic import for three/examples GLTFLoader; if you hit type errors, ensure `three` and examples are available in your build.
- For native builds, WebView will load the VRM via inline HTML; remote VRM URLs must have CORS enabled.
