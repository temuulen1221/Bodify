/* eslint-disable react/no-unknown-property */
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Asset } from 'expo-asset';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getMixamoAnimation } from '../CharacterStudio/src/library/loadMixamoAnimation';
import { isIdleAnimationType, resolveAvatarAnimationConfig, resolveAvatarExpressionConfig } from '../utils/avatarAnimationConfig';
import { getDefaultAvatarModelId, getLocalAvatarModelModule } from '../utils/avatarModels';

class BlinkManager {
  constructor() {
    this.vrms = new Set();
  }

  addVRM(vrm) {
    if (vrm) this.vrms.add(vrm);
  }

  removeVRM(vrm) {
    if (vrm) this.vrms.delete(vrm);
  }
}

class CameraFrameManager {
  constructor(camera) {
    this.camera = camera;
    this.target = null;
  }

  setFrameTarget(target) {
    this.target = target;
  }

  async calculateBoneOffsets() {
    return null;
  }

  frameMediumShot() {
    return null;
  }
}

class EmotionManager {
  constructor() {
    this.vrms = new Set();
  }

  addVRM(vrm) {
    if (vrm) this.vrms.add(vrm);
  }

  removeVRM(vrm) {
    if (vrm) this.vrms.delete(vrm);
  }
}

class LookAtManager {
  constructor(_intensity, _canvasId, camera) {
    this.camera = camera;
    this.enabled = true;
    this.active = true;
    this.vrms = new Set();
  }

  addVRM(vrm) {
    if (vrm) this.vrms.add(vrm);
  }

  removeVRM(vrm) {
    if (vrm) this.vrms.delete(vrm);
  }

  setCamera(camera) {
    this.camera = camera;
  }

  setActive(active) {
    this.active = active;
  }

  update() {
    return null;
  }
}

const animationSourceCache = new Map();
const RESETTABLE_EXPRESSION_KEYS = ['neutral', 'happy', 'relaxed', 'sad', 'surprised', 'angry', 'blink', 'aa', 'ee', 'oh', 'ih', 'ou'];

const BONE_NAME_PATTERNS = [
  { key: 'hips', patterns: [/^hips$/, /^pelvis$/, /^mixamorighips$/] },
  { key: 'spine', patterns: [/^spine$/, /^mixamorigspine$/] },
  { key: 'chest', patterns: [/^spine1$/, /^chest$/, /^uppertorso$/, /^mixamorigspine1$/] },
  { key: 'upperChest', patterns: [/^spine2$/, /^upperchest$/, /^mixamorigspine2$/] },
  { key: 'neck', patterns: [/^neck$/, /^mixamorigneck$/] },
  { key: 'head', patterns: [/^head$/, /^mixamorighead$/] },
  { key: 'leftShoulder', patterns: [/^leftshoulder$/, /^lshoulder$/, /^mixamorigleftshoulder$/] },
  { key: 'rightShoulder', patterns: [/^rightshoulder$/, /^rshoulder$/, /^mixamorigrightshoulder$/] },
  { key: 'leftUpperArm', patterns: [/^leftupperarm$/, /^leftarm$/, /^larm$/, /^lupperarm$/, /^mixamorigleftarm$/] },
  { key: 'rightUpperArm', patterns: [/^rightupperarm$/, /^rightarm$/, /^rarm$/, /^rupperarm$/, /^mixamorigrightarm$/] },
  { key: 'leftLowerArm', patterns: [/^leftlowerarm$/, /^leftforearm$/, /^lforearm$/, /^llowerarm$/, /^mixamorigleftforearm$/] },
  { key: 'rightLowerArm', patterns: [/^rightlowerarm$/, /^rightforearm$/, /^rforearm$/, /^rlowerarm$/, /^mixamorigrightforearm$/] },
  { key: 'leftHand', patterns: [/^lefthand$/, /^lhand$/, /^mixamoriglefthand$/] },
  { key: 'rightHand', patterns: [/^righthand$/, /^rhand$/, /^mixamorigrighthand$/] },
  { key: 'leftUpperLeg', patterns: [/^leftupleg$/, /^leftthigh$/, /^lthigh$/, /^leftupperleg$/, /^mixamorigleftupleg$/] },
  { key: 'rightUpperLeg', patterns: [/^rightupleg$/, /^rightthigh$/, /^rthigh$/, /^rightupperleg$/, /^mixamorigrightupleg$/] },
  { key: 'leftLowerLeg', patterns: [/^leftleg$/, /^leftcalf$/, /^lcalf$/, /^leftlowerleg$/, /^mixamorigleftleg$/] },
  { key: 'rightLowerLeg', patterns: [/^rightleg$/, /^rightcalf$/, /^rcalf$/, /^rightlowerleg$/, /^mixamorigrightleg$/] },
  { key: 'leftFoot', patterns: [/^leftfoot$/, /^lfoot$/, /^mixamorigleftfoot$/] },
  { key: 'rightFoot', patterns: [/^rightfoot$/, /^rfoot$/, /^mixamorigrightfoot$/] },
  { key: 'leftToes', patterns: [/^lefttoebase$/, /^lefttoe$/, /^ltoe$/, /^mixamoriglefttoebase$/] },
  { key: 'rightToes', patterns: [/^righttoebase$/, /^righttoe$/, /^rtoe$/, /^mixamorigrighttoebase$/] },
];

const isPlayableAnimationClip = (clip) => Boolean(
  clip
  && Array.isArray(clip.tracks)
  && clip.tracks.length > 0
  && Number.isFinite(clip.duration)
  && clip.duration > 0
);

const hasBindableTrack = (clip, targetRoot) => {
  if (!isPlayableAnimationClip(clip) || !targetRoot) return false;

  return clip.tracks.some((track) => {
    const trackName = String(track?.name || '');
    const nodeName = trackName.split('.')[0].split(/[|:/\\]/).filter(Boolean).pop();
    if (!nodeName) return false;
    const node = targetRoot.name === nodeName ? targetRoot : targetRoot.getObjectByName?.(nodeName);
    return Boolean(node?.isBone);
  });
};

const getCanonicalBoneName = (name) => {
  const normalized = String(name || '')
    .split(/[|:/\\]/)
    .filter(Boolean)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!normalized) return null;

  const match = BONE_NAME_PATTERNS.find(({ patterns }) => patterns.some((pattern) => pattern.test(normalized)));
  return match?.key || null;
};

