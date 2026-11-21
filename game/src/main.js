// SOLMAR BAY — entry point: game state, the loop, and the wiring.
// Every system lives in its own module; this file owns the shared state
// and the frame: read input, update systems, render, update the HUD.

import { WORLD, WEAPONS, PLACES } from './config.js';
import { clamp, dist, rand, pick } from './util.js';
import { createInput } from './input.js';
import { buildCity, prerenderCity, blockedByBuilding, nearestRoadPoint, districtAt } from './city.js';
import { createAudio } from './audio.js';
import { spawnTraffic, spawnParked, spawnPeds, updateTraffic, updatePeds } from './entities.js';
import { makePlayer, updatePlayer, hurtPlayer } from './player.js';
import { updateBullets, playerShoot, playerMelee } from './combat.js';
import { spawnWanted, updatePolice, trySpray } from './police.js';
import { makeMissionState, updateMissions, updateRivals, startMission, currentMission, missionTarget } from './missions.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { applyScene } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const sceneName = params.get('scene');
const snapMode = params.get('snap') === '1';

// --- shared state -----------------------------------------------------------
const state = {
  time: 0,
  dayTime: 0.42, // 0..1, 0.42 is late afternoon
  mode: 'menu', // menu | playing | paused | dead
  vista: false,
  snap: snapMode,
  player: makePlayer(),
  missions: makeMissionState(),
  city: null,
  cityLayer: null,
  cars: [],
  peds: [],
  copCars: [],
  cops: [],
  roadblocks: [],
  heli: null,
  rivals: [],
  bullets: [],
  sparks: [],
  explosions: [],
  coins: [],
  heat: 0,
  wanted: 0,
  seenTimer: 0,
  coolTimer: 0,
  cooldown: 0,
  muzzle: 0,
  shake: 0,
  shotsFired: 0,
  hintText: '',
  keysPressed: new Set(),
  camera: { x: 0, y: 0, w: 1280, h: 800 },
  input: null,
  audio: createAudio(),
  ui: null,
  renderer: null,
};

// Helpers the modules call back into.
state.cityBlocked = (x, y) => blockedByBuilding(state.city, x, y, 0);
state.nearestRoad = (x, y) => nearestRoadPoint(x, y);
state.missionTarget = () => missionTarget(state);
state.saveGame = (silent) => saveGame(state, silent);
state.toast = (text) => state.ui.showToast(text);

state.addHeat = (amount) => {
  const before = state.wanted;
  state.heat = clamp(state.heat + amount, 0, 5);
  state.wanted = Math.min(5, Math.floor(state.heat));
  if (state.wanted > before) {
    spawnWanted(state);
    state.audio.setSiren(state.wanted > 0);
    if (state.wanted >= 2) state.toast(`Wanted level ${state.wanted} — the Bay PD is on you`);
  }
};

state.onCopDown = (cop) => {
  state.addHeat(0.4);
  state.player.respect += 5;
};

state.onRivalDown = (rival) => {
  state.missions.kills += 1;
  state.player.respect += 20;
  state.player.cash += 25;
  state.sparks.push({ x: rival.x, y: rival.y, life: 0.3, color: '#ff5a5a' });
};

// --- world setup ------------------------------------------------------------
function scatterCoins() {
  state.coins = [];
  for (let i = 0; i < 24; i++) {
    const p = nearestRoadPoint(rand(400, WORLD.w - 400), rand(400, WORLD.h - 400));
    state.coins.push({ x: p.x + rand(-120, 120), y: p.y + rand(-120, 120) });
  }
}

function buildWorld() {
  state.city = buildCity();
  state.cityLayer = prerenderCity(state.city);
  state.cars = [];
  state.peds = [];
  state.copCars = [];
  state.cops = [];
  state.roadblocks = [];
  state.heli = null;
  state.bullets = [];
  state.sparks = [];
  state.explosions = [];
  state.heat = 0;
  state.wanted = 0;
  spawnTraffic(state, 26);
  spawnParked(state, 22);
  spawnPeds(state, 34);
  scatterCoins();
}

