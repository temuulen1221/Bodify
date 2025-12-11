const { createInitialRepState, updateRepState, countRepsFromAngles } = require('../../utils/poseRepCounter');

describe('poseRepCounter', () => {
  test('counts squat reps with knee angle sequence', () => {
    // Crafted sequence with clear low (<100) and high (>160) phases repeated twice
    const angles = [170,170,168,165,110,95,90,92,100,140,160,165,170,170,165,110,95,90,92,100,150,165,170];
  const reps = countRepsFromAngles(angles, { downThresh: 100, upThresh: 160, maxHistory: 3, downFramesRequired: 1, upFramesRequired: 1 });
    expect(reps).toBeGreaterThanOrEqual(2);
  });

  test('push-up rep detection using elbow angle', () => {
    const seq = [160,155,152,120,85,70,65,60,62,90,130,150,155,158,160,120,85,70,65,60,62,95,140,150,155,158,160];
  const reps = countRepsFromAngles(seq, { downThresh: 80, upThresh: 150, maxHistory: 3, downFramesRequired: 1, upFramesRequired: 1 });
    expect(reps).toBeGreaterThanOrEqual(2);
  });

  test('hysteresis prevents false rapid toggling', () => {
    const state = createInitialRepState();
    const config = { downThresh: 100, upThresh: 160 };
    // Bounce around mid angles should not create reps
    const noise = Array.from({ length: 30 }, (_, i) => 130 + Math.sin(i) * 10);
    noise.forEach(a => updateRepState(state, a, config));
    expect(state.reps).toBe(0);
  });
});
