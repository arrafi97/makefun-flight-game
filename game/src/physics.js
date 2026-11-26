// Arcade flight model for Langit Nusantara: throttle, lift, drag, stall,
// banked turns and ground contact. It rewards gentle throttle and turn
// discipline and punishes hot, steep flying — the decisions the missions
// are built around.
import { onRunway, terrainHeight } from './terrain.js';

export const STALL_SPEED = 26; // m/s: below this the wing stops flying
export const MAX_SPEED = 92; // m/s at full throttle, level flight
export const TAKEOFF_SPEED = 34;

const GRAVITY = 9.81;
const THRUST_ACCEL = 24; // m/s^2 at full throttle
const DRAG_K = 0.0032;
const ROLL_RATE = 1.9; // rad/s at full deflection
const PITCH_RATE = 1.15;
const TURN_K = 0.55;

/** A fresh aircraft state for a mission start. */
export function makeFlightState(spawn) {
  return {
    x: spawn.x, y: spawn.y, z: spawn.z,
    heading: spawn.heading, // radians, 0 = north (-z), grows clockwise
    pitch: spawn.pitch ?? 0,
    roll: spawn.roll ?? 0,
    speed: spawn.speed ?? 0,
    throttle: spawn.throttle ?? 0,
    fuel: 100,
    damage: 0,
    airborne: spawn.airborne ?? false,
    verticalSpeed: 0,
    agl: 0,
    grounded: !spawn.airborne,
    time: 0,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Advance the flight state by `dt` seconds under `input`
 * {pitch: -1..1, roll: -1..1, throttle: -1..1, brake: bool}.
 * Returns an event string: 'takeoff' | 'landed' | 'crash' | ''.
 */
export function stepFlight(state, input, dt, seed) {
  state.time += dt;
  const ground = terrainHeight(state.x, state.z, seed);
  const onStrip = onRunway(state.x, state.z);

  // Throttle: W/S keys move it, fuel starvation pins it at idle.
  state.throttle = clamp(state.throttle + (input.throttle ?? 0) * dt * 0.7, 0, 1);
  if (state.fuel <= 0) state.throttle = 0;

  const authority = clamp(state.speed / STALL_SPEED, 0.25, 1);
  state.roll = clamp(state.roll + (input.roll ?? 0) * ROLL_RATE * authority * dt, -1.15, 1.15);
  state.roll *= Math.pow(0.35, dt); // the wing levels itself when released
  state.pitch = clamp(state.pitch + (input.pitch ?? 0) * PITCH_RATE * authority * dt, -0.5, 0.6);
  state.pitch *= Math.pow(0.55, dt);

  // A banked wing turns the nose: the tighter the bank, the harder the turn.
  // Heading grows clockwise (north -> east -> south), so a right bank
  // (positive roll) turns the nose right, toward a larger heading.
  const turnRate = Math.tan(state.roll) * GRAVITY / Math.max(state.speed, 12) * TURN_K;
  state.heading += turnRate * dt;

  // Thrust fights drag; a steep climb costs speed, a dive buys it.
  const drag = DRAG_K * state.speed * state.speed + (input.brake ? 14 : 0);
  const climbFactor = Math.sin(state.pitch);
  let accel = state.throttle * THRUST_ACCEL - drag - GRAVITY * climbFactor * 1.4;
  state.speed = Math.max(0, state.speed + accel * dt);

  // Lift: enough speed and the wing carries the climb; too slow and the
  // aircraft sinks no matter what the nose says.
  const liftFactor = clamp((state.speed * state.speed) / (STALL_SPEED * STALL_SPEED), 0, 1.25);
  const climbRate = state.speed * Math.sin(state.pitch) * liftFactor
    - (1 - liftFactor) * 7;
  state.verticalSpeed = climbRate;

  const sinH = Math.sin(state.heading);
  const cosH = Math.cos(state.heading);
  const forwardX = sinH * Math.cos(state.pitch);
  const forwardZ = -cosH * Math.cos(state.pitch);
  state.x += forwardX * state.speed * dt;
  state.z += forwardZ * state.speed * dt;
  state.y += climbRate * dt;

  // Fuel burns with the throttle; gliding sips it.
  state.fuel = Math.max(0, state.fuel - (0.22 + state.throttle * 0.85) * dt);

  // Keep the sortie inside the charted islands.
  const radius = Math.hypot(state.x, state.z);
  if (radius > 3900) {
    const pull = Math.atan2(-state.x, -state.z);
    let diff = pull - state.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.heading += clamp(diff, -1, 1) * dt * 0.8;
  }

  const clearance = state.y - ground;
  state.agl = clearance;
  if (!state.airborne && state.speed >= TAKEOFF_SPEED && climbRate > 0.5) {
    state.airborne = true;
    state.grounded = false;
    return 'takeoff';
  }
  if (clearance <= 0.6) {
    state.y = ground + 0.6;
    if (!state.airborne) {
      // Rolling on the ground: friction and the brake slow the aircraft.
      state.speed = Math.max(0, state.speed - (2.2 + (input.brake ? 9 : 0)) * dt);
      state.pitch = 0;
      state.roll *= Math.pow(0.2, dt);
      return '';
    }
    // Coming down: a gentle touchdown on the strip is a landing; a rough
    // one on the strip bends the aircraft and bounces it back up; anywhere
    // else the terrain wins.
    const hard = -climbRate;
    const aligned = Math.abs(Math.sin(state.heading - Math.PI / 2)) < 0.35
      || Math.abs(Math.sin(state.heading + Math.PI / 2)) < 0.35;
    if (onStrip && hard < 3.2 && state.speed < 48 && aligned) {
      state.airborne = false;
      state.grounded = true;
      state.pitch = 0;
      state.roll = 0;
      return 'landed';
    }
    if (onStrip && hard < 6.5 && state.speed < 58) {
      state.damage += hard * 9;
      state.y = ground + 2.5;
      state.pitch = 0.12;
      state.speed *= 0.85;
      if (state.damage >= 100) return 'crash';
      return 'bounce';
    }
    state.damage = 100;
    state.speed *= 0.3;
    state.airborne = false;
    state.grounded = true;
    return 'crash';
  }
  if (state.damage >= 100) return 'crash';
  return '';
}

/** Human-readable speed in knots for the HUD. */
export function knots(speedMs) {
  return speedMs * 1.94384;
}

/** Compass heading in degrees, 0 = north. */
export function headingDeg(heading) {
  return ((heading * 180 / Math.PI) % 360 + 360) % 360;
}
