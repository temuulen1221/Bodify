import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useDispatch, useSelector } from 'react-redux';
import BackButton from '../components/BackButton';
import { acceptPrivacy, addWeeklySquatReps, addWorkoutSession, addXP, incrementPoseRep, markWeeklyXPAwarded, resetPoseSession, setFormFeedback, setPoseExercise } from '../store';

// Multi-exercise pose detector HTML. Accepts postMessage of type 'config' with { exercise }
// Exercises supported: squat, pushup, lunge. Each has thresholds & angle logic.
const POSE_HTML = `<!doctype html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/><style>html,body{margin:0;padding:0;height:100%;background:#000;color:#eee;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}#wrap{position:relative;width:100%;height:100%;overflow:hidden}#video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}#overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}#hud{position:absolute;left:12px;top:12px;padding:8px 10px;background:rgba(0,0,0,.35);border-radius:10px;border:1px solid rgba(0,231,255,.45)}#hud strong{color:#fff}#status{position:absolute;right:12px;top:12px;padding:6px 10px;background:rgba(0,0,0,.35);border-radius:10px;font-size:12px;opacity:.8}#help{position:absolute;left:12px;bottom:12px;max-width:62ch;font-size:11px;opacity:.7}#feedback{position:absolute;right:12px;bottom:12px;font-size:14px;font-weight:700;color:#00FFC6;text-shadow:0 0 6px rgba(0,255,198,.6)}</style></head><body><div id='wrap'><video id='video' autoplay playsinline muted></video><canvas id='overlay'></canvas><div id='hud'>Reps: <strong id='reps'>0</strong></div><div id='status'>Starting…</div><div id='help'></div><div id='feedback'></div></div><script>function postMsg(t,p){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:t,payload:p}))}catch(e){}try{if(window.parent&&window.parent!==window){window.parent.postMessage({type:t,payload:p},'*')}}catch(e){}}const setStatus=t=>{const el=document.getElementById('status');if(el)el.textContent=t};const setHelp=t=>{const el=document.getElementById('help');if(el)el.textContent=t};const setFeedback=t=>{const el=document.getElementById('feedback');if(el)el.textContent=t||''};function angleDeg(ax,ay,bx,by,cx,cy){const abx=ax-bx,aby=ay-by,cbx=cx-bx,cby=cy-by,dot=abx*cbx+aby*cby,mag1=Math.hypot(abx,aby)||1e-6,mag2=Math.hypot(cbx,cby)||1e-6,cos=Math.max(-1,Math.min(1,dot/(mag1*mag2)));return Math.acos(cos)*180/Math.PI}const configs={squat:{down:100,up:160,help:'Squat: knee avg down <100°, up >160°'},pushup:{down:80,up:150,help:'Push-up: elbow avg down <80°, up >150°'},lunge:{down:90,up:155,help:'Lunge: front knee angle down <90°, up >155°'}};let exercise='squat';let downThresh=configs[exercise].down,upThresh=configs[exercise].up;setHelp(configs[exercise].help); (async function(){setStatus('Loading model…');const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.10/vision_bundle.js';document.head.appendChild(script);await new Promise((res,rej)=>{script.onload=res;script.onerror=rej});var FilesetResolver=window.FilesetResolver||(window.vision&&window.vision.FilesetResolver);var PoseLandmarker=window.PoseLandmarker||(window.vision&&window.vision.PoseLandmarker);var DrawingUtils=window.DrawingUtils||(window.vision&&window.vision.DrawingUtils);const fileset=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.10/wasm');const landmarker=await PoseLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});setStatus('Camera…');const video=document.getElementById('video');const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false}).catch(err=>{setStatus('Camera error');postMsg('error',String(err&&err.message||err));throw err});video.srcObject=stream;await video.play();const overlay=document.getElementById('overlay');const ctx=overlay.getContext('2d');function resize(){const w=video.videoWidth||overlay.clientWidth||window.innerWidth;const h=video.videoHeight||overlay.clientHeight||window.innerHeight;overlay.width=w;overlay.height=h}resize();window.addEventListener('resize',resize);const draw=new DrawingUtils(ctx);let reps=0,phaseDown=false,lastReport=-1;let angleHistory=[];let downFrames=0,upFrames=0;postMsg('ready',{ok:true});setStatus('Detecting');function computeAngle(lm){if(exercise==='squat'||exercise==='lunge'){const L={hip:lm[23],knee:lm[25],ankle:lm[27]};const R={hip:lm[24],knee:lm[26],ankle:lm[28]};if(!L.hip||!L.knee||!L.ankle||!R.hip||!R.knee||!R.ankle)return null;const lAng=angleDeg(L.hip.x,L.hip.y,L.knee.x,L.knee.y,L.ankle.x,L.ankle.y);const rAng=angleDeg(R.hip.x,R.hip.y,R.knee.x,R.knee.y,R.ankle.x,R.ankle.y);if(exercise==='lunge'){return Math.min(lAng,rAng);}return (lAng+rAng)/2;} else if(exercise==='pushup'){const L={shoulder:lm[11],elbow:lm[13],wrist:lm[15]};const R={shoulder:lm[12],elbow:lm[14],wrist:lm[16]};if(!L.shoulder||!L.elbow||!L.wrist||!R.shoulder||!R.elbow||!R.wrist)return null;const lAng=angleDeg(L.shoulder.x,L.shoulder.y,L.elbow.x,L.elbow.y,L.wrist.x,L.wrist.y);const rAng=angleDeg(R.shoulder.x,R.shoulder.y,R.elbow.x,R.elbow.y,R.wrist.x,R.wrist.y);return (lAng+rAng)/2;}return null;}function handleLandmarks(landmarks){if(!landmarks||landmarks.length===0)return;const lm=landmarks[0];const ang=computeAngle(lm);if(!Number.isFinite(ang))return;angleHistory.push(ang);if(angleHistory.length>8)angleHistory.shift();const smooth=angleHistory.reduce((s,a)=>s+a,0)/angleHistory.length;let feedback='';if(!phaseDown){if(smooth<downThresh){downFrames++;upFrames=0;if(smooth>downThresh+8)feedback='Go deeper';}else{downFrames=Math.max(0,downFrames-1);}if(downFrames>=3){phaseDown=true;downFrames=0;}}else{if(smooth>upThresh){upFrames++;downFrames=0;if(smooth<upThresh-8)feedback='Extend fully';}else{upFrames=Math.max(0,upFrames-1);}if(upFrames>=4){phaseDown=false;upFrames=0;reps+=1;document.getElementById('reps').textContent=String(reps);if(reps!==lastReport){lastReport=reps;postMsg('reps',{reps,exercise});}}}if(feedback){setFeedback(feedback);postMsg('feedback',{text:feedback});}}function loop(){const now=performance.now();const result=landmarker.detectForVideo(video,now);ctx.clearRect(0,0,overlay.width,overlay.height);if(result&&result.landmarks&&result.landmarks.length>0){for(const lms of result.landmarks){draw.drawLandmarks(lms,{radius:2,color:'#00E7FF'});draw.drawConnectors(lms,PoseLandmarker.POSE_LANDMARKS_LEFT,{color:'#6A00FF',lineWidth:2});draw.drawConnectors(lms,PoseLandmarker.POSE_LANDMARKS_RIGHT,{color:'#00FFC6',lineWidth:2});draw.drawConnectors(lms,PoseLandmarker.POSE_LANDMARKS_NEUTRAL,{color:'#CCCCCC',lineWidth:1});}handleLandmarks(result.landmarks);}requestAnimationFrame(loop);}requestAnimationFrame(loop);window.addEventListener('message',ev=>{const data=ev&&ev.data||{};if(data.type==='reset'){reps=0;phaseDown=false;lastReport=-1;angleHistory=[];downFrames=0;upFrames=0;document.getElementById('reps').textContent='0';postMsg('reps',{reps,exercise});setFeedback('');}else if(data.type==='config'){const ex=data.exercise;if(configs[ex]){exercise=ex;downThresh=configs[ex].down;upThresh=configs[ex].up;setHelp(configs[ex].help);reps=0;phaseDown=false;lastReport=-1;angleHistory=[];downFrames=0;upFrames=0;document.getElementById('reps').textContent='0';postMsg('reps',{reps,exercise});setFeedback('');}}});})().catch(e=>{setStatus('Init failed');postMsg('error',String(e&&e.message||e));});</script></body></html>`;

