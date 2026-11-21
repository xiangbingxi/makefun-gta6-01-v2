// Cars and pedestrians: traffic that follows the roads, parked cars to
// steal, and people who stroll the sidewalks and flee from gunfire.

import { WORLD, ROADS_X, ROADS_Y, CAR, COLORS } from './config.js';
import { clamp, dist, rand, randInt, pick, chance, angleDiff } from './util.js';
import { onRoad, nearestRoadPoint, randomRoadPoint, collideBuildings } from './city.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8e8e8', '#2b2b2b', '#e8a13d', '#5fa88f', '#8a5fd0', '#c0c8d0'];
const CAR_NAMES = ['Comet', 'Stallion', 'Panto', 'Vagrant', 'Sultan', 'Bison', 'Futo', 'Dominator'];

export function makeCar(x, y, angle, opts) {
  const o = opts || {};
  return {
    x, y, angle,
    speed: o.speed || 0,
    color: o.color || pick(CAR_COLORS),
    name: o.name || pick(CAR_NAMES),
    len: o.len || 44,
    wid: o.wid || 22,
    traffic: !!o.traffic,
    parked: !!o.parked,
    cop: !!o.cop,
    van: !!o.van,
    // traffic AI
    dir: o.dir || (chance(0.5) ? 1 : -1),
    vertical: o.vertical !== undefined ? o.vertical : chance(0.5),
    targetSpeed: o.targetSpeed || rand(120, 200),
    stuck: 0,
    health: 100,
    siren: 0,
  };
}

// Spawn the starting set of traffic and parked cars.
export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint();
    const angle = p.vertical ? (p.dir || 1) * Math.PI / 2 : 0;
    const car = makeCar(p.x, p.y, angle, { traffic: true, vertical: p.vertical });
    car.dir = chance(0.5) ? 1 : -1;
    car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    state.cars.push(car);
  }
}

export function spawnParked(state, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint();
    const side = chance(0.5) ? 1 : -1;
    let x = p.x;
    let y = p.y;
    if (p.vertical) x += side * 46; else y += side * 46;
    if (onRoad(x, y)) continue;
    const angle = p.vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    state.cars.push(makeCar(x, y, angle, { parked: true }));
  }
}

// Traffic follows the road grid: drive straight, turn at intersections.
export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (!car.traffic) continue;
    const px = state.player.x;
    const py = state.player.y;
    const near = dist(car.x, car.y, px, py) < 900;
    if (!near && state.cars.indexOf(car) % 3 !== 0) {
      // Far cars just cruise cheaply.
    }
    // Slow down for the car ahead.
    let blocked = false;
    for (const other of state.cars) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70 && d > 1) {
        const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        if (ahead > 0) { blocked = true; break; }
      }
    }
    const want = blocked ? 0 : car.targetSpeed;
    car.speed += clamp(want - car.speed, -300 * dt, 200 * dt);
    const step = car.speed * dt;
    car.x += Math.cos(car.angle) * step;
    car.y += Math.sin(car.angle) * step;
    // At an intersection, sometimes turn.
    const nearX = ROADS_X.find((rx) => Math.abs(car.x - rx) < 8);
    const nearY = ROADS_Y.find((ry) => Math.abs(car.y - ry) < 8);
    if ((nearX !== undefined || nearY !== undefined) && chance(0.25)) {
      if (car.vertical && nearY !== undefined) {
        car.vertical = false;
        car.angle = chance(0.5) ? 0 : Math.PI;
        car.y = nearY;
      } else if (!car.vertical && nearX !== undefined) {
        car.vertical = true;
        car.angle = chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        car.x = nearX;
      }
    }
    // Wrap around the map edges: respawn on the far side.
    if (car.x < 260 || car.x > WORLD.w - 260 || car.y < 260 || car.y > WORLD.h - 260) {
      const p = randomRoadPoint();
      car.x = p.x;
      car.y = p.y;
      car.vertical = p.vertical;
      car.angle = car.vertical ? Math.PI / 2 : 0;
      car.speed = car.targetSpeed;
    }
  }
}

// A parked car the player can steal: the nearest one within reach.
export function nearestStealableCar(state, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of state.cars) {
    if (car.cop || car === state.player.car) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function makePed(x, y) {
  return {
    x, y,
    angle: rand(0, Math.PI * 2),
    speed: rand(28, 60),
    color: pick(['#e8e8e8', '#d9a066', '#7dc4ff', '#ff9ec4', '#9aa4c0', '#5fa88f']),
    flee: 0,
    walkPhase: rand(0, Math.PI * 2),
    target: null,
  };
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint();
    const side = chance(0.5) ? 1 : -1;
    const x = p.vertical ? p.x + side * 80 : p.x + rand(-160, 160);
    const y = p.vertical ? p.y + rand(-160, 160) : p.y + side * 80;
    state.peds.push(makePed(clamp(x, 300, WORLD.w - 300), clamp(y, 300, WORLD.h - 300)));
  }
}

// Pedestrians stroll, gather near shops, and run from gunfire and speeding cars.
export function updatePeds(state, dt) {
  const px = state.player.x;
  const py = state.player.y;
  for (const ped of state.peds) {
    ped.walkPhase += dt * 6;
    const danger = state.shotsFired > 0 && dist(ped.x, ped.y, px, py) < 420;
    if (danger) ped.flee = 2.5;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = Math.atan2(ped.y - py, ped.x - px);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      ped.angle = a;
    } else {
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 20) {
        const p = randomRoadPoint();
        ped.target = { x: clamp(p.x, 300, WORLD.w - 300), y: clamp(p.y, 300, WORLD.h - 300) };
      }
      const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * dt;
      ped.y += Math.sin(a) * ped.speed * dt;
    }
    const fixed = collideBuildings(state.city, ped.x, ped.y, 10);
    ped.x = clamp(fixed.x, 280, WORLD.w - 280);
    ped.y = clamp(fixed.y, 280, WORLD.h - 280);
  }
  if (state.shotsFired > 0) state.shotsFired -= dt;
}

// Car-to-car and car-to-building collision for the player's car.
export function collideCar(state, car, dt) {
  const fixed = collideBuildings(state.city, car.x, car.y, 20);
  const hitWall = fixed.x !== car.x || fixed.y !== car.y;
  car.x = fixed.x;
  car.y = fixed.y;
  let hitOther = false;
  for (const other of state.cars) {
    if (other === car) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 44 && d > 0.01) {
      const push = (44 - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      if (!other.traffic) { other.x -= nx * push; other.y -= ny * push; }
      car.speed *= 0.55;
      hitOther = true;
    }
  }
  car.x = clamp(car.x, 250, WORLD.w - 250);
  car.y = clamp(car.y, 250, WORLD.h - 250);
  return hitWall || hitOther;
}

export { CAR_COLORS, CAR_NAMES };
