// The wanted system: heat, patrol cars that ram, foot cops that shoot and
// arrest, roadblocks at 3 stars, the Air One helicopter at 4 stars, and the
// Spray & Shine that loses the cops for cash.

import { WORLD, COP, PLACES } from './config.js';
import { clamp, dist, rand, pick, angleTo, angleDiff, chance } from './util.js';
import { makeCar } from './entities.js';
import { randomRoadPoint, collideBuildings } from './city.js';
import { enemyShoot } from './combat.js';
import { hurtPlayer } from './player.js';

export function makeCopCar(x, y, angle) {
  const car = makeCar(x, y, angle, { cop: true, color: '#2f6df6', name: 'Interceptor' });
  car.traffic = false;
  car.targetSpeed = COP.carSpeed;
  return car;
}

export function makeFootCop(x, y) {
  return {
    x, y, angle: 0, hp: 60, speed: COP.footSpeed,
    shootCd: rand(0.5, 1.5), arrest: 0, car: null,
  };
}

// How many cop cars and foot cops the wanted level calls for.
export function wantedForces(stars) {
  return {
    cars: stars >= 1 ? Math.min(2 + stars, 6) : 0,
    foot: stars >= 2 ? Math.min(stars, 4) : 0,
    heli: stars >= 4,
    roadblock: stars >= 3,
  };
}

// Spawn the forces for the current wanted level, near the player.
export function spawnWanted(state) {
  const p = state.player;
  const f = wantedForces(state.wanted);
  while (state.copCars.length < f.cars) {
    const a = rand(0, Math.PI * 2);
    const x = clamp(p.x + Math.cos(a) * rand(500, 800), 300, WORLD.w - 300);
    const y = clamp(p.y + Math.sin(a) * rand(500, 800), 300, WORLD.h - 300);
    state.copCars.push(makeCopCar(x, y, angleTo(x, y, p.x, p.y)));
  }
  while (state.cops.length < f.foot) {
    const a = rand(0, Math.PI * 2);
    state.cops.push(makeFootCop(
      clamp(p.x + Math.cos(a) * rand(220, 380), 300, WORLD.w - 300),
      clamp(p.y + Math.sin(a) * rand(220, 380), 300, WORLD.h - 300),
    ));
  }
  if (f.heli && !state.heli) {
    state.heli = { x: p.x + 300, y: p.y - 300, angle: 0, hp: 200 };
  }
  if (!f.heli) state.heli = null;
}

