/* eslint-disable react/no-unknown-property */
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const Model = ({ url, height = '170', weight = '70', sizeMultiplier = 1, scaleBoost = 1, xOffset = 0, yOffset = 0, zOffset = 0, playAnimation = true, alignFootToBottom = false, bottomPadding = 0.06, autoFit = true, headMargin = 0.08, bottomInsetPx = 0, focus = 'chest', fitMode = 'shrink', targetFill = 0.94, footLift = 0, onUpdateTargetY, expressionName, expressionValue = 1 }) => {
  const isVrm = /\.vrm$/i.test(String(url));
  const [error, setError] = useState(null);
  console.log('[AvatarWeb] Loading model URL:', url, 'isVRM:', isVrm);
  const gltf = useLoader(
    GLTFLoader,
    url,
    (loader) => {
      // DRACO fallback logic: attempt local path first, then remote CDN; if both fail, continue without DRACO.
      let dracoAttached = false;
      try {
        const dracoLocal = new DRACOLoader();
        // Local decoder path (place decoder files in /draco/ for web build if desired)
        dracoLocal.setDecoderPath('/draco/');
        loader.setDRACOLoader(dracoLocal);
        dracoAttached = true;
        console.log('[AvatarWeb] DRACO loader attached (local /draco/)');
      } catch (e) {
        console.warn('[AvatarWeb] Local DRACO attach failed, will try remote CDN:', e);
      }
      if (!dracoAttached) {
        try {
          const dracoCdn = new DRACOLoader();
          dracoCdn.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
          loader.setDRACOLoader(dracoCdn);
          dracoAttached = true;
          console.log('[AvatarWeb] DRACO loader attached (remote CDN)');
        } catch (e2) {
          console.warn('[AvatarWeb] Remote DRACO attach failed; continuing without DRACO compression support:', e2);
        }
      }
      // Register VRM plugin only when needed to avoid extra work for plain glb
      if (isVrm) {
        try { loader.register((parser) => new VRMLoaderPlugin(parser)); } catch (e) { console.warn('[AvatarWeb] VRM plugin register failed:', e); }
      }
    }
  );
  const rawScene = useMemo(() => gltf.scene || gltf.scenes?.[0], [gltf]);
  // For VRM v3 the instantiated VRM is in gltf.userData.vrm
  const vrmInstance = useMemo(() => (isVrm ? gltf.userData?.vrm : null), [gltf, isVrm]);
  const scene = useMemo(() => (vrmInstance?.scene ? vrmInstance.scene : rawScene), [vrmInstance, rawScene]);
  const group = useRef();
  const mixerRef = useRef(null);
  const playedOnceRef = useRef(false);
  const { camera, size: viewportSize } = useThree();

  // Normalize materials and ensure color space once loaded
  useEffect(() => {
    if (!scene) return;
    try {
      scene.traverse?.((child) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m, i) => {
            if (!m) return;
            // If shader-like, convert to MeshStandardMaterial
            const isShaderLike = m.isShaderMaterial || m.isRawShaderMaterial || typeof m.vertexShader === 'string' || typeof m.fragmentShader === 'string';
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
            if (m && m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.needsUpdate = true; }
            if (m && m.emissiveMap) { m.emissiveMap.colorSpace = THREE.SRGBColorSpace; m.emissiveMap.needsUpdate = true; }
          });
        }
      });
      console.log('[AvatarWeb] GLTF loaded. Animations:', (gltf.animations || []).length);
    } catch (e) {
      console.warn('[AvatarWeb] Material normalization error', e);
    }
  }, [scene, gltf.animations]);

  useEffect(() => {
    if (!group.current || !scene || !camera) return;
    // Re-center model around origin (keeps rotation visually centered)
    const initialBox = new THREE.Box3().setFromObject(scene);
    const initialCenter = new THREE.Vector3();
    initialBox.getCenter(initialCenter);
    scene.position.sub(initialCenter);

    // Base scale logic: allow enlargement via scaleBoost/sizeMultiplier but never shrink below 1.
    const h = parseFloat(height) || 170;
    const w = parseFloat(weight) || 70;
    const scaleY = Math.max(1, h / 170);
    const scaleX = Math.max(1, Math.min(1.4, w / 70));
    scene.scale.set(scaleX, scaleY, scaleX);
    if (scaleBoost && scaleBoost > 1) scene.scale.multiplyScalar(scaleBoost);
    if (sizeMultiplier && sizeMultiplier > 1) scene.scale.multiplyScalar(sizeMultiplier);

    // Offsets (X/Z)
    scene.position.x = xOffset || 0;
    scene.position.z = zOffset || 0;

    // Compute current bounding box after scaling
    let box = new THREE.Box3().setFromObject(scene);
    let size = new THREE.Vector3();
    box.getSize(size);

    const fov = (camera.fov * Math.PI) / 180;
    const halfFovTan = Math.tan(fov / 2);
    const aspect = camera.aspect || ((viewportSize?.width || 1) / Math.max(1, viewportSize?.height || 1));

    // Determine camera distance required to see full height and width with small margin.
    const fitMargin = 1.10; // slightly larger margin to avoid width/arm clipping
    const requiredDistanceY = (size.y / 2) / halfFovTan * fitMargin;
    const requiredDistanceX = (size.x / 2) / (halfFovTan * Math.max(0.0001, aspect)) * fitMargin;
    const required = Math.max(requiredDistanceY, requiredDistanceX);
    if (!Number.isFinite(camera.position.z) || camera.position.z < required) {
      camera.position.z = required;
    }

    // Align feet to bottom if requested. We do this AFTER setting camera distance.
    if (alignFootToBottom && camera.isPerspectiveCamera) {
      const visibleHalfH = Math.tan(fov / 2) * Math.max(0.0001, camera.position.z);
      const insetWorld = (viewportSize?.height ? (bottomInsetPx / viewportSize.height) * (visibleHalfH * 2) : 0);
      const desiredBottomY = -visibleHalfH + bottomPadding + insetWorld;
      const currentBottomY = -size.y / 2 + (scene.position.y || 0);
      const delta = desiredBottomY - currentBottomY;
      scene.position.y = (scene.position.y || 0) + delta;
      if (yOffset) scene.position.y += yOffset;
      if (footLift) scene.position.y += footLift; // fine tuning vertical foot placement
    } else {
      scene.position.y = yOffset || 0;
      if (footLift) scene.position.y += footLift;
    }

    // Final safety: if top still out of view (rare), nudge model downward minimally.
    box = new THREE.Box3().setFromObject(scene);
    box.getSize(size);
    const topY = scene.position.y + size.y / 2;
    const visibleHalfH2 = Math.tan(fov / 2) * Math.max(0.0001, camera.position.z);
    if (topY > visibleHalfH2) {
      scene.position.y -= (topY - visibleHalfH2);
    }
    // Aim camera at requested focus area ("chest" or "upper") for a natural view
    try {
      const focusRatio = focus === 'upper' ? 0.60 : 0.52; // chest ~0.52, upper chest ~0.60 of total height
      const targetY = scene.position.y + Math.min(size.y * focusRatio, size.y - 0.25);
      camera.lookAt(scene.position.x || 0, targetY, scene.position.z || 0);
      camera.updateProjectionMatrix();
      if (typeof onUpdateTargetY === 'function') onUpdateTargetY(targetY);
    } catch (_) {}
    // Auto-fit logic: existing "shrink" behavior + optional "tight" mode to enlarge into available space.
    if (autoFit && camera.isPerspectiveCamera) {
      const visibleHalfH = Math.tan(fov / 2) * Math.max(0.0001, camera.position.z);
      const availableH = (visibleHalfH * 2) - (bottomPadding + headMargin);
      if (size.y > availableH && size.y > 0) {
        // shrink only if too tall
        const fitScale = availableH / size.y;
        scene.scale.multiplyScalar(fitScale);
      } else if (fitMode === 'tight' && size.y < availableH * targetFill && size.y > 0) {
        // enlarge to reach targetFill percent of available height
        const growScale = (availableH * targetFill) / size.y;
        scene.scale.multiplyScalar(growScale);
      }
      // Recompute size and adjust vertical positioning again after any scale change
      box = new THREE.Box3().setFromObject(scene);
      box.getSize(size);
      // After scaling, ensure camera distance still satisfies width/height margins
      const requiredDistanceY2 = (size.y / 2) / halfFovTan * fitMargin;
      const requiredDistanceX2 = (size.x / 2) / (halfFovTan * Math.max(0.0001, aspect)) * fitMargin;
      const required2 = Math.max(requiredDistanceY2, requiredDistanceX2);
      if (!Number.isFinite(camera.position.z) || camera.position.z < required2) {
        camera.position.z = required2;
      }
      if (alignFootToBottom) {
        const visibleHalfH2 = Math.tan(fov / 2) * Math.max(0.0001, camera.position.z);
        const insetWorld2 = (viewportSize?.height ? (bottomInsetPx / viewportSize.height) * (visibleHalfH2 * 2) : 0);
        const desiredBottomY2 = -visibleHalfH2 + bottomPadding + insetWorld2;
        const currentBottomY2 = -size.y / 2 + (scene.position.y || 0);
        const delta2 = desiredBottomY2 - currentBottomY2;
        scene.position.y = (scene.position.y || 0) + delta2;
        if (footLift) scene.position.y += footLift;
      }
    }
  }, [scene, camera, height, weight, xOffset, yOffset, zOffset, sizeMultiplier, scaleBoost, alignFootToBottom, bottomPadding, autoFit, headMargin, bottomInsetPx, focus, fitMode, targetFill, footLift]);

  useFrame((_, delta) => {
    if (vrmInstance?.update) {
      try { vrmInstance.update(delta); } catch (_) {}
    }
    if (mixerRef.current && playAnimation) {
      try { mixerRef.current.update(delta); } catch (_) {}
    }
  });
  useEffect(() => {
    if (!scene) return;
    // Setup animation mixer on first mount
    if (playAnimation && (gltf.animations || []).length > 0 && !playedOnceRef.current) {
      try {
        const mixer = new THREE.AnimationMixer(scene);
        mixerRef.current = mixer;
        const clip = (gltf.animations.find((c) => c.name?.toLowerCase().includes('idle')) || gltf.animations[0]);
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        action.play();
        playedOnceRef.current = true;
      } catch (_) {}
    }
    return () => {
      try { mixerRef.current?.stopAllAction(); } catch (_) {}
      mixerRef.current = null;
    };
  }, [scene, gltf.animations, playAnimation]);

  useEffect(() => {
    if (!vrmInstance || !expressionName) return;
    const mgr = vrmInstance.expressionManager;
    if (!mgr) return;
    try {
      const v = typeof expressionValue === 'number' ? expressionValue : 1;
      mgr.setValue(expressionName, v);
      mgr.update(0);
    } catch (_) {}
    return () => {
      try { mgr.setValue(expressionName, 0); mgr.update(0); } catch (_) {}
    };
  }, [vrmInstance, expressionName, expressionValue]);

  if (error) {
    return (
      <group ref={group}>
        <mesh>
          <boxGeometry args={[1,1,1]} />
          <meshStandardMaterial color={'#ff5555'} />
        </mesh>
      </group>
    );
  }
  return <primitive ref={group} object={scene} />;
};

