import { POSE_EXERCISE_RUNTIME_CONFIG } from './poseExerciseConfig';

const CONFIG_JSON = JSON.stringify(POSE_EXERCISE_RUNTIME_CONFIG);
const DEFAULT_VISION_BUNDLE_URL = 'https://unpkg.com/@mediapipe/tasks-vision@0.10.17/vision_bundle.mjs';
const DEFAULT_VISION_WASM_ROOT = 'https://unpkg.com/@mediapipe/tasks-vision@0.10.17/wasm';
const DEFAULT_POSE_MODEL_ASSET_PATH = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

const DEFAULT_MIN_VISIBILITY = 0.35;
const DEFAULT_SMOOTHING_WINDOW = 10;
const DEFAULT_POSE_DETECTION_CONFIDENCE = 0.65;
const DEFAULT_POSE_PRESENCE_CONFIDENCE = 0.65;
const DEFAULT_POSE_TRACKING_CONFIDENCE = 0.7;
const DEFAULT_SEGMENTER_MODEL_ASSET_PATH = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

export const buildPoseDetectorHtml = ({
	visionBundleUrl = DEFAULT_VISION_BUNDLE_URL,
	visionWasmRoot = DEFAULT_VISION_WASM_ROOT,
	poseModelAssetPath = DEFAULT_POSE_MODEL_ASSET_PATH,
} = {}) => `<!doctype html>
<html>
<head>
	<meta charset='utf-8'/>
	<meta name='viewport' content='width=device-width,initial-scale=1'/>
	<style>
		html,body{margin:0;padding:0;height:100%;background:#000;color:#eee;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
		#wrap{position:relative;width:100%;height:100%;overflow:hidden}
		#video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
		#bgCanvas{position:absolute;inset:0;width:100%;height:100%;display:none;transform:scaleX(-1)}
		#overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transform:scaleX(-1)}
		#hud{display:none}
		#hud strong{color:#fff}
		#status{display:none}
		#help{display:none}
		#feedback{display:none}
		#bgBtn{position:absolute;bottom:20px;left:16px;z-index:20;display:flex;align-items:center;gap:7px;background:rgba(10,12,30,0.72);border:2px solid rgba(255,255,255,0.18);color:#e8f0ff;font-size:12px;font-weight:800;padding:9px 16px 9px 12px;border-radius:28px;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);letter-spacing:0.04em;box-shadow:0 4px 18px rgba(0,0,0,0.55),0 0 0 0 rgba(120,160,255,0);transition:background 0.18s,box-shadow 0.18s,border-color 0.18s;user-select:none;-webkit-user-select:none}
		#bgBtn:hover{background:rgba(30,40,90,0.85);box-shadow:0 4px 24px rgba(0,0,0,0.65),0 0 0 3px rgba(120,160,255,0.25)}
		#bgBtn.active{border-color:rgba(120,200,255,0.55);box-shadow:0 4px 22px rgba(0,0,0,0.55),0 0 12px rgba(80,180,255,0.35)}
		#bgBtnIcon{font-size:18px;line-height:1}
		#bgBtnLabel{line-height:1}
		#bgUploadBtn{display:none;position:absolute;bottom:20px;left:172px;z-index:20;background:rgba(10,12,30,0.72);border:2px solid rgba(255,255,255,0.18);color:#e8f0ff;font-size:18px;padding:9px 12px;border-radius:28px;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 4px 18px rgba(0,0,0,0.55);transition:background 0.18s}
		#bgUploadBtn:hover{background:rgba(30,40,90,0.85)}
		#bgGallery{display:none;position:absolute;bottom:72px;left:16px;z-index:30;background:rgba(10,12,30,0.92);border:1.5px solid rgba(255,255,255,0.18);border-radius:18px;padding:14px;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 8px 36px rgba(0,0,0,0.7);min-width:260px;max-width:92vw}
		#bgGallery h4{margin:0 0 10px;font-size:12px;font-weight:700;color:rgba(200,220,255,0.7);letter-spacing:0.08em;text-transform:uppercase}
		#bgGalleryGrid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
		.bg-thumb{width:72px;height:48px;border-radius:10px;object-fit:cover;cursor:pointer;border:2px solid transparent;transition:border-color 0.15s,transform 0.12s;flex-shrink:0}
		.bg-thumb:hover{border-color:rgba(100,180,255,0.8);transform:scale(1.06)}
		.bg-thumb.selected{border-color:#4db8ff}
		#bgGalleryEmpty{color:rgba(255,255,255,0.4);font-size:12px;margin-bottom:10px}
		#bgGalleryActions{display:flex;gap:8px}
		.bg-action-btn{flex:1;padding:8px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:#e8f0ff;font-size:12px;font-weight:700;cursor:pointer;transition:background 0.15s}
		.bg-action-btn:hover{background:rgba(255,255,255,0.16)}
		#bgGalleryClose{position:absolute;top:10px;right:12px;background:none;border:none;color:rgba(255,255,255,0.5);font-size:18px;cursor:pointer;padding:0;line-height:1}
	</style>
</head>
<body>
	<div id='wrap'>
		<video id='video' autoplay playsinline muted></video>
		<canvas id='bgCanvas'></canvas>
		<canvas id='overlay'></canvas>
		<button id='bgBtn' title='Change background'><span id='bgBtnIcon'>🎭</span><span id='bgBtnLabel'>Background</span></button>
		<button id='bgUploadBtn' title='Manage background photos'>🖼️</button>
		<input type='file' id='bgImageInput' accept='image/*' style='display:none'/>
		<div id='bgGallery'>
			<button id='bgGalleryClose'>×</button>
			<h4>Background Photos</h4>
			<div id='bgGalleryGrid'></div>
			<div id='bgGalleryEmpty' style='display:none'>No saved photos yet</div>
			<div id='bgGalleryActions'>
				<button class='bg-action-btn' id='bgAddNewBtn'>＋ Add New</button>
				<button class='bg-action-btn' id='bgClearBtn'>🗑️ Clear All</button>
			</div>
		</div>
		<div id='hud'><span id='counterLabel'>Count</span>: <strong id='reps'>0</strong></div>
		<div id='status'>Starting...</div>
		<div id='help'></div>
		<div id='feedback'></div>
	</div>
	<script>
		function postMsg(type, payload) {
			try {
				if (window.ReactNativeWebView) {
					window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
				}
			} catch (error) {}
			try {
				if (window.parent && window.parent !== window) {
					window.parent.postMessage({ type, payload }, '*');
				}
			} catch (error) {}
		}

		const configs = ${CONFIG_JSON};
		const holdModes = ['hold', 'tree_hold', 'still_hold'];

		const setStatus = (text) => {
			const element = document.getElementById('status');
			if (element) element.textContent = text;
		};

		const setHelp = (text) => {
			const element = document.getElementById('help');
			if (element) element.textContent = text || '';
		};

		const setFeedback = (text) => {
			const element = document.getElementById('feedback');
			if (element) element.textContent = text || '';
		};

		const setCount = (value) => {
			const element = document.getElementById('reps');
			if (element) element.textContent = String(value || 0);
		};

		const setCounterLabel = (text) => {
			const element = document.getElementById('counterLabel');
			if (element) element.textContent = text || 'Count';
		};

		const formatError = (error) => {
			const raw = String(error && (error.name || error.message || error) || '').trim();
			if (/NotAllowedError|Permission|denied/i.test(raw)) {
				return 'Camera access blocked. Allow camera access for localhost.';
			}
			return raw || 'Pose detector failed to initialize.';
		};

		function clamp(value, min, max) {
			return Math.max(min, Math.min(max, value));
		}

		function dist(a, b) {
			if (!a || !b) return null;
			return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
		}

		function avg() {
			const values = [...arguments].filter((value) => Number.isFinite(value));
			if (!values.length) return null;
			return values.reduce((sum, value) => sum + value, 0) / values.length;
		}

		function angleDeg(ax, ay, bx, by, cx, cy) {
			const abx = ax - bx;
			const aby = ay - by;
			const cbx = cx - bx;
			const cby = cy - by;
			const dot = (abx * cbx) + (aby * cby);
			const mag1 = Math.hypot(abx, aby) || 1e-6;
			const mag2 = Math.hypot(cbx, cby) || 1e-6;
			const cosine = clamp(dot / (mag1 * mag2), -1, 1);
			return Math.acos(cosine) * 180 / Math.PI;
		}

		function getMinVisibility(config) {
			return Number.isFinite(config && config.minVisibility)
				? config.minVisibility
				: ${DEFAULT_MIN_VISIBILITY};
		}

		function point(landmarks, index, minVisibility) {
			const value = landmarks && landmarks[index];
			if (!value) return null;
			if (Number.isFinite(value.visibility) && value.visibility < minVisibility) return null;
			return value;
		}

		function hasRequiredLandmarks(landmarks, config) {
			const required = Array.isArray(config && config.requiredLandmarkIndices)
				? config.requiredLandmarkIndices
				: [];
			if (!required.length) return true;
			const minVisibility = getMinVisibility(config);
			return required.every((index) => !!point(landmarks, index, minVisibility));
		}

		function createState() {
			return {
				reps: 0,
				lastReport: -1,
				history: {},
				downFrames: 0,
				upFrames: 0,
				phaseDown: false,
				phase: 'open',
				lastSide: null,
				holdMs: 0,
				lastTimestamp: 0,
				burpeePhase: 'stand',
				stillAnchor: null,
				lastInvalidHint: '',
			};
		}

		function updateHudUnit() {
			const config = configs[exercise] || {};
			setCounterLabel(holdModes.includes(config.mode) ? 'Seconds' : 'Count');
		}

		function resetState(silent) {
			state = createState();
			setCount(0);
			setFeedback('');
			updateHudUnit();
			if (!silent) postMsg('reps', { reps: 0, exercise });
		}

		function smoothMetric(name, value) {
			if (!Number.isFinite(value)) return null;
			const bucket = state.history[name] || [];
			const config = configs[exercise] || {};
			const smoothingWindow = Number.isFinite(config.smoothWindow)
				? Math.max(4, Math.round(config.smoothWindow))
				: DEFAULT_SMOOTHING_WINDOW;
			bucket.push(value);
			if (bucket.length > smoothingWindow) bucket.shift();
			state.history[name] = bucket;
			return avg.apply(null, bucket);
		}

		function incrementCount(step) {
			state.reps += step || 1;
			setCount(state.reps);
			if (state.reps !== state.lastReport) {
				state.lastReport = state.reps;
				postMsg('reps', { reps: state.reps, exercise });
			}
		}

		const configKeys = Object.keys(configs);
		let exercise = configKeys.includes('squat') ? 'squat' : configKeys[0];
		let state = createState();
		setHelp((configs[exercise] || {}).help || '');
		updateHudUnit();

		function computeMetrics(landmarks, config) {
			const minVisibility = getMinVisibility(config);
			const ls = point(landmarks, 11, minVisibility);
			const rs = point(landmarks, 12, minVisibility);
			const le = point(landmarks, 13, minVisibility);
			const re = point(landmarks, 14, minVisibility);
			const lw = point(landmarks, 15, minVisibility);
			const rw = point(landmarks, 16, minVisibility);
			const lh = point(landmarks, 23, minVisibility);
			const rh = point(landmarks, 24, minVisibility);
			const lk = point(landmarks, 25, minVisibility);
			const rk = point(landmarks, 26, minVisibility);
			const la = point(landmarks, 27, minVisibility);
			const ra = point(landmarks, 28, minVisibility);
			const nose = point(landmarks, 0, minVisibility);

			if (!ls || !rs || !lh || !rh || !lk || !rk || !la || !ra) return null;

			const shoulderWidth = dist(ls, rs) || 0.001;
			const hipWidth = dist(lh, rh) || 0.001;
			const torsoLen = avg(dist(ls, lh), dist(rs, rh)) || 0.001;
			const kneeLeft = angleDeg(lh.x, lh.y, lk.x, lk.y, la.x, la.y);
			const kneeRight = angleDeg(rh.x, rh.y, rk.x, rk.y, ra.x, ra.y);
			const hipLeft = angleDeg(ls.x, ls.y, lh.x, lh.y, lk.x, lk.y);
			const hipRight = angleDeg(rs.x, rs.y, rh.x, rh.y, rk.x, rk.y);
			const elbowLeft = le && lw ? angleDeg(ls.x, ls.y, le.x, le.y, lw.x, lw.y) : null;
			const elbowRight = re && rw ? angleDeg(rs.x, rs.y, re.x, re.y, rw.x, rw.y) : null;
			const bodyLineLeft = angleDeg(ls.x, ls.y, lh.x, lh.y, la.x, la.y);
			const bodyLineRight = angleDeg(rs.x, rs.y, rh.x, rh.y, ra.x, ra.y);
			const hipCenterY = avg(lh.y, rh.y);
			const shoulderCenterY = avg(ls.y, rs.y);
			const wristCenterY = avg(lw && lw.y, rw && rw.y);
			const kneeCenterY = avg(lk.y, rk.y);
			const ankleWidth = dist(la, ra) || 0;
			const wristWidth = lw && rw ? dist(lw, rw) : 0;
			const leftCross = le && rk ? dist(le, rk) / (torsoLen || 1) : null;
			const rightCross = re && lk ? dist(re, lk) / (torsoLen || 1) : null;
			const leftLift = (lh.y - lk.y) / (torsoLen || 1);
			const rightLift = (rh.y - rk.y) / (torsoLen || 1);
			const hipFoldLeft = angleDeg(ls.x, ls.y, lh.x, lh.y, la.x, la.y);
			const hipFoldRight = angleDeg(rs.x, rs.y, rh.x, rh.y, ra.x, ra.y);
			const treeLeft = la && rk ? dist(la, rk) / (torsoLen || 1) : null;
			const treeRight = ra && lk ? dist(ra, lk) / (torsoLen || 1) : null;

			return {
				shoulderWidth,
				hipWidth,
				torsoLen,
				kneeAvg: avg(kneeLeft, kneeRight),
				kneeMin: Math.min(kneeLeft || 999, kneeRight || 999),
				hipAvg: avg(hipLeft, hipRight),
				elbowAvg: avg(elbowLeft, elbowRight),
				bodyLine: avg(bodyLineLeft, bodyLineRight),
				hipCenterY,
				shoulderCenterY,
				wristCenterY,
				kneeCenterY,
				ankleWidth,
				ankleRatio: ankleWidth / (hipWidth || 1),
				wristWidth,
				wristRatio: wristWidth / (shoulderWidth || 1),
				leftCross,
				rightCross,
				leftLift,
				rightLift,
				hipFold: avg(hipFoldLeft, hipFoldRight),
				treeLeft,
				treeRight,
				noseY: nose && nose.y,
			};
		}

		function handleAngle(config, metrics) {
			const raw = metrics[config.metric];
			const smooth = smoothMetric('angle', raw);
			if (!Number.isFinite(smooth)) return;

			if (!state.phaseDown) {
				if (smooth < config.down) {
					state.downFrames += 1;
					state.upFrames = 0;
					if (config.lowerHint && smooth > config.down + 8) setFeedback(config.lowerHint);
				} else {
					state.downFrames = Math.max(0, state.downFrames - 1);
				}

				if (state.downFrames >= (config.downFrames || 3)) {
					state.phaseDown = true;
					state.downFrames = 0;
					setFeedback('');
				}
				return;
			}

			if (smooth > config.up) {
				state.upFrames += 1;
				state.downFrames = 0;
				if (config.upperHint && smooth < config.up - 8) setFeedback(config.upperHint);
			} else {
				state.upFrames = Math.max(0, state.upFrames - 1);
			}

			if (state.upFrames >= (config.upFrames || 4)) {
				state.phaseDown = false;
				state.upFrames = 0;
				setFeedback('');
				incrementCount(1);
			}
		}

		function handleCross(config, metrics) {
			const left = smoothMetric('crossLeft', metrics.leftCross);
			const right = smoothMetric('crossRight', metrics.rightCross);
			if (!Number.isFinite(left) || !Number.isFinite(right)) return;

			const activeSide = left < right ? 'left' : 'right';
			const activeValue = Math.min(left, right);
			const bothOpen = left > config.open && right > config.open;

			if (state.phase === 'open') {
				if (activeValue < config.close && activeSide !== state.lastSide) {
					state.phase = 'closed';
					state.lastSide = activeSide;
					if (config.lowerHint) setFeedback(config.lowerHint);
				}
				return;
			}

			if (bothOpen) {
				state.phase = 'open';
				setFeedback('');
				incrementCount(1);
			}
		}

		function handleJack(config, metrics) {
			const armOpen = metrics.wristRatio > config.openArm && ((metrics.shoulderCenterY - metrics.wristCenterY) / (metrics.torsoLen || 1)) > 0.05;
			const legOpen = metrics.ankleRatio > config.openLeg;
			const armClosed = metrics.wristRatio < config.closedArm;
			const legClosed = metrics.ankleRatio < config.closedLeg;

			if (state.phase === 'closed') {
				if (armOpen && legOpen) {
					state.phase = 'open';
					if (config.lowerHint) setFeedback(config.lowerHint);
				}
				return;
			}

			if (armClosed && legClosed) {
				state.phase = 'closed';
				setFeedback('');
				incrementCount(1);
			}
		}

		function handleArms(config, metrics) {
			const lift = (metrics.shoulderCenterY - metrics.wristCenterY) / (metrics.torsoLen || 1);
			const smooth = smoothMetric('arms', lift);
			if (!Number.isFinite(smooth)) return;

			if (state.phase === 'down') {
				if (smooth > config.upLift) {
					state.phase = 'up';
					if (config.lowerHint) setFeedback(config.lowerHint);
				}
				return;
			}

			if (smooth < config.downLift) {
				state.phase = 'down';
				setFeedback('');
				incrementCount(1);
			}
		}

		function handleHold(config, metrics, deltaMs) {
			let valid = false;
			if (config.metric === 'bodyLine') {
				const hipDelta = Math.abs((metrics.hipCenterY - metrics.shoulderCenterY) / (metrics.torsoLen || 1));
				valid = metrics.bodyLine >= (config.min || 150) && hipDelta <= (config.maxHipOffset || 0.2);
			} else if (Number.isFinite(config.min)) {
				valid = metrics[config.metric] >= (config.min || 0);
			} else if (Number.isFinite(config.max)) {
				valid = metrics[config.metric] <= (config.max || 999);
			}

			if (valid) {
				state.holdMs += deltaMs;
				if (config.validHint) setFeedback(config.validHint);
			} else {
				state.holdMs = 0;
				if (config.invalidHint) setFeedback(config.invalidHint);
			}

			while (state.holdMs >= (config.reportEveryMs || 1000)) {
				state.holdMs -= (config.reportEveryMs || 1000);
				incrementCount(1);
			}
		}

		function handleSteps(config, metrics) {
			const left = metrics.leftLift;
			const right = metrics.rightLift;
			if (left > config.lift && state.lastSide !== 'left') {
				state.lastSide = 'left';
				setFeedback(config.lowerHint || '');
				incrementCount(1);
				return;
			}
			if (right > config.lift && state.lastSide !== 'right') {
				state.lastSide = 'right';
				setFeedback(config.lowerHint || '');
				incrementCount(1);
			}
		}

		function handlePikeSteps(config, metrics) {
			if (metrics.hipFold > (config.hipFoldMax || 120)) {
				if (config.lowerHint) setFeedback(config.lowerHint);
				return;
			}
			handleSteps(config, metrics);
		}

		function handleBurpee(config, metrics) {
			const standing = metrics.kneeAvg > config.standKnee && metrics.bodyLine > 145;
			const squatting = metrics.kneeAvg < config.squatKnee;
			const plankish = metrics.bodyLine > config.plankLine && metrics.elbowAvg > 132 && Math.abs((metrics.hipCenterY - metrics.shoulderCenterY) / (metrics.torsoLen || 1)) < 0.38;

			if (state.burpeePhase === 'stand') {
				if (squatting) {
					state.burpeePhase = 'squat';
					if (config.lowerHint) setFeedback(config.lowerHint);
				}
				return;
			}

			if (state.burpeePhase === 'squat') {
				if (plankish) {
					state.burpeePhase = 'plank';
					setFeedback('Hold the plank');
				}
				return;
			}

			if (standing) {
				state.burpeePhase = 'stand';
				setFeedback('');
				incrementCount(1);
			}
		}

		function handleTree(config, metrics, deltaMs) {
			const ankleNearKnee = Math.min(metrics.treeLeft || 999, metrics.treeRight || 999) < (config.ankleToKneeMax || 0.2);
			const upright = metrics.bodyLine > (config.minBodyLine || 150);
			if (ankleNearKnee && upright) {
				state.holdMs += deltaMs;
				if (config.validHint) setFeedback(config.validHint);
			} else {
				state.holdMs = 0;
				if (config.invalidHint) setFeedback(config.invalidHint);
			}

			while (state.holdMs >= (config.reportEveryMs || 1000)) {
				state.holdMs -= (config.reportEveryMs || 1000);
				incrementCount(1);
			}
		}

		function handleStill(config, metrics, deltaMs) {
			const anchor = [metrics.noseY, metrics.shoulderCenterY, metrics.hipCenterY].filter(Number.isFinite);
			if (anchor.length < 2) return;

			const baseline = anchor.join('|');
			if (!state.stillAnchor) {
				state.stillAnchor = baseline;
				state.holdMs = 0;
				return;
			}

			const previous = String(state.stillAnchor).split('|').map((value) => Number(value));
			const movement = avg.apply(null, anchor.map((value, index) => Math.abs(value - (previous[index] || 0)))) / (metrics.torsoLen || 1);
			state.stillAnchor = baseline;

			if (movement <= (config.motionThreshold || 0.025)) {
				state.holdMs += deltaMs;
				if (config.validHint) setFeedback(config.validHint);
			} else {
				state.holdMs = 0;
				if (config.invalidHint) setFeedback(config.invalidHint);
			}

			while (state.holdMs >= (config.reportEveryMs || 1000)) {
				state.holdMs -= (config.reportEveryMs || 1000);
				incrementCount(1);
			}
		}

		function handleLandmarks(landmarks, timestamp) {
			if (!landmarks || landmarks.length === 0) return;
			const activeLandmarks = landmarks[0];
			const config = configs[exercise];
			if (!config) return;

			if (!hasRequiredLandmarks(activeLandmarks, config)) {
				if (config.invalidFrameHint && state.lastInvalidHint !== config.invalidFrameHint) {
					state.lastInvalidHint = config.invalidFrameHint;
					setFeedback(config.invalidFrameHint);
				}
				return;
			}

			state.lastInvalidHint = '';
			const metrics = computeMetrics(activeLandmarks, config);
			if (!metrics) return;

			const now = Number.isFinite(timestamp) ? timestamp : performance.now();
			const deltaMs = state.lastTimestamp ? Math.max(16, now - state.lastTimestamp) : 16;
			state.lastTimestamp = now;

			if (config.mode === 'angle') handleAngle(config, metrics);
			else if (config.mode === 'cross') handleCross(config, metrics);
			else if (config.mode === 'jack') handleJack(config, metrics);
			else if (config.mode === 'arms') handleArms(config, metrics);
			else if (config.mode === 'hold') handleHold(config, metrics, deltaMs);
			else if (config.mode === 'steps') handleSteps(config, metrics);
			else if (config.mode === 'pike_steps') handlePikeSteps(config, metrics);
			else if (config.mode === 'burpee') handleBurpee(config, metrics);
			else if (config.mode === 'tree_hold') handleTree(config, metrics, deltaMs);
			else if (config.mode === 'still_hold') handleStill(config, metrics, deltaMs);
		}

		(async function () {
			setStatus('Loading model...');
			const { FilesetResolver, PoseLandmarker, ImageSegmenter, DrawingUtils } = await import(${JSON.stringify(visionBundleUrl)});
			const fileset = await FilesetResolver.forVisionTasks(${JSON.stringify(visionWasmRoot)});
			const landmarker = await PoseLandmarker.createFromOptions(fileset, {
				baseOptions: {
					modelAssetPath: ${JSON.stringify(poseModelAssetPath)},
				},
				runningMode: 'VIDEO',
				numPoses: 1,
				minPoseDetectionConfidence: ${DEFAULT_POSE_DETECTION_CONFIDENCE},
				minPosePresenceConfidence: ${DEFAULT_POSE_PRESENCE_CONFIDENCE},
				minTrackingConfidence: ${DEFAULT_POSE_TRACKING_CONFIDENCE},
			});

			// Load segmenter in background — does not block pose detection
			let segmenter = null;
			ImageSegmenter.createFromOptions(fileset, {
				baseOptions: { modelAssetPath: ${JSON.stringify(DEFAULT_SEGMENTER_MODEL_ASSET_PATH)} },
				runningMode: 'VIDEO',
				outputCategoryMask: true,
				outputConfidenceMasks: false,
			}).then(s => { segmenter = s; }).catch(() => {});

			setStatus('Camera...');
			const video = document.getElementById('video');

			let currentStream = null;
			let currentFacingMode = 'user';
			let cameraReady = false;

			async function startCamera(facingMode) {
				if (currentStream) {
					currentStream.getTracks().forEach(t => t.stop());
					currentStream = null;
					// Brief pause for Android hardware to release the camera before re-acquiring
					await new Promise(r => setTimeout(r, 200));
				}
				const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false }).catch((error) => {
					const message = formatError(error);
					setStatus(message); setHelp(message); postMsg('error', message);
					throw error;
				});
				currentStream = stream;
				video.srcObject = stream;
				video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none';
				const _overlay = document.getElementById('overlay');
				if (_overlay) _overlay.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none';
				await video.play();
				return stream;
			}

			window.flipCamera = async function() {
				currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
				cameraReady = false;
				context.clearRect(0, 0, overlay.width, overlay.height);
				bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
				try {
					await startCamera(currentFacingMode);
					// Wait for the new stream to deliver its first frame before re-enabling detection
					if (video.readyState < 2) {
						await new Promise(r => {
							video.addEventListener('canplay', r, { once: true });
							setTimeout(r, 2500); // safety timeout
						});
					}
					resize();
				} catch(e) { postMsg('error', 'Flip failed: ' + (e.message||e)); }
				cameraReady = true;
			};

			await startCamera(currentFacingMode);
			cameraReady = true;

			const overlay = document.getElementById('overlay');
			const context = overlay.getContext('2d');
			const bgCanvas = document.getElementById('bgCanvas');
			const bgCtx = bgCanvas.getContext('2d');

			// Offscreen canvases for compositing
			const personCanvas = document.createElement('canvas');
			const personCtx = personCanvas.getContext('2d', { willReadFrequently: true });

			// Background modes
			const BG_MODES  = ['off',        'remove',    'blur',     'space',    'neon',  'photo'];
			const BG_ICONS  = ['🎭',          '👤',          '🌫️',       '🌌',      '💚',    '🖼️'];
			const BG_LABELS = ['Background', 'No Background', 'Blur BG',  'Space',    'Neon',  'Photo BG'];
			let bgModeIndex = 0;
			let customBgImage = null;
			const bgBtn         = document.getElementById('bgBtn');
			const bgBtnIcon     = document.getElementById('bgBtnIcon');
			const bgBtnLabel    = document.getElementById('bgBtnLabel');
			const bgUploadBtn   = document.getElementById('bgUploadBtn');
			const bgImageInput  = document.getElementById('bgImageInput');
			const bgGallery     = document.getElementById('bgGallery');
			const bgGalleryGrid = document.getElementById('bgGalleryGrid');
			const bgGalleryEmpty = document.getElementById('bgGalleryEmpty');
			const BG_STORAGE_KEY = 'bodify_bg_photos';
			const BG_MAX_PHOTOS  = 6;

			// --- localStorage helpers ---
			function loadStoredPhotos() {
				try { return JSON.parse(localStorage.getItem(BG_STORAGE_KEY) || '[]'); } catch(_) { return []; }
			}
			function saveStoredPhotos(arr) {
				try { localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(arr)); } catch(_) {}
			}
			// Compress a File to a base64 jpeg string (max 960px wide)
			function compressImage(file, cb) {
				const url = URL.createObjectURL(file);
				const img = new Image();
				img.onload = () => {
					const MAX = 960;
					let { naturalWidth: w, naturalHeight: h } = img;
					if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
					const c = document.createElement('canvas');
					c.width = w; c.height = h;
					c.getContext('2d').drawImage(img, 0, 0, w, h);
					cb(c.toDataURL('image/jpeg', 0.82));
					URL.revokeObjectURL(url);
				};
				img.src = url;
			}
			// Set a base64 string as the current background
			function setCustomBgFromDataUrl(dataUrl) {
				const img = new Image();
				img.onload = () => { customBgImage = img; };
				img.src = dataUrl;
			}

			// --- Gallery UI ---
			function renderGallery() {
				const photos = loadStoredPhotos();
				bgGalleryGrid.innerHTML = '';
				if (photos.length === 0) {
					bgGalleryEmpty.style.display = 'block';
				} else {
					bgGalleryEmpty.style.display = 'none';
					photos.forEach((dataUrl, idx) => {
						const thumb = document.createElement('img');
						thumb.src = dataUrl;
						thumb.className = 'bg-thumb';
						if (customBgImage && customBgImage.src === dataUrl) thumb.classList.add('selected');
						thumb.addEventListener('click', () => {
							setCustomBgFromDataUrl(dataUrl);
							document.querySelectorAll('.bg-thumb').forEach(t => t.classList.remove('selected'));
							thumb.classList.add('selected');
							hideGallery();
						});
						bgGalleryGrid.appendChild(thumb);
					});
				}
			}
			function showGallery() { renderGallery(); bgGallery.style.display = 'block'; }
			function hideGallery() { bgGallery.style.display = 'none'; }

			try {
				document.getElementById('bgGalleryClose').addEventListener('click', hideGallery);
				document.getElementById('bgAddNewBtn').addEventListener('click', () => bgImageInput.click());
				document.getElementById('bgClearBtn').addEventListener('click', () => {
					saveStoredPhotos([]);
					customBgImage = null;
					renderGallery();
				});
			} catch(_) {}

			bgImageInput.addEventListener('change', () => {
				const file = bgImageInput.files && bgImageInput.files[0];
				if (!file) return;
				compressImage(file, (dataUrl) => {
					const photos = loadStoredPhotos();
					// Prepend new photo, cap at max
					photos.unshift(dataUrl);
					if (photos.length > BG_MAX_PHOTOS) photos.pop();
					saveStoredPhotos(photos);
					setCustomBgFromDataUrl(dataUrl);
					renderGallery();
					hideGallery();
				});
				bgImageInput.value = '';
			});

			function applyBgMode(index) {
				const mode = BG_MODES[index];
				const needsCanvas = mode !== 'off';
				video.style.display = needsCanvas ? 'none' : '';
				bgCanvas.style.display = needsCanvas ? 'block' : 'none';
				bgBtn.classList.toggle('active', needsCanvas);
				// Show gallery button only in photo mode
				bgUploadBtn.style.display = mode === 'photo' ? 'block' : 'none';
				if (mode !== 'photo') hideGallery();
				// Open gallery when entering photo mode
				if (mode === 'photo') {
					const stored = loadStoredPhotos();
					if (stored.length > 0 && !customBgImage) setCustomBgFromDataUrl(stored[0]);
					showGallery();
				}
			}

			bgBtn.addEventListener('click', () => {
				bgModeIndex = (bgModeIndex + 1) % BG_MODES.length;
				bgBtnIcon.textContent  = BG_ICONS[bgModeIndex];
				bgBtnLabel.textContent = BG_LABELS[bgModeIndex];
				applyBgMode(bgModeIndex);
			});

			// Gallery button opens the popup
			bgUploadBtn.addEventListener('click', () => showGallery());

			function drawBgFrame(mode, w, h, maskArr) {
				bgCtx.clearRect(0, 0, w, h);

				// --- Draw styled background layer ---
				if (mode === 'photo') {
					if (customBgImage) {
						// Cover-fit the custom image
						const iw = customBgImage.naturalWidth, ih = customBgImage.naturalHeight;
						const scale = Math.max(w / iw, h / ih);
						const dw = iw * scale, dh = ih * scale;
						bgCtx.drawImage(customBgImage, (w - dw) / 2, (h - dh) / 2, dw, dh);
					} else {
						// No image chosen yet — draw a placeholder
						bgCtx.fillStyle = 'rgb(20,20,40)';
						bgCtx.fillRect(0, 0, w, h);
						bgCtx.fillStyle = 'rgba(255,255,255,0.35)';
						bgCtx.font = 'bold 18px system-ui';
						bgCtx.textAlign = 'center';
						bgCtx.fillText('Tap 📁 to choose a photo', w / 2, h / 2);
					}
				} else if (mode === 'blur') {
					bgCtx.filter = 'blur(20px) brightness(0.6)';
					bgCtx.drawImage(video, 0, 0, w, h);
					bgCtx.filter = 'none';
				} else if (mode === 'remove') {
					bgCtx.fillStyle = '#000';
					bgCtx.fillRect(0, 0, w, h);
				} else if (mode === 'space') {
					const g = bgCtx.createLinearGradient(0, 0, w, h);
					g.addColorStop(0,   'rgb(12,0,36)');
					g.addColorStop(0.5, 'rgb(26,0,80)');
					g.addColorStop(1,   'rgb(10,10,46)');
					bgCtx.fillStyle = g;
					bgCtx.fillRect(0, 0, w, h);
				} else if (mode === 'neon') {
					const g = bgCtx.createLinearGradient(0, 0, w, h);
					g.addColorStop(0,   'rgb(0,26,14)');
					g.addColorStop(0.5, 'rgb(0,26,46)');
					g.addColorStop(1,   'rgb(10,0,26)');
					bgCtx.fillStyle = g;
					bgCtx.fillRect(0, 0, w, h);
				}

				// --- Draw person layer using segmentation mask (all non-off modes) ---
				if (maskArr) {
					personCtx.clearRect(0, 0, w, h);
					personCtx.drawImage(video, 0, 0, w, h);
					const frame = personCtx.getImageData(0, 0, w, h);
					const d = frame.data;
					// selfie_segmenter: 0=person, non-zero=background
					for (let i = 0; i < maskArr.length; i++) {
						if (maskArr[i] !== 0) d[i * 4 + 3] = 0;
					}
					personCtx.putImageData(frame, 0, 0);
					bgCtx.drawImage(personCanvas, 0, 0);
				} else {
					// Segmenter still loading — fall back to showing full video frame
					bgCtx.drawImage(video, 0, 0, w, h);
				}
			}

			function resize() {
				const width = video.videoWidth || overlay.clientWidth || window.innerWidth;
				const height = video.videoHeight || overlay.clientHeight || window.innerHeight;
				overlay.width = width;
				overlay.height = height;
				bgCanvas.width = width;
				bgCanvas.height = height;
				personCanvas.width = width;
				personCanvas.height = height;
			}

			resize();
			video.addEventListener('loadedmetadata', resize);
			window.addEventListener('resize', resize);

			const drawing = new DrawingUtils(context);
			postMsg('ready', { ok: true });
			setStatus('Detecting');

			let lastDetectTs = -1;
			function loop() {
				// requestAnimationFrame MUST always be called — put it in a finally so
				// any throw anywhere in the loop body can never kill the animation loop.
				try {
					const now = performance.now();
					let result = null;
					try {
						if (cameraReady && video.readyState >= 2 && now > lastDetectTs) {
							result = landmarker.detectForVideo(video, now);
							lastDetectTs = now;
						}
					} catch (_) {
						// skip frame during camera switch or transient MediaPipe error
					}

					// Background compositing (every frame)
					const bgMode = BG_MODES[bgModeIndex];
					if (bgMode !== 'off' && cameraReady && video.readyState >= 2) {
						try {
							const w = bgCanvas.width;
							const h = bgCanvas.height;
							let maskArr = null;
							if (segmenter) {
								const sr = segmenter.segmentForVideo(video, now + 0.1);
								if (sr && sr.categoryMask) {
									maskArr = sr.categoryMask.getAsUint8Array();
									sr.categoryMask.close();
								}
							}
							drawBgFrame(bgMode, w, h, maskArr);
						} catch(_) {}
					}

					try { context.clearRect(0, 0, overlay.width, overlay.height); } catch (_) {}

					if (result && result.landmarks && result.landmarks.length > 0) {
						for (const landmarkSet of result.landmarks) {
							try {
								drawing.drawConnectors(landmarkSet, PoseLandmarker.POSE_CONNECTIONS, { color: '#00FFC6', lineWidth: 3 });
								drawing.drawLandmarks(landmarkSet, { radius: 3, color: '#00E7FF', fillColor: '#ffffff' });
							} catch (_) {}
						}
						try { handleLandmarks(result.landmarks, now); } catch (_) {}
					}
				} finally {
					requestAnimationFrame(loop);
				}
			}

			requestAnimationFrame(loop);

			// Expose direct globals so react-native-webview can call them via injectJavaScript
			// setExercise: only switch config + clear UI; React Native side already resets its counter.
			// Use silent=true to avoid echoing reps=0 back which would cause a re-render cascade.
			window.setExercise = function(name) {
				const next = String(name || '').toLowerCase();
				if (configs[next]) {
					exercise = next;
					setHelp(configs[next].help || '');
					resetState(true);
				}
			};
			window.resetDetector = function() { resetState(); };

			window.addEventListener('message', (event) => {
				const data = event && event.data || {};
				if (data.type === 'reset') {
					resetState();
					return;
				}

				if (data.type === 'flipCamera') {
					window.flipCamera && window.flipCamera();
					return;
				}

				if (data.type === 'config') {
					const nextExercise = String(data.exercise || '').toLowerCase();
					if (configs[nextExercise]) {
						exercise = nextExercise;
						setHelp(configs[nextExercise].help || '');
						resetState();
					}
				}
			});
		})().catch((error) => {
			const message = formatError(error);
			setStatus(message);
			setHelp(message);
			postMsg('error', message);
		});
	</script>
</body>
</html>`;

export const POSE_DETECTOR_HTML = buildPoseDetectorHtml();