const buildCanonicalBoneMap = (targetRoot) => {
  const canonicalMap = new Map();
  if (!targetRoot) return canonicalMap;

  targetRoot.traverse?.((child) => {
    if (!child?.isBone || !child?.name) return;
    const canonicalName = getCanonicalBoneName(child.name);
    if (canonicalName && !canonicalMap.has(canonicalName)) {
      canonicalMap.set(canonicalName, child.name);
    }
  });

  return canonicalMap;
};

const remapAnimationClipToScene = (clip, targetRoot) => {
  if (!isPlayableAnimationClip(clip) || !targetRoot) return clip;

  const canonicalBoneMap = buildCanonicalBoneMap(targetRoot);
  if (canonicalBoneMap.size === 0) return clip;

  let changed = false;
  const remappedTracks = clip.tracks.map((track) => {
    const [rawNodeName, ...propertySegments] = String(track?.name || '').split('.');
    const nodeName = rawNodeName.split(/[|:/\\]/).filter(Boolean).pop();
    if (!nodeName || propertySegments.length === 0) return track;

    const canonicalName = getCanonicalBoneName(nodeName);
    const targetNodeName = canonicalName ? canonicalBoneMap.get(canonicalName) : null;

    if (!targetNodeName || targetNodeName === nodeName) return track;

    const remappedTrack = track.clone();
    remappedTrack.name = `${targetNodeName}.${propertySegments.join('.')}`;
    changed = true;
    return remappedTrack;
  });

  if (!changed) return clip;
  return new THREE.AnimationClip(`${clip.name || 'sceneAnimation'}:remapped`, clip.duration, remappedTracks);
};

const attachDracoLoader = (loader) => {
  try {
    const dracoLocal = new DRACOLoader();
    dracoLocal.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLocal);
    return;
  } catch (_) {}

  try {
    const dracoCdn = new DRACOLoader();
    dracoCdn.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(dracoCdn);
  } catch (_) {}
};

const resetExpressionValues = (expressionManager, keepKeys = []) => {
  if (!expressionManager) return;

  const keep = new Set(keepKeys.filter(Boolean));
  RESETTABLE_EXPRESSION_KEYS.forEach((key) => {
    if (keep.has(key)) return;
    try {
      expressionManager.setValue(key, 0);
    } catch (_) {}
  });
};

