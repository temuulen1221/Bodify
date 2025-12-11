import * as React from 'react';
import { Platform } from 'react-native';

// base64 helper removed (unused)

const Avatar3D = ({ height = '175', weight = '70', gender = 'male', photoUri, model, sizeMultiplier = 1, xOffset = 0, yOffset = 0, zOffset = 0, alignFootToBottom = false, bottomPadding = 0.05, playAnimation = true }) => {
  // ...full implementation from avatar.js goes here...
  // ...existing code...
};

// VRM Avatar Loader (Web & Mobile)

// For web: use three.js and three-vrm
// For mobile: use expo-three and three-vrm

// Web implementation
let VRMAvatarWeb = null;
if (Platform.OS === 'web') {
  VRMAvatarWeb = function VRMAvatarWeb({ vrmUrl, style }) {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
      let renderer, scene, camera, loader, vrm;
      let animateId;
      async function init() {
        const THREE = await import('three');
        const { VRMLoader } = await import('@pixiv/three-vrm');
        renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true });
        renderer.setSize(300, 300);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
        camera.position.set(0, 1.4, 2.5);
        loader = new VRMLoader();
        loader.load(vrmUrl, (loadedVrm) => {
          vrm = loadedVrm;
          scene.add(vrm.scene);
        });
        function animate() {
          animateId = requestAnimationFrame(animate);
          renderer.render(scene, camera);
        }
        animate();
      }
      init();
      return () => {
        if (animateId) cancelAnimationFrame(animateId);
        if (renderer) renderer.dispose();
      };
    }, [vrmUrl]);
    return (
      <canvas ref={canvasRef} style={style} width={300} height={300} />
    );
  };
}

// Mobile implementation
let VRMAvatarMobile = null;
if (Platform.OS !== 'web') {
  const { GLView } = require('expo-gl');
  const ExpoTHREE = require('expo-three');
  VRMAvatarMobile = function VRMAvatarMobile({ vrmUrl, style }) {
  const glViewRef = React.useRef(null);
    return (
      <GLView
        style={style}
        ref={glViewRef}
        onContextCreate={async (gl) => {
          const THREE = await import('three');
          const { VRMLoader } = await import('@pixiv/three-vrm');
          const renderer = new ExpoTHREE.Renderer({ gl });
          renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(35, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
          camera.position.set(0, 1.4, 2.5);
          const loader = new VRMLoader();
          loader.load(vrmUrl, (vrm) => {
            scene.add(vrm.scene);
          });
          function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
            gl.endFrameEXP();
          }
          animate();
        }}
      />
    );
  };
}

// Main VRMAvatar component
export function VRMAvatar({ vrmUrl, style }) {
  if (Platform.OS === 'web' && VRMAvatarWeb) {
    return <VRMAvatarWeb vrmUrl={vrmUrl} style={style} />;
  }
  if (Platform.OS !== 'web' && VRMAvatarMobile) {
    return <VRMAvatarMobile vrmUrl={vrmUrl} style={style} />;
  }
  return null;
}

// Example usage in your Avatar screen/component:
// import { VRMAvatar } from '../components/Avatar3D';
// <VRMAvatar vrmUrl={require('../assets/models/AvatarSample_1.vrm')} style={{ width: 300, height: 300 }} />

export default Avatar3D;