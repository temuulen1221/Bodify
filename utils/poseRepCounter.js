// Generic pose rep counting state machine used for tests and potential reuse in runtime.
// It applies smoothing (moving average) and hysteresis (separate up/down frame thresholds)
// to reduce noise. Angle samples are fed in sequentially.
function createInitialRepState() {
  return {
    history: [], // recent smoothed angles
    phaseDown: false,
    reps: 0,
    lastReport: 0,
    downFrames: 0,
    upFrames: 0,
  };
}

function updateRepState(state, rawAngle, config) {
  const {
    downThresh = 100,
    upThresh = 160,
    maxHistory = 8,
    downFramesRequired = 3,
    upFramesRequired = 4,
  } = config || {};

  if (!Number.isFinite(rawAngle)) {
    return { state, repIncreased: false, feedback: '' };
  }

  state.history.push(rawAngle);
  if (state.history.length > maxHistory) state.history.shift();
  const smooth = state.history.reduce((s, a) => s + a, 0) / state.history.length;

  let feedback = '';
  let repIncreased = false;

  if (!state.phaseDown) {
    if (smooth < downThresh) {
      state.downFrames++;
      state.upFrames = 0;
      if (smooth > downThresh + 8) feedback = 'Go deeper';
    } else {
      state.downFrames = Math.max(0, state.downFrames - 1);
    }
    if (state.downFrames >= downFramesRequired) {
      state.phaseDown = true;
      state.downFrames = 0;
    }
  } else {
    if (smooth > upThresh) {
      state.upFrames++;
      state.downFrames = 0;
      if (smooth < upThresh - 8) feedback = 'Extend fully';
    } else {
      state.upFrames = Math.max(0, state.upFrames - 1);
    }
    if (state.upFrames >= upFramesRequired) {
      state.phaseDown = false;
      state.upFrames = 0;
      state.reps += 1;
      repIncreased = true;
    }
  }

  return { state, repIncreased, feedback };
}

// Convenience helper to process a batch of angle samples and return the final rep count.
function countRepsFromAngles(angles, config) {
  const st = createInitialRepState();
  angles.forEach((a) => updateRepState(st, a, config));
  return st.reps;
}

module.exports = { createInitialRepState, updateRepState, countRepsFromAngles };
