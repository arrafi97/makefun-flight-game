// Seeded randomness for Langit Nusantara: every random choice in the game
// comes from here, so a seed always rebuilds the same islands, fields and
// clouds, and a screenshot query always renders the same frame.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 2D hash in [0, 1) for integer lattice points. */
export function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0, 1). */
export function valueNoise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal noise in roughly [0, 1): 4 octaves of value noise. */
export function fbm2(x, z, seed) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let octave = 0; octave < 4; octave += 1) {
    sum += amp * valueNoise2(x * freq, z * freq, seed + octave * 101);
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
}

/** Pick one of `items` with the seeded random function `rand`. */
export function pick(rand, items) {
  return items[Math.floor(rand() * items.length)];
}