export default function PoseScreen() {
  const dispatch = useDispatch();
  const poseState = useSelector((s:any)=> s.pose || {});
  const { currentExercise, privacyAccepted } = poseState;
  const weeklySquatRepsByWeek = useSelector((s:any) => s.quests?.weeklySquatRepsByWeek || {});
  const weeklyXPAwardedByWeek = useSelector((s:any) => s.quests?.weeklyXPAwardedByWeek || {});
  const [reps, setReps] = useState(0);
  const [startedAt] = useState<number>(() => Date.now());
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Messaging (web): listen for reps & feedback
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMsg = (ev: MessageEvent) => {
      const data: any = ev?.data || {};
      if (data.type === 'reps' && data.payload && typeof data.payload.reps === 'number') {
        setReps(data.payload.reps);
        dispatch(incrementPoseRep());
      } else if (data.type === 'feedback' && data.payload?.text) {
        dispatch(setFormFeedback(data.payload.text));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [dispatch]);

  // Messaging (native WebView)
  const onNativeMessage = useCallback((ev:any) => {
    try { const data = JSON.parse(ev.nativeEvent.data); if (data.type === 'reps') { setReps(data.payload.reps||0); dispatch(incrementPoseRep()); } else if (data.type==='feedback' && data.payload?.text){ dispatch(setFormFeedback(data.payload.text)); } } catch(_) {}
  }, [dispatch]);

  // Send config when exercise changes
  useEffect(()=>{
    if (Platform.OS === 'web') {
      try { iframeRef.current?.contentWindow?.postMessage({ type:'config', exercise: currentExercise }, '*'); } catch(_) {}
    }
  }, [currentExercise]);

  const reset = () => {
    setReps(0);
    dispatch(resetPoseSession());
    if (Platform.OS === 'web') {
      try { iframeRef.current?.contentWindow?.postMessage({ type: 'reset' }, '*'); } catch(_) {}
    }
  };

  const saveSession = () => {
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const durationMin = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const calories = Math.max(40, Math.round(reps * 0.5));
    dispatch(addWorkoutSession({
      date: dateKey,
      session: { title: `${currentExercise} (pose)`, durationMin, calories, notes: `Auto-counted ${reps} reps via pose`, type: currentExercise, reps: String(reps) } as any,
    }));
    if (currentExercise === 'squat') {
      dispatch(addWeeklySquatReps({ date: dateKey, reps }));
      const dt = new Date(dateKey + 'T00:00:00');
      const target = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      const dayNr = (target.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNr + 3);
      const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
      const week = 1 + Math.floor(diff / 7);
      const weekKey = `${target.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
      const total = (weeklySquatRepsByWeek[weekKey] || 0) + reps;
      const WEEK_GOAL = 100; const WEEK_XP = 100;
      if (!weeklyXPAwardedByWeek[weekKey] && total >= WEEK_GOAL) {
        dispatch(addXP(WEEK_XP));
        dispatch(markWeeklyXPAwarded({ weekKey }));
      }
    }
    const sessionXP = Math.floor(reps / 5) * 5;
    if (sessionXP > 0) dispatch(addXP(sessionXP));
  };

  const srcDoc = useMemo(() => POSE_HTML, []);
  const iframeStyle: any = { border: '0', width: '100%', height: '100%', display: 'block' };

  const ExerciseSelector = () => (
    <View style={styles.exerciseRow}>
      {['squat','pushup','lunge'].map(ex => (
        <TouchableOpacity key={ex} onPress={() => dispatch(setPoseExercise(ex))} activeOpacity={0.85}>
          <LinearGradient colors={currentExercise===ex?["#00E7FF","#6A00FF"]:["#333","#111"]} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.exerciseBtn,currentExercise===ex&&styles.exerciseBtnActive]}>
            <Text style={styles.exerciseBtnText}>{ex==='squat'?'🦵 Squat':ex==='pushup'?'🤸 Push-up':'🦿 Lunge'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (!privacyAccepted) {
    return (
      <SafeAreaView style={styles.root}> 
        <View style={styles.privacyWrap}> 
          <View style={[styles.topRow, { marginBottom: 12 }]}> 
            <BackButton />
            <Text style={[styles.privacyTitle, { marginBottom: 0 }]}>Pose Detection</Text>
          </View>
          <Text style={styles.privacyDesc}>Camera frames are processed locally in real-time to estimate joint angles and count reps. No video is uploaded or stored. Continue?</Text>
          <View style={{marginTop:24}}>
            <TouchableOpacity onPress={()=>dispatch(acceptPrivacy())} activeOpacity={0.85}>
              <LinearGradient colors={["#00E7FF","#6A00FF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.acceptBtn}> 
                <Text style={styles.acceptBtnText}>Allow Camera & Start</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}> 
            <View style={styles.topRow}>
              <BackButton />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.title}>Pose Detector</Text>
                <Text style={styles.subtitle}>MediaPipe via WebView</Text>
              </View>
            </View>
            <ExerciseSelector />
        </View>
        <View style={styles.viewer}>
          <WebView
            source={{ html: POSE_HTML }}
            style={styles.webView}
            onMessage={onNativeMessage}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            domStorageEnabled
          />
        </View>
        <View style={styles.footer}> 
          <Text style={styles.reps}>Reps: {reps}</Text>
          <View style={{flexDirection:'row', gap: 12}}>
            <PillButton label="Reset" onPress={reset} />
            <PillButton label="Save Session" onPress={saveSession} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}> 
          <View style={styles.topRow}>
            <BackButton />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.title}>Pose Detector</Text>
              <Text style={styles.subtitle}>Webcam + MediaPipe</Text>
            </View>
          </View>
          <ExerciseSelector />
      </View>
      <View style={[styles.viewer, styles.viewerWeb]}>
        <View style={styles.phoneFrame}>
          {/* eslint-disable-next-line jsx-a11y/iframe-has-title */}
          <iframe ref={iframeRef} srcDoc={srcDoc} style={iframeStyle} allow="camera *; microphone *;" />
        </View>
      </View>
      <View style={styles.footer}> 
        <Text style={styles.reps}>Reps: {reps}</Text>
        <View style={{flexDirection:'row', gap: 12}}>
          <PillButton label="Reset" onPress={reset} />
          <PillButton label="Save Session" onPress={saveSession} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function PillButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient colors={["#00E7FF", "#6A00FF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.btn}> 
        <Text style={styles.btnText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#f0f6fc', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#8b949e', marginTop: 2 },
  viewer: { flex: 1 },
  viewerWeb: { alignItems: 'center', justifyContent: 'center', padding: 12 },
  phoneFrame: { width: 393, height: 852, maxWidth: '100%', maxHeight: '100%', borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#000' },
  webView: { flex: 1, width: '100%', backgroundColor: '#000' },
  footer: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  reps: { color: '#f0f6fc', fontSize: 16, fontWeight: '700' },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  btnText: { color: '#fff', fontWeight: '700' },
  exerciseRow: { flexDirection:'row', marginTop: 10, gap: 10 },
  exerciseBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  exerciseBtnActive: { borderColor: '#00E7FF' },
  exerciseBtnText: { color:'#fff', fontWeight:'700', fontSize:13 },
  privacyWrap: { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  privacyTitle: { color:'#fff', fontSize:22, fontWeight:'800', marginBottom:16 },
  privacyDesc: { color:'#c9d1d9', fontSize:14, lineHeight:20, textAlign:'center' },
  acceptBtn: { paddingHorizontal:22, paddingVertical:14, borderRadius:999 },
  acceptBtnText: { color:'#fff', fontWeight:'700', fontSize:16 },
});
