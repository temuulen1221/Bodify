// @pixiv/three-vrm exports both named and default (CommonJS) in different builds.
// Import VRMLoader named, and also attempt to read a default/VRM export to
// support both ESM and CJS bundles used by the package in RN/Metro.
// Temporarily disable full VRM processing to avoid Blob/FileReader issues on RN.
// import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { GLView } from 'expo-gl';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as THREE from 'three';
import '../shims/fbjs-performanceNow-shim';
import '../shims/three-BinaryLoader-shim';
import '../shims/three-legacy-loaders-shim';
import AvatarWeb from './AvatarWeb';

// Minimal base64 -> Uint8Array converter (no reliance on global atob)
const base64ToUint8Array = (base64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < base64.length; i++) {
    const c = base64.charAt(i);
    if (c === '=') break;
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(output);
};

const Avatar = ({ height = '175', weight = '70', gender = 'male', photoUri, model, sizeMultiplier = 1.15, xOffset = 0, yOffset = 0, zOffset = 0, alignFootToBottom = false, bottomPadding = 0.05, playAnimation = true }) => {
  // On web, delegate to the fiber/Canvas-based implementation for better performance & VRM support
  if (Platform.OS === 'web') {
    return (
      <AvatarWeb
        gender={gender}
        height={height}
        weight={weight}
  /* rotation removed */
        sizeMultiplier={sizeMultiplier}
        scaleBoost={1.3}
        xOffset={xOffset}
        yOffset={yOffset}
        zOffset={zOffset}
        alignFootToBottom={alignFootToBottom}
        bottomPadding={bottomPadding}
        modelUrl={model}
        playAnimation={playAnimation}
      />
    );
  }
  const cubeRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const clockRef = useRef(null);
  const mixerRef = useRef(null);
  const animationsRef = useRef([]);

  const updateCubeFromProps = useCallback(() => {
    const cube = cubeRef.current;
    if (!cube) return;
    const h = parseFloat(height) || 170;
    const w = parseFloat(weight) || 70;
    const scaleY = h / 170;
    const scaleX = Math.min(1.4, Math.max(0.6, w / 70));
    cube.scale.set(scaleX, scaleY, scaleX);
    const baseColor = '#4F8EF7';
    const tint = gender === 'female' ? '#ff7eb6' : baseColor;
    cube.material.color = new THREE.Color(tint);
  }, [height, weight, gender]);

  const applyFootAlignment = useCallback(() => {
    const m = modelRef.current;
    const camera = cameraRef.current;
    if (!m || !camera || !camera.isPerspectiveCamera) return;
    // Compute current bounding box in world space
    const box = new THREE.Box3().setFromObject(m);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Visible half height in world units at model depth ~ 0 (we center models near origin)
    const fov = (camera.fov * Math.PI) / 180;
    const halfFovTan = Math.tan(fov / 2);
    const distance = Math.max(0.0001, camera.position.z);
    const visibleHalfH = distance * halfFovTan;
    const desiredBottomY = -visibleHalfH + bottomPadding; // world units
    const currentBottomY = -size.y / 2 + (m.position.y || 0);
    const delta = desiredBottomY - currentBottomY;
    m.position.y = (m.position.y || 0) + delta;
  }, [bottomPadding]);

  const updateModelFromProps = useCallback(() => {
    const m = modelRef.current;
    if (!m) return;
    const h = parseFloat(height) || 170;
    const w = parseFloat(weight) || 70;
    const scaleY = h / 170;
    const scaleX = Math.min(1.4, Math.max(0.7, w / 70));
    m.scale.set(scaleX, scaleY, scaleX);
    if (sizeMultiplier && sizeMultiplier !== 1) m.scale.multiplyScalar(sizeMultiplier);
    // Base positions
    m.position.x = xOffset || 0;
    m.position.z = zOffset || 0;
    if (alignFootToBottom) {
      // Reset Y before alignment to avoid compounding
      m.position.y = 0;
  applyFootAlignment();
      // Apply manual tweak after aligning to bottom
      if (yOffset) m.position.y += yOffset;
    } else {
      m.position.y = yOffset || 0;
    }
  }, [height, weight, sizeMultiplier, xOffset, yOffset, zOffset, alignFootToBottom, applyFootAlignment]);

  useEffect(() => {
    updateCubeFromProps();
    updateModelFromProps();
  }, [updateCubeFromProps, updateModelFromProps]);

  useEffect(() => {
    updateModelFromProps();
  }, [updateModelFromProps]);

  const onContextCreate = async (gl) => {
    try {
      console.log('[Avatar] GL context created');
      // Patch gl.pixelStorei to ignore unsupported enums in Expo GL (avoids noisy warnings)
      if (gl && typeof gl.pixelStorei === 'function') {
        // Ignore WebGL-specific enums Expo GL doesn't support to avoid noisy logs
        const UNSUPPORTED = new Set([
          0x9240, // UNPACK_FLIP_Y_WEBGL
          0x9241, // UNPACK_PREMULTIPLY_ALPHA_WEBGL
          0x9243, // UNPACK_COLORSPACE_CONVERSION_WEBGL
          0x9244, // BROWSER_DEFAULT_WEBGL (as value for UNPACK_COLORSPACE_CONVERSION_WEBGL)
        ]);
        const originalPixelStorei = gl.pixelStorei.bind(gl);
        gl.pixelStorei = (pname, param) => {
          if (UNSUPPORTED.has(pname)) return;
          try { originalPixelStorei(pname, param); } catch (_e) { /* noop */ }
        };
      }
      // Create THREE renderer manually (inline version of ExpoTHREE.renderer)
      const renderer = new THREE.WebGLRenderer({
        context: gl,
        alpha: true,
        canvas: {
          width: gl.drawingBufferWidth,
          height: gl.drawingBufferHeight,
          style: {},
          addEventListener: () => {},
          removeEventListener: () => {},
          clientHeight: gl.drawingBufferHeight,
        },
      });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      // Transparent clear (alpha 0) so underlying screen shows through
      renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
      rendererRef.current = renderer;
      clockRef.current = new THREE.Clock();

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(
      75,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(3, 10, 5);
    scene.add(dir);
  camera.position.z = 3.2;
  camera.lookAt(0, 0, 0);

    // 3D Cube Placeholder
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const baseColor = '#4F8EF7';
    const tint = gender === 'female' ? '#ff7eb6' : baseColor;
    const material = new THREE.MeshStandardMaterial({ color: tint });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    cubeRef.current = cube;
    updateCubeFromProps();

    // Try to load GLTF model
    console.log('[Avatar] Loading model for gender:', gender);
    const loadedModel = await loadGLTFModel(scene);
    if (loadedModel) {
      console.log('[Avatar] Model loaded successfully');
    } else {
      console.warn('[Avatar] Model URI');
    }

    // Animation loop
    const render = () => {
      requestAnimationFrame(render);
      const delta = clockRef.current ? clockRef.current.getDelta() : 1 / 60;
      // Advance animation if present
      if (mixerRef.current) {
        try { mixerRef.current.update(delta); } catch (_e) { /* noop */ }
      }
      // Rotation removed: model and cube remain static
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
    } catch (e) {
      console.error('[Avatar] onContextCreate error', e);
    }
  };

  const centerAndFitModel = (obj, scene, camera) => {
    // Center the model around origin and fit camera distance
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    obj.position.sub(center); // center it at origin

    // Compute distance based on object max dimension and camera fov
  const fitOffset = 1.35; // tighter framing for better interactivity
    if (camera && camera.isPerspectiveCamera) {
      const fov = (camera.fov * Math.PI) / 180;
      const halfFovTan = Math.tan(fov / 2);
      const height = size.y || 1;
      const width = size.x || 1;
      const distY = (height / 2) / halfFovTan;
      const distX = (width / 2) / (halfFovTan * (camera.aspect || 1));
      const distance = Math.max(distX, distY) * fitOffset;
      camera.position.z = Math.max(distance, 1.5);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix?.();
    }
  };

  const disposeModel = (obj, scene) => {
    if (!obj) return;
    // Stop previous animation
    if (mixerRef.current) {
      try { mixerRef.current.stopAllAction(); } catch (_e) {}
      mixerRef.current = null;
    }
    animationsRef.current = [];
    scene?.remove(obj);
    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose?.();
        if (child.material) {
          const m = child.material;
          if (m.map) m.map.dispose?.();
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose?.());
          else m.dispose?.();
        }
      }
    });
  };


  const loadGLTFModel = useCallback(async (scene) => {
    // Select model asset
    const fileName = model
      ? model
      : gender === 'female'
        ? 'AvatarSample_F.vrm'
        : 'AvatarSample_M.vrm';
    // Static mapping for Metro compatibility
    const modelMap = {
      'AvatarSample_F.vrm': require('../assets/models/AvatarSample_F.vrm'),
      'AvatarSample_M.vrm': require('../assets/models/AvatarSample_M.vrm'),
      // Add other models as needed
    };
    const asset = Asset.fromModule(modelMap[fileName]);
    await asset.downloadAsync();
    console.log('[Avatar] Asset localUri:', asset.localUri);
    const destPath = `${FileSystem.documentDirectory}${fileName}`;
    try {
      const info = await FileSystem.getInfoAsync(destPath);
      console.log('[Avatar] Dest file exists:', info.exists, 'Size:', info.size);
      if (!info.exists) {
        console.log('[Avatar] Copying from', asset.localUri, 'to', destPath);
        await FileSystem.copyAsync({ from: asset.localUri, to: destPath });
        console.log('[Avatar] Copy successful');
      } else {
        console.log('[Avatar] Using existing file');
      }
    } catch (e) {
      console.warn('[Avatar] Asset copy failed', e);
      return null;
    }
    const uri = destPath;
    console.log('[Avatar] Model URI:', uri);
    // Verify the file exists
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('[Avatar] File exists:', fileInfo.exists, 'Size:', fileInfo.size);
    } catch (e) {
      console.log('[Avatar] Error checking file:', e.message);
    }
    const baseDir = uri ? uri.replace(/[^/]*$/, '') : '';

    // Load GLTFLoader dynamically
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

    // Configure loader - use GLTFLoader with VRM plugin
    const loader = new GLTFLoader();
    // Re-enable VRM plugin (needed for proper rig); mitigate Blob/FileReader crash via safe FileReader shim.
    try {
      const { VRMLoaderPlugin, VRM } = await import('@pixiv/three-vrm');
      loader.register((parser) => new VRMLoaderPlugin(parser));
      loader.__enableVRM = true;
      loader.__VRMClass = VRM;
    } catch (e) {
      console.warn('[Avatar] VRM plugin load failed, continuing without VRM:', e?.message);
    }

    // FileReader shim to avoid native null blob crash. Provides minimal dataURL handling.
    const originalFileReader = global.FileReader;
    global.FileReader = class SafeFileReader {
      constructor() { this.onload = null; this.onerror = null; this.result = null; }
      readAsArrayBuffer(blob) {
        setTimeout(() => {
          if (!blob) { if (this.onerror) this.onerror(new Error('blob-null')); return; }
          try {
            const toBuffer = blob.arrayBuffer ? blob.arrayBuffer() : Promise.resolve(new ArrayBuffer(0));
            toBuffer.then((buf) => {
              this.result = buf;
              this.onload && this.onload({ target: this });
            }).catch((e) => { this.onerror && this.onerror(e); });
          } catch (e) { this.onerror && this.onerror(e); }
        }, 0);
      }
      readAsDataURL(blob) {
        setTimeout(() => {
          if (!blob) { if (this.onerror) this.onerror(new Error('blob-null')); return; }
          this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
          this.onload && this.onload({ target: this });
        }, 0);
      }
      readAsText(blob) {
        setTimeout(() => {
          if (!blob) { if (this.onerror) this.onerror(new Error('blob-null')); return; }
          this.result = '';
          this.onload && this.onload({ target: this });
        }, 0);
      }
    };
    
    // Minimal createImageBitmap polyfill to avoid blob->FileReader paths during GLTF parse
    const originalCreateImageBitmap = global.createImageBitmap;
    global.createImageBitmap = async (_blob) => ({ width: 1, height: 1, close: () => {} });

    // Helper to normalize materials (convert ShaderMaterial-like to MeshStandardMaterial)
    const normalizeChildMaterials = (child) => {
      if (!child.isMesh || !child.material) return;
      const convert = (mat) => {
        if (!mat) return mat;
        const isShaderLike = mat.isShaderMaterial || mat.isRawShaderMaterial || typeof mat.vertexShader === 'string' || typeof mat.fragmentShader === 'string';
        if (isShaderLike) {
          const safe = new THREE.MeshStandardMaterial({
            color: (mat.color && mat.color.isColor) ? mat.color.clone() : new THREE.Color(0xffffff),
            map: mat.map || null,
            normalMap: mat.normalMap || null,
            roughnessMap: mat.roughnessMap || null,
            metalnessMap: mat.metalnessMap || null,
            roughness: typeof mat.roughness === 'number' ? mat.roughness : 0.8,
            metalness: typeof mat.metalness === 'number' ? mat.metalness : 0.0,
            skinning: !!child.isSkinnedMesh,
            transparent: !!mat.transparent,
            opacity: typeof mat.opacity === 'number' ? mat.opacity : 1,
          });
          return safe;
        }
        // ensure standard props are safe
        mat.skinning = !!child.isSkinnedMesh;
        if (typeof mat.roughness !== 'number') mat.roughness = 0.8;
        if (typeof mat.metalness !== 'number') mat.metalness = 0.0;
        return mat;
      };
      if (Array.isArray(child.material)) {
        child.material = child.material.map(convert);
      } else {
        child.material = convert(child.material);
      }
    };

    // Helper to ensure color spaces for base color/emissive maps are sRGB
    const ensureTextureSpaces = (root) => {
      root.traverse?.((child) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (!m) return;
            if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.needsUpdate = true; }
            if (m.emissiveMap) { m.emissiveMap.colorSpace = THREE.SRGBColorSpace; m.emissiveMap.needsUpdate = true; }
            // normal/metalness/roughness remain linear
          });
        }
      });
    };

    // Load by resolving to ArrayBuffer and parsing (more robust on RN)
    try {
      if (!uri || typeof uri !== 'string') {
        // Final attempt to ensure a string URI
        try { await Asset.loadAsync(asset); } catch (_) {}
        uri = asset?.localUri || asset?.uri || '';
      }
      let arrayBuffer;
      if (uri.startsWith('file://')) {
        // Read local file reliably via Expo FileSystem (base64 -> ArrayBuffer)
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        arrayBuffer = base64ToUint8Array(base64).buffer;
        console.log('[Avatar] ArrayBuffer size:', arrayBuffer.byteLength);
      } else if (uri.startsWith('data:')) {
        // Data URI: extract the base64 payload
        const m = uri.match(/^data:.*?;base64,(.*)$/);
        if (!m) throw new Error('Unsupported data URI');
        arrayBuffer = base64ToUint8Array(m[1]).buffer;
      } else if (uri.startsWith('http')) {
        // Download and read as base64
        const ext = uri.toLowerCase().includes('.gltf') ? '.gltf' : '.glb';
        const key = Math.abs(Array.from(uri).reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0));
        const dest = `${FileSystem.cacheDirectory}model-${key}${ext}`;
        try {
          const info = await FileSystem.getInfoAsync(dest);
          if (!info.exists) {
            await FileSystem.downloadAsync(uri, dest);
          }
          const base64 = await FileSystem.readAsStringAsync(dest, { encoding: 'base64' });
          arrayBuffer = base64ToUint8Array(base64).buffer;
        } catch (e) {
          throw new Error(`Failed to load remote asset: ${e.message}`);
        }
      } else {
        throw new Error(`Invalid or unsupported model URI: ${String(uri)}`);
      }
      const parsed = await new Promise((resolve, reject) => {
        console.log('[Avatar] Starting GLTF parse...');
        loader.parse(
          arrayBuffer,
          baseDir,
          (gltf) => {
            console.log('[Avatar] GLTF parse successful');
            // Post-process GLTF to handle any remaining texture issues
            if (gltf.scene) {
              gltf.scene.traverse((child) => {
                if (child.isMesh && child.material) {
                  const mats = Array.isArray(child.material) ? child.material : [child.material];
                  mats.forEach((mat) => {
                    // Remove any problematic textures
                    if (mat.map && (!mat.map.image || mat.map.image instanceof Blob)) {
                      console.log('[Avatar] Removing texture due to RN compatibility');
                      mat.map = null;
                      mat.needsUpdate = true;
                    }
                  });
                }
              });
            }
            resolve(gltf);
          },
          (err) => {
            console.warn('[Avatar] GLTF parse error callback:', err);
            reject(err || new Error('GLTF parse failed'));
          }
        );
      });
      // Create VRM from GLTF
      let sceneObj = parsed.scene;
      const animations = parsed.animations || [];
      // If VRM class available, attempt VRM conversion safely
      if (loader.__enableVRM && loader.__VRMClass && parsed) {
        try {
          console.log('[Avatar] Attempting VRM.from conversion');
          const vrmInstance = await loader.__VRMClass.from(parsed);
          if (vrmInstance?.scene) {
            sceneObj = vrmInstance.scene;
            console.log('[Avatar] VRM conversion succeeded');
          }
        } catch (e) {
          console.warn('[Avatar] VRM conversion failed, fallback to raw GLTF scene:', e?.message);
        }
      }
      if (!sceneObj) throw new Error('No scene in GLTF');
      // Normalize materials and color spaces
      sceneObj.traverse(normalizeChildMaterials);
      ensureTextureSpaces(sceneObj);
      if (modelRef.current) disposeModel(modelRef.current, scene);
      if (cubeRef.current) cubeRef.current.visible = false;
      scene.add(sceneObj);
      modelRef.current = sceneObj;
      modelRef.current.position.set(0, 0, 0);
      modelRef.current.visible = true;
      console.log('Model added:', sceneObj);

      if (playAnimation && animationsRef.current.length > 0) {
        try {
          const mixer = new THREE.AnimationMixer(sceneObj);
          mixerRef.current = mixer;
          const clip = animationsRef.current.find((c) => c.name?.toLowerCase().includes('idle')) || animationsRef.current[0];
          const action = mixer.clipAction(clip);
          action.loop = THREE.LoopRepeat;
          action.clampWhenFinished = false;
          action.play();
        } catch (_e) { /* noop */ }
      }
      centerAndFitModel(sceneObj, scene, cameraRef.current);
      updateModelFromProps();
      return sceneObj;
    } catch (e) {
      console.warn('[Avatar] GLTF load failed:', JSON.stringify(e));
      console.warn('[Avatar] Error details:', e);
      return null;
    } finally {
      // Restore original constructors (Blob left untouched intentionally)
      if (originalCreateImageBitmap) global.createImageBitmap = originalCreateImageBitmap;
      if (originalFileReader) global.FileReader = originalFileReader;
    }
  }, [gender, model, updateModelFromProps, playAnimation]);

  // Respond to playAnimation toggles by starting/stopping mixer
  useEffect(() => {
    if (!modelRef.current) return;
    if (playAnimation) {
      if (!mixerRef.current && animationsRef.current && animationsRef.current.length > 0) {
        try {
          const mixer = new THREE.AnimationMixer(modelRef.current);
          mixerRef.current = mixer;
          const clip = animationsRef.current.find((c) => c.name?.toLowerCase().includes('idle')) || animationsRef.current[0];
          const action = mixer.clipAction(clip);
          action.loop = THREE.LoopRepeat;
          action.clampWhenFinished = false;
          action.play();
        } catch (_e) { /* noop */ }
      }
    } else {
      if (mixerRef.current) {
        try { mixerRef.current.stopAllAction(); } catch (_e) {}
        mixerRef.current = null;
      }
    }
  }, [playAnimation]);

  useEffect(() => {
    const applyTextureToObject = (obj, texture) => {
      obj.traverse?.((child) => {
        if (child.isMesh && child.material) {
          const apply = (m) => { m.map = texture || null; m.needsUpdate = true; };
          if (Array.isArray(child.material)) child.material.forEach(apply); else apply(child.material);
        }
      });
    };

    if (!photoUri) {
      // If no custom photo, keep original GLTF textures intact; only clear cube fallback
      if (cubeRef.current) {
        cubeRef.current.material.map = null;
        cubeRef.current.material.needsUpdate = true;
      }
      return;
    }
    try {
      const loader = new THREE.TextureLoader();
      loader.load(
        photoUri,
        (texture) => {
          if (!texture || !texture.image) {
            console.warn('[Avatar] Skipping empty texture image');
            return;
          }
          texture.flipY = false;
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
          if (modelRef.current) {
            applyTextureToObject(modelRef.current, texture);
            // Normalize materials again to ensure texture application didn't reintroduce shader materials
            modelRef.current.traverse?.((child) => {
              if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((m, i) => {
                  const isShaderLike = m && (m.isShaderMaterial || m.isRawShaderMaterial || typeof m.vertexShader === 'string' || typeof m.fragmentShader === 'string');
                  if (isShaderLike) {
                    const safe = new THREE.MeshStandardMaterial({
                      color: (m.color && m.color.isColor) ? m.color.clone() : new THREE.Color(0xffffff),
                      map: m.map || null,
                      normalMap: m.normalMap || null,
                      roughnessMap: m.roughnessMap || null,
                      metalnessMap: m.metalnessMap || null,
                      roughness: typeof m.roughness === 'number' ? m.roughness : 0.8,
                      metalness: typeof m.metalness === 'number' ? m.metalness : 0.0,
                      skinning: !!child.isSkinnedMesh,
                      transparent: !!m.transparent,
                      opacity: typeof m.opacity === 'number' ? m.opacity : 1,
                    });
                    if (Array.isArray(child.material)) child.material[i] = safe; else child.material = safe;
                  } else {
                    m.skinning = !!child.isSkinnedMesh;
                    if (typeof m.roughness !== 'number') m.roughness = 0.8;
                    if (typeof m.metalness !== 'number') m.metalness = 0.0;
                  }
                });
              }
            });
          } else if (cubeRef.current) {
            cubeRef.current.material.map = texture;
            cubeRef.current.material.needsUpdate = true;
          }
        },
        undefined,
        (err) => {
          console.warn('Failed to load texture', err);
        }
      );
    } catch (e) {
      console.warn('[Avatar] TextureLoader error', e);
    }
  }, [photoUri]);

  useEffect(() => {
    // Update color when gender changes
    updateCubeFromProps();
    // Try loading the corresponding model when gender changes
    if (sceneRef.current) {
      loadGLTFModel(sceneRef.current).catch(() => {});
    }
  }, [gender, model, updateCubeFromProps, loadGLTFModel]);

  useEffect(() => {
    return () => {
      if (modelRef.current) disposeModel(modelRef.current, sceneRef.current);
      if (rendererRef.current) rendererRef.current.dispose();
    };
  }, []);

  return <GLView style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }} onContextCreate={onContextCreate} />;
};

export default Avatar;