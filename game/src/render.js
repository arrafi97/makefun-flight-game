// The 3D view: a chase camera behind the Elang, a projected heightfield
// for the islands, the runway, the rings, clouds, trees and airfield
// buildings — all drawn on one 2D canvas, far to near, with distance fog.
import { drawAircraft } from './aircraft.js';
import {
  RUNWAY, WATER_LEVEL, airfieldProps, cloudSpots, onRunway, terrainColor,
  terrainHeight, treeSpots,
} from './terrain.js';

const FOV = 68 * Math.PI / 180;
const CAM_DIST = 24;
const CAM_HEIGHT = 7.5;
const ROWS = 28;
const COLS = 36;
const FAR = 4200;

const SKY_TOP = [52, 120, 196];
const SKY_HORIZON = [196, 222, 236];
const SUNSET = [255, 190, 120];
const FOG = [196, 222, 236];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function css(c, alpha = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
}

function dot(ax, ay, az, bx, by, bz) {
  return ax * bx + ay * by + az * bz;
}

/** A smoothed chase camera that follows the aircraft without fighting it. */
export function makeCamera() {
  return {
    x: 0, y: 40, z: 0,
    heading: 0, pitch: 0, roll: 0,
    fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0],
  };
}

export function updateCamera(cam, state, dt) {
  const k = 1 - Math.pow(0.0015, dt);
  cam.heading += (state.heading - cam.heading) * k;
  cam.pitch += (state.pitch - cam.pitch) * k;
  cam.roll += (state.roll * 0.45 - cam.roll) * k;
  const sinH = Math.sin(cam.heading);
  const cosH = Math.cos(cam.heading);
  const fx = sinH * Math.cos(cam.pitch);
  const fy = Math.sin(cam.pitch);
  const fz = -cosH * Math.cos(cam.pitch);
  const tx = state.x - fx * CAM_DIST;
  const ty = state.y - fy * CAM_DIST + CAM_HEIGHT;
  const tz = state.z - fz * CAM_DIST;
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.z += (tz - cam.z) * k;
  // Camera basis: forward, right and up, rolled a little with the wing.
  let f = [fx, fy, fz];
  const fl = Math.hypot(f[0], f[1], f[2]);
  f = [f[0] / fl, f[1] / fl, f[2] / fl];
  let r = [Math.cos(cam.heading), 0, Math.sin(cam.heading)];
  const rl = Math.hypot(r[0], r[1], r[2]);
  r = [r[0] / rl, r[1] / rl, r[2] / rl];
  let u = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];
  // Roll the camera around its forward axis.
  const cr = Math.cos(cam.roll);
  const sr = Math.sin(cam.roll);
  const r2 = [
    r[0] * cr + u[0] * sr,
    r[1] * cr + u[1] * sr,
    r[2] * cr + u[2] * sr,
  ];
  const u2 = [
    u[0] * cr - r[0] * sr,
    u[1] * cr - r[1] * sr,
    u[2] * cr - r[2] * sr,
  ];
  cam.fwd = f;
  cam.right = r2;
  cam.up = u2;
}

/** Project a world point to screen space; null when behind the camera. */
export function project(cam, w, h, focal, x, y, z) {
  const vx = x - cam.x;
  const vy = y - cam.y;
  const vz = z - cam.z;
  const cz = dot(vx, vy, vz, cam.fwd[0], cam.fwd[1], cam.fwd[2]);
  if (cz < 1.5) return null;
  const cx = dot(vx, vy, vz, cam.right[0], cam.right[1], cam.right[2]);
  const cy = dot(vx, vy, vz, cam.up[0], cam.up[1], cam.up[2]);
  return {
    x: w / 2 + (cx / cz) * focal,
    y: h * 0.52 - (cy / cz) * focal,
    s: focal / cz,
    d: cz,
  };
}

