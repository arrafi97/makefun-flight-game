// Langit Nusantara: the game loop, the screens and the wiring between the
// flight model, the renderer, the HUD, the sound and the input. It also
// honours ?shot=<name>&seed=<n>, which stages one deterministic frame for
// a screenshot and then stops.
import { drawAircraft } from './aircraft.js';
import {
  makeSoundEngine, playCrash, playFanfare, playRing, playTouchdown,
  startSound, toggleMute, updateSound,
} from './audio.js';
import {
  drawEnd, drawHud, drawPause, drawTitle,
} from './hud.js';
import { attachInput, clearPressed, makeInput, readFlightInput, wasPressed } from './input.js';
import {
  checkRing, makeProgress, missionById, MISSIONS, scoreLanding,
} from './missions.js';
import { makeFlightState, stepFlight } from './physics.js';
import { drawWorld, makeCamera, updateCamera } from './render.js';
import { stageShot } from './shots.js';
import {
  airfieldProps, cloudSpots, terrainHeight, treeSpots,
} from './terrain.js';

const WIDTH = 1280;
const HEIGHT = 720;
const STEP = 1 / 60;

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '20261126', 10) || 20261126;
const shotName = params.get('shot');

const canvas = document.getElementById('game');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const ctx = canvas.getContext('2d');

const world = {
  seed,
  props: airfieldProps(seed),
  trees: treeSpots(seed, 900),
  clouds: cloudSpots(seed, 40),
};

const input = makeInput();
const sound = makeSoundEngine();
const cam = makeCamera();

let screen = 'title';
let selected = 0;
let mission = MISSIONS[0];
let state = makeFlightState(mission.spawn);
let progress = makeProgress(mission);
let endTitle = '';
let endLines = [];
let accumulator = 0;
let lastTime = 0;
let demoTime = 0;

function startMission(index) {
  selected = index;
  mission = MISSIONS[index];
  state = makeFlightState(mission.spawn);
  progress = makeProgress(mission);
  cam.heading = state.heading;
  cam.x = state.x - Math.sin(state.heading) * 24;
  cam.z = state.z + Math.cos(state.heading) * 24;
  cam.y = state.y + 7.5;
  updateCamera(cam, state, 1);
  screen = 'play';
  startSound(sound);
}

function backToTitle() {
  screen = 'title';
  mission = MISSIONS[0];
  state = makeFlightState(mission.spawn);
  progress = makeProgress(mission);
  demoTime = 0;
}

function endSortie(title, lines) {
  endTitle = title;
  endLines = lines;
  screen = 'end';
}

function stepGame(dt) {
  const flightInput = readFlightInput(input);
  const event = stepFlight(state, flightInput, dt, seed);
  if (event === 'ring') {
    // checkRing reports the ring; the sound plays there.
  }
  const ringEvent = checkRing(progress, mission, state);
  if (ringEvent === 'ring') playRing(sound);
  if (event === 'takeoff') {
    progress.tookOff = true;
    progress.message = 'Lepas landas! Naik dan jaga kecepatan.';
    progress.messageTime = state.time;
  }
  if (event === 'bounce') {
    progress.message = `Sentuhan kasar! Kerusakan ${Math.round(state.damage)}%.`;
    progress.messageTime = state.time;
    playTouchdown(sound);
  }
  if (event === 'landed') {
    playTouchdown(sound);
    if (mission.id === 'landing') {
      const points = scoreLanding(progress, state);
      playFanfare(sound);
      endSortie('Mendarat dengan selamat', [
        `Kecepatan sentuh ${state.speed.toFixed(0)} m/s · turun ${Math.abs(state.verticalSpeed).toFixed(1)} m/s`,
        `Posisi di landasan: ${Math.abs(state.z).toFixed(0)} m dari garis tengah`,
        `Poin pendaratan: ${points}`,
      ]);
      return;
    }
    progress.message = 'Mendarat. Tekan W untuk gas penuh dan lepas landas lagi.';
    progress.messageTime = state.time;
  }
  if (event === 'crash') {
    playCrash(sound);
    const reason = state.y <= terrainHeight(state.x, state.z, seed) + 1
      ? 'Pesawat menabrak medan.'
      : 'Pesawat rusak parah.';
    endSortie('Pesawat jatuh', [reason, `Kerusakan ${Math.round(state.damage)}% · bahan bakar ${Math.round(state.fuel)}%`, 'Terbang lebih pelan dan jaga ketinggian.']);
    return;
  }
  if (progress.done) {
    playFanfare(sound);
    endSortie('Misi selesai!', [
      `Semua cincin terlewati · ${progress.ringsHit} cincin`,
      `Bahan bakar tersisa ${Math.round(state.fuel)}%`,
      'Terbang yang rapi — throttle dan belokan terjaga.',
    ]);
    return;
  }
  if (state.fuel <= 0 && state.airborne) {
    progress.message = 'Bahan bakar habis — meluncur! Cari tempat mendarat.';
    progress.messageTime = state.time;
  }
  updateSound(sound, state);
}

