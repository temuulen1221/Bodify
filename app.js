
import { Picker } from '@react-native-picker/picker';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
// Use the installed package name
import UnityView from 'react-native-unity-view';
import { Provider } from 'react-redux';
import * as THREE from 'three';
import store from './store';



function MainApp() {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyShape, setBodyShape] = useState('athletic');
  const [face, setFace] = useState('example1');
  const glViewRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);

  // Helper to update model scale/morphs
  const updateModel = () => {
    const model = modelRef.current;
    if (!model) return;
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const bmi = w && h ? w / ((h / 100) ** 2) : 25;
    model.scale.set(1, h ? h / 170 : 1, 1);
    model.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary) {
        const muscleKey = child.morphTargetDictionary['muscle'] || 0;
        child.morphTargetInfluences[muscleKey] = bmi < 25 ? 0.3 : 0.7;
      }
    });
  };

  // Update model when height/weight changes
  useEffect(() => {
    updateModel();
  }, [height, weight]);

  // Update model when bodyShape changes (reload model)
  useEffect(() => {
    if (!sceneRef.current) return;
    // Remove old model
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current = null;
    }
    // Load new model if GL context is ready
    if (rendererRef.current && cameraRef.current) {
      loadModel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyShape]);

  const loadModel = () => {
    const scene = sceneRef.current;
    if (!scene) return;
  // Removed GLTFLoader: not supported in React Native/Expo
    // Try both .glb and .gltf extensions
    const tryLoad = (exts, idx = 0) => {
      if (idx >= exts.length) {
        console.warn('Model not found for', bodyShape);
        return;
      }
      loader.load(
        `assets/${bodyShape}.${exts[idx]}`,
        (gltf) => {
          const model = gltf.scene;
          modelRef.current = model;
          scene.add(model);
          updateModel();
        },
        undefined,
        (error) => {
          // Try next extension
          tryLoad(exts, idx + 1);
        }
      );
    };
    tryLoad(['glb', 'gltf']);
  };

  const handleContextCreate = async (gl) => {
    // Set up scene, camera, renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
    camera.position.z = 5;
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    // Load model
    loadModel();

    // Render loop
    const render = () => {
      requestAnimationFrame(render);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  const handleCreateAvatar = () => {
    console.log(`Avatar: Height ${height}cm, Weight ${weight}kg, Shape ${bodyShape}, Face ${face}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Your Bodify Avatar</Text>
      <GLView
        ref={glViewRef}
        style={styles.glContainer}
        onContextCreate={handleContextCreate}
      />
      <Text style={styles.label}>Height (cm)</Text>
      <TextInput
        style={styles.input}
        placeholder="175"
        keyboardType="numeric"
        value={height}
        onChangeText={setHeight}
      />
      <Text style={styles.label}>Weight (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="70"
        keyboardType="numeric"
        value={weight}
        onChangeText={setWeight}
      />
      <Text style={styles.label}>Body Shape</Text>
      <Picker
        selectedValue={bodyShape}
        style={styles.picker}
        onValueChange={(itemValue) => setBodyShape(itemValue)}
      >
        <Picker.Item label="Athletic" value="athletic" />
        <Picker.Item label="Slim" value="slim" />
        <Picker.Item label="Curvy" value="curvy" />
      </Picker>
      <Text style={styles.label}>Face</Text>
      <Picker
        selectedValue={face}
        style={styles.picker}
        onValueChange={(itemValue) => setFace(itemValue)}
      >
        <Picker.Item label="Example 1" value="example1" />
        <Picker.Item label="Example 2" value="example2" />
      </Picker>
      <Button title="Create Avatar" onPress={handleCreateAvatar} />

      {/* UnityView integration below the avatar builder UI */}
      <Text style={styles.title}>Unity 3D View</Text>
      <View style={styles.unityContainer}>
        <UnityView style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <MainApp />
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  glContainer: { height: 300, backgroundColor: '#ccc', marginBottom: 20 },
  title: { fontSize: 24, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 16, marginTop: 10 },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 10, padding: 10 },
  picker: { height: 50, width: '100%' },
  unityContainer: { flex: 1, minHeight: 300, marginTop: 20 },
});