function drawSky(ctx, w, h, cam, time) {
  const horizonY = h * 0.52 - Math.tan(cam.pitch) * (h / 2) / Math.tan(FOV / 2) * 0.9;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(SKY_TOP));
  g.addColorStop(Math.max(0.25, Math.min(0.75, horizonY / h)), css(SKY_HORIZON));
  g.addColorStop(1, css([222, 232, 238]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Low afternoon sun, west-southwest.
  const sun = project(cam, w, h, (h / 2) / Math.tan(FOV / 2), cam.x - 2600, cam.y + 420, cam.z + 1500);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 130);
    glow.addColorStop(0, 'rgba(255,236,180,0.95)');
    glow.addColorStop(0.25, 'rgba(255,200,120,0.55)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 140, sun.y - 140, 280, 280);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  return horizonY;
}

function shadeColor(base, x, z, h, seed) {
  // Slope shading: faces turned from the sun go darker.
  const e = 14;
  const hx = terrainHeight(x + e, z, seed) - terrainHeight(x - e, z, seed);
  const hz = terrainHeight(x, z + e, seed) - terrainHeight(x, z - e, seed);
  const slope = clamp(1 - (hx * -0.55 + hz * 0.35) / (e * 2) * 0.9, 0.84, 1.07);
  return [base[0] * slope, base[1] * slope, base[2] * slope];
}

function drawTerrain(ctx, cam, w, h, focal, seed, time) {
  const sinH = Math.sin(cam.heading);
  const cosH = Math.cos(cam.heading);
  // View-aligned grid: forward is -z rotated by heading, right is +x.
  const fx = sinH;
  const fz = -cosH;
  const rx = cosH;
  const rz = sinH;
  const near = 26;
  const ratio = Math.pow(FAR / near, 1 / ROWS);
  const depths = [];
  let d = near;
  for (let i = 0; i <= ROWS; i += 1) {
    depths.push(d);
    d *= ratio;
  }
  const groundX = cam.x;
  const groundZ = cam.z;
  // Project the grid row by row, far to near.
  const rowPts = [];
  for (let i = 0; i <= ROWS; i += 1) {
    const depth = depths[i];
    const halfW = 50 + depth * 0.78;
    const pts = [];
    for (let j = 0; j <= COLS; j += 1) {
      const lat = -halfW + (2 * halfW * j) / COLS;
      const wx = groundX + fx * depth + rx * lat;
      const wz = groundZ + fz * depth + rz * lat;
      const wy = terrainHeight(wx, wz, seed);
      const p = project(cam, w, h, focal, wx, wy, wz);
      pts.push({ p, wx, wz, wy });
    }
    rowPts.push(pts);
  }
  for (let i = ROWS - 1; i >= 0; i -= 1) {
    const depth = depths[i];
    const fogT = clamp((depth - 300) / 3200, 0, 0.92);
    for (let j = 0; j < COLS; j += 1) {
      const a = rowPts[i][j];
      const b = rowPts[i][j + 1];
      const c = rowPts[i + 1][j + 1];
      const e = rowPts[i + 1][j];
      if (!a.p || !b.p || !c.p || !e.p) continue;
      const cx = (a.wx + c.wx) / 2;
      const cz = (a.wz + c.wz) / 2;
      const ch = (a.wy + c.wy) / 2;
      let base = terrainColor(cx, cz, ch, seed);
      base = shadeColor(base, cx, cz, ch, seed);
      if (ch < WATER_LEVEL + 0.4) {
        const sparkle = Math.sin(time * 1.7 + cx * 0.11 + cz * 0.13) * 0.5 + 0.5;
        base = mixRgb(base, [190, 225, 240], sparkle * 0.25);
      }
      const col = mixRgb(base, FOG, fogT);
      ctx.fillStyle = css(col);
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(c.p.x, c.p.y);
      ctx.lineTo(e.p.x, e.p.y);
      ctx.closePath();
      ctx.fill();
      // Stroke with the same colour so neighbouring quads never leave a
      // hairline gap between them.
      ctx.strokeStyle = css(col);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawRunway(ctx, cam, w, h, focal, seed) {
  // Paved strip, drawn just above the terrain surface.
  const lift = 0.25;
  const step = 60;
  for (let x = RUNWAY.x0; x < RUNWAY.x1; x += step) {
    const x2 = Math.min(RUNWAY.x1, x + step);
    const y = RUNWAY.elevation + lift;
    const a = project(cam, w, h, focal, x, y, -RUNWAY.halfWidth);
    const b = project(cam, w, h, focal, x2, y, -RUNWAY.halfWidth);
    const c = project(cam, w, h, focal, x2, y, RUNWAY.halfWidth);
    const e = project(cam, w, h, focal, x, y, RUNWAY.halfWidth);
    if (!a || !b || !c || !e) continue;
    const dist = a.d;
    const fogT = clamp((dist - 300) / 3200, 0, 0.92);
    ctx.fillStyle = css(mixRgb([74, 78, 84], FOG, fogT));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(e.x, e.y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes.
    if (Math.floor(x / step) % 2 === 0) {
      const m1 = project(cam, w, h, focal, x + 8, y + 0.05, -1.2);
      const m2 = project(cam, w, h, focal, x + step - 8, y + 0.05, -1.2);
      const m3 = project(cam, w, h, focal, x + step - 8, y + 0.05, 1.2);
      const m4 = project(cam, w, h, focal, x + 8, y + 0.05, 1.2);
      if (m1 && m2 && m3 && m4) {
        ctx.fillStyle = css(mixRgb([240, 240, 235], FOG, fogT));
        ctx.beginPath();
        ctx.moveTo(m1.x, m1.y);
        ctx.lineTo(m2.x, m2.y);
        ctx.lineTo(m3.x, m3.y);
        ctx.lineTo(m4.x, m4.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  // Threshold bars at both ends.
  for (const tx of [RUNWAY.x0 + 12, RUNWAY.x1 - 12]) {
    const y = RUNWAY.elevation + lift + 0.05;
    for (let k = -2; k <= 2; k += 1) {
      const z0 = k * 5.4 - 1.4;
      const a = project(cam, w, h, focal, tx - 14, y, z0);
      const b = project(cam, w, h, focal, tx + 14, y, z0);
      const c = project(cam, w, h, focal, tx + 14, y, z0 + 2.8);
      const e = project(cam, w, h, focal, tx - 14, y, z0 + 2.8);
      if (!a || !b || !c || !e) continue;
      ctx.fillStyle = 'rgba(245,245,240,0.95)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(e.x, e.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawRing(ctx, cam, w, h, focal, ring, isNext, time) {
  const c = project(cam, w, h, focal, ring.x, ring.y, ring.z);
  if (!c) return;
  // The ring faces the pilot: its plane is perpendicular to the course.
  const right = project(cam, w, h, focal, ring.x + ring.r, ring.y, ring.z);
  const up = project(cam, w, h, focal, ring.x, ring.y + ring.r, ring.z);
  if (!right || !up) return;
  const rx = Math.hypot(right.x - c.x, right.y - c.y);
  const ry = Math.hypot(up.x - c.x, up.y - c.y);
  if (rx < 2 || ry < 2) return;
  const pulse = isNext ? 0.75 + Math.sin(time * 4) * 0.25 : 0.5;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(rx / ring.r, ry / ring.r);
  ctx.lineWidth = Math.max(2, Math.min(9, (isNext ? 7 : 5) * (rx / 220)));
  ctx.strokeStyle = isNext ? `rgba(255, 196, 66, ${pulse})` : 'rgba(214, 164, 60, 0.55)';
  ctx.shadowColor = isNext ? 'rgba(255, 180, 40, 0.9)' : 'rgba(0,0,0,0)';
  ctx.shadowBlur = isNext ? 18 : 0;
  ctx.beginPath();
  ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(120, 70, 10, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, ring.r * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (isNext) {
    ctx.fillStyle = 'rgba(255, 214, 110, 0.95)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◉', c.x, c.y - ry - 10);
  }
}

function drawClouds(ctx, cam, w, h, focal, clouds) {
  for (const cloud of clouds) {
    const c = project(cam, w, h, focal, cloud.x, cloud.y, cloud.z);
    if (!c || c.d > 4200) continue;
    const s = cloud.r * c.s;
    if (s < 4) continue;
    // A puff is several overlapping soft circles, not one flat pill.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(c.x - s * 0.42, c.y + s * 0.08, s * 0.42, 0, Math.PI * 2);
    ctx.arc(c.x, c.y - s * 0.1, s * 0.55, 0, Math.PI * 2);
    ctx.arc(c.x + s * 0.45, c.y + s * 0.06, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + s * 0.14, s * 0.85, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrees(ctx, cam, w, h, focal, trees, state) {
  for (const tree of trees) {
    const dx = tree.x - state.x;
    const dz = tree.z - state.z;
    if (dx * dx + dz * dz > 900 * 900) continue;
    const p = project(cam, w, h, focal, tree.x, tree.h, tree.z);
    if (!p || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) continue;
    const s = tree.s * p.s * 0.02;
    if (s < 1.5) continue;
    ctx.fillStyle = '#2c5c33';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 2.4);
    ctx.lineTo(p.x - s, p.y);
    ctx.lineTo(p.x + s, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(p.x - s * 0.12, p.y - s * 0.4, s * 0.24, s * 0.5);
  }
}

function drawProps(ctx, cam, w, h, focal, props, seed) {
  for (const prop of props) {
    const y = terrainHeight(prop.x, prop.z, seed);
    if (prop.kind === 'windsock') {
      const base = project(cam, w, h, focal, prop.x, y, prop.z);
      const top = project(cam, w, h, focal, prop.x, y + 7, prop.z);
      if (!base || !top) continue;
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = Math.max(1, 2 * top.s * 0.02);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x + 14 * top.s * 0.02, top.y + 2);
      ctx.lineTo(top.x, top.y + 5);
      ctx.closePath();
      ctx.fill();
      continue;
    }
    const hw = prop.w / 2;
    const hd = prop.d / 2;
    const corners = [
      [prop.x - hw, y, prop.z - hd],
      [prop.x + hw, y, prop.z - hd],
      [prop.x + hw, y, prop.z + hd],
      [prop.x - hw, y, prop.z + hd],
    ];
    const topCorners = corners.map(([cx, cy, cz]) => [cx, cy + prop.h, cz]);
    const ps = corners.map(([cx, cy, cz]) => project(cam, w, h, focal, cx, cy, cz));
    const ts = topCorners.map(([cx, cy, cz]) => project(cam, w, h, focal, cx, cy, cz));
    if (ps.some((p) => !p) || ts.some((p) => !p)) continue;
    const isTower = prop.kind === 'tower';
    ctx.fillStyle = isTower ? '#dfe6ea' : '#b8c4cc';
    ctx.beginPath();
    ctx.moveTo(ps[1].x, ps[1].y);
    ctx.lineTo(ps[2].x, ps[2].y);
    ctx.lineTo(ts[2].x, ts[2].y);
    ctx.lineTo(ts[1].x, ts[1].y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = isTower ? '#8fb8d8' : '#7d8a94';
    ctx.beginPath();
    ctx.moveTo(ts[0].x, ts[0].y);
    ctx.lineTo(ts[1].x, ts[1].y);
    ctx.lineTo(ts[2].x, ts[2].y);
    ctx.lineTo(ts[3].x, ts[3].y);
    ctx.closePath();
    ctx.fill();
    if (isTower) {
      // A glass cab crowns the tower.
      const cabW = (ts[1].x - ts[0].x) * 0.3;
      ctx.fillStyle = '#2c4a5e';
      ctx.fillRect(ts[1].x - cabW, ts[1].y - 4, cabW * 2, 6);
      ctx.fillStyle = 'rgba(160, 210, 240, 0.9)';
      ctx.fillRect(ts[1].x - cabW + 1, ts[1].y - 3, cabW * 2 - 2, 3);
    }
  }
}

/**
 * Draw one frame of the world: sky, terrain, runway, props, trees, rings,
 * clouds and the aircraft with its shadow. The HUD is drawn separately.
 */
export function drawWorld(ctx, cam, w, h, state, mission, progress, world, time) {
  const focal = (h / 2) / Math.tan(FOV / 2);
  drawSky(ctx, w, h, cam, time);
  drawTerrain(ctx, cam, w, h, focal, world.seed, time);
  drawRunway(ctx, cam, w, h, focal, world.seed);
  drawProps(ctx, cam, w, h, focal, world.props, world.seed);
  drawTrees(ctx, cam, w, h, focal, world.trees, state);
  // Rings, far to near, so the next one reads clearly.
  const rings = mission.rings
    .map((ring, i) => ({ ring, i, d: Math.hypot(ring.x - state.x, ring.z - state.z) }))
    .sort((a, b) => b.d - a.d);
  for (const { ring, i } of rings) {
    if (i < progress.ringIndex) continue;
    drawRing(ctx, cam, w, h, focal, ring, i === progress.ringIndex, time);
  }
  drawClouds(ctx, cam, w, h, focal, world.clouds);
  // The aircraft's shadow on the ground below it.
  const groundY = terrainHeight(state.x, state.z, world.seed);
  const shadow = project(cam, w, h, focal, state.x, groundY + 0.4, state.z);
  if (shadow && state.y - groundY < 260) {
    const s = clamp(90 * shadow.s * 0.02, 2, 90) * clamp(1 - (state.y - groundY) / 260, 0.25, 1);
    ctx.fillStyle = `rgba(20, 30, 20, ${0.28 * clamp(1 - (state.y - groundY) / 260, 0.2, 1)})`;
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The Elang itself, low and centred, banking with the wing.
  const planeScale = clamp(w / 1280, 0.7, 1.15) * 0.66;
  drawAircraft(ctx, w / 2, h * 0.62, planeScale, state.roll * 0.9, state.pitch, time, true);
}
