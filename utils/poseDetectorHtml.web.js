import { buildPoseDetectorHtml } from './poseDetectorHtml.js';

export const POSE_DETECTOR_HTML = buildPoseDetectorHtml({
  visionBundleUrl: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.17/vision_bundle.mjs',
  visionWasmRoot: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.17/wasm',
});