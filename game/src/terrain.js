// Terrain of the Nusantara archipelago: one seeded heightfield with a coastal
// airfield, a lake to the south, rice fields, forest hills and open sea to
// the east. Everything the renderer and the physics need reads from here.
import { fbm2, hash2, mulberry32, valueNoise2 } from './rng.js';

export const WATER_LEVEL = 2.0;
export const RUNWAY = {
  // Runway 09/27: a flat strip along the x axis, centred on the origin.
  x0: -420, x1: 420, halfWidth: 16, elevation: 6, headingDeg: 90,
};
export const AIRFIELD = { x: 0, z: 0 };

const HILL_AMP = 62;
const HILL_SCALE = 0.00042;
const FIELD_SCALE = 0.0016;

/** Raw rolling height before the airfield is flattened into it. */
function rawHeight(x, z, seed) {
  const hills = fbm2(x * HILL_SCALE, z * HILL_SCALE, seed);
  const ridge = valueNoise2(x * 0.00012 + 40, z * 0.00012 + 9, seed + 7);
  // A broad basin south of the airfield becomes the lake; the east falls
  // away to the sea.
  const lakeDip = Math.max(0, (z - 650) / 1400) * 26;
  const seaDip = Math.max(0, (x - 2400) / 1200) * 30;
  const mountain = Math.max(0, ridge - 0.62) * 260 * Math.max(0, 1 - Math.hypot(x + 2600, z + 1800) / 2600);
  return 4 + hills * HILL_AMP + mountain - lakeDip - seaDip;
}

/** Height of the ground in metres at world (x, z). */
export function terrainHeight(x, z, seed) {
  let h = rawHeight(x, z, seed);
  // Flatten a generous apron around the runway so the strip and its
  // taxiway sit on level ground.
  const along = Math.max(RUNWAY.x0, Math.min(RUNWAY.x1, x));
  const dRunway = Math.hypot(x - along, z);
  const flat = Math.max(0, 1 - dRunway / 620);
  const blend = flat * flat * (3 - 2 * flat);
  return h * (1 - blend) + RUNWAY.elevation * blend;
}

/** True when the world point sits on the paved runway strip. */
export function onRunway(x, z) {
  return x >= RUNWAY.x0 && x <= RUNWAY.x1 && Math.abs(z) <= RUNWAY.halfWidth;
}

/** True when the point is on the grass apron beside the runway. */
export function onApron(x, z) {
  return x >= RUNWAY.x0 - 90 && x <= RUNWAY.x1 + 90 && Math.abs(z) <= 90;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixRgb(a, b, t) {
  return [lerp(a[0], b[0], t) | 0, lerp(a[1], b[1], t) | 0, lerp(a[2], b[2], t) | 0];
}

const GRASS_A = [96, 158, 74];
const GRASS_B = [74, 138, 66];
const FOREST = [43, 102, 52];
const WHEAT = [198, 166, 82];
const PADDY = [124, 176, 96];
const SAND = [216, 196, 143];
const ROCK = [138, 125, 111];
const WATER_DEEP = [24, 92, 128];
const WATER_SHALLOW = [64, 158, 192];

/**
 * Base ground colour at (x, z): patchwork fields, forest, beach and water,
 * before slope shading and distance fog.
 */
export function terrainColor(x, z, h, seed) {
  if (h < WATER_LEVEL - 1.2) return WATER_DEEP;
  if (h < WATER_LEVEL + 0.6) {
    const t = Math.max(0, Math.min(1, (h - (WATER_LEVEL - 1.2)) / 1.8));
    return mixRgb(WATER_DEEP, WATER_SHALLOW, t);
  }
  if (h < WATER_LEVEL + 2.2) return SAND;
  const patch = valueNoise2(x * FIELD_SCALE, z * FIELD_SCALE, seed + 31);
  const field = valueNoise2(x * FIELD_SCALE * 0.23 + 7, z * FIELD_SCALE * 0.23 + 3, seed + 55);
  let color;
  if (field > 0.56) color = mixRgb(GRASS_A, WHEAT, Math.min(1, (field - 0.56) * 4));
  else if (field > 0.47) color = mixRgb(GRASS_A, PADDY, Math.min(1, (field - 0.47) * 6));
  else color = mixRgb(GRASS_A, GRASS_B, patch);
  if (patch > 0.68 && h > 14) color = mixRgb(color, FOREST, Math.min(1, (patch - 0.68) * 5));
  if (h > 58) color = mixRgb(color, ROCK, Math.min(1, (h - 58) / 30));
  return color;
}

/** A few buildings and windsocks around the airfield, for the eye to find. */
export function airfieldProps(seed) {
  const rand = mulberry32(seed + 900);
  const props = [];
  for (let i = 0; i < 5; i += 1) {
    props.push({
      kind: 'hangar',
      x: -330 + i * 30 + rand() * 8,
      z: 96 + (i % 2) * 22,
      w: 20, d: 15, h: 7 + rand() * 2,
    });
  }
  props.push({ kind: 'tower', x: -60, z: 92, w: 8, d: 8, h: 20 });
  props.push({ kind: 'windsock', x: 300, z: 42 });
  props.push({ kind: 'windsock', x: -360, z: -44 });
  return props;
}

/** Scattered trees, seeded and fixed: only those near the camera are drawn. */
export function treeSpots(seed, count) {
  const rand = mulberry32(seed + 4242);
  const spots = [];
  for (let i = 0; i < count; i += 1) {
    const x = (rand() * 2 - 1) * 3800;
    const z = (rand() * 2 - 1) * 3800;
    const h = terrainHeight(x, z, seed);
    if (h < WATER_LEVEL + 2 || onApron(x, z)) continue;
    if (hash2(Math.floor(x / 90), Math.floor(z / 90), seed + 31) > 0.62) continue;
    spots.push({ x, z, h, s: 5 + rand() * 7 });
  }
  return spots;
}

/** Puffy clouds drifting high above the islands. */
export function cloudSpots(seed, count) {
  const rand = mulberry32(seed + 777);
  const spots = [];
  for (let i = 0; i < count; i += 1) {
    spots.push({
      x: (rand() * 2 - 1) * 4200,
      z: (rand() * 2 - 1) * 4200,
      y: 260 + rand() * 180,
      r: 60 + rand() * 130,
    });
  }
  return spots;
}