function newGame() {
  state.player = makePlayer();
  state.missions = makeMissionState();
  state.time = 0;
  state.dayTime = 0.42;
  buildWorld();
  state.mode = 'playing';
  state.ui.menu.classList.add('hidden');
  state.ui.pause.classList.add('hidden');
  state.ui.dead.classList.add('hidden');
  state.toast('Welcome to Solmar Bay — go see Luna at La Luna Bar');
}

function continueGame() {
  buildWorld();
  const had = loadGame(state);
  state.mode = 'playing';
  state.ui.menu.classList.add('hidden');
  state.ui.pause.classList.add('hidden');
  state.ui.dead.classList.add('hidden');
  state.toast(had ? 'Welcome back to Solmar Bay' : 'No save found — starting fresh');
  if (!had) {
    state.player = makePlayer();
    state.missions = makeMissionState();
  }
}

// --- camera -----------------------------------------------------------------
function updateCamera(dt) {
  const cam = state.camera;
  const p = state.player;
  if (state.vista) return; // vista pins the whole island
  const vw = canvas.width;
  const vh = canvas.height;
  cam.w = vw;
  cam.h = vh;
  const tx = clamp(p.x - vw / 2, 0, WORLD.w - vw);
  const ty = clamp(p.y - vh / 2, 0, WORLD.h - vh);
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
}

// --- interaction: shops, Luna, home ----------------------------------------
function updateInteractions(dt) {
  const p = state.player;
  const input = state.input;
  const e = state.keysPressed.has('KeyE');
  state.hintText = '';

  // Luna starts the next job.
  const luna = PLACES.lunaBar;
  if (!state.missions.started && currentMission(state) && dist(p.x, p.y, luna.x, luna.y) < 110) {
    state.hintText = 'E — Talk to Luna, start the next job';
    if (e) startMission(state);
  }
  // Gun shop: buy weapons and ammo.
  const gun = PLACES.gunShop;
  if (dist(p.x, p.y, gun.x, gun.y) < 110) {
    const owned = [true, p.ammo[1] > 0 || p.weapon === 1, p.ammo[2] > 0 || p.weapon === 2, p.ammo[3] > 0 || p.weapon === 3];
    let offer = 'E — Buy ammo $50';
    if (!owned[1]) offer = 'E — Buy Pistol $250';
    else if (!owned[2]) offer = 'E — Buy SMG $900';
    else if (!owned[3]) offer = 'E — Buy Shotgun $1400';
    state.hintText = offer;
    if (e) buyAtGunShop();
  }
  // Spray & Shine: lose the heat.
  const spray = PLACES.spray;
  if (state.wanted > 0 && dist(p.x, p.y, spray.x, spray.y) < 110) {
    state.hintText = 'E — Spray & Shine: fresh paint, lose the cops ($300)';
    if (e) trySpray(state);
  }
  // Casa del Sol: save.
  const casa = PLACES.casa;
  if (dist(p.x, p.y, casa.x, casa.y) < 110) {
    state.hintText = 'E — Save game at Casa del Sol';
    if (e) saveGame(state, false);
  }
  // Sun coins.
  for (let i = state.coins.length - 1; i >= 0; i--) {
    const c = state.coins[i];
    if (dist(p.x, p.y, c.x, c.y) < 28) {
      state.coins.splice(i, 1);
      p.cash += 50;
      p.respect += 10;
      p.coins += 1;
      state.audio.blip(1320);
      state.toast('Sun Coin +$50');
      const np = nearestRoadPoint(rand(400, WORLD.w - 400), rand(400, WORLD.h - 400));
      state.coins.push({ x: np.x + rand(-120, 120), y: np.y + rand(-120, 120) });
    }
  }
}

