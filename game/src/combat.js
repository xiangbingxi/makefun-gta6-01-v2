// Combat: weapons, bullets, muzzle flashes, enemy health.
// The player shoots with the mouse; enemies shoot back.

import { WEAPONS, PLAYER } from './config.js';
import { dist, angleTo, rand, clamp } from './util.js';
import { hurtPlayer } from './player.js';

export function makeBullets() {
  return [];
}

// Fire the player's current weapon toward the aim angle.
export function playerShoot(state) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  const now = state.time;
  if (state.cooldown > now) return false;
  if (w.ammo !== Infinity && p.ammo[p.weapon] <= 0) {
    state.audio.blip(180);
    state.toast('No ammo — visit Ironworks Guns');
    state.cooldown = now + 0.4;
    return false;
  }
  state.cooldown = now + w.rate;
  if (w.ammo !== Infinity) p.ammo[p.weapon] -= 1;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const spread = (Math.random() - 0.5) * (w.pellets ? 0.22 : 0.05);
    state.bullets.push({
      x: p.x + Math.cos(p.aim) * 24,
      y: p.y + Math.sin(p.aim) * 24,
      angle: p.aim + spread,
      speed: 900,
      damage: w.damage,
      fromPlayer: true,
      life: 0.9,
    });
  }
  state.audio.shot(w.id);
  state.muzzle = 0.06;
  state.shotsFired = 0.5;
  if (p.weapon !== 0) state.addHeat(0.2, 'gunfire');
  return true;
}

// An enemy (cop or rival) shoots at the player.
export function enemyShoot(state, from, target, damage) {
  const a = angleTo(from.x, from.y, target.x, target.y) + (Math.random() - 0.5) * 0.12;
  state.bullets.push({
    x: from.x + Math.cos(a) * 20,
    y: from.y + Math.sin(a) * 20,
    angle: a,
    speed: 700,
    damage,
    fromPlayer: false,
    life: 0.8,
  });
  state.audio.shot('pistol');
}

// Move bullets, hit cars, peds, cops, rivals and the player.
export function updateBullets(state, dt) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Buildings stop bullets.
      if (state.cityBlocked(b.x, b.y)) dead = true;
    }
    if (!dead && b.fromPlayer) {
      // Hit a rival.
      for (const r of state.rivals) {
        if (r.hp > 0 && dist(b.x, b.y, r.x, r.y) < 16) {
          r.hp -= b.damage;
          dead = true;
          state.sparks.push({ x: b.x, y: b.y, life: 0.2, color: '#ff5a5a' });
          if (r.hp <= 0) state.onRivalDown(r);
          break;
        }
      }
      // Hit a cop.
      if (!dead) {
        for (const c of state.cops) {
          if (c.hp > 0 && dist(b.x, b.y, c.x, c.y) < 16) {
            c.hp -= b.damage;
            dead = true;
            state.sparks.push({ x: b.x, y: b.y, life: 0.2, color: '#2f6df6' });
            if (c.hp <= 0) state.onCopDown(c);
            break;
          }
        }
      }
      // Hit a traffic car.
      if (!dead) {
        for (const car of state.cars) {
          if (car === p.car) continue;
          if (Math.abs(b.x - car.x) < 24 && Math.abs(b.y - car.y) < 14) {
            car.health -= b.damage;
            dead = true;
            if (car.health <= 0 && !car.wrecked) {
              car.wrecked = true;
              state.explosions.push({ x: car.x, y: car.y, life: 0.7, r: 10 });
              state.audio.crash(true);
              state.addHeat(0.5, 'blew up a car');
            }
            break;
          }
        }
      }
      // Hit a pedestrian.
      if (!dead) {
        for (const ped of state.peds) {
          if (dist(b.x, b.y, ped.x, ped.y) < 12) {
            ped.flee = 4;
            dead = true;
            state.addHeat(0.5, 'shot a pedestrian');
            break;
          }
        }
      }
    }
    if (!dead && !b.fromPlayer) {
      // Enemy bullet vs the player (or the player's car).
      const tx = p.car ? p.car.x : p.x;
      const ty = p.car ? p.car.y : p.y;
      if (dist(b.x, b.y, tx, ty) < 20) {
        hurtPlayer(state, b.damage);
        dead = true;
        state.sparks.push({ x: b.x, y: b.y, life: 0.2, color: '#ffd94d' });
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

// Melee swing: hits anything close in front of the player.
export function playerMelee(state) {
  const p = state.player;
  const now = state.time;
  if (state.cooldown > now) return;
  state.cooldown = now + WEAPONS[0].rate;
  state.muzzle = 0.06;
  const reach = WEAPONS[0].range;
  const fx = p.x + Math.cos(p.aim) * reach * 0.6;
  const fy = p.y + Math.sin(p.aim) * reach * 0.6;
  for (const r of state.rivals) {
    if (r.hp > 0 && dist(fx, fy, r.x, r.y) < 30) {
      r.hp -= WEAPONS[0].damage;
      if (r.hp <= 0) state.onRivalDown(r);
    }
  }
  for (const c of state.cops) {
    if (c.hp > 0 && dist(fx, fy, c.x, c.y) < 30) {
      c.hp -= WEAPONS[0].damage;
      if (c.hp <= 0) state.onCopDown(c);
    }
  }
}