const Model = ({ url, gender = 'male', animationType = 'idle', height = '170', weight = '70', sizeMultiplier = 1, scaleBoost = 1, xOffset = 0, yOffset = 0, zOffset = 0, animationSpeed = 1, playAnimation = true, animationReplayNonce = 0, animationRepeatCount = 1, onAnimationComplete, alignFootToBottom = false, bottomPadding = 0.06, autoFit = true, headMargin = 0.08, bottomInsetPx = 0, focus = 'chest', fitMode = 'shrink', targetFill = 0.94, footLift = 0, preserveTPose = false, onUpdateTargetY, onVrmLoad, onManagersReady, canvasId, expressionName, expressionValue = 1, visemeLevel = 0, visemeActive = false }) => {
  const isVrm = /\.vrm$/i.test(String(url));
  const [error, setError] = useState(null);
  const [activeAnimationConfig, setActiveAnimationConfig] = useState(() => resolveAvatarAnimationConfig(animationType, gender));
  const idleTimerRef = useRef(null);
  const selectedAnimation = activeAnimationConfig;
  const derivedExpression = useMemo(
    () => resolveAvatarExpressionConfig(selectedAnimation.key || animationType, gender),
    [animationType, gender, selectedAnimation.key]
  );
  const [resolvedAnimationClip, setResolvedAnimationClip] = useState(null);
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
  const currentActionRef = useRef(null);
  const naturalPoseAppliedRef = useRef(false);
  const genericIdlePoseAppliedRef = useRef(false);
  const naturalPoseRestoreRef = useRef(null);
  const genericPoseRestoreRef = useRef(null);
  const idleTimeRef = useRef(0);
  const blinkCycleRef = useRef(0);
  const idleBonesRef = useRef(null);
  const genericIdleBonesRef = useRef(null);
  const lookAtManagerRef = useRef(null);
  const blinkManagerRef = useRef(null);
  const emotionManagerRef = useRef(null);
  const cameraFrameManagerRef = useRef(null);
  const frameReadyRef = useRef(false);
  const actionCompleteHandledRef = useRef(null);
  const { camera, size: viewportSize } = useThree();
  const animationTargetRoot = vrmInstance?.scene || scene || null;
  const embeddedSceneClip = useMemo(() => gltf.animations?.[0] || null, [gltf.animations]);
  const remappedResolvedClip = useMemo(() => {
    if (vrmInstance || !resolvedAnimationClip || !animationTargetRoot) return resolvedAnimationClip;
    return remapAnimationClipToScene(resolvedAnimationClip, animationTargetRoot);
  }, [animationTargetRoot, resolvedAnimationClip, vrmInstance]);
  const playableResolvedClip = useMemo(() => {
    if (!remappedResolvedClip) return null;
    if (vrmInstance) return remappedResolvedClip;
    return hasBindableTrack(remappedResolvedClip, animationTargetRoot) ? remappedResolvedClip : null;
  }, [animationTargetRoot, remappedResolvedClip, vrmInstance]);
  const allowEmbeddedClip = !vrmInstance && Boolean(selectedAnimation?.asset);
  const playableEmbeddedClip = allowEmbeddedClip && hasBindableTrack(embeddedSceneClip, animationTargetRoot) ? embeddedSceneClip : null;
  const hasMotionClip = Boolean(playableResolvedClip || playableEmbeddedClip);
  const explicitExpressionName = typeof expressionName === 'string' ? expressionName : null;

  useEffect(() => {
    if (vrmInstance || !remappedResolvedClip || playableResolvedClip || !animationTargetRoot) return;
    const sampleTrackNames = (remappedResolvedClip.tracks || []).slice(0, 6).map((track) => String(track?.name || ''));
    console.warn('[AvatarWeb] Resolved animation clip has no bindable tracks on current model; using procedural fallback', sampleTrackNames);
  }, [animationTargetRoot, playableResolvedClip, remappedResolvedClip, vrmInstance]);

  const clearIdleSchedule = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const getBoneNode = (humanoid, name) => {
    if (!humanoid) return null;
    return humanoid.getNormalizedBoneNode?.(name) || humanoid.getRawBoneNode?.(name) || null;
  };

  useEffect(() => {
    let cancelled = false;

    const loadResolvedAnimationClip = async () => {
      const cacheKey = selectedAnimation.id || `${gender}:${animationType}`;
      setResolvedAnimationClip(null);

      if (isIdleAnimationType(animationType) && !selectedAnimation.asset) {
        return;
      }

      if (!selectedAnimation.asset) {
        return;
      }

      try {
        let animationSource = animationSourceCache.get(cacheKey);
        if (!animationSource) {
          const animationAsset = Asset.fromModule(selectedAnimation.asset);
          await animationAsset.downloadAsync();
          const animationUri = animationAsset.localUri || animationAsset.uri;

          if (!animationUri) {
            throw new Error(`Missing animation URI for ${cacheKey}`);
          }

          if (selectedAnimation.format === 'fbx') {
            const loader = new FBXLoader();
            animationSource = await loader.loadAsync(animationUri);
          } else {
            const loader = new GLTFLoader();
            attachDracoLoader(loader);
            animationSource = await loader.loadAsync(animationUri);
          }
          animationSourceCache.set(cacheKey, animationSource);
        }

        const sourceAnimations = animationSource?.animations || [];
        if (sourceAnimations.length === 0) {
          if (!cancelled) {
            setResolvedAnimationClip(null);
          }
          return;
        }

        if (!vrmInstance) {
          if (!cancelled) {
            setResolvedAnimationClip(isPlayableAnimationClip(sourceAnimations[0]) ? sourceAnimations[0] : null);
          }
          return;
        }

        try {
          const retargetedClip = getMixamoAnimation(
            sourceAnimations,
            animationSource.scene || animationSource.scenes?.[0] || animationSource,
            vrmInstance,
          ) || sourceAnimations[0];

          if (!cancelled) {
            if (isPlayableAnimationClip(retargetedClip)) {
              setResolvedAnimationClip(retargetedClip);
            } else {
              console.warn('[AvatarWeb] Retargeted clip has no playable tracks; using procedural idle fallback');
              setResolvedAnimationClip(null);
            }
          }
        } catch (animationError) {
          console.warn('[AvatarWeb] Failed to retarget external animation clip:', animationError);
          if (!cancelled) {
            setResolvedAnimationClip(null);
          }
        }
      } catch (animationError) {
        console.warn('[AvatarWeb] External animation load failed:', animationError);
        if (!cancelled) {
          setResolvedAnimationClip(null);
        }
      }
    };

    loadResolvedAnimationClip();

    return () => {
      cancelled = true;
    };
  }, [animationType, gender, selectedAnimation.asset, selectedAnimation.id, vrmInstance]);

  const findBoneByNamePattern = (root, patterns = []) => {
    if (!root || !Array.isArray(patterns) || patterns.length === 0) return null;
    let found = null;
    root.traverse?.((child) => {
      if (found || !child?.isBone) return;
      const name = String(child.name || '').toLowerCase();
      if (!name) return;
      if (patterns.some((pattern) => pattern.test(name))) {
        found = child;
      }
    });
    return found;
  };

  useEffect(() => {
    clearIdleSchedule();
    setActiveAnimationConfig(resolveAvatarAnimationConfig(animationType, gender));

    return () => {
      clearIdleSchedule();
    };
  }, [animationType, clearIdleSchedule, gender]);

  useEffect(() => {
    if (vrmInstance && typeof onVrmLoad === 'function') {
      console.log('[AvatarWeb] VRM instance loaded, calling onVrmLoad callback');
      onVrmLoad(vrmInstance);
    }
  }, [vrmInstance, onVrmLoad]);

  useEffect(() => {
    if (!vrmInstance || !camera || typeof window === 'undefined') return;
    try {
      if (!emotionManagerRef.current) {
        emotionManagerRef.current = new EmotionManager();
      }
      emotionManagerRef.current.addVRM(vrmInstance);

      if (!blinkManagerRef.current) {
        blinkManagerRef.current = new BlinkManager(0.14, 0.12, 1.8, 4);
      }
      blinkManagerRef.current.addVRM(vrmInstance);

      if (!lookAtManagerRef.current) {
        lookAtManagerRef.current = new LookAtManager(92, canvasId, camera);
        lookAtManagerRef.current.enabled = true;
        lookAtManagerRef.current.setActive(true);
      }
      lookAtManagerRef.current.setCamera(camera);
      if (vrmInstance?.humanoid?.humanBones || vrmInstance?.data || vrmInstance?.meta) {
        lookAtManagerRef.current.addVRM(vrmInstance);
      }

      if (!cameraFrameManagerRef.current) {
        cameraFrameManagerRef.current = new CameraFrameManager(camera);
      }
      cameraFrameManagerRef.current.camera = camera;
      cameraFrameManagerRef.current.setFrameTarget(scene || vrmInstance.scene);
      if (!frameReadyRef.current) {
        cameraFrameManagerRef.current.calculateBoneOffsets(scene || vrmInstance.scene, 0.02)
          .then(() => {
            frameReadyRef.current = true;
            try { cameraFrameManagerRef.current.frameMediumShot(); } catch (_) {}
          })
          .catch(() => {});
      }

      if (typeof onManagersReady === 'function') {
        onManagersReady({
          lookAtManager: lookAtManagerRef.current,
          blinkManager: blinkManagerRef.current,
          emotionManager: emotionManagerRef.current,
          cameraFrameManager: cameraFrameManagerRef.current,
          vrm: vrmInstance,
        });
      }
    } catch (error) {
      console.warn('[AvatarWeb] Failed to initialize VRM interactivity managers', error);
    }

    return () => {
      try { lookAtManagerRef.current?.removeVRM?.(vrmInstance); } catch (_) {}
      try { blinkManagerRef.current?.removeVRM?.(vrmInstance); } catch (_) {}
      try { emotionManagerRef.current?.removeVRM?.(vrmInstance); } catch (_) {}
    };
  }, [vrmInstance, camera, scene, canvasId, onManagersReady]);

  useEffect(() => {
    if (preserveTPose || !vrmInstance || naturalPoseAppliedRef.current || hasMotionClip) return;
    try {
      const humanoid = vrmInstance.humanoid;
      const leftUpperArm = getBoneNode(humanoid, 'leftUpperArm');
      const rightUpperArm = getBoneNode(humanoid, 'rightUpperArm');
      const leftLowerArm = getBoneNode(humanoid, 'leftLowerArm');
      const rightLowerArm = getBoneNode(humanoid, 'rightLowerArm');
      const spine = getBoneNode(humanoid, 'spine');
      const chest = getBoneNode(humanoid, 'chest');
      const neck = getBoneNode(humanoid, 'neck');

      naturalPoseRestoreRef.current = {
        leftUpperArm: leftUpperArm ? { x: leftUpperArm.rotation.x, z: leftUpperArm.rotation.z } : null,
        rightUpperArm: rightUpperArm ? { x: rightUpperArm.rotation.x, z: rightUpperArm.rotation.z } : null,
        leftLowerArm: leftLowerArm ? { z: leftLowerArm.rotation.z } : null,
        rightLowerArm: rightLowerArm ? { z: rightLowerArm.rotation.z } : null,
        spine: spine ? { x: spine.rotation.x } : null,
        neck: neck ? { x: neck.rotation.x } : null,
      };

      // Relax default T-pose into a subtle natural standing pose.
      if (leftUpperArm) {
        leftUpperArm.rotation.z -= 1.42;
        leftUpperArm.rotation.x -= 0.3;
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.z += 1.42;
        rightUpperArm.rotation.x -= 0.3;
      }
      if (leftLowerArm) leftLowerArm.rotation.z += 0.28;
      if (rightLowerArm) rightLowerArm.rotation.z -= 0.28;
      if (spine) spine.rotation.x += 0.03;
      if (neck) neck.rotation.x += 0.02;

      idleBonesRef.current = {
        leftUpperArm,
        rightUpperArm,
        spine,
        chest,
        neck,
        leftUpperArmZ: leftUpperArm?.rotation?.z || 0,
        rightUpperArmZ: rightUpperArm?.rotation?.z || 0,
        spineX: spine?.rotation?.x || 0,
        chestX: chest?.rotation?.x || 0,
        chestY: chest?.rotation?.y || 0,
        neckY: neck?.rotation?.y || 0,
      };

      const mgr = vrmInstance.expressionManager;
      if (mgr) {
        try { mgr.setValue('neutral', 1); } catch (_) {}
        try { mgr.update(0); } catch (_) {}
      }

      naturalPoseAppliedRef.current = true;
      console.log('[AvatarWeb] Applied natural idle pose');
    } catch (e) {
      console.warn('[AvatarWeb] Failed to apply natural pose', e);
    }
  }, [hasMotionClip, preserveTPose, vrmInstance]);

  useEffect(() => {
    if (preserveTPose || vrmInstance || !scene || genericIdlePoseAppliedRef.current || hasMotionClip) return;
    try {
      const leftUpperArm = findBoneByNamePattern(scene, [/left.*upperarm/, /upperarm.*left/, /^leftarm$/, /leftarm$/, /mixamorigleftarm/, /l_upperarm/, /arm_l/]);
      const rightUpperArm = findBoneByNamePattern(scene, [/right.*upperarm/, /upperarm.*right/, /^rightarm$/, /rightarm$/, /mixamorigrightarm/, /r_upperarm/, /arm_r/]);
      const leftLowerArm = findBoneByNamePattern(scene, [/left.*lowerarm/, /lowerarm.*left/, /left.*forearm/, /forearm.*left/, /mixamorigleftforearm/, /l_forearm/, /forearm_l/]);
      const rightLowerArm = findBoneByNamePattern(scene, [/right.*lowerarm/, /lowerarm.*right/, /right.*forearm/, /forearm.*right/, /mixamorigrightforearm/, /r_forearm/, /forearm_r/]);
      const spine = findBoneByNamePattern(scene, [/spine(\d+)?$/, /hips?spine/, /chestspine/]);
      const chest = findBoneByNamePattern(scene, [/chest/, /upperchest/]);
      const neck = findBoneByNamePattern(scene, [/neck/, /headneck/]);

      genericPoseRestoreRef.current = {
        leftUpperArm: leftUpperArm ? { x: leftUpperArm.rotation.x, z: leftUpperArm.rotation.z } : null,
        rightUpperArm: rightUpperArm ? { x: rightUpperArm.rotation.x, z: rightUpperArm.rotation.z } : null,
        leftLowerArm: leftLowerArm ? { z: leftLowerArm.rotation.z } : null,
        rightLowerArm: rightLowerArm ? { z: rightLowerArm.rotation.z } : null,
        spine: spine ? { x: spine.rotation.x } : null,
        neck: neck ? { x: neck.rotation.x } : null,
      };

      if (leftUpperArm) {
        leftUpperArm.rotation.z -= 1.34;
        leftUpperArm.rotation.x -= 0.26;
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.z += 1.34;
        rightUpperArm.rotation.x -= 0.26;
      }
      if (leftLowerArm) leftLowerArm.rotation.z += 0.24;
      if (rightLowerArm) rightLowerArm.rotation.z -= 0.24;
      if (spine) spine.rotation.x += 0.025;
      if (neck) neck.rotation.x += 0.018;

      genericIdleBonesRef.current = {
        leftUpperArm,
        rightUpperArm,
        spine,
        chest,
        neck,
        leftUpperArmZ: leftUpperArm?.rotation?.z || 0,
        rightUpperArmZ: rightUpperArm?.rotation?.z || 0,
        spineX: spine?.rotation?.x || 0,
        chestX: chest?.rotation?.x || 0,
        chestY: chest?.rotation?.y || 0,
        neckY: neck?.rotation?.y || 0,
      };

      genericIdlePoseAppliedRef.current = true;
      console.log('[AvatarWeb] Applied generic idle pose fallback');
    } catch (e) {
      console.warn('[AvatarWeb] Failed to apply generic idle fallback pose', e);
    }
  }, [hasMotionClip, preserveTPose, vrmInstance, scene]);

  useEffect(() => {
    if (!hasMotionClip) return;

    const naturalPose = naturalPoseRestoreRef.current;
    if (naturalPose && vrmInstance) {
      const humanoid = vrmInstance.humanoid;
      const leftUpperArm = getBoneNode(humanoid, 'leftUpperArm');
      const rightUpperArm = getBoneNode(humanoid, 'rightUpperArm');
      const leftLowerArm = getBoneNode(humanoid, 'leftLowerArm');
      const rightLowerArm = getBoneNode(humanoid, 'rightLowerArm');
      const spine = getBoneNode(humanoid, 'spine');
      const neck = getBoneNode(humanoid, 'neck');

      if (leftUpperArm && naturalPose.leftUpperArm) {
        leftUpperArm.rotation.x = naturalPose.leftUpperArm.x;
        leftUpperArm.rotation.z = naturalPose.leftUpperArm.z;
      }
      if (rightUpperArm && naturalPose.rightUpperArm) {
        rightUpperArm.rotation.x = naturalPose.rightUpperArm.x;
        rightUpperArm.rotation.z = naturalPose.rightUpperArm.z;
      }
      if (leftLowerArm && naturalPose.leftLowerArm) {
        leftLowerArm.rotation.z = naturalPose.leftLowerArm.z;
      }
      if (rightLowerArm && naturalPose.rightLowerArm) {
        rightLowerArm.rotation.z = naturalPose.rightLowerArm.z;
      }
      if (spine && naturalPose.spine) {
        spine.rotation.x = naturalPose.spine.x;
      }
      if (neck && naturalPose.neck) {
        neck.rotation.x = naturalPose.neck.x;
      }

      naturalPoseRestoreRef.current = null;
      naturalPoseAppliedRef.current = false;
      idleBonesRef.current = null;
    }

    const genericPose = genericPoseRestoreRef.current;
    if (genericPose && scene) {
      const leftUpperArm = findBoneByNamePattern(scene, [/left.*upperarm/, /upperarm.*left/, /^leftarm$/, /leftarm$/, /mixamorigleftarm/, /l_upperarm/, /arm_l/]);
      const rightUpperArm = findBoneByNamePattern(scene, [/right.*upperarm/, /upperarm.*right/, /^rightarm$/, /rightarm$/, /mixamorigrightarm/, /r_upperarm/, /arm_r/]);
      const leftLowerArm = findBoneByNamePattern(scene, [/left.*lowerarm/, /lowerarm.*left/, /left.*forearm/, /forearm.*left/, /mixamorigleftforearm/, /l_forearm/, /forearm_l/]);
      const rightLowerArm = findBoneByNamePattern(scene, [/right.*lowerarm/, /lowerarm.*right/, /right.*forearm/, /forearm.*right/, /mixamorigrightforearm/, /r_forearm/, /forearm_r/]);
      const spine = findBoneByNamePattern(scene, [/spine(\d+)?$/, /hips?spine/, /chestspine/]);
      const neck = findBoneByNamePattern(scene, [/neck/, /headneck/]);

      if (leftUpperArm && genericPose.leftUpperArm) {
        leftUpperArm.rotation.x = genericPose.leftUpperArm.x;
        leftUpperArm.rotation.z = genericPose.leftUpperArm.z;
      }
      if (rightUpperArm && genericPose.rightUpperArm) {
        rightUpperArm.rotation.x = genericPose.rightUpperArm.x;
        rightUpperArm.rotation.z = genericPose.rightUpperArm.z;
      }
      if (leftLowerArm && genericPose.leftLowerArm) {
        leftLowerArm.rotation.z = genericPose.leftLowerArm.z;
      }
      if (rightLowerArm && genericPose.rightLowerArm) {
        rightLowerArm.rotation.z = genericPose.rightLowerArm.z;
      }
      if (spine && genericPose.spine) {
        spine.rotation.x = genericPose.spine.x;
      }
      if (neck && genericPose.neck) {
        neck.rotation.x = genericPose.neck.x;
      }

      genericPoseRestoreRef.current = null;
      genericIdlePoseAppliedRef.current = false;
      genericIdleBonesRef.current = null;
    }
  }, [hasMotionClip, scene, vrmInstance]);

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
                transparent: !!m.transparent,
                opacity: typeof m.opacity === 'number' ? m.opacity : 1,
              });
              if (Array.isArray(child.material)) child.material[i] = safe; else child.material = safe;
            } else {
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

    // Final safety: keep the model inside the configured top safe area, not just inside the raw viewport.
    box = new THREE.Box3().setFromObject(scene);
    box.getSize(size);
    const topY = scene.position.y + size.y / 2;
    const visibleHalfH2 = Math.tan(fov / 2) * Math.max(0.0001, camera.position.z);
    const safeTopY = visibleHalfH2 - headMargin;
    if (topY > safeTopY) {
      scene.position.y -= (topY - safeTopY);
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
      const insetWorldFit = (viewportSize?.height ? (bottomInsetPx / viewportSize.height) * (visibleHalfH * 2) : 0);
      const availableH = (visibleHalfH * 2) - (bottomPadding + headMargin + insetWorldFit);
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
        if (yOffset) scene.position.y += yOffset;
        if (footLift) scene.position.y += footLift;
      }
      // Re-run top safety after scaling and foot alignment so head margin is preserved.
      box = new THREE.Box3().setFromObject(scene);
      box.getSize(size);
      const finalTopY = scene.position.y + size.y / 2;
      const finalVisibleHalfH = Math.tan(fov / 2) * Math.max(0.0001, camera.position.z);
      const finalSafeTopY = finalVisibleHalfH - headMargin;
      if (finalTopY > finalSafeTopY) {
        scene.position.y -= (finalTopY - finalSafeTopY);
      }
    }
  }, [scene, camera, height, weight, xOffset, yOffset, zOffset, sizeMultiplier, scaleBoost, alignFootToBottom, bottomPadding, autoFit, headMargin, bottomInsetPx, focus, fitMode, targetFill, footLift]);

  useFrame((_, delta) => {
    const effectiveAnimationSpeed = Math.max(0.35, Number(animationSpeed) || 1);
    idleTimeRef.current += delta * effectiveAnimationSpeed;
    blinkCycleRef.current += delta;

    try { lookAtManagerRef.current?.update?.(); } catch (_) {}

    if (!hasMotionClip && vrmInstance?.humanoid && idleBonesRef.current) {
      try {
        const t = idleTimeRef.current;
        const base = idleBonesRef.current;
        if (base.leftUpperArm) base.leftUpperArm.rotation.z = base.leftUpperArmZ + Math.sin(t * 0.85) * 0.02;
        if (base.rightUpperArm) base.rightUpperArm.rotation.z = base.rightUpperArmZ - Math.sin(t * 0.85) * 0.02;
        if (base.spine) base.spine.rotation.x = base.spineX + Math.sin(t * 1.6) * 0.008;
        if (base.chest) base.chest.rotation.x = base.chestX + Math.sin(t * 1.35) * 0.01;
        if (base.chest) base.chest.rotation.y = base.chestY + Math.sin(t * 1.2) * 0.009;
        if (base.neck) base.neck.rotation.y = base.neckY + Math.sin(t * 1.1) * 0.012;
      } catch (_) {}
    }

    if (!hasMotionClip && !vrmInstance && genericIdleBonesRef.current) {
      try {
        const t = idleTimeRef.current;
        const base = genericIdleBonesRef.current;
        if (base.leftUpperArm) base.leftUpperArm.rotation.z = base.leftUpperArmZ + Math.sin(t * 0.8) * 0.018;
        if (base.rightUpperArm) base.rightUpperArm.rotation.z = base.rightUpperArmZ - Math.sin(t * 0.8) * 0.018;
        if (base.spine) base.spine.rotation.x = base.spineX + Math.sin(t * 1.4) * 0.006;
        if (base.chest) base.chest.rotation.x = base.chestX + Math.sin(t * 1.2) * 0.008;
        if (base.chest) base.chest.rotation.y = base.chestY + Math.sin(t * 1.1) * 0.008;
        if (base.neck) base.neck.rotation.y = base.neckY + Math.sin(t * 1.0) * 0.01;
      } catch (_) {}
    }

    if (vrmInstance?.expressionManager) {
      try {
        const cycle = blinkCycleRef.current % 4.0;
        let blink = 0;
        if (cycle < 0.08) {
          blink = Math.sin((cycle / 0.08) * Math.PI);
        }
        vrmInstance.expressionManager.setValue('blink', blink);
      } catch (_) {}
    }

    if (vrmInstance?.expressionManager) {
      try {
        const mgr = vrmInstance.expressionManager;
        const micTalkLevel = visemeActive ? THREE.MathUtils.clamp(visemeLevel, 0, 1) : 0;
        const shouldDriveTalkViseme = micTalkLevel > 0 || (!explicitExpressionName && selectedAnimation.key === 'talk');
        const talkCycle = micTalkLevel > 0 ? micTalkLevel : (Math.sin(idleTimeRef.current * 10.5) + 1) / 2;
        const aa = shouldDriveTalkViseme ? (0.12 + (talkCycle * 0.42)) : 0;
        const ee = micTalkLevel > 0 ? (0.04 + (micTalkLevel * 0.12)) : 0;
        const oh = shouldDriveTalkViseme ? (0.04 + ((1 - talkCycle) * 0.18)) : 0;
        mgr.setValue('aa', aa);
        mgr.setValue('ee', ee);
        mgr.setValue('oh', oh);
      } catch (_) {}
    }

    if (vrmInstance?.update) {
      try { vrmInstance.update(delta); } catch (_) {}
    }
    if (mixerRef.current && playAnimation) {
      try { mixerRef.current.update(delta * effectiveAnimationSpeed); } catch (_) {}
    }
  });

  useEffect(() => {
    const targetRoot = vrmInstance?.scene || scene;
    if (!targetRoot) return;

    if (!playAnimation) {
      try { mixerRef.current?.stopAllAction(); } catch (_) {}
      currentActionRef.current = null;
      return;
    }

    const clip = playableResolvedClip || playableEmbeddedClip || null;
    if (!clip) {
      try { mixerRef.current?.stopAllAction(); } catch (_) {}
      currentActionRef.current = null;
      return;
    }

    try {
      const mixer = mixerRef.current || new THREE.AnimationMixer(targetRoot);
      mixerRef.current = mixer;
      const nextAction = mixer.clipAction(clip);
      const previousAction = currentActionRef.current;
      const resolvedRepeatCount = Math.max(1, Number(animationRepeatCount) || 1);
      const completionKey = `${selectedAnimation.id || selectedAnimation.key || animationType}:${animationReplayNonce}`;

      actionCompleteHandledRef.current = null;

      const handleFinished = (event) => {
        if (event?.action !== nextAction) return;
        if (actionCompleteHandledRef.current === completionKey) return;
        actionCompleteHandledRef.current = completionKey;
        try {
          onAnimationComplete?.({
            animationType,
            replayNonce: animationReplayNonce,
            repeatCount: resolvedRepeatCount,
          });
        } catch (_) {}
      };

      mixer.removeEventListener('finished', handleFinished);
      mixer.addEventListener('finished', handleFinished);

      if (previousAction && previousAction !== nextAction) {
        try { previousAction.fadeOut(0.15); } catch (_) {}
      }

      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveTimeScale(Math.max(0.35, Number(animationSpeed) || 1));
      nextAction.setEffectiveWeight(1);
      nextAction.repetitions = resolvedRepeatCount;
      nextAction.setLoop(selectedAnimation.loop ? THREE.LoopRepeat : THREE.LoopOnce, selectedAnimation.loop ? Infinity : resolvedRepeatCount);
      nextAction.clampWhenFinished = !selectedAnimation.loop;
      if (!selectedAnimation.loop && resolvedRepeatCount > 1) {
        nextAction.repetitions = resolvedRepeatCount;
      }
      try { nextAction.fadeIn(0.15); } catch (_) {}
      nextAction.play();
      currentActionRef.current = nextAction;

      return () => {
        try { mixer.removeEventListener('finished', handleFinished); } catch (_) {}
      };
    } catch (animationError) {
      console.warn('[AvatarWeb] Failed to play animation clip:', animationError);
    }
  }, [scene, vrmInstance, animationReplayNonce, animationRepeatCount, animationSpeed, animationType, onAnimationComplete, playAnimation, playableEmbeddedClip, playableResolvedClip, selectedAnimation.asset, selectedAnimation.id, selectedAnimation.key, selectedAnimation.loop]);

  useEffect(() => () => {
    clearIdleSchedule();
    try { mixerRef.current?.stopAllAction(); } catch (_) {}
    currentActionRef.current = null;
  }, [clearIdleSchedule]);

  useEffect(() => {
    if (!vrmInstance) return;
    const nextExpressionName = expressionName || derivedExpression?.name;
    if (!nextExpressionName) return;
    const mgr = vrmInstance.expressionManager;
    if (!mgr) return;
    try {
      resetExpressionValues(mgr, [nextExpressionName]);
      const v = typeof expressionName === 'string'
        ? (typeof expressionValue === 'number' ? expressionValue : 1)
        : (typeof derivedExpression?.value === 'number' ? derivedExpression.value : 1);
      mgr.setValue(nextExpressionName, v);
      mgr.update(0);
    } catch (_) {}
    return () => {
      try {
        resetExpressionValues(mgr);
        mgr.update(0);
      } catch (_) {}
    };
  }, [vrmInstance, expressionName, expressionValue, derivedExpression]);

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