// Canvas-child controls: updates the R3F camera using refs mutated by outer pointer handlers
const Controls = ({ interactive, targetRef, sphericalRef, targetSphericalRef, targetY, minDistance, maxDistance }) => {
  const { camera } = useThree();
  // Initialize spherical from camera position
  useEffect(() => {
    try {
      const t = targetRef.current || new THREE.Vector3(0, targetY, 0);
      targetRef.current = t;
      const offset = new THREE.Vector3().copy(camera.position).sub(t);
      const r = Math.max(0.0001, offset.length());
      const theta = Math.atan2(offset.x, offset.z);
      const phi = Math.acos(THREE.MathUtils.clamp(offset.y / r, -1, 1));
      sphericalRef.current = { r, theta, phi };
      targetSphericalRef.current = { r, theta, phi };
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useFrame(() => {
    if (!interactive) return;
    const s = sphericalRef.current;
    const ts = targetSphericalRef.current;
    if (!s || !ts) return;
    // smooth towards target spherical
    s.r += (ts.r - s.r) * 0.15;
    s.theta += (ts.theta - s.theta) * 0.15;
    s.phi += (ts.phi - s.phi) * 0.15;
    // clamp distance
    s.r = THREE.MathUtils.clamp(s.r, minDistance, maxDistance);
    const t = targetRef.current || new THREE.Vector3(0, targetY, 0);
    const sinPhi = Math.sin(s.phi);
    const x = t.x + s.r * sinPhi * Math.sin(s.theta);
    const y = t.y + s.r * Math.cos(s.phi);
    const z = t.z + s.r * sinPhi * Math.cos(s.theta);
    camera.position.set(x, y, z);
    camera.lookAt(t);
  });
  return null;
};

const AvatarWeb = ({
  gender = 'male',
  height,
  weight,
  sizeMultiplier = 1,
  scaleBoost = 1,
  xOffset = 0.125,
  yOffset = 0,
  zOffset = 0,
  playAnimation = true,
  modelUrl: providedModelUrl,
  alignFootToBottom = false,
  bottomPadding = 0.06,
  autoFit = true,
  headMargin = 0.08,
  // interactive camera controls
  interactive = true,
  minDistance = 1.6,
  maxDistance = 4.5,
  rotateSpeed = 0.003,
  zoomSpeed = 0.005,
  panSpeed = 0.003,
  allowPan = true,
  initialTheta = 0,
  initialPhi = Math.PI / 2,
  showExpressionButtons = false,
  expressionButtons = [
    { label: 'Neutral', emoji: '😐' },
    { label: 'Smiling', emoji: '🙂' },
    { label: 'Happy', emoji: '😄' },
    { label: 'Angry', emoji: '😠' },
    { label: 'Surprised', emoji: '😮' },
    { label: 'Sad', emoji: '😢' },
    { label: 'Closed', emoji: '😴' },
    { label: 'A', emoji: '🅰️' },
    { label: 'I', emoji: 'ℹ️' },
    { label: 'U', emoji: '🔄' },
    { label: 'E', emoji: '📧' },
    { label: 'O', emoji: '⭕' },
  ],
  targetY = 0.9,
  bottomInsetPx = 0,
  focus = 'chest', // 'chest' | 'upper'
  fitMode = 'shrink', // 'shrink' | 'tight'
  targetFill = 0.94,
  footLift = 0,
  expressionName,
  expressionValue,
}) => {
  // Prefer VRM samples; fall back to GLB if not provided
  let defaultUrl;
  try {
    defaultUrl = gender === 'female'
      ? require('../assets/models/AvatarSample_F.vrm')
      : require('../assets/models/AvatarSample_M.vrm');
  } catch (e) {
    // Fallback to existing glb assets if VRM require fails
    defaultUrl = gender === 'female' ? require('../assets/models/w.glb') : require('../assets/models/q.glb');
  }
  const modelUrl = providedModelUrl || defaultUrl;

  // Simple custom orbit-like controls implemented in HTML overlay
  const containerRef = useRef(null);
  const target = useRef(new THREE.Vector3(0, targetY, 0));
  const spherical = useRef({ r: 2.6, theta: initialTheta, phi: initialPhi });
  const targetSpherical = useRef({ r: 2.6, theta: initialTheta, phi: initialPhi });
  const dragging = useRef(false);
  const dragMode = useRef('orbit'); // 'orbit' | 'pan'
  const pointers = useRef(new Map());
  const pinchState = useRef({ pinching: false, startDist: 0, startR: 2.6 });
  const [expressionNameLocal, setExpressionNameLocal] = useState(null);
  const [expressionValueLocal, setExpressionValueLocal] = useState(1);
  const effectiveExpressionName = expressionName ?? expressionNameLocal;
  const effectiveExpressionValue = expressionValue ?? expressionValueLocal;

  // Camera updates are handled by Controls inside Canvas

  // Pointer/gesture handlers (web)
  const onPointerDown = (e) => {
    if (!interactive) return;
    const el = containerRef.current;
    if (!el) return;
    el.setPointerCapture?.(e.pointerId);
    const isPan = allowPan && (e.button === 1 || e.button === 2 || e.shiftKey || e.metaKey || e.ctrlKey);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, mode: isPan ? 'pan' : 'orbit' });
    if (pointers.current.size === 1) {
      dragging.current = true;
      dragMode.current = isPan ? 'pan' : 'orbit';
    } else if (pointers.current.size === 2) {
      // start pinch
      const arr = Array.from(pointers.current.values());
      const dx = arr[0].x - arr[1].x;
      const dy = arr[0].y - arr[1].y;
      pinchState.current = { pinching: true, startDist: Math.hypot(dx, dy), startR: targetSpherical.current.r };
      dragging.current = false;
    }
  };
  const onPointerMove = (e) => {
    if (!interactive) return;
    if (!pointers.current.has(e.pointerId)) return;
    const last = pointers.current.get(e.pointerId);
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, mode: last.mode });
    const ts = targetSpherical.current;
    if (pinchState.current.pinching && pointers.current.size === 2) {
      const arr = Array.from(pointers.current.values());
      const ndx = arr[0].x - arr[1].x;
      const ndy = arr[0].y - arr[1].y;
      const nd = Math.hypot(ndx, ndy);
      const scale = pinchState.current.startDist > 0 ? pinchState.current.startDist / Math.max(1, nd) : 1;
      const newR = THREE.MathUtils.clamp(pinchState.current.startR * scale, minDistance, maxDistance);
      ts.r = newR;
    } else if (dragging.current && dragMode.current === 'orbit') {
      ts.theta -= dx * rotateSpeed; // horizontal orbit
      ts.phi = THREE.MathUtils.clamp(ts.phi - dy * rotateSpeed, 0.1, Math.PI - 0.1); // vertical orbit
    } else if (dragging.current && dragMode.current === 'pan' && allowPan) {
      const t = target.current;
      const distance = Math.max(minDistance, Math.min(maxDistance, ts.r));
      const factor = panSpeed * distance;
      if (t) {
        t.x -= dx * factor;
        t.y += dy * factor;
        target.current = t;
      }
    }
  };
  const onPointerUp = (e) => {
    if (!interactive) return;
    const el = containerRef.current;
    el?.releasePointerCapture?.(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchState.current.pinching = false;
    if (pointers.current.size === 0) {
      dragging.current = false;
      dragMode.current = 'orbit';
    }
  };
  const onWheel = (e) => {
    if (!interactive) return;
    const ts = targetSpherical.current;
    const delta = e.deltaY * zoomSpeed;
    ts.r = THREE.MathUtils.clamp(ts.r + delta, minDistance, maxDistance);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
    <Canvas
      camera={{ position: [0, 1.2, 2.6], fov: 45, near: 0.01, far: 100 }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        try {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.physicallyCorrectLights = true;
        } catch (_) {}
      }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight intensity={0.65} position={[3, 5, 5]} />
  <Model
    url={modelUrl}
    height={height}
    weight={weight}
    sizeMultiplier={sizeMultiplier}
    scaleBoost={scaleBoost}
    xOffset={xOffset}
    yOffset={yOffset}
    zOffset={zOffset}
    playAnimation={playAnimation}
    alignFootToBottom={alignFootToBottom}
    bottomPadding={bottomPadding}
    autoFit={autoFit}
    headMargin={headMargin}
    bottomInsetPx={bottomInsetPx}
    focus={focus}
    fitMode={fitMode}
    targetFill={targetFill}
    footLift={footLift}
    expressionName={effectiveExpressionName}
    expressionValue={effectiveExpressionValue}
    onUpdateTargetY={(y)=>{ try { target.current.set(0, y, 0); } catch(_){} }}
  />
  <Controls interactive={interactive} targetRef={target} sphericalRef={spherical} targetSphericalRef={targetSpherical} targetY={targetY} minDistance={minDistance} maxDistance={maxDistance} />
    </Canvas>
    {showExpressionButtons && (
      <div style={{ position: 'absolute', left: 8, top: 8, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'auto', overflow: 'visible' }}>
        {expressionButtons.map((item) => {
          const name = typeof item === 'string' ? item : item.label;
          const emoji = typeof item === 'string' ? '' : item.emoji || item.label;
          return (
          <button
            key={name}
            onClick={() => { setExpressionNameLocal(name); setExpressionValueLocal(1); }}
            style={{
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.25)',
              background: effectiveExpressionName === name ? 'rgba(0,160,255,0.65)' : 'rgba(20,20,30,0.7)',
              color: '#f5f7ff',
              fontSize: 12,
              backdropFilter: 'blur(6px)',
              pointerEvents: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
            }}
          >
            <span style={{ marginRight: emoji ? 6 : 0 }}>{emoji}</span>
            <span>{emoji ? '' : name}</span>
          </button>
          );
        })}
      </div>
    )}
    </div>
  );
};

export default AvatarWeb;
