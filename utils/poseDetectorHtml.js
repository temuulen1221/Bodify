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
		#overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
		#hud{display:none}
		#hud strong{color:#fff}
		#status{display:none}
		#help{display:none}
		#feedback{display:none}
	</style>
</head>
<body>
	<div id='wrap'>
		<video id='video' autoplay playsinline muted></video>
		<canvas id='overlay'></canvas>
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

		function resetState() {
			state = createState();
			setCount(0);
			setFeedback('');
			updateHudUnit();
			postMsg('reps', { reps: 0, exercise });
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
			const { FilesetResolver, PoseLandmarker, DrawingUtils } = await import(${JSON.stringify(visionBundleUrl)});
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

			setStatus('Camera...');
			const video = document.getElementById('video');

			let currentStream = null;
			let currentFacingMode = 'user';

			async function startCamera(facingMode) {
				if (currentStream) { currentStream.getTracks().forEach(t => t.stop()); currentStream = null; }
				const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false }).catch((error) => {
					const message = formatError(error);
					setStatus(message); setHelp(message); postMsg('error', message);
					throw error;
				});
				currentStream = stream;
				video.srcObject = stream;
				video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none';
				await video.play();
				return stream;
			}

			window.flipCamera = async function() {
				currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
				try { await startCamera(currentFacingMode); } catch(e) { postMsg('error', 'Flip failed: ' + (e.message||e)); }
			};

			await startCamera(currentFacingMode);

			const overlay = document.getElementById('overlay');
			const context = overlay.getContext('2d');

			function resize() {
				const width = video.videoWidth || overlay.clientWidth || window.innerWidth;
				const height = video.videoHeight || overlay.clientHeight || window.innerHeight;
				overlay.width = width;
				overlay.height = height;
			}

			resize();
			window.addEventListener('resize', resize);

			const drawing = new DrawingUtils(context);
			postMsg('ready', { ok: true });
			setStatus('Detecting');

			function loop() {
				const now = performance.now();
				const result = landmarker.detectForVideo(video, now);
				context.clearRect(0, 0, overlay.width, overlay.height);

				if (result && result.landmarks && result.landmarks.length > 0) {
					for (const landmarkSet of result.landmarks) {
						drawing.drawLandmarks(landmarkSet, { radius: 2, color: '#00E7FF' });
						drawing.drawConnectors(landmarkSet, PoseLandmarker.POSE_LANDMARKS_LEFT, { color: '#6A00FF', lineWidth: 2 });
						drawing.drawConnectors(landmarkSet, PoseLandmarker.POSE_LANDMARKS_RIGHT, { color: '#00FFC6', lineWidth: 2 });
						drawing.drawConnectors(landmarkSet, PoseLandmarker.POSE_LANDMARKS_NEUTRAL, { color: '#CCCCCC', lineWidth: 1 });
					}
					handleLandmarks(result.landmarks, now);
				}

				requestAnimationFrame(loop);
			}

			requestAnimationFrame(loop);

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