function buyAtGunShop() {
  const p = state.player;
  const has = (i) => p.ammo[i] > 0 || p.weapon === i;
  if (!has(1) && p.cash >= 250) {
    p.cash -= 250; p.ammo[1] = 12; p.weapon = 1;
    state.toast('Bought a Pistol — press 2 to use it');
  } else if (!has(2) && p.cash >= 900) {
    p.cash -= 900; p.ammo[2] = 32; p.weapon = 2;
    state.toast('Bought an SMG — press 3 to use it');
  } else if (!has(3) && p.cash >= 1400) {
    p.cash -= 1400; p.ammo[3] = 6; p.weapon = 3;
    state.toast('Bought a Shotgun — press 4 to use it');
  } else if (p.cash >= 50) {
    p.cash -= 50;
    const w = WEAPONS[p.weapon];
    if (w.ammo !== Infinity) p.ammo[p.weapon] += w.ammo;
    state.toast(`Bought ammo for the ${w.name}`);
  } else {
    state.toast('Not enough cash — go earn some');
  }
  state.audio.blip(990);
}

// --- per-frame update -------------------------------------------------------
function update(dt) {
  const p = state.player;
  const input = state.input;

  // Edge-triggered keys (driving, weapons, radio).
  if (state.keysPressed.has('KeyR')) {
    state.audio.ensure();
    state.toast('Radio: ' + state.audio.nextStation());
  }
  if (state.keysPressed.has('KeyM')) {
    state.audio.radioOn = !state.audio.radioOn;
    state.toast(state.audio.radioOn ? 'Radio on' : 'Radio off');
  }
  if (state.keysPressed.has('Digit1')) p.weapon = 0;
  if (state.keysPressed.has('Digit2') && p.ammo[1] > 0) p.weapon = 1;
  if (state.keysPressed.has('Digit3') && p.ammo[2] > 0) p.weapon = 2;
  if (state.keysPressed.has('Digit4') && p.ammo[3] > 0) p.weapon = 3;

  // Screenshot scenes drive themselves.
  if (state.snap && p.car) input.keys.KeyW = true;

  updatePlayer(state, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateMissions(state, dt);
  updateRivals(state, dt);
  updateBullets(state, dt);

  // Shooting.
  if (input.mouseDown && !p.car && !p.dead) {
    if (p.weapon === 0) playerMelee(state);
    else playerShoot(state);
  }
  if (input.mouseClicked && !p.car && !p.dead && p.weapon !== 0) {
    playerShoot(state);
  }

  // Day cycle (a full day is about 8 minutes).
  state.dayTime = (state.dayTime + dt / 480) % 1;

  // Effects decay.
  if (state.muzzle > 0) state.muzzle -= dt;
  for (let i = state.sparks.length - 1; i >= 0; i--) {
    state.sparks[i].life -= dt;
    if (state.sparks[i].life <= 0) state.sparks.splice(i, 1);
  }
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    state.explosions[i].life -= dt;
    if (state.explosions[i].life <= 0) state.explosions.splice(i, 1);
  }

  // Audio follows the car and the sirens.
  state.audio.tickRadio();
  state.audio.setEngine(p.car ? Math.abs(p.car.speed) / 560 : 0, !!p.car);
  state.audio.setSiren(state.wanted > 0 && state.copCars.length > 0);

  updateInteractions(dt);
  updateCamera(dt);

  // Wasted / busted.
  if (p.dead && state.mode === 'playing') {
    state.mode = 'dead';
    state.ui.deadTitle.textContent = 'WASTED';
    state.ui.deadText.textContent = 'The city keeps moving without you.';
    state.ui.dead.classList.remove('hidden');
  }
  if (p.busted && state.mode === 'playing') {
    state.mode = 'dead';
    state.ui.deadTitle.textContent = 'BUSTED';
    state.ui.deadText.textContent = 'The Bay PD caught up with you.';
    state.ui.dead.classList.remove('hidden');
  }
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    state.ui.pause.classList.remove('hidden');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    state.ui.pause.classList.add('hidden');
  }
}