function render(time) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawWorld(ctx, cam, WIDTH, HEIGHT, state, mission, progress, world, time);
  if (screen === 'play' || screen === 'shot') drawHud(ctx, WIDTH, HEIGHT, state, mission, progress, time);
  if (screen === 'title') drawTitle(ctx, WIDTH, HEIGHT, selected, time);
  if (screen === 'pause') {
    drawHud(ctx, WIDTH, HEIGHT, state, mission, progress, time);
    drawPause(ctx, WIDTH, HEIGHT);
  }
  if (screen === 'end') {
    drawHud(ctx, WIDTH, HEIGHT, state, mission, progress, time);
    drawEnd(ctx, WIDTH, HEIGHT, endTitle, endLines, progress.score);
  }
}

function handleKeys() {
  if (wasPressed(input, 'enter') || wasPressed(input, ' ')) {
    startSound(sound);
    if (screen === 'title') startMission(selected);
    else if (screen === 'end') backToTitle();
  }
  if (screen === 'title') {
    for (let i = 0; i < MISSIONS.length; i += 1) {
      if (wasPressed(input, String(i + 1))) selected = i;
    }
    if (wasPressed(input, 'arrowdown')) selected = (selected + 1) % MISSIONS.length;
    if (wasPressed(input, 'arrowup')) selected = (selected - 1 + MISSIONS.length) % MISSIONS.length;
    if (input.clicked) {
      const y0 = HEIGHT * 0.34;
      for (let i = 0; i < MISSIONS.length; i += 1) {
        const y = y0 + i * 92;
        if (Math.abs(input.mouseX - WIDTH / 2) < 230 && input.mouseY > y && input.mouseY < y + 44) {
          startMission(i);
        }
      }
    }
  }
  if (screen === 'play' && wasPressed(input, 'p')) screen = 'pause';
  else if (screen === 'pause' && wasPressed(input, 'p')) screen = 'play';
  if ((screen === 'play' || screen === 'pause' || screen === 'end') && wasPressed(input, 'r')) startMission(selected);
  if (screen !== 'title' && wasPressed(input, 'escape')) backToTitle();
  if (wasPressed(input, 'm')) toggleMute(sound);
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000 || STEP);
  lastTime = now;
  handleKeys();
  if (screen === 'play') {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      stepGame(STEP);
      updateCamera(cam, state, STEP);
      accumulator -= STEP;
      steps += 1;
      if (screen !== 'play') break;
    }
  } else if (screen === 'title') {
    // A quiet demo flight drifts behind the title screen.
    demoTime += dt;
    const demoInput = { pitch: 0, roll: Math.sin(demoTime * 0.12) * 0.25, throttle: 0, brake: false };
    stepFlight(state, demoInput, dt, seed);
    if (state.y < terrainHeight(state.x, state.z, seed) + 30) {
      state = makeFlightState(mission.spawn);
    }
    updateCamera(cam, state, dt);
  }
  render(now / 1000);
  clearPressed(input);
  if (screen !== 'shot') requestAnimationFrame(frame);
}

attachInput(input, canvas);

// Screenshot mode: stage one deterministic frame, draw it, and stop.
if (shotName) {
  const staged = stageShot(shotName, seed);
  mission = staged.mission;
  state = staged.state;
  progress = staged.progress;
  Object.assign(cam, staged.cam);
  screen = 'shot';
  render(staged.time);
  window.__langitShotDone = true;
  window.__langit = { state, mission, progress };
} else {
  // The title screen opens over a live demo flight of the ring course.
  state = makeFlightState(MISSIONS[0].spawn);
  cam.heading = state.heading;
  cam.x = state.x - Math.sin(state.heading) * 24;
  cam.z = state.z + Math.cos(state.heading) * 24;
  cam.y = state.y + 7.5;
  updateCamera(cam, state, 1);
  requestAnimationFrame(frame);
}
