/**
 * AvatarWebView.js
 * Renders a VRM avatar inside an Android WebView using Three.js + @pixiv/three-vrm loaded from CDN.
 * This is used in place of the expo-gl / Three.js native path on Android, where
 * URL.createObjectURL returns undefined and embedded VRM textures can't be decoded.
 */
import { Asset } from 'expo-asset';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { isIdleAnimationType, resolveAvatarAnimationConfig } from '../utils/avatarAnimationConfig';
import { getDefaultAvatarModelId, getLocalAvatarModelModule } from '../utils/avatarModels';

// ---------------------------------------------------------------------------
// HTML injected into the WebView
// Three.js + GLTFLoader + @pixiv/three-vrm loaded from unpkg CDN.
// The page exposes:
//   window.loadModel(uri)         – load a VRM file
//   window.playAnimation(name)    – play a named animation
// It posts messages back:
//   { type: 'bridge-ready' }
//   { type: 'model-ready' }
//   { type: 'animation-complete', payload: { name } }
//   { type: 'error', payload: string }
// ---------------------------------------------------------------------------
const AVATAR_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:transparent; overflow:hidden; }
    canvas { display:block; width:100%!important; height:100%!important; }
    #status { position:fixed; top:4px; left:4px; color:#fff; font:13px sans-serif;
              background:rgba(200,0,0,0.85); padding:4px 8px; border-radius:3px;
              pointer-events:none; z-index:99; }
  </style>
</head>
<body>
<div id="status">loading...</div>
<script>
  window.__rnSend = function(type, payload) {
    var bridge = window.ReactNativeWebView;
    if (!bridge || !bridge.postMessage) return;
    try { bridge.postMessage(JSON.stringify({ type: type, payload: payload || null })); } catch(e) {}
  };
  window.__setStatus = function(msg) {
    var el = document.getElementById('status');
    if (el) el.textContent = msg;
    window.__rnSend('status', msg);
  };
  window.onerror = function(msg, src, line) {
    window.__setStatus('JS error: ' + msg);
    window.__rnSend('error', msg + ' line:' + line);
  };
  window.addEventListener('unhandledrejection', function(ev) {
    var msg = (ev.reason && (ev.reason.message || String(ev.reason))) || 'rejection';
    window.__setStatus('promise error: ' + msg);
    window.__rnSend('error', 'promise: ' + msg);
  });

  // ---------------------------------------------------------------------------
  // Android WebView: fetch() cannot load file:// URIs.
  // Patch window.fetch so that three.js loaders (FBXLoader, GLTFLoader) use
  // XMLHttpRequest for file:// paths — XHR works with allowFileAccess flags.
  // ---------------------------------------------------------------------------
  (function() {
    var _origFetch = window.fetch;
    window.fetch = function(input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      if (url.startsWith('file://')) {
        return new Promise(function(resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.responseType = 'arraybuffer';
          xhr.onload = function() {
            var buf = xhr.response;
            resolve({
              ok: true, status: 200, url: url,
              arrayBuffer: function() { return Promise.resolve(buf); },
              text: function() { return Promise.resolve(new TextDecoder().decode(buf)); },
              json: function() { return Promise.resolve(JSON.parse(new TextDecoder().decode(buf))); },
              blob: function() { return Promise.resolve(new Blob([buf])); },
              headers: { get: function() { return null; } },
            });
          };
          xhr.onerror = function() { reject(new Error('XHR failed: ' + url)); };
          xhr.send();
        });
      }
      return _origFetch.apply(window, arguments);
    };
  })();