function respawn() {
  const p = state.player;
  p.dead = false;
  p.busted = false;
  p.health = 100;
  p.armor = 0;
  p.cash = Math.floor(p.cash / 2);
  p.car = null;
  p.x = PLACES.casa.x;
  p.y = PLACES.casa.y + 60;
  state.heat = 0;
  state.wanted = 0;
  state.copCars = [];
  state.cops = [];
  state.heli = null;
  state.roadblocks = [];
  state.bullets = [];
  state.mode = 'playing';
  state.ui.dead.classList.add('hidden');
  state.toast('You woke up at Casa del Sol — half your cash is gone');
}

// --- boot -------------------------------------------------------------------
function resize() {
  const w = Math.min(1280, window.innerWidth);
  const h = Math.min(800, window.innerHeight);
  canvas.width = w;
  canvas.height = h;
  // Note: camera.w/h are owned by updateCamera (or by the vista scene);
  // a resize must not clobber them.
}

function boot() {
  state.input = createInput(canvas);
  state.city = buildCity();
  state.cityLayer = prerenderCity(state.city);
  state.renderer = createRenderer(canvas, state.cityLayer);
  state.ui = createUI(state);
  buildWorld();
  resize();
  window.addEventListener('resize', resize);

  // Edge-triggered key presses (E, R, M, P, digits, H).
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    state.keysPressed.add(e.code);
    if (e.code === 'KeyE' || e.code === 'KeyR' || e.code === 'KeyM') state.audio.ensure();
  });

  // Menu buttons.
  document.getElementById('btn-new').addEventListener('click', () => {
    state.audio.ensure();
    newGame();
  });
  document.getElementById('btn-continue').addEventListener('click', () => {
    state.audio.ensure();
    continueGame();
  });
  document.getElementById('btn-help').addEventListener('click', () => {
    state.ui.help.classList.toggle('hidden');
  });
  document.getElementById('btn-resume').addEventListener('click', togglePause);
  document.getElementById('btn-save').addEventListener('click', () => saveGame(state, false));
  document.getElementById('btn-quit').addEventListener('click', () => {
    state.mode = 'menu';
    state.ui.pause.classList.add('hidden');
    state.ui.menu.classList.remove('hidden');
  });
  document.getElementById('btn-retry').addEventListener('click', respawn);
  document.getElementById('btn-dead-menu').addEventListener('click', () => {
    state.mode = 'menu';
    state.ui.dead.classList.add('hidden');
    state.ui.menu.classList.remove('hidden');
  });
  document.getElementById('btn-continue').style.display = hasSave() ? '' : 'none';

  // Screenshot scene: skip the menu, set the scene up, play at once.
  if (sceneName) {
    state.mode = 'playing';
    state.ui.menu.classList.add('hidden');
    applyScene(state, sceneName);
    if (state.vista) {
      document.getElementById('hud').style.display = 'none';
      document.getElementById('minimap').style.display = 'none';
    }
  }

  // Debug handle for playtesting (also used by the screenshot scenes).
  window.__solmar = state;

  // The loop.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Pause works from both playing and paused (update() does not run
    // while paused, so the key has to be caught here).
    if ((state.keysPressed.has('KeyP') || state.keysPressed.has('Escape'))
      && (state.mode === 'playing' || state.mode === 'paused')) {
      togglePause();
      state.keysPressed.clear();
      state.input.mouseClicked = false;
      requestAnimationFrame(frame);
      return;
    }
    if (state.mode === 'playing') {
      state.time += dt;
      update(dt);
      state.renderer.draw(state);
      state.ui.update(dt);
    } else if (state.mode === 'menu' || state.mode === 'paused' || state.mode === 'dead') {
      // Keep the city behind the menu alive and visible.
      state.renderer.draw(state);
    }
    state.keysPressed.clear();
    state.input.mouseClicked = false;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
