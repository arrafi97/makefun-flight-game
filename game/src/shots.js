// Deterministic screenshot scenes: each one plays the real game forward
// from a fresh start for a fixed number of steps, steered by the autopilot,
// so the frame is what a short sortie really looks like and the same seed
// always gives the same frame. The game reads ?shot=<name>&seed=<n>.
import { makeFlightState, stepFlight } from './physics.js';
import { autopilotInput, checkRing, makeProgress, missionById, scoreLanding } from './missions.js';
import { RUNWAY } from './terrain.js';
import { makeCamera, updateCamera } from './render.js';

const STEP = 1 / 60;

function simulate(state, mission, progress, cam, seed, seconds, stopWhen) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = autopilotInput(state, mission, progress);
    const event = stepFlight(state, input, STEP, seed);
    checkRing(progress, mission, state);
    if (event === 'landed') scoreLanding(progress, state);
    if (event === 'takeoff') progress.tookOff = true;
    updateCamera(cam, state, STEP);
    if (stopWhen && stopWhen(state, progress)) break;
    if (event === 'crash') break;
  }
}

export const SHOTS = {
  cover: { mission: 'rings', seconds: 11, label: 'Kursus cincin di atas danau' },
  play: { mission: 'rings', seconds: 26, label: 'Belokan tajam di atas sawah' },
  landing: { mission: 'landing', seconds: 75, label: 'Pendekatan akhir ke landasan 09' },
  takeoff: { mission: 'takeoff', seconds: 12, label: 'Lepas landas dari landasan 09' },
};

/**
 * Stage the named scene and return the world state to render: the mission,
 * its progress, the aircraft state, the settled chase camera and the
 * simulated time. Any other name stages the cover.
 */
export function stageShot(name, seed) {
  const shot = SHOTS[name] ?? SHOTS.cover;
  const mission = missionById(shot.mission);
  const state = makeFlightState(mission.spawn);
  const progress = makeProgress(mission);
  const cam = makeCamera();
  cam.heading = state.heading;
  cam.x = state.x - Math.sin(state.heading) * 24;
  cam.z = state.z + Math.cos(state.heading) * 24;
  cam.y = state.y + 7.5;
  updateCamera(cam, state, 0.5);
  let stopWhen = null;
  if (name === 'landing') {
    stopWhen = (s) => Math.hypot(s.x - (RUNWAY.x0 + 60), s.z) < 520;
  }
  if (name === 'takeoff') {
    stopWhen = (s) => s.speed >= 38;
  }
  simulate(state, mission, progress, cam, seed, shot.seconds, stopWhen);
  // Let the camera settle on the final frame.
  for (let i = 0; i < 40; i += 1) updateCamera(cam, state, STEP);
  progress.message = shot.label;
  progress.messageTime = state.time;
  return { mission, state, progress, cam, seed, time: state.time };
}
