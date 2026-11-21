// Story missions: eight jobs for Luna Reyes, each a chain of steps.
// A step completes when the player reaches a place, holds E, steals the
// van, clears the crew, or runs the race checkpoints.

import { MISSIONS, PLACES, RANKS } from './config.js';
import { dist, rand, clamp } from './util.js';
import { makeCar } from './entities.js';
import { enemyShoot } from './combat.js';

export function makeMissionState() {
  return {
    index: 0, // which mission is active
    step: 0,
    done: false,
    timer: 0,
    holdT: 0,
    kills: 0,
    racePoints: [],
    raceIndex: 0,
    van: null,
    rivals: [],
    started: false,
  };
}

export function currentMission(state) {
  if (state.missions.index >= MISSIONS.length) return null;
  return MISSIONS[state.missions.index];
}

export function currentStep(state) {
  const m = currentMission(state);
  if (!m) return null;
  return m.steps[state.missions.step];
}

export function missionTarget(state) {
  const step = currentStep(state);
  if (!step) return null;
  if (step.type === 'reach' || step.type === 'hold') return PLACES[step.at];
  if (step.type === 'race') {
    const pts = state.missions.racePoints;
    if (pts.length > 0 && state.missions.raceIndex < pts.length) return pts[state.missions.raceIndex];
  }
  if (step.type === 'stealVan' && state.missions.van) {
    return { x: state.missions.van.x, y: state.missions.van.y };
  }
  if (step.type === 'kill' && state.missions.rivals.length > 0) {
    const alive = state.missions.rivals.find((r) => r.hp > 0);
    if (alive) return { x: alive.x, y: alive.y };
  }
  return null;
}

function advanceStep(state) {
  const m = currentMission(state);
  state.missions.step += 1;
  state.missions.holdT = 0;
  state.audio.blip(880);
  if (state.missions.step >= m.steps.length) {
    completeMission(state);
  }
}

function completeMission(state) {
  const m = currentMission(state);
  const p = state.player;
  p.cash += m.reward;
  p.respect += m.respect;
  state.missions.index += 1;
  state.missions.step = 0;
  state.missions.started = false; // next job starts by talking to Luna
  state.missions.done = state.missions.index >= MISSIONS.length;
  state.missions.rivals = [];
  state.missions.van = null;
  state.toast(`Job done: ${m.title}  +$${m.reward}`);
  state.audio.blip(1320);
  state.saveGame(true);
  if (state.missions.done) {
    state.toast('All jobs done — you run Solmar Bay now, Kingpin');
  }
}

function failMission(state, why) {
  state.toast('Job failed: ' + why + ' — talk to Luna to retry');
  state.missions.step = 0;
  state.missions.holdT = 0;
  state.missions.timer = 0;
  state.missions.rivals = [];
  state.missions.racePoints = [];
  state.missions.raceIndex = 0;
  state.missions.van = null;
}

// Start the current mission's first step (called when the player talks
// to Luna, or automatically when a mission becomes active).
export function startMission(state) {
  const m = currentMission(state);
  if (!m) return;
  state.missions.started = true;
  state.missions.step = 0;
  state.missions.holdT = 0;
  state.missions.timer = m.time || 0;
  state.missions.kills = 0;
  state.missions.racePoints = [];
  state.missions.raceIndex = 0;
  state.missions.rivals = [];
  state.missions.van = null;
  if (m.id === 'm5') {
    // The armored van waits at the docks.
    const van = makeCar(PLACES.port.x + 60, PLACES.port.y + 40, 0, {
      color: '#3a3f4a', name: 'Stockade', len: 56, wid: 26, van: true, parked: true,
    });
    state.missions.van = van;
    state.cars.push(van);
  }
  if (m.id === 'm6') {
    // Five checkpoints around the city.
    state.missions.racePoints = [
      { x: 1250, y: 1150 }, { x: 2450, y: 1150 }, { x: 2450, y: 2350 },
      { x: 3650, y: 2350 }, { x: 3650, y: 1150 },
    ];
  }
  if (m.id === 'm7') {
    for (let i = 0; i < 6; i++) {
      state.missions.rivals.push({
        x: PLACES.crewBlock.x + rand(-90, 90),
        y: PLACES.crewBlock.y + rand(-90, 90),
        hp: 50, angle: 0, shootCd: rand(0.5, 1.5),
      });
    }
  }
  state.toast(`${m.title}: ${m.text}`);
}

export function updateMissions(state, dt) {
  const m = currentMission(state);
  if (!m || !state.missions.started) return;
  const p = state.player;
  const step = currentStep(state);
  if (!step) return;

  if (m.time) {
    state.missions.timer -= dt;
    if (state.missions.timer <= 0) {
      failMission(state, 'out of time');
      return;
    }
  }

  const at = (place, radius) => dist(p.x, p.y, place.x, place.y) < radius;

  switch (step.type) {
    case 'stealCar':
      if (p.car) advanceStep(state);
      break;
    case 'reach': {
      const place = PLACES[step.at];
      if (at(place, step.radius)) advanceStep(state);
      break;
    }
    case 'hold': {
      const place = PLACES[step.at];
      if (at(place, step.radius)) {
        if (state.input.down('KeyE')) {
          state.missions.holdT += dt;
          if (state.missions.holdT >= step.seconds) advanceStep(state);
        } else {
          state.missions.holdT = Math.max(0, state.missions.holdT - dt);
        }
      }
      break;
    }
    case 'wanted':
      if (state.wanted >= step.stars) advanceStep(state);
      break;
    case 'loseWanted':
      if (state.wanted === 0) advanceStep(state);
      break;
    case 'stealVan': {
      const van = state.missions.van;
      if (van && p.car === van) advanceStep(state);
      break;
    }
    case 'race': {
      const pts = state.missions.racePoints;
      const idx = state.missions.raceIndex;
      if (idx < pts.length && dist(p.x, p.y, pts[idx].x, pts[idx].y) < 80) {
        state.missions.raceIndex += 1;
        state.audio.blip(1100);
        if (state.missions.raceIndex >= pts.length) advanceStep(state);
      }
      break;
    }
    case 'kill':
      if (state.missions.kills >= step.count) advanceStep(state);
      break;
    default:
      break;
  }
}

// Rival crew AI: they stand their ground and shoot at the player.
export function updateRivals(state, dt) {
  const p = state.player;
  for (const r of state.missions.rivals) {
    if (r.hp <= 0) continue;
    r.angle = Math.atan2(p.y - r.y, p.x - r.x);
    const d = dist(r.x, r.y, p.x, p.y);
    r.shootCd -= dt;
    if (r.shootCd <= 0 && d < 420) {
      enemyShoot(state, r, p, 6);
      r.shootCd = rand(1.0, 2.0);
    }
    // They shuffle to keep a little distance.
    if (d < 90) {
      r.x -= Math.cos(r.angle) * 40 * dt;
      r.y -= Math.sin(r.angle) * 40 * dt;
    }
  }
}

export function rankName(respect) {
  let name = RANKS[0].name;
  for (const r of RANKS) if (respect >= r.at) name = r.name;
  return name;
}
