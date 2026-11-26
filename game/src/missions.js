// Missions for Langit Nusantara: three sorties with different goals, plus
// free flight. Each mission names its spawn, its targets and how it scores,
// and the autopilot that flies its screenshot scenes.
import { RUNWAY } from './terrain.js';

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Kursus Cincin',
    short: 'Cincin',
    brief: 'Terbang melewati 8 cincin emas di atas danau dan sawah. Terbang halus, hemat bahan bakar.',
    spawn: { x: -900, y: 190, z: -420, heading: Math.PI / 2 + 0.35, speed: 52, throttle: 0.62, airborne: true },
    rings: [
      { x: -500, y: 175, z: -180, r: 34 },
      { x: -120, y: 165, z: 60, r: 34 },
      { x: 320, y: 150, z: 260, r: 32 },
      { x: 760, y: 170, z: 520, r: 34 },
      { x: 1120, y: 190, z: 880, r: 36 },
      { x: 900, y: 210, z: 1280, r: 34 },
      { x: 380, y: 200, z: 1420, r: 32 },
      { x: -160, y: 185, z: 1180, r: 34 },
    ],
  },
  {
    id: 'landing',
    name: 'Mendarat di Landasan',
    short: 'Mendarat',
    brief: 'Kamu di ketinggian 380 m, 3 km di barat landasan. Turun perlahan, lurus, dan sentuh landasan dengan lembut.',
    spawn: { x: -2900, y: 380, z: 30, heading: Math.PI / 2, speed: 58, throttle: 0.3, airborne: true },
    rings: [],
  },
  {
    id: 'takeoff',
    name: 'Lepas Landas',
    short: 'Lepas Landas',
    brief: 'Dari ujung barat landasan: gas penuh, lepas landas, lalu naik melewati 3 gerbang di langit.',
    spawn: { x: RUNWAY.x0 + 30, y: RUNWAY.elevation + 0.6, z: 0, heading: Math.PI / 2, speed: 0, throttle: 0, airborne: false },
    rings: [
      { x: 700, y: 150, z: 0, r: 40 },
      { x: 1300, y: 260, z: 120, r: 40 },
      { x: 1900, y: 380, z: 260, r: 44 },
    ],
  },
  {
    id: 'free',
    name: 'Terbang Bebas',
    short: 'Bebas',
    brief: 'Jelajahi kepulauan sesukamu. Cincin emas muncul di jalurmu — lewati sebanyak mungkin.',
    spawn: { x: -900, y: 220, z: -420, heading: Math.PI / 2 + 0.35, speed: 52, throttle: 0.62, airborne: true },
    rings: [
      { x: -500, y: 175, z: -180, r: 34 },
      { x: 320, y: 150, z: 260, r: 32 },
      { x: 1120, y: 190, z: 880, r: 36 },
      { x: 380, y: 200, z: 1420, r: 32 },
    ],
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}

/** Fresh per-sortie progress for a mission. */
export function makeProgress(mission) {
  return {
    missionId: mission.id,
    ringIndex: 0,
    ringsHit: 0,
    score: 0,
    landed: false,
    tookOff: false,
    done: false,
    message: mission.brief,
    messageTime: 0,
    bestLanding: null,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Score a ring pass: the next ring is the one ahead, and the aircraft must
 * be inside its circle. Returns 'ring' when one is flown through.
 */
export function checkRing(progress, mission, state) {
  if (progress.ringIndex >= mission.rings.length) return '';
  const ring = mission.rings[progress.ringIndex];
  const dx = state.x - ring.x;
  const dy = state.y - ring.y;
  const dz = state.z - ring.z;
  if (dx * dx + dy * dy + dz * dz < ring.r * ring.r) {
    progress.ringIndex += 1;
    progress.ringsHit += 1;
    progress.score += 250;
    progress.message = `Cincin ${progress.ringsHit}/${mission.rings.length} — bagus! +250`;
    progress.messageTime = state.time;
    if (progress.ringIndex >= mission.rings.length) {
      progress.done = true;
      progress.score += Math.round(state.fuel) * 5;
      progress.message = 'Misi selesai! Bonus bahan bakar ditambahkan.';
    }
    return 'ring';
  }
  return '';
}

/** Score a completed landing: gentle, slow and centred scores best. */
export function scoreLanding(progress, state) {
  const vs = Math.abs(state.verticalSpeed);
  const centre = 1 - Math.min(1, Math.abs(state.z) / 16);
  const soft = clamp(1 - vs / 3.2, 0, 1);
  const slow = clamp(1 - (state.speed - 30) / 18, 0, 1);
  const points = Math.round(400 + 600 * (soft * 0.5 + centre * 0.3 + slow * 0.2));
  progress.score += points;
  progress.landed = true;
  progress.done = true;
  progress.bestLanding = { vs, speed: state.speed, centre, points };
  progress.message = `Mendarat! +${points} poin — sentuhan ${vs.toFixed(1)} m/s.`;
  progress.messageTime = state.time;
  return points;
}

/**
 * The screenshot autopilot: steers toward the next ring, the runway
 * threshold, or a cruise altitude, with gentle throttle discipline.
 */
export function autopilotInput(state, mission, progress) {
  let targetX = state.x + Math.sin(state.heading) * 400;
  let targetZ = state.z - Math.cos(state.heading) * 400;
  let targetY = 190;
  let wantSpeed = 55;
  if (mission.id === 'landing' && !progress.landed) {
    targetX = RUNWAY.x0 + 60;
    targetZ = 0;
    targetY = Math.max(30, 6 + Math.hypot(state.x - targetX, state.z - targetZ) * 0.09);
    wantSpeed = 42;
  } else if (progress.ringIndex < mission.rings.length) {
    const ring = mission.rings[progress.ringIndex];
    targetX = ring.x;
    targetZ = ring.z;
    targetY = ring.y;
  } else if (mission.id === 'takeoff') {
    targetY = 320;
  }
  const desiredHeading = Math.atan2(targetX - state.x, -(targetZ - state.z));
  let diff = desiredHeading - state.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const roll = clamp(diff * 1.4, -0.8, 0.8);
  const altError = targetY - state.y;
  const pitch = clamp(altError * 0.012, -0.28, 0.3) - (state.speed < 30 ? 0.05 : 0);
  let throttle = 0;
  if (state.speed < wantSpeed - 3) throttle = 1;
  else if (state.speed > wantSpeed + 3) throttle = -1;
  return { pitch: clamp(pitch * 2.2, -1, 1), roll: clamp(roll * 1.6, -1, 1), throttle, brake: false };
}
