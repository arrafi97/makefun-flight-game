// The HUD and the screens: altitude, speed and heading on lit
// instruments, fuel and damage gauges, the mission panel, and the title,
// pause, landing and crash screens — all drawn on the canvas so the
// screenshots show the game as the player sees it.
import { headingDeg, knots } from './physics.js';
import { MISSIONS } from './missions.js';

const PANEL = 'rgba(8, 18, 28, 0.62)';
const PANEL_EDGE = 'rgba(140, 200, 230, 0.5)';
const TEXT = '#eaf6ff';
const AMBER = '#ffc442';
const GREEN = '#5ee88a';
const RED = '#ff5a4e';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx, text, x, y, size, color, align = 'left') {
  ctx.fillStyle = color ?? 'rgba(234,246,255,0.75)';
  ctx.font = `600 ${size}px sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size, align = 'left') {
  ctx.fillStyle = TEXT;
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function drawCompass(ctx, w, heading) {
  const cx = w / 2;
  const y = 26;
  panel(ctx, cx - 190, 10, 380, 34);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 190, 10, 380, 34);
  ctx.clip();
  const deg = headingDeg(heading);
  for (let d = -120; d <= 120; d += 5) {
    let a = Math.round(deg + d);
    a = ((a % 360) + 360) % 360;
    const x = cx + d * 1.5;
    const major = a % 45 === 0;
    ctx.strokeStyle = major ? TEXT : 'rgba(234,246,255,0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x, major ? 30 : 24);
    ctx.stroke();
    if (major) label(ctx, COMPASS_POINTS[(a / 45) | 0], x, 42, 11, TEXT, 'center');
  }
  ctx.restore();
  // The lubber line and the heading readout.
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx, 12);
  ctx.lineTo(cx - 5, 4);
  ctx.lineTo(cx + 5, 4);
  ctx.closePath();
  ctx.fill();
  value(ctx, `${String(Math.round(deg)).padStart(3, '0')}°`, cx, 62, 15, 'center');
}

function drawTape(ctx, x, y, w, h, current, step, unit, format) {
  panel(ctx, x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const centre = y + h / 2;
  const pxPerUnit = (h / 2) / (step * 4);
  const base = Math.floor(current / step) * step;
  for (let v = base - step * 4; v <= base + step * 4; v += step) {
    if (v < 0) continue;
    const yy = centre - (v - current) * pxPerUnit;
    ctx.strokeStyle = 'rgba(234,246,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x + w - 14, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    label(ctx, format(v), x + 8, yy + 4, 12);
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,196,66,0.9)';
  ctx.beginPath();
  ctx.moveTo(x + w, centre - 7);
  ctx.lineTo(x + w, centre + 7);
  ctx.lineTo(x + w - 10, centre);
  ctx.closePath();
  ctx.fill();
  label(ctx, unit, x + 8, y + h + 13, 10, 'rgba(234,246,255,0.6)');
}

function drawGauge(ctx, x, y, w, labelText, fraction, color, warnAt) {
  label(ctx, labelText, x, y - 6, 11);
  panel(ctx, x, y, w, 12);
  const frac = clamp(fraction, 0, 1);
  ctx.fillStyle = frac < warnAt ? RED : color;
  if (frac > 0.01) {
    roundRect(ctx, x + 1, y + 1, (w - 2) * frac, 10, 5);
    ctx.fill();
  }
}

/** A round lit instrument: a dial, a needle and a glowing rim. */
function drawDial(ctx, cx, cy, r, title, needleAngle, readout) {
  ctx.save();
  ctx.shadowColor = 'rgba(120, 220, 255, 0.9)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#0c1a26';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(160, 210, 240, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(234,246,255,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
    ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
    ctx.stroke();
  }
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleAngle) * (r - 12), cy + Math.sin(needleAngle) * (r - 12));
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, title, cx, cy + r + 14, 10, 'rgba(234,246,255,0.7)', 'center');
  value(ctx, readout, cx, cy + r * 0.42, 12, 'center');
}

/** The attitude indicator: a glowing ball with a pitch ladder. */
function drawAttitude(ctx, cx, cy, r, pitch, roll) {
  ctx.save();
  ctx.shadowColor = 'rgba(120, 220, 255, 0.9)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#0c1a26';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(roll);
  const pitchPx = clamp(pitch, -0.6, 0.6) * r * 1.6;
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r, -pitchPx);
  ctx.lineTo(r, -pitchPx);
  ctx.stroke();
  for (const deg of [-20, -10, 10, 20]) {
    const yy = -pitchPx - (deg * Math.PI / 180) * r * 1.6;
    ctx.beginPath();
    ctx.moveTo(-14, yy);
    ctx.lineTo(14, yy);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(160, 210, 240, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings of the miniature aircraft.
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx - r * 0.12, cy);
  ctx.moveTo(cx + r * 0.12, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, 'SIKAP', cx, cy + r + 14, 10, 'rgba(234,246,255,0.7)', 'center');
}

/** The full in-flight HUD over the world frame. */
export function drawHud(ctx, w, h, state, mission, progress, time) {
  drawCompass(ctx, w, state.heading);
  drawTape(ctx, 16, 60, 92, 190, knots(state.speed), 10, 'KT', (v) => `${v}`);
  drawTape(ctx, w - 108, 60, 92, 190, state.y, 50, 'M', (v) => `${v}`);
  // Vertical speed under the altitude tape.
  const vs = state.verticalSpeed;
  panel(ctx, w - 108, 258, 92, 26);
  value(ctx, `${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`, w - 62, 277, 13, 'center');

  // Throttle, fuel and damage, bottom left.
  drawGauge(ctx, 16, h - 84, 170, 'GAS', state.throttle, AMBER, 0.2);
  drawGauge(ctx, 16, h - 56, 170, `BAHAN BAKAR ${Math.round(state.fuel)}%`, state.fuel / 100, GREEN, 0.2);
  drawGauge(ctx, 16, h - 28, 170, `KERUSAKAN ${Math.round(state.damage)}%`, state.damage / 100, RED, 0.6);

  // Lit instruments, bottom centre-right.
  drawAttitude(ctx, w / 2 - 130, h - 78, 42, state.pitch, state.roll);
  drawDial(ctx, w / 2 + 10, h - 78, 34, 'KECEPATAN', -Math.PI / 2 + (knots(state.speed) / 160) * Math.PI * 1.5, `${Math.round(knots(state.speed))} kt`);
  drawDial(ctx, w / 2 + 96, h - 78, 34, 'KETINGGIAN', -Math.PI / 2 + (state.y / 600) * Math.PI * 1.5, `${Math.round(state.y)} m`);

  // Mission panel, right side below the altitude tape.
  panel(ctx, w - 268, 296, 252, 96);
  label(ctx, mission.name.toUpperCase(), w - 256, 316, 12, AMBER);
  const target = mission.id === 'landing'
    ? (progress.landed ? 'Mendarat ✓' : 'Mendarat di landasan 09')
    : `Cincin ${progress.ringsHit}/${mission.rings.length}`;
  value(ctx, target, w - 256, 340, 16);
  value(ctx, `Skor ${progress.score}`, w - 256, 364, 14);
  label(ctx, 'W/S gas · ←→ belok · ↑↓ hidung · Spasi rem', w - 256, 384, 10);

  // Mission message banner.
  if (state.time - progress.messageTime < 5 && progress.message) {
    ctx.font = '600 15px sans-serif';
    const tw = ctx.measureText(progress.message).width;
    panel(ctx, w / 2 - tw / 2 - 16, 78, tw + 32, 32);
    value(ctx, progress.message, w / 2, 99, 15, 'center');
  }

  // Warnings, centre screen.
  const warnings = [];
  if (state.speed < 30 && state.airborne) warnings.push('STALL — TAMBAH GAS');
  if (state.fuel < 20) warnings.push('BAHAN BAKAR RENDAH');
  if (state.damage > 60) warnings.push('KERUSAKAN PARAH');
  if (state.agl < 20 && state.verticalSpeed < -1 && state.airborne) warnings.push('MEDAN DI DEPAN');
  if (warnings.length && Math.sin(time * 8) > -0.2) {
    ctx.font = 'bold 20px sans-serif';
    const text = warnings.join('  ·  ');
    const tw = ctx.measureText(text).width;
    panel(ctx, w / 2 - tw / 2 - 14, h * 0.3, tw + 28, 36);
    ctx.fillStyle = RED;
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h * 0.3 + 24);
  }
}

function bigButton(ctx, cx, y, w, text, active) {
  ctx.fillStyle = active ? 'rgba(255,196,66,0.95)' : 'rgba(10, 24, 36, 0.8)';
  roundRect(ctx, cx - w / 2, y, w, 44, 8);
  ctx.fill();
  ctx.strokeStyle = active ? '#ffd66e' : PANEL_EDGE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = active ? '#1a2a1a' : TEXT;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y + 28);
}

/** Title screen with the mission list. */
export function drawTitle(ctx, w, h, selected, time) {
  ctx.fillStyle = 'rgba(6, 16, 26, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('LANGIT NUSANTARA', w / 2, h * 0.2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = AMBER;
  ctx.font = '600 20px sans-serif';
  ctx.fillText('Terbang di atas kepulauan — cincin, landasan, dan langit sore', w / 2, h * 0.2 + 36);
  let y = h * 0.34;
  MISSIONS.forEach((mission, i) => {
    bigButton(ctx, w / 2, y, 460, `${i + 1}. ${mission.name}`, i === selected);
    ctx.fillStyle = 'rgba(234,246,255,0.85)';
    ctx.font = '13px sans-serif';
    ctx.fillText(mission.brief, w / 2, y + 62);
    y += 92;
  });
  ctx.fillStyle = TEXT;
  ctx.font = '15px sans-serif';
  ctx.fillText('Pilih misi dengan tombol 1–4 atau klik, lalu tekan Enter untuk terbang.', w / 2, y + 8);
  ctx.fillStyle = 'rgba(234,246,255,0.75)';
  ctx.font = '13px sans-serif';
  ctx.fillText('W/S gas · panah kiri/kanan belok · panah atas/bawah hidung · Spasi rem udara · M suara · P jeda', w / 2, y + 34);
  if (Math.sin(time * 3) > -0.3) {
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('— tekan Enter —', w / 2, y + 62);
  }
}

export function drawPause(ctx, w, h) {
  ctx.fillStyle = 'rgba(6, 16, 26, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('JEDA', w / 2, h / 2 - 10);
  ctx.font = '16px sans-serif';
  ctx.fillText('Tekan P untuk lanjut · R untuk mulai lagi · Esc ke menu', w / 2, h / 2 + 26);
}

export function drawEnd(ctx, w, h, title, lines, score) {
  ctx.fillStyle = 'rgba(6, 16, 26, 0.6)';
  ctx.fillRect(0, 0, w, h);
  panel(ctx, w / 2 - 260, h / 2 - 130, 520, 260);
  ctx.fillStyle = title.includes('Mendarat') || title.includes('selesai') ? GREEN : AMBER;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, h / 2 - 78);
  ctx.fillStyle = TEXT;
  ctx.font = '16px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 34 + i * 26));
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`Skor akhir: ${score}`, w / 2, h / 2 + 62);
  ctx.fillStyle = 'rgba(234,246,255,0.8)';
  ctx.font = '14px sans-serif';
  ctx.fillText('Tekan R untuk terbang lagi · Esc ke menu', w / 2, h / 2 + 96);
}
