// Screenshot scenes: deterministic setups the maker captures with
// headless Chromium (?scene=chase|street|race|vista&snap=1).
// Each scene places the player, cars, cops and camera so one frame shows
// several systems at once: the city, driving, the HUD, the minimap,
// the wanted level and a mission objective.

import { PLACES } from './config.js';
import { makeCar, makePed } from './entities.js';
import { makeFootCop, makeCopCar } from './police.js';
import { startMission } from './missions.js';

export function applyScene(state, name) {
  const p = state.player;
  state.dayTime = 0.42; // late afternoon sun
  if (name === 'chase') {
    // 3-star pursuit east along The Strip (road y=1100): the player in a
    // fast car, three patrol cars closing in behind, foot cops on the sidewalk.
    p.x = 2200; p.y = 1100;
    const car = makeCar(2200, 1100, 0, { color: '#d94f3d', name: 'Comet' });
    state.cars.push(car);
    p.car = car;
    car.speed = 420;
    state.heat = 3;
    state.wanted = 3;
    state.missions.index = 3;
    startMission(state);
    for (let i = 0; i < 3; i++) {
      const cop = makeCopCar(2200 - 190 - i * 100, 1100 + (i % 2 === 0 ? 26 : -26), 0);
      cop.speed = 480;
      state.copCars.push(cop);
    }
    for (let i = 0; i < 4; i++) {
      state.cops.push(makeFootCop(2350 + i * 90, 1100 + (i % 2 === 0 ? 92 : -92)));
    }
    for (let i = 0; i < 6; i++) {
      state.peds.push(makePed(2100 + i * 90, 1100 + (i % 2 === 0 ? 88 : -88)));
    }
    state.camera.x = 2200 - 640;
    state.camera.y = 1100 - 400;
  } else if (name === 'street') {
    // On foot outside La Luna Bar, first job: Luna's marker, parked cars,
    // pedestrians, the Strip glowing behind.
    p.x = PLACES.lunaBar.x;
    p.y = PLACES.lunaBar.y + 110;
    p.car = null;
    p.aim = -Math.PI / 2;
    state.wanted = 0;
    state.missions.index = 0;
    startMission(state);
    for (let i = 0; i < 4; i++) {
      const car = makeCar(PLACES.lunaBar.x - 140 + i * 120, PLACES.lunaBar.y + 170, 0, { parked: true });
      state.cars.push(car);
    }
    for (let i = 0; i < 8; i++) {
      state.peds.push(makePed(PLACES.lunaBar.x - 220 + i * 70, PLACES.lunaBar.y + 60 + (i % 3) * 60));
    }
    state.camera.x = p.x - 640;
    state.camera.y = p.y - 400;
  } else if (name === 'race') {
    // Street Kings race: the player in a fast car at checkpoint 2,
    // two rival racers ahead, the checkpoint ring glowing.
    p.x = 2450; p.y = 1150;
    const car = makeCar(2450, 1150, Math.PI / 2, { color: '#ffd94d', name: 'Comet' });
    state.cars.push(car);
    p.car = car;
    car.speed = 460;
    state.heat = 1;
    state.wanted = 1;
    state.missions.index = 5;
    startMission(state);
    state.missions.raceIndex = 1;
    for (let i = 0; i < 2; i++) {
      const rival = makeCar(2450 - 60, 1150 + 160 + i * 120, Math.PI / 2, { color: '#8a5fd0', name: 'Futo' });
      rival.speed = 420;
      state.cars.push(rival);
    }
    state.camera.x = 2450 - 640;
    state.camera.y = 1150 - 400;
  } else if (name === 'vista') {
    // The whole island from above: camera zoomed out, no HUD clutter.
    // 4800x3000 keeps the canvas aspect, covering the full width and
    // the whole city (the outer water ring is trimmed top and bottom).
    p.x = 2400; p.y = 1800;
    p.car = null;
    state.wanted = 0;
    state.missions.index = 0;
    state.vista = true;
    state.camera.x = 0;
    state.camera.y = 300;
    state.camera.w = 4800;
    state.camera.h = 3000;
  }
  // Park a few extra cars and peds everywhere so the world feels alive.
  if (name !== 'vista') {
    for (let i = 0; i < 5; i++) {
      const car = makeCar(1500 + i * 400, 500 + (i % 2) * 600, (i % 2) * Math.PI, { parked: true });
      state.cars.push(car);
    }
  }
}