</script>
<script type="module">
(async function() {
  try {
    // esm.sh resolves bare specifiers and sets Access-Control-Allow-Origin: *
    window.__setStatus('loading three.js...');
    const THREE = await import('https://esm.sh/three@0.160.0');

    window.__setStatus('loading GLTFLoader...');
    const { GLTFLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader?deps=three@0.160.0');

    window.__setStatus('loading three-vrm...');
    const { VRMLoaderPlugin, VRMUtils } = await import('https://esm.sh/@pixiv/three-vrm@2.1.0?deps=three@0.160.0');

    window.__setStatus('init renderer...');

    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);

    // ---- Scene ----
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 100);
    camera.position.set(0, 1.4, 2.2);
    camera.lookAt(0, 1.35, 0);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(3, 10, 5);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    // ---- Orbit / zoom controls ----
    const orbit = { r: 2.2, theta: 0, phi: Math.PI / 2, targetR: 2.2, targetTheta: 0, targetPhi: Math.PI / 2, focusY: 1.35 };
    const MIN_R = 0.8, MAX_R = 5.0;
    function updateCameraFromOrbit() {
      const sinPhi = Math.sin(orbit.phi);
      camera.position.x = orbit.r * sinPhi * Math.sin(orbit.theta);
      camera.position.y = orbit.focusY + orbit.r * Math.cos(orbit.phi);
      camera.position.z = orbit.r * sinPhi * Math.cos(orbit.theta);
      camera.lookAt(0, orbit.focusY, 0);
    }
    let touch1 = null, touch2 = null, lastPinchDist = 0;
    renderer.domElement.addEventListener('touchstart', function(e) {
      e.preventDefault();
      if (e.touches.length === 1) {
        touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY }; touch2 = null;
      } else if (e.touches.length >= 2) {
        touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
        const dx = touch2.x - touch1.x, dy = touch2.y - touch1.y;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: false });
    renderer.domElement.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (e.touches.length === 1 && touch1) {
        const dx = e.touches[0].clientX - touch1.x;
        const dy = e.touches[0].clientY - touch1.y;
        orbit.targetTheta -= dx * 0.008;
        orbit.targetPhi = Math.max(0.15, Math.min(Math.PI - 0.15, orbit.targetPhi + dy * 0.006));
        touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length >= 2 && touch1 && touch2) {
        const t0 = e.touches[0], t1 = e.touches[1];
        const dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        orbit.targetR = Math.max(MIN_R, Math.min(MAX_R, orbit.targetR + (lastPinchDist - dist) * 0.005));
        lastPinchDist = dist;
        touch1 = { x: t0.clientX, y: t0.clientY };
        touch2 = { x: t1.clientX, y: t1.clientY };
      }
    }, { passive: false });
    renderer.domElement.addEventListener('touchend', function(e) {
      if (e.touches.length === 0) { touch1 = null; touch2 = null; }
      else if (e.touches.length === 1) { touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY }; touch2 = null; }
    }, { passive: false });

    // ---- VRM state ----
    let currentVRM  = null;
    let idleBase    = null;   // captured after applying natural pose
    let mixer       = null;   // THREE.AnimationMixer for clip-based animations
    let currentAction = null; // active AnimationAction
    let clipMode    = false;  // true = clip playing, skip procedural
    const clipCache = {};     // uri → retargeted AnimationClip
    const clock = new THREE.Clock();
    const anim  = { name: 'idle', t: 0 };

    // v2.x API: getNormalizedBoneNode(camelCaseName)
    function getBone(name) {
      if (!currentVRM || !currentVRM.humanoid) return null;
      try { return currentVRM.humanoid.getNormalizedBoneNode(name); } catch(e) { return null; }
    }

    // ---- Mixamo → VRM bone name map ----
    const VRM_RIG = {
      mixamorigHips:'hips', mixamorigSpine:'spine', mixamorigSpine1:'chest',
      mixamorigSpine2:'upperChest', mixamorigNeck:'neck', mixamorigHead:'head',
      mixamorigLeftShoulder:'leftShoulder', mixamorigLeftArm:'leftUpperArm',
      mixamorigLeftForeArm:'leftLowerArm', mixamorigLeftHand:'leftHand',
      mixamorigRightShoulder:'rightShoulder', mixamorigRightArm:'rightUpperArm',
      mixamorigRightForeArm:'rightLowerArm', mixamorigRightHand:'rightHand',
      mixamorigLeftUpLeg:'leftUpperLeg', mixamorigLeftLeg:'leftLowerLeg',
      mixamorigLeftFoot:'leftFoot', mixamorigLeftToeBase:'leftToes',
      mixamorigRightUpLeg:'rightUpperLeg', mixamorigRightLeg:'rightLowerLeg',
      mixamorigRightFoot:'rightFoot', mixamorigRightToeBase:'rightToes',
    };

    // Retarget a Mixamo FBX/GLB animation clip to the loaded VRM
    function retargetMixamo(animations, sourceModel, vrm) {
      const clip = THREE.AnimationClip.findByName(animations, 'mixamo.com');
      if (!clip) return null;
      const mHips = sourceModel.getObjectByName('mixamorigHips');
      if (!mHips) return null;
      const vHipsNode = vrm.humanoid?.getNormalizedBoneNode('hips');
      if (!vHipsNode) return null;
      const v3 = new THREE.Vector3();
      const vrmHipsHeight = Math.abs(vHipsNode.getWorldPosition(v3).y - vrm.scene.getWorldPosition(v3).y);
      const hipsScale = mHips.position.y > 0 ? vrmHipsHeight / mHips.position.y : 1;
      const isVRM0 = vrm.meta?.metaVersion === '0';
      const rInv = new THREE.Quaternion();
      const pRot = new THREE.Quaternion();
      const qA   = new THREE.Quaternion();
      const tracks = [];
      clip.tracks.forEach((orig) => {
        const t = orig.clone();
        const dot = t.name.indexOf('.');
        if (dot < 0) return;
        const rig  = t.name.slice(0, dot);
        const prop = t.name.slice(dot + 1);
        const vrmBone = VRM_RIG[rig];
        if (!vrmBone) return;
        const boneNode = vrm.humanoid?.getNormalizedBoneNode(vrmBone);
        if (!boneNode) return;
        const nodeName = boneNode.name || vrmBone;
        const rigNode  = sourceModel.getObjectByName(rig);
        if (!rigNode) return;
        rigNode.getWorldQuaternion(rInv).invert();
        rigNode.parent.getWorldQuaternion(pRot);
        if (t instanceof THREE.QuaternionKeyframeTrack) {
          for (let i = 0; i < t.values.length; i += 4) {
            qA.fromArray(t.values, i).premultiply(pRot).multiply(rInv).toArray(t.values, i);
          }
          tracks.push(new THREE.QuaternionKeyframeTrack(
            nodeName + '.' + prop, t.times,
            t.values.map((v, i) => isVRM0 && i % 2 === 0 ? -v : v)
          ));
        } else if (t instanceof THREE.VectorKeyframeTrack) {
          tracks.push(new THREE.VectorKeyframeTrack(
            nodeName + '.' + prop, t.times,
            t.values.map((v, i) => (isVRM0 && i % 3 !== 1 ? -v : v) * hipsScale)
          ));
        }
      });
      return tracks.length ? new THREE.AnimationClip('vrmAnimation', clip.duration, tracks) : null;
    }

    // Lazy-load FBXLoader only when first needed
    let _FBXLoader = null;
    async function getFBXLoader() {
      if (!_FBXLoader) {
        const m = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader?deps=three@0.160.0');
        _FBXLoader = m.FBXLoader;
      }
      return _FBXLoader;
    }

    // ---- Procedural animations (bone names are VRM 1.0 camelCase) ----
    function poseIdle(t) {
      if (!idleBase) return;  // wait until natural pose is captured
      const b = idleBase;
      // Arms: restore both z (oscillating) and x (static natural value)
      if (b.lArm)  { b.lArm.rotation.z = b.lArmZ + Math.sin(t * 0.85) * 0.02; b.lArm.rotation.x = b.lArmX; }
      if (b.rArm)  { b.rArm.rotation.z = b.rArmZ - Math.sin(t * 0.85) * 0.02; b.rArm.rotation.x = b.rArmX; }
      if (b.spine) { b.spine.rotation.x = b.spineX + Math.sin(t * 1.6) * 0.008; b.spine.rotation.z = 0; }
      if (b.chest) {
        b.chest.rotation.x = b.chestX + Math.sin(t * 1.35) * 0.01;
        b.chest.rotation.y = b.chestY + Math.sin(t * 1.2)  * 0.009;
      }
      if (b.neck) b.neck.rotation.y = b.neckY + Math.sin(t * 1.1) * 0.012;
      // Reset hips to origin after happy/dance/squat
      if (b.hips) { b.hips.position.y = 0; b.hips.rotation.y = 0; b.hips.rotation.x = 0; }
    }

    function poseWave(t) {
      poseIdle(t);
      const rArm  = getBone('rightUpperArm'); if (rArm)  { rArm.rotation.z = -1.6; rArm.rotation.x = 0.3; }
      const rFore = getBone('rightLowerArm'); if (rFore) { rFore.rotation.z = -Math.abs(Math.sin(t*5))*0.6; }
    }

    function poseHappy(t) {
      const bounce = Math.abs(Math.sin(t * 3)) * 0.04;
      const hips = getBone('hips'); if (hips) hips.position.y = bounce;
      const lArm = getBone('leftUpperArm');  if (lArm) { lArm.rotation.z =  1.3; lArm.rotation.x = -0.2; }
      const rArm = getBone('rightUpperArm'); if (rArm) { rArm.rotation.z = -1.3; rArm.rotation.x = -0.2; }
    }

    function poseDance(t) {
      const lean = Math.sin(t * 2) * 0.1;
      const hips  = getBone('hips');  if (hips)  { hips.position.y = Math.abs(Math.sin(t*4)*0.05); hips.rotation.y = lean; }
      const spine = getBone('spine'); if (spine) { spine.rotation.z = lean * 0.5; }
      const lArm  = getBone('leftUpperArm');  if (lArm) { lArm.rotation.z =  0.9 + Math.sin(t*3)*0.4; }
      const rArm  = getBone('rightUpperArm'); if (rArm) { rArm.rotation.z = -0.9 - Math.sin(t*3+1)*0.4; }
    }

    function poseSurprised(t) {
      poseIdle(t);
      const head = getBone('head'); if (head) { head.rotation.x = -0.2; }
      const lArm = getBone('leftUpperArm');  if (lArm) { lArm.rotation.z =  0.8; }
      const rArm = getBone('rightUpperArm'); if (rArm) { rArm.rotation.z = -0.8; }
    }

    function posePushup(t) {
      const phase = (Math.sin(t * 1.5) + 1) / 2;
      const hips  = getBone('hips');         if (hips)  { hips.rotation.x = 0.3; }
      const spine = getBone('spine');        if (spine) { spine.rotation.x = -0.2 - phase*0.3; }
      const lArm  = getBone('leftUpperArm'); if (lArm)  { lArm.rotation.z =  1.2; lArm.rotation.x = 0.5; }
      const rArm  = getBone('rightUpperArm');if (rArm)  { rArm.rotation.z = -1.2; rArm.rotation.x = 0.5; }
      const lFore = getBone('leftLowerArm'); if (lFore) { lFore.rotation.x = -1.2 + phase*0.9; }
      const rFore = getBone('rightLowerArm');if (rFore) { rFore.rotation.x = -1.2 + phase*0.9; }
    }

    function poseSquat(t) {
      const phase = (Math.sin(t * 1.5) + 1) / 2;
      const hips  = getBone('hips');          if (hips)  { hips.position.y = -phase*0.25; }
      const spine = getBone('spine');         if (spine) { spine.rotation.x = 0.1 + phase*0.15; }
      const lLeg  = getBone('leftUpperLeg');  if (lLeg)  { lLeg.rotation.x  =  0.4 + phase*0.8; }
      const rLeg  = getBone('rightUpperLeg'); if (rLeg)  { rLeg.rotation.x  =  0.4 + phase*0.8; }
      const lKnee = getBone('leftLowerLeg');  if (lKnee) { lKnee.rotation.x = -(0.3 + phase*0.8); }
      const rKnee = getBone('rightLowerLeg'); if (rKnee) { rKnee.rotation.x = -(0.3 + phase*0.8); }
    }

    const POSE_MAP = {
      idle: poseIdle, procedural_idle: poseIdle,
      wave: poseWave,
      happy: poseHappy, laugh: poseHappy,
      dance: poseDance,
      surprised: poseSurprised,
      pushup: posePushup, idle_to_pushup: posePushup, pushup_to_idle: posePushup,
      squat: poseSquat, idle_to_squat: poseSquat,
    };

    const ANIM_DURATION = { wave: 3000, happy: 2500, laugh: 2500, surprised: 2000, dance: 5000 };

    // ---- Load model (VRM 1.0 via VRMLoaderPlugin) ----
    window.loadModel = function(uri) {
      window.__setStatus('loading model...');
      window.__rnSend('status', 'loading');
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      loader.load(
        uri,
        (gltf) => {
          const vrm = gltf.userData.vrm;
          if (!vrm) {
            window.__setStatus('error: no VRM data');
            window.__rnSend('error', 'gltf.userData.vrm is undefined');
            return;
          }
          if (currentVRM) {
            scene.remove(currentVRM.scene);
            VRMUtils.deepDispose(currentVRM.scene);
          }
          currentVRM = vrm;
          idleBase = null;     // reset
          clipMode = false;    // stop any previous clip
          if (currentAction) { try { currentAction.stop(); } catch(_){} currentAction = null; }
          if (mixer) { mixer.stopAllAction(); mixer = null; }
          anim.name = 'idle'; anim.t = 0;
          VRMUtils.rotateVRM0(vrm); // no-op for VRM 1.0, rotates VRM 0.0 to face camera
          scene.add(vrm.scene);

          // --- Apply natural pose (matching AvatarWeb.js) ---
          const lArm  = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
          const rArm  = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
          const lFore = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
          const rFore = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
          const spine = vrm.humanoid.getNormalizedBoneNode('spine');
          const chest = vrm.humanoid.getNormalizedBoneNode('chest');
          const neck  = vrm.humanoid.getNormalizedBoneNode('neck');

          if (lArm)  { lArm.rotation.z  -= 1.42; lArm.rotation.x  -= 0.3; }
          if (rArm)  { rArm.rotation.z  += 1.42; rArm.rotation.x  -= 0.3; }
          if (lFore) { lFore.rotation.z += 0.28; }
          if (rFore) { rFore.rotation.z -= 0.28; }
          if (spine) { spine.rotation.x += 0.03; }
          if (neck)  { neck.rotation.x  += 0.02; }

          // Capture baseline for idle oscillation
          const hips = vrm.humanoid.getNormalizedBoneNode('hips');
          idleBase = {
            lArm, rArm, spine, chest, neck, hips,
            lArmZ:  lArm  ? lArm.rotation.z  : 0,
            lArmX:  lArm  ? lArm.rotation.x  : 0,
            rArmZ:  rArm  ? rArm.rotation.z  : 0,
            rArmX:  rArm  ? rArm.rotation.x  : 0,
            spineX: spine ? spine.rotation.x : 0,
            chestX: chest ? chest.rotation.x : 0,
            chestY: chest ? chest.rotation.y : 0,
            neckY:  neck  ? neck.rotation.y  : 0,
          };

          // --- Auto-fit camera (matching AvatarWeb.js) ---
          try {
            const box = new THREE.Box3().setFromObject(vrm.scene);
            const size = new THREE.Vector3();
            box.getSize(size);
            if (size.y > 0.1) {
              const fovRad = (camera.fov * Math.PI) / 180;
              const halfFovTan = Math.tan(fovRad / 2);
              const aspect = Math.max(0.0001, window.innerWidth / window.innerHeight);
              const fitMargin = 0.80;
              const reqY = (size.y / 2) / halfFovTan * fitMargin;
              const reqX = (size.x / 2) / (halfFovTan * aspect) * fitMargin;
              camera.position.z = Math.max(reqY, reqX, 1.5);

              // Bottom-align: feet rest at bottomPadding above viewport bottom
              const bottomPadding = 0.06;
              const headMargin = 0.08;
              const visHalfH = halfFovTan * camera.position.z;
              const desiredBottomY = -visHalfH + bottomPadding;
              vrm.scene.position.y = desiredBottomY + size.y / 2;

              // Head safety margin
              const topY = vrm.scene.position.y + size.y / 2;
              const safeTop = visHalfH - headMargin;
              if (topY > safeTop) vrm.scene.position.y -= (topY - safeTop);

              // Look at ~62% of model height (eye level)
              const focusY = vrm.scene.position.y - size.y / 2 + Math.min(size.y * 0.62, size.y - 0.15);
              // Set camera Y to eye level so it looks straight ahead, not down
              camera.position.y = focusY;
              camera.lookAt(0, focusY, 0);
              camera.updateProjectionMatrix();
              // Sync orbit state with computed camera position
              orbit.focusY = focusY;
              const offX = camera.position.x, offY = camera.position.y - focusY, offZ = camera.position.z;
              const rLen = Math.sqrt(offX * offX + offY * offY + offZ * offZ);
              orbit.r = rLen; orbit.targetR = rLen;
              orbit.theta = Math.atan2(offX, offZ); orbit.targetTheta = orbit.theta;
              orbit.phi = Math.acos(Math.max(-1, Math.min(1, offY / Math.max(0.0001, rLen))));
              orbit.targetPhi = orbit.phi;
            }
          } catch (fitErr) {
            console.warn('autofit error', fitErr);
          }

          window.__setStatus('');
          window.__rnSend('model-ready', { ok: true });
        },
        undefined,
        (err) => {
          const msg = (err && (err.message || String(err))) || 'load error';
          window.__setStatus('load error: ' + msg);
          window.__rnSend('error', msg);
        }
      );
    };

    // ---- Load animation from file URI and play via AnimationMixer ----
    window.loadAnimation = async function(uri, format, loop) {
      if (!currentVRM) { window.__rnSend('error', 'loadAnimation: no VRM'); return; }
      try {
        // Stop any running clip first
        if (currentAction) { try { currentAction.stop(); } catch(_){} currentAction = null; }
        clipMode = false;

        let clip = clipCache[uri];
        if (!clip) {
          window.__setStatus('loading clip...');
          let source;
          if (format === 'fbx') {
            const FBXLoader = await getFBXLoader();
            source = await new Promise((res, rej) => new FBXLoader().load(uri, res, null, rej));
            clip = retargetMixamo(source.animations, source, currentVRM);
          } else {
            source = await new Promise((res, rej) => new GLTFLoader().load(uri, res, null, rej));
            const anims = source.animations || [];
            clip = retargetMixamo(anims, source.scene, currentVRM) || anims[0] || null;
          }
          window.__setStatus('');
          if (!clip) { window.__rnSend('error', 'loadAnimation: no clip in ' + uri); return; }
          clipCache[uri] = clip;
        }

        if (!mixer) mixer = new THREE.AnimationMixer(currentVRM.scene);
        const action = mixer.clipAction(clip);
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.clampWhenFinished = !loop;
        action.reset().play();
        currentAction = action;
        clipMode = true;

        if (!loop) {
          mixer.addEventListener('finished', function onDone(e) {
            if (e.action !== action) return;
            mixer.removeEventListener('finished', onDone);
            clipMode = false;
            currentAction = null;
            anim.name = 'idle'; anim.t = 0;
            window.__rnSend('animation-complete', { uri });
          });
        }
        window.__rnSend('animation-playing', { uri });
      } catch(e) {
        window.__setStatus('');
        clipMode = false;
        window.__rnSend('error', 'loadAnimation: ' + (e.message || String(e)));
      }
    };

    // ---- Play procedural animation (or stop clip and revert to idle) ----
    window.playAnimation = function(name) {
      // Stop any playing clip
      if (currentAction) { try { currentAction.stop(); } catch(_){} currentAction = null; }
      clipMode = false;
      anim.name = name || 'idle';
      anim.t    = 0;
      const dur = ANIM_DURATION[name];
      if (dur) {
        const captured = name;
        setTimeout(function() {
          if (anim.name === captured && !clipMode) {
            anim.name = 'idle'; anim.t = 0;
            window.__rnSend('animation-complete', { name: captured });
          }
        }, dur);
      }
    };

    // ---- Blink state ----
    let blinkCycle = 0;

    // ---- Viseme / mouth sync state (set from RN via injectJavaScript) ----
    let visemeAA = 0, visemeEE = 0, visemeOH = 0, visemeActive = false;
    window.setViseme = function(aa, ee, oh, active) {
      visemeAA = aa || 0;
      visemeEE = ee || 0;
      visemeOH = oh || 0;
      visemeActive = !!active;
    };

    // ---- Render loop ----
    function animate() {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (currentVRM) {
        if (clipMode && mixer) {
          mixer.update(dt);                            // clip drives bones
        } else {
          anim.t += dt;
          (POSE_MAP[anim.name] || poseIdle)(anim.t); // procedural drives bones
        }
        currentVRM.update(dt);

        // Eye blinking — blinks every ~4 s, 80 ms close-reopen (matches web)
        if (currentVRM.expressionManager) {
          blinkCycle = (blinkCycle + dt) % 4.0;
          const b = blinkCycle < 0.08 ? Math.sin((blinkCycle / 0.08) * Math.PI) : 0;
          try { currentVRM.expressionManager.setValue('blink', b); } catch (_) {}
        }

        // Mouth / viseme sync — driven by RN via window.setViseme()
        if (currentVRM.expressionManager && (visemeActive || visemeAA > 0.01 || visemeEE > 0.01 || visemeOH > 0.01)) {
          try {
            currentVRM.expressionManager.setValue('aa', Math.max(0, Math.min(1, visemeAA)));
            currentVRM.expressionManager.setValue('ee', Math.max(0, Math.min(1, visemeEE)));
            currentVRM.expressionManager.setValue('oh', Math.max(0, Math.min(1, visemeOH)));
          } catch (_) {}
        }
      }
      // Smooth orbit interpolation
      orbit.r += (orbit.targetR - orbit.r) * 0.15;
      orbit.theta += (orbit.targetTheta - orbit.theta) * 0.15;
      orbit.phi += (orbit.targetPhi - orbit.phi) * 0.15;
      updateCameraFromOrbit();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function() {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    window.__setStatus('ready');
    window.__rnSend('bridge-ready');

  } catch(e) {
    const msg = (e && (e.message || String(e))) || 'unknown error';
    window.__setStatus('error: ' + msg);
    window.__rnSend('error', msg);
    window.__rnSend('bridge-ready');
  }
})();
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------
const AvatarWebView = forwardRef(function AvatarWebView(
  {
    gender        = 'male',
    model,                        // model ID, e.g. 'AvatarSample_M.vrm'
    playAnimation = true,
    animationType = 'idle',
    animationReplayNonce = 0,
    onAnimationComplete,
    onVrmLoad,
    style,
  },
  ref
) {
  const webRef      = useRef(null);
  const [ready, setReady]           = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    console.log('[AvatarWebView] mounted, model:', model, 'gender:', gender);
  }, []);

  // Helper: resolve an animation type and inject the right call into the WebView
  const triggerAnimation = useCallback(async (type) => {
    if (!webRef.current || !modelLoaded) return;
    if (!type || isIdleAnimationType(type)) {
      webRef.current.injectJavaScript(`try { window.playAnimation('idle'); } catch(e){} true;`);
      return;
    }
    const config = resolveAvatarAnimationConfig(type, gender || 'neutral');
    // Use real asset file if available and not disabled
    if (config.asset && !config.disabled) {
      try {
        const asset = Asset.fromModule(config.asset);
        if (!asset.localUri) {
          // Expo dev-server URLs sometimes contain unencoded spaces in filenames
          // (e.g. "happy hand gesture.fbx"). Encode them before downloadAsync runs.
          if (asset.uri) asset.uri = asset.uri.replace(/ /g, '%20');
          await asset.downloadAsync();
        }
        const uri = asset.localUri || asset.uri;
        if (!uri || !webRef.current) return;
        webRef.current.injectJavaScript(
          `try { window.loadAnimation(${JSON.stringify(uri)}, ${JSON.stringify(config.format || 'fbx')}, ${config.loop ? 'true' : 'false'}); } catch(e){ window.__rnSend('error','inj:'+e.message); } true;`
        );
      } catch (err) {
        console.warn('[AvatarWebView] Asset resolve failed, falling back to procedural:', err);
        webRef.current?.injectJavaScript(`try { window.playAnimation(${JSON.stringify(type)}); } catch(e){} true;`);
      }
      return;
    }
    // Disabled or no asset — use procedural fallback
    webRef.current.injectJavaScript(`try { window.playAnimation(${JSON.stringify(type)}); } catch(e){} true;`);
  }, [modelLoaded, gender]);

  // Resolve the require() module for the model
  const modelModule = useMemo(() => {
    const id = model || getDefaultAvatarModelId(gender);
    return getLocalAvatarModelModule(id);
  }, [gender, model]);

  // Load the VRM into the WebView once the bridge is ready
  const triggerLoad = useCallback(async () => {
    if (!webRef.current || !modelModule) return;
    try {
      const asset = Asset.fromModule(modelModule);
      if (!asset.localUri && !asset.uri) {
        await asset.downloadAsync();
      }
      const uri = asset.localUri || asset.uri;
      if (!uri) return;
      webRef.current.injectJavaScript(
        `try { loadModel(${JSON.stringify(uri)}); } catch(e){} true;`
      );
    } catch (_) {}
  }, [modelModule]);

  useEffect(() => {
    if (ready) triggerLoad();
  }, [ready, triggerLoad]);

  // Forward animation changes to the WebView
  useEffect(() => {
    if (!ready || !modelLoaded) return;
    const type = playAnimation ? (animationType || 'idle') : 'idle';
    triggerAnimation(type);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, modelLoaded, animationType, animationReplayNonce, playAnimation]);

  // Expose imperative handle so InteractiveAvatar can trigger animations directly
  useImperativeHandle(ref, () => ({
    playAnimation: (name) => triggerAnimation(name),
    setViseme: (aa, ee, oh, active) => {
      if (!webRef.current) return;
      webRef.current.injectJavaScript(
        `try { window.setViseme(${+aa||0},${+ee||0},${+oh||0},${active?'true':'false'}); } catch(_){} true;`
      );
    },
  }));

  const onMessage = useCallback((ev) => {
    try {
      const data = JSON.parse(ev.nativeEvent.data || '{}');
      if (data.type === 'bridge-ready') {
        setReady(true);
      } else if (data.type === 'model-ready') {
        setModelLoaded(true);
        onVrmLoad?.();
      } else if (data.type === 'animation-complete') {
        onAnimationComplete?.(data.payload?.name || data.payload?.uri);
      } else if (data.type === 'animation-playing') {
        // clip started — no-op, just for debug
      } else if (data.type === 'error') {
        console.warn('[AvatarWebView] WebView error:', data.payload);
      } else if (data.type === 'status') {
        console.log('[AvatarWebView] status:', data.payload);
      }
    } catch (_) {}
  }, [onVrmLoad, onAnimationComplete]);

  // Fallback: if bridge-ready was never received (e.g. CDN slow), try loading on page-load-end
  const onLoadEnd = useCallback(() => {
    if (!ready) {
      setTimeout(() => {
        setReady((prev) => {
          if (!prev) triggerLoad();
          return prev;
        });
      }, 500);
    }
  }, [ready, triggerLoad]);

  return (
    <View style={[styles.wrapper, style]}>
      <WebView
        ref={webRef}
        source={{ html: AVATAR_HTML, baseUrl: 'file:///android_asset/' }}
        style={styles.webView}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
        onError={(e) => console.warn('[AvatarWebView] nav error:', e.nativeEvent)}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        // Transparent background so the avatar blends into the app
        backgroundColor="transparent"
        androidLayerType="hardware"
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        automaticallyAdjustContentInsets={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default AvatarWebView;
