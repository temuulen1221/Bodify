import { Asset } from 'expo-asset';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

type ModelChoice = 'female' | 'male';

const HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body, #root { height: 100%; margin: 0; padding: 0; background: #000; }
      canvas { display: block; }
      #overlay { position: fixed; bottom: 8px; right: 12px; color: #8b949e; font: 12px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; opacity: .7; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <div id="overlay">VRM WebView</div>
    <script src="https://unpkg.com/three@0.151.3/build/three.min.js"></script>
    <script src="https://unpkg.com/three@0.151.3/examples/js/loaders/GLTFLoader.js"></script>
    <script src="https://unpkg.com/@pixiv/three-vrm@1.0.10/dist/three-vrm.min.js"></script>
    <script>
      (function(){
        var container = document.getElementById('root');
        var w = window.innerWidth, h = window.innerHeight;
        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(w, h);
        container.appendChild(renderer.domElement);

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(0, 1.3, 2.4);

        var light = new THREE.DirectionalLight(0xffffff, 1.0); light.position.set(1,1,1); scene.add(light);
        var ambient = new THREE.AmbientLight(0xffffff, 0.5); scene.add(ambient);

        var currentVRM = null;
        var clock = new THREE.Clock();

        function send(type, payload){
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload })); } catch(e) {}
          }
        }

        var loader = new THREE.GLTFLoader();
        window.loadModel = function(url){
          try {
            loader.load(url, function(gltf){
              THREE.VRM.from(gltf).then(function(vrm){
                try { if (currentVRM) { scene.remove(currentVRM.scene); } } catch(_) {}
                currentVRM = vrm;
                scene.add(vrm.scene);
                send('model-ready', { ok: true });
              }).catch(function(err){
                send('error', String(err && err.message || err));
              });
            }, undefined, function(err){
              send('error', String(err && err.message || err));
            });
          } catch (e) { send('error', String(e && e.message || e)); }
        };

        function onResize(){
          var w = window.innerWidth, h = window.innerHeight;
          camera.aspect = w/h; camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
        window.addEventListener('resize', onResize);

        function animate(){
          requestAnimationFrame(animate);
          var dt = clock.getDelta();
          if (currentVRM) {
            currentVRM.scene.rotation.y += 0.3 * dt;
          }
          renderer.render(scene, camera);
        }
        animate();

        // Bridge is ready
        send('bridge-ready');
      })();
    </script>
  </body>
  </html>`;

export default function VrmWebViewScreen() {
  const webRef = useRef<WebView>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [selected, setSelected] = useState<ModelChoice>('female');
  const [lastError, setLastError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Initializing…');

  const modelModule = useMemo(() => (
    selected === 'female'
      ? require('../assets/models/AvatarSample_F.vrm')
      : require('../assets/models/AvatarSample_M.vrm')
  ), [selected]);

  const loadIntoWebView = useCallback(async () => {
    try {
      setStatus('Resolving model…');
      const asset = Asset.fromModule(modelModule);
      // Ensure the asset is available and get a URI (dev: http URL, prod: file/asset URL)
      if (!asset.localUri && !asset.uri) {
        await asset.downloadAsync();
      }
      const uri = asset.localUri || asset.uri;
      if (!uri) throw new Error('Failed to resolve model URI');

      // Call the global function inside the web content
      const js = `try { loadModel(${JSON.stringify(uri)}); } catch (e) { true; }`;
      webRef.current?.injectJavaScript(js + '\n');
      setStatus('Loading model in WebView…');
    } catch (e: any) {
      setLastError(String(e?.message || e));
      setStatus('Failed to load model');
    }
  }, [modelModule]);

  const onMessage = useCallback((ev: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(ev.nativeEvent.data || '{}');
      if (data.type === 'bridge-ready') {
        setBridgeReady(true);
        setStatus('Bridge ready');
        // Auto-load current selection
        setTimeout(() => { loadIntoWebView(); }, 50);
      } else if (data.type === 'model-ready') {
        setStatus('Model loaded');
        setLastError(null);
      } else if (data.type === 'error') {
        setLastError(String(data.payload || 'Unknown error'));
        setStatus('Error');
      }
    } catch (_) {
      // ignore non-JSON messages
    }
  }, [loadIntoWebView]);

  useEffect(() => {
    if (bridgeReady) {
      loadIntoWebView();
    }
  }, [bridgeReady, selected, loadIntoWebView]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.title}>Open on iOS/Android</Text>
        <Text style={styles.paragraph}>This screen uses a native WebView to render 3D VRM avatars.</Text>
        <Text style={styles.paragraph}>Use the existing web route at /avatar-web for a direct WebGL preview on web.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}> 
        <Text style={styles.headerTitle}>VRM WebView</Text>
        <View style={styles.segment}>
          <SegmentButton label="Female" active={selected==='female'} onPress={() => setSelected('female')} />
          <SegmentButton label="Male" active={selected==='male'} onPress={() => setSelected('male')} />
        </View>
      </View>
      <View style={styles.webShell}>
        <WebView
          ref={webRef}
          originWhitelist={["*"]}
          source={{ html: HTML }}
          style={styles.webView}
          onMessage={onMessage}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowingReadAccessToURL={"/" as any}
          allowUniversalAccessFromFileURLs
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          automaticallyAdjustContentInsets={false}
        />
      </View>
      <View style={styles.footer}>
        <Text style={styles.status}>Status: {status}</Text>
        {!!lastError && <Text style={styles.error}>Error: {lastError}</Text>}
      </View>
    </SafeAreaView>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.segmentBtn, active && styles.segmentBtnActive]}> 
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: '#0a0c10', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)', gap: 8 },
  headerTitle: { color: '#f0f6fc', fontSize: 18, fontWeight: '600' },
  segment: { flexDirection: 'row', gap: 8 },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(240,246,252,0.06)' },
  segmentBtnActive: { backgroundColor: 'rgba(88,166,255,0.25)', borderWidth: 1, borderColor: 'rgba(88,166,255,0.5)' },
  segmentText: { color: '#c9d1d9', fontSize: 14 },
  segmentTextActive: { color: '#f0f6fc', fontWeight: '600' },
  webShell: { flex: 1 },
  webView: { flex: 1, width: '100%', backgroundColor: '#000' },
  footer: { padding: 12, backgroundColor: '#0a0c10', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  status: { color: '#c9d1d9' },
  error: { color: '#ff7b72', marginTop: 4 },
  fallbackContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 6 },
  paragraph: { fontSize: 15, color: '#333', textAlign: 'center' },
});
