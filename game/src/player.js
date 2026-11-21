// The player: Rio on foot, and Rio behind the wheel.
// Walking, sprinting, entering and leaving cars, driving physics.

import { WORLD, PLAYER, CAR, PLACES } from './config.js';
import { clamp, dist, angleDiff } from './util.js';
import { nearestStealableCar, collideCar } from './entities.js';
import { collideBuildings } from './city.js';

export function makePlayer() {
  return {
    x: PLACES.lunaBar.x,
    y: PLACES.lunaBar.y + 90,
    angle: -Math.PI / 2,
    aim: -Math.PI / 2,
    health: PLAYER.health,
    armor: 0,
    cash: 150,
    respect: 0,
    coins: 0,
    car: null, // the car currently driven, or null on foot
    speed: 0,
    weapon: 0,
    ammo: [Infinity, 12, 0, 0],
    sprinting: false,
    dead: false,
    busted: false,
  };
}

export function updatePlayer(state, dt) {
  const p = state.player;
  const input = state.input;
  if (p.dead || p.busted) return;

  if (p.car) {
    driveCar(state, dt);
    return;
  }

  // On foot.
  const axis = input.axis();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.sprinting = sprint && (axis.x !== 0 || axis.y !== 0);
  let mx = axis.x;
  let my = axis.y;
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  p.x += mx * speed * dt;
  p.y += my * speed * dt;
  const fixed = collideBuildings(state.city, p.x, p.y, PLAYER.radius);
  p.x = clamp(fixed.x, 260, WORLD.w - 260);
  p.y = clamp(fixed.y, 260, WORLD.h - 260);

  // Aim at the mouse (screen space -> world space).
  const cam = state.camera;
  const wx = cam.x + input.mouseX;
  const wy = cam.y + input.mouseY;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  p.angle = p.aim;

  // Enter the nearest car.
  if (state.keysPressed.has('KeyE')) {
    const car = nearestStealableCar(state, p.x, p.y, 64);
    if (car) {
      p.car = car;
      car.parked = false;
      car.traffic = false;
      car.speed = 0;
      state.audio.ensure();
      state.audio.blip(660);
      state.toast('You took the ' + car.name);
      if (state.wanted < 1) state.addHeat(1, 'stole a car');
    }
  }
}

function driveCar(state, dt) {
  const p = state.player;
  const car = p.car;
  const input = state.input;
  const axis = input.axis();
  const handbrake = input.down('Space');

  // Steering: only while moving, sharper at low speed.
  const spd = car.speed;
  const steer = -axis.x; // A = left
  const steerPower = CAR.turn * clamp(Math.abs(spd) / 160, 0.25, 1) * (spd >= 0 ? 1 : -1);
  car.angle += steer * steerPower * dt * (handbrake ? 1.5 : 1);

  if (axis.y < 0) {
    // W forward.
    car.speed += CAR.accel * dt;
  } else if (axis.y > 0) {
    // S brake / reverse.
    if (spd > 30) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverse * dt;
  } else {
    // Coast down.
    car.speed -= Math.sign(car.speed) * 160 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  if (handbrake) {
    car.speed *= Math.pow(0.4, dt * 4);
  }
  car.speed = clamp(car.speed, -CAR.reverse * 0.9, CAR.maxSpeed);

  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.x += vx * dt;
  car.y += vy * dt;

  const hit = collideCar(state, car, dt);
  if (car.crashCd === undefined) car.crashCd = 0;
  car.crashCd -= dt;
  if (hit && Math.abs(car.speed) > 120 && car.crashCd <= 0) {
    car.crashCd = 0.7;
    state.audio.crash(Math.abs(car.speed) > 300);
    state.shake = Math.min(10, Math.abs(car.speed) / 60);
    if (Math.abs(car.speed) > 320) {
      p.health -= 6;
      state.addHeat(0, '');
    }
  }
  car.speed *= Math.pow(CAR.grip, dt * 10);

  // Player rides in the car.
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.aim = car.angle;

  // Horn.
  if (state.keysPressed.has('KeyH')) state.audio.horn();

  // Get out.
  if (state.keysPressed.has('KeyE')) {
    const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 34, y: car.y + Math.sin(car.angle + Math.PI / 2) * 34 };
    p.x = side.x;
    p.y = side.y;
    car.speed = 0;
    p.car = null;
    state.audio.blip(440);
  }
}

// Damage the player (armor soaks first). Returns true if the player died.
export function hurtPlayer(state, dmg) {
  const p = state.player;
  if (p.dead) return true;
  let left = dmg;
  if (p.armor > 0) {
    const soaked = Math.min(p.armor, left);
    p.armor -= soaked;
    left -= soaked;
  }
  p.health -= left;
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    state.audio.setEngine(0, false);
    state.audio.setSiren(false);
    return true;
  }
  return false;
}

export function healPlayer(state, amount) {
  const p = state.player;
  p.health = clamp(p.health + amount, 0, PLAYER.health);
}