// Cop cars chase and ram; foot cops chase, shoot, and arrest up close.
export function updatePolice(state, dt) {
  const p = state.player;
  const px = p.x;
  const py = p.y;

  for (let i = state.copCars.length - 1; i >= 0; i--) {
    const car = state.copCars[i];
    const d = dist(car.x, car.y, px, py);
    const wantAngle = angleTo(car.x, car.y, px, py);
    const diff = angleDiff(car.angle, wantAngle);
    car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
    const target = d > 60 ? COP.carSpeed : COP.carSpeed * 0.6;
    car.speed += clamp(target - car.speed, -600 * dt, 350 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.siren += dt;
    // Cop cars do not drive through buildings: push them out, slow them,
    // and steer them back toward the nearest road.
    const fixed = collideBuildings(state.city, car.x, car.y, 20);
    if (fixed.x !== car.x || fixed.y !== car.y) {
      car.x = fixed.x;
      car.y = fixed.y;
      car.speed *= 0.5;
      const rp = state.nearestRoad(car.x, car.y);
      if (rp) car.angle = angleTo(car.x, car.y, rp.x, rp.y);
    }
    // Ram the player (damage gated by a cooldown so a ram is one hit,
    // not 60 hits a second).
    const hitD = p.car ? 46 : 30;
    if (car.ramCd === undefined) car.ramCd = 0;
    car.ramCd -= dt;
    if (d < hitD && car.ramCd <= 0) {
      car.ramCd = 0.8;
      if (p.car) {
        p.car.speed *= 0.6;
        state.audio.crash(false);
        state.shake = 6;
        p.health -= 2;
      } else {
        hurtPlayer(state, COP.ramDamage);
      }
      state.addHeat(0, '');
    }
    // Cop cars that fall far behind respawn closer.
    if (d > 1600) {
      const a = rand(0, Math.PI * 2);
      car.x = clamp(px + Math.cos(a) * 700, 300, WORLD.w - 300);
      car.y = clamp(py + Math.sin(a) * 700, 300, WORLD.h - 300);
      car.speed = COP.carSpeed * 0.7;
    }
    // Cop car wrecked by the player.
    if (car.health <= 0) {
      state.explosions.push({ x: car.x, y: car.y, life: 0.7, r: 10 });
      state.audio.crash(true);
      state.copCars.splice(i, 1);
      state.addHeat(0.5, 'wrecked a patrol car');
    }
  }

  for (let i = state.cops.length - 1; i >= 0; i--) {
    const c = state.cops[i];
    if (c.hp <= 0) { state.cops.splice(i, 1); continue; }
    const d = dist(c.x, c.y, px, py);
    c.angle = angleTo(c.x, c.y, px, py);
    if (d < COP.arrestRange && !p.car) {
      // Busted: the cop is on top of you.
      c.arrest += dt;
      if (c.arrest > 1.2) {
        p.busted = true;
        state.audio.setSiren(false);
        return;
      }
    } else {
      c.arrest = 0;
    }
    if (d > 50) {
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
    }
    c.shootCd -= dt;
    if (c.shootCd <= 0 && d < COP.shootRange && d > 60) {
      enemyShoot(state, c, p, 7);
      c.shootCd = rand(0.9, 1.8);
    }
  }

  // Helicopter circles overhead and spots the player.
  if (state.heli) {
    const h = state.heli;
    const a = Math.atan2(py - h.y, px - h.x) + Math.PI / 2;
    h.x += Math.cos(a) * 260 * dt;
    h.y += Math.sin(a) * 260 * dt;
    h.angle += dt * 0.8;
    // The spotlight keeps the heat from cooling.
    state.seenTimer = 3;
  }

  // Roadblocks: two cop cars parked across the road ahead of the player.
  if (state.wanted >= 3 && state.roadblocks.length === 0 && p.car) {
    const ahead = { x: px + Math.cos(p.angle) * 500, y: py + Math.sin(p.angle) * 500 };
    const rp = state.nearestRoad(ahead.x, ahead.y);
    if (rp) {
      for (const s of [-1, 1]) {
        const bc = makeCopCar(rp.x + (rp.vertical ? s * 30 : 0), rp.y + (rp.vertical ? 0 : s * 30), rp.vertical ? 0 : Math.PI / 2);
        bc.speed = 0;
        bc.roadblock = true;
        state.roadblocks.push(bc);
      }
    }
  }
  if (state.wanted < 3) state.roadblocks = [];

  // Heat cools when the player is unseen: no cops near, no helicopter.
  const nearestCop = Math.min(
    ...state.copCars.map((c) => dist(c.x, c.y, px, py)),
    ...state.cops.map((c) => dist(c.x, c.y, px, py)),
    9999,
  );
  if (state.seenTimer > 0) state.seenTimer -= dt;
  const hidden = nearestCop > 700 && state.seenTimer <= 0;
  if (hidden && state.wanted > 0) {
    state.coolTimer += dt;
    if (state.coolTimer > 4) {
      state.heat = Math.max(0, state.heat - 1);
      state.wanted = Math.floor(state.heat);
      state.coolTimer = 0;
      state.toast('Heat cooling off…');
      trimForces(state);
    }
  } else {
    state.coolTimer = 0;
  }
  // If the wanted level dropped, pull the extra forces off.
  trimForces(state);
}

// Remove cop cars and foot cops above what the wanted level calls for
// (the farthest ones leave first).
function trimForces(state) {
  const f = wantedForces(state.wanted);
  while (state.copCars.length > f.cars) {
    let far = 0;
    let farD = -1;
    state.copCars.forEach((c, i) => {
      const d = dist(c.x, c.y, state.player.x, state.player.y);
      if (d > farD) { farD = d; far = i; }
    });
    state.copCars.splice(far, 1);
  }
  while (state.cops.length > f.foot) state.cops.pop();
  if (!f.heli) state.heli = null;
}

// Pay for a paint job: lose all heat, costs $300.
export function trySpray(state) {
  const p = state.player;
  const s = PLACES.spray;
  if (dist(p.x, p.y, s.x, s.y) > 110) return false;
  if (state.wanted === 0) {
    state.toast('No heat to lose — you are clean');
    return false;
  }
  if (p.cash < 300) {
    state.toast('Spray & Shine costs $300');
    return false;
  }
  p.cash -= 300;
  state.heat = 0;
  state.wanted = 0;
  state.copCars = [];
  state.cops = [];
  state.heli = null;
  state.roadblocks = [];
  state.audio.blip(990);
  state.toast('Fresh paint — the cops lost you');
  return true;
}