const AvatarWeb = forwardRef((props, ref) => {
  const {
    gender = 'male',
    animationType = 'idle',
    animationReplayNonce = 0,
    animationRepeatCount = 1,
    height,
    weight,
    sizeMultiplier = 1,
    scaleBoost = 1,
    animationSpeed = 1,
    xOffset = 0.125,
    yOffset = 0,
    zOffset = 0,
    playAnimation = true,
    modelUrl: providedModelUrl,
    alignFootToBottom = false,
    bottomPadding = 0.06,
    autoFit = true,
    headMargin = 0.08,
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
      { label: 'Neutral', value: 'neutral', emoji: '😐' },
      { label: 'Smile', value: 'happy', emoji: '🙂' },
      { label: 'Happy', value: 'happy', emoji: '😄' },
      { label: 'Angry', value: 'angry', emoji: '😠' },
      { label: 'Surprised', value: 'surprised', emoji: '😮' },
      { label: 'Sad', value: 'sad', emoji: '😢' },
      { label: 'Closed', value: 'blink', emoji: '😴' },
      { label: 'A', value: 'aa', emoji: '🅰️' },
      { label: 'I', value: 'ih', emoji: 'ℹ️' },
      { label: 'U', value: 'ou', emoji: '🔄' },
      { label: 'E', value: 'ee', emoji: '📧' },
      { label: 'O', value: 'oh', emoji: '⭕' },
    ],
    targetY = 0.9,
    bottomInsetPx = 0,
    focus = 'chest',
    fitMode = 'shrink',
    targetFill = 0.94,
    footLift = 0,
    preserveTPose = false,
    onAnimationComplete,
    onVrmLoad,
    onManagersReady,
    expressionName,
    expressionValue,
  } = props;
  // Prefer local VRM samples when no explicit model is provided.
  let defaultUrl;
  try {
    defaultUrl = getLocalAvatarModelModule(getDefaultAvatarModelId(gender));
  } catch (_e) {
    defaultUrl = null;
  }
  const resolvedProvidedModelUrl = typeof providedModelUrl === 'string'
    ? (getLocalAvatarModelModule(providedModelUrl) || providedModelUrl)
    : providedModelUrl;
  const modelUrl = resolvedProvidedModelUrl || defaultUrl;

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
  const [micLipSyncActive, setMicLipSyncActive] = useState(false);
  const [micVisemeLevel, setMicVisemeLevel] = useState(0);
  const [speechLipSyncActive, setSpeechLipSyncActive] = useState(false);
  const [speechVisemeLevel, setSpeechVisemeLevel] = useState(0);
  const [speechAnimating, setSpeechAnimating] = useState(false);
  const effectiveExpressionName = expressionName ?? expressionNameLocal;
  const effectiveExpressionValue = expressionValue ?? expressionValueLocal;
  const combinedVisemeLevel = Math.max(micVisemeLevel, speechVisemeLevel);
  const combinedVisemeActive = micLipSyncActive || speechLipSyncActive;
  const effectiveAnimationType = speechAnimating ? 'talk' : animationType;
  const canvasIdRef = useRef(`avatar-canvas-${Math.random().toString(36).slice(2)}`);
  const micStreamRef = useRef(null);
  const micLevelFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const analyserDataRef = useRef(null);
  const speechUtteranceRef = useRef(null);
  const speechVisemeRafRef = useRef(null);
  const speechPulseTimersRef = useRef([]);
  const speechVisemeTargetRef = useRef(0);

  const clearSpeechPulseTimers = useCallback(() => {
    speechPulseTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    speechPulseTimersRef.current = [];
  }, []);

  const stopSpeechLipSync = useCallback((resetAnimation = true) => {
    if (speechVisemeRafRef.current) {
      cancelAnimationFrame(speechVisemeRafRef.current);
      speechVisemeRafRef.current = null;
    }

    clearSpeechPulseTimers();
    speechVisemeTargetRef.current = 0;
    speechUtteranceRef.current = null;
    setSpeechLipSyncActive(false);
    setSpeechVisemeLevel(0);
    if (resetAnimation) {
      setSpeechAnimating(false);
    }
  }, [clearSpeechPulseTimers]);

  const pulseSpeechViseme = useCallback((token, durationMs = 120) => {
    const normalizedToken = String(token || '').toLowerCase();
    if (!normalizedToken) return;

    let target = 0.32;
    if (/[ae]/.test(normalizedToken)) target = 0.78;
    else if (/[ou]/.test(normalizedToken)) target = 0.62;
    else if (/[i]/.test(normalizedToken)) target = 0.48;

    speechVisemeTargetRef.current = Math.max(speechVisemeTargetRef.current, target);

    const timerId = setTimeout(() => {
      speechVisemeTargetRef.current = Math.min(speechVisemeTargetRef.current, 0.08);
    }, Math.max(80, durationMs));
    speechPulseTimersRef.current.push(timerId);
  }, []);

  const startSpeechVisemeLoop = useCallback(() => {
    if (speechVisemeRafRef.current) {
      cancelAnimationFrame(speechVisemeRafRef.current);
      speechVisemeRafRef.current = null;
    }

    const tick = () => {
      setSpeechVisemeLevel((current) => {
        const targetLevel = speechVisemeTargetRef.current;
        const nextLevel = current + ((targetLevel - current) * 0.34);
        return Math.max(0, Math.min(1, nextLevel < 0.01 ? 0 : nextLevel));
      });
      speechVisemeTargetRef.current *= 0.88;
      speechVisemeRafRef.current = requestAnimationFrame(tick);
    };

    speechVisemeRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopMicLipSync = useCallback(async () => {
    if (micLevelFrameRef.current) {
      cancelAnimationFrame(micLevelFrameRef.current);
      micLevelFrameRef.current = null;
    }

    const stream = micStreamRef.current;
    micStreamRef.current = null;
    if (stream?.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (_) {}
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    analyserDataRef.current = null;
    setMicLipSyncActive(false);
    setMicVisemeLevel(0);
  }, []);

  const startMicLipSync = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    if (micStreamRef.current) {
      setMicLipSyncActive(true);
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioContextCtor = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : null;

      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.72;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        analyserDataRef.current = new Uint8Array(analyser.fftSize);

        const updateMicLevel = () => {
          const currentAnalyser = analyserRef.current;
          const data = analyserDataRef.current;
          if (!currentAnalyser || !data) return;

          currentAnalyser.getByteTimeDomainData(data);
          let sumSquares = 0;
          for (let index = 0; index < data.length; index += 1) {
            const sample = (data[index] - 128) / 128;
            sumSquares += sample * sample;
          }

          const rms = Math.sqrt(sumSquares / data.length);
          const normalizedLevel = THREE.MathUtils.clamp((rms - 0.015) * 8, 0, 1);
          setMicVisemeLevel(normalizedLevel);
          micLevelFrameRef.current = requestAnimationFrame(updateMicLevel);
        };

        micLevelFrameRef.current = requestAnimationFrame(updateMicLevel);
      }

      setMicLipSyncActive(true);
      return true;
    } catch (error) {
      console.warn('[AvatarWeb] Unable to start microphone lip sync:', error);
      await stopMicLipSync();
      return false;
    }
  }, [stopMicLipSync]);

  const speak = useCallback(async (text, options = {}) => {
    const speechText = String(text || '').trim();
    if (!speechText) return false;
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;

    const preserveAnimation = Boolean(options.preserveAnimation);
    const onStart = typeof options.onStart === 'function' ? options.onStart : null;
    const onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;

    try {
      window.speechSynthesis.cancel();
      stopSpeechLipSync(false);

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.rate = 0.98;
      utterance.pitch = 1.02;
      utterance.lang = 'en-US';

      const availableVoices = window.speechSynthesis.getVoices?.() || [];
      if (availableVoices.length > 0) {
        const preferredVoice = availableVoices.find((voice) => /en-US|en_US/i.test(voice.lang || '')) || availableVoices[0];
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      let boundarySeen = false;

      utterance.onstart = () => {
        speechUtteranceRef.current = utterance;
        setSpeechLipSyncActive(true);
        if (!preserveAnimation) {
          setSpeechAnimating(true);
        }
        startSpeechVisemeLoop();
        speechVisemeTargetRef.current = 0.18;
        onStart?.();
      };

      utterance.onboundary = (event) => {
        boundarySeen = true;
        if (typeof event.charIndex !== 'number') return;
        const start = Math.max(0, event.charIndex - 8);
        const end = Math.min(speechText.length, event.charIndex + 8);
        const chunk = speechText.slice(start, end);
        const match = chunk.match(/[A-Za-z']+/);
        pulseSpeechViseme(match ? match[0] : chunk, 95 + Math.round(Math.random() * 70));
      };

      speechText.split(/\s+/).filter(Boolean).forEach((token, index) => {
        const timerId = setTimeout(() => {
          if (!boundarySeen) {
            pulseSpeechViseme(token, 110 + Math.round(Math.random() * 60));
          }
        }, index * 130);
        speechPulseTimersRef.current.push(timerId);
      });

      const finishSpeech = () => {
        stopSpeechLipSync(true);
        onEnd?.();
      };

      utterance.onend = finishSpeech;
      utterance.onerror = finishSpeech;

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      stopSpeechLipSync(true);
      console.warn('[AvatarWeb] Browser TTS failed:', error);
      onEnd?.();
      return false;
    }
  }, [pulseSpeechViseme, startSpeechVisemeLoop, stopSpeechLipSync]);

  useImperativeHandle(ref, () => ({
    speak,
    startMicLipSync,
    stopMicLipSync,
  }), [speak, startMicLipSync, stopMicLipSync]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    stopSpeechLipSync(true);
    stopMicLipSync();
  }, [stopMicLipSync, stopSpeechLipSync]);

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
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', overflow: 'visible' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
    <Canvas
      id={canvasIdRef.current}
      camera={{ position: [0, 1.2, 2.6], fov: 45, near: 0.01, far: 100 }}
      style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', boxShadow: 'none' }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        try {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.physicallyCorrectLights = true;
          if (gl.domElement?.style) {
            gl.domElement.style.background = 'transparent';
            gl.domElement.style.border = 'none';
            gl.domElement.style.outline = 'none';
            gl.domElement.style.boxShadow = 'none';
          }
        } catch (_) {}
      }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight intensity={0.65} position={[3, 5, 5]} />
  <Model
    url={modelUrl}
    gender={gender}
    animationType={effectiveAnimationType}
    height={height}
    weight={weight}
    sizeMultiplier={sizeMultiplier}
    scaleBoost={scaleBoost}
    animationSpeed={animationSpeed}
    xOffset={xOffset}
    yOffset={yOffset}
    zOffset={zOffset}
    playAnimation={playAnimation}
    animationReplayNonce={animationReplayNonce}
    animationRepeatCount={animationRepeatCount}
    onAnimationComplete={onAnimationComplete}
    alignFootToBottom={alignFootToBottom}
    bottomPadding={bottomPadding}
    autoFit={autoFit}
    headMargin={headMargin}
    bottomInsetPx={bottomInsetPx}
    focus={focus}
    fitMode={fitMode}
    targetFill={targetFill}
    footLift={footLift}
    preserveTPose={preserveTPose}
    expressionName={effectiveExpressionName}
    expressionValue={effectiveExpressionValue}
    visemeLevel={combinedVisemeLevel}
    visemeActive={combinedVisemeActive}
    onVrmLoad={onVrmLoad}
    onManagersReady={onManagersReady}
    canvasId={canvasIdRef.current}
    onUpdateTargetY={(y)=>{ try { target.current.set(0, y, 0); } catch(_){} }}
  />
  <Controls interactive={interactive} targetRef={target} sphericalRef={spherical} targetSphericalRef={targetSpherical} targetY={targetY} minDistance={minDistance} maxDistance={maxDistance} />
    </Canvas>
    {showExpressionButtons && (
      <div style={{ position: 'absolute', left: 8, top: 8, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'auto', overflow: 'visible' }}>
        {expressionButtons.map((item) => {
          const label = typeof item === 'string' ? item : item.label;
          const name = typeof item === 'string' ? item : item.value || item.label;
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
            <span>{emoji ? '' : label}</span>
          </button>
          );
        })}
      </div>
    )}
    </div>
  );
});

AvatarWeb.displayName = 'AvatarWeb';

export default AvatarWeb;
