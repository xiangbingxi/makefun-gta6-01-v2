// World rendering: blit the prerendered city, then draw every moving thing
// on top — cars, people, the player, cops, the helicopter, bullets, coins,
// markers and effects — and the day/night light.

import { WORLD, COLORS } from './config.js';
import { clamp, dist } from './util.js';

export function createRenderer(canvas, cityLayer) {
  const g = canvas.getContext('2d');
  const renderer = { canvas, g, cityLayer };

  renderer.draw = function (state) {
    const cam = state.camera;
    const W = canvas.width;
    const H = canvas.height;
    g.clearRect(0, 0, W, H);
    g.save();
    // Camera shake.
    if (state.shake > 0.2) {
      g.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      state.shake *= 0.88;
    }
    // City layer (clipped to the viewport).
    g.drawImage(
      cityLayer,
      cam.x, cam.y, cam.w, cam.h,
      0, 0, W, H,
    );
    // Sun coins.
    for (const coin of state.coins) {
      if (!onScreen(state, coin.x, coin.y, 40)) continue;
      const bob = Math.sin(state.time * 4 + coin.x) * 3;
      g.fillStyle = '#ffd94d';
      g.beginPath();
      g.arc(coin.x - cam.x, coin.y - cam.y + bob, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#b8860b';
      g.font = 'bold 12px Arial';
      g.textAlign = 'center';
      g.fillText('S', coin.x - cam.x, coin.y - cam.y + bob + 4);
    }
    // Mission target marker (pulsing ring + beam).
    const target = state.missionTarget();
    if (target) {
      const pulse = 26 + Math.sin(state.time * 5) * 6;
      g.strokeStyle = '#ffd94d';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(target.x - cam.x, target.y - cam.y, pulse, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(255,217,77,0.15)';
      g.beginPath();
      g.arc(target.x - cam.x, target.y - cam.y, pulse, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffd94d';
      g.beginPath();
      g.moveTo(target.x - cam.x, target.y - cam.y - 70);
      g.lineTo(target.x - cam.x - 10, target.y - cam.y - 44);
      g.lineTo(target.x - cam.x + 10, target.y - cam.y - 44);
      g.closePath();
      g.fill();
    }
    // Race checkpoints.
    if (state.missions.racePoints.length > 0) {
      state.missions.racePoints.forEach((pt, i) => {
        if (i < state.missions.raceIndex) return;
        const isNext = i === state.missions.raceIndex;
        g.strokeStyle = isNext ? '#ffd94d' : 'rgba(255,255,255,0.5)';
        g.lineWidth = isNext ? 4 : 2;
        g.beginPath();
        g.arc(pt.x - cam.x, pt.y - cam.y, isNext ? 30 : 22, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = isNext ? '#ffd94d' : '#fff';
        g.font = 'bold 20px Arial';
        g.textAlign = 'center';
        g.fillText(String(i + 1), pt.x - cam.x, pt.y - cam.y + 7);
      });
    }
    // Pedestrians.
    for (const ped of state.peds) {
      if (!onScreen(state, ped.x, ped.y, 30)) continue;
      drawPerson(g, ped.x - cam.x, ped.y - cam.y, ped.angle, ped.color, ped.walkPhase, ped.flee > 0);
    }
    // Traffic and parked cars.
    for (const car of state.cars) {
      if (!onScreen(state, car.x, car.y, 60)) continue;
      drawCar(g, car, cam, state.time);
    }
    // Roadblock cop cars.
    for (const car of state.roadblocks) {
      if (!onScreen(state, car.x, car.y, 60)) continue;
      drawCar(g, car, cam, state.time);
    }
    // Cop cars.
    for (const car of state.copCars) {
      if (!onScreen(state, car.x, car.y, 60)) continue;
      drawCar(g, car, cam, state.time);
      // Flashing light bar.
      const on = Math.floor(state.time * 6) % 2 === 0;
      g.fillStyle = on ? '#ff2d2d' : '#2f6df6';
      g.beginPath();
      g.arc(car.x - cam.x, car.y - cam.y - 6, 5, 0, Math.PI * 2);
      g.fill();
    }
    // Foot cops.
    for (const c of state.cops) {
      if (!onScreen(state, c.x, c.y, 30)) continue;
      drawPerson(g, c.x - cam.x, c.y - cam.y, c.angle, '#2f6df6', state.time * 6, false);
      g.fillStyle = '#1a3a8a';
      g.fillRect(c.x - cam.x - 7, c.y - cam.y - 20, 14, 5);
    }
    // Rival crew.
    for (const r of state.missions.rivals) {
      if (r.hp <= 0 || !onScreen(state, r.x, r.y, 30)) continue;
      drawPerson(g, r.x - cam.x, r.y - cam.y, r.angle, '#ff5a5a', state.time * 6, false);
      // Health bar.
      g.fillStyle = '#000';
      g.fillRect(r.x - cam.x - 14, r.y - cam.y - 26, 28, 5);
      g.fillStyle = '#ff5a5a';
      g.fillRect(r.x - cam.x - 14, r.y - cam.y - 26, 28 * clamp(r.hp / 50, 0, 1), 5);
    }
    // The player (on foot) or the player's car.
    const p = state.player;
    if (!p.car) {
      drawPerson(g, p.x - cam.x, p.y - cam.y, p.aim, COLORS.player, state.time * 8, false);
      // Aim line.
      g.strokeStyle = 'rgba(255,217,77,0.7)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(p.x - cam.x, p.y - cam.y);
      g.lineTo(p.x - cam.x + Math.cos(p.aim) * 60, p.y - cam.y + Math.sin(p.aim) * 60);
      g.stroke();
      // Muzzle flash.
      if (state.muzzle > 0) {
        g.fillStyle = '#fff2a0';
        g.beginPath();
        g.arc(p.x - cam.x + Math.cos(p.aim) * 30, p.y - cam.y + Math.sin(p.aim) * 30, 10, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Bullets.
    for (const b of state.bullets) {
      g.strokeStyle = '#ffe9a0';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(b.x - cam.x, b.y - cam.y);
      g.lineTo(b.x - cam.x - Math.cos(b.angle) * 14, b.y - cam.y - Math.sin(b.angle) * 14);
      g.stroke();
    }
    // Sparks and explosions.
    for (const s of state.sparks) {
      g.fillStyle = s.color;
      g.globalAlpha = clamp(s.life * 5, 0, 1);
      g.beginPath();
      g.arc(s.x - cam.x, s.y - cam.y, 4, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    for (const e of state.explosions) {
      const t = 1 - e.life / 0.7;
      g.fillStyle = `rgba(255,${Math.floor(160 - t * 120)},40,${clamp(1 - t, 0, 1)})`;
      g.beginPath();
      g.arc(e.x - cam.x, e.y - cam.y, e.r + t * 46, 0, Math.PI * 2);
      g.fill();
    }
    // Helicopter with its searchlight.
    if (state.heli) {
      const h = state.heli;
      const hx = h.x - cam.x;
      const hy = h.y - cam.y;
      g.fillStyle = 'rgba(255,255,200,0.10)';
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(p.x - cam.x - 40, p.y - cam.y - 40);
      g.lineTo(p.x - cam.x + 40, p.y - cam.y + 40);
      g.closePath();
      g.fill();
      g.save();
      g.translate(hx, hy);
      g.rotate(h.angle);
      g.fillStyle = '#2f6df6';
      g.fillRect(-26, -8, 52, 16);
      g.fillStyle = '#1a3a8a';
      g.fillRect(-6, -3, 12, 6);
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-34, 0);
      g.lineTo(34, 0);
      g.stroke();
      g.restore();
    }
    // Day/night tint.
    const night = state.dayTime;
    if (night > 0.75 || night < 0.15) {
      g.fillStyle = 'rgba(8,10,40,0.28)';
      g.fillRect(0, 0, W, H);
    } else if (night > 0.6) {
      g.fillStyle = 'rgba(255,120,40,0.10)';
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  };

  function onScreen(state, x, y, pad) {
    const cam = state.camera;
    return x > cam.x - pad && x < cam.x + cam.w + pad && y > cam.y - pad && y < cam.y + cam.h + pad;
  }

  return renderer;
}

function drawCar(g, car, cam, time) {
  const x = car.x - cam.x;
  const y = car.y - cam.y;
  g.save();
  g.translate(x, y);
  g.rotate(car.angle);
  // Shadow.
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(-car.len / 2 + 3, -car.wid / 2 + 3, car.len, car.wid);
  // Body.
  g.fillStyle = car.color;
  g.beginPath();
  g.roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 6);
  g.fill();
  // Cabin.
  g.fillStyle = 'rgba(20,30,50,0.9)';
  g.beginPath();
  g.roundRect(-car.len / 2 + 10, -car.wid / 2 + 4, car.len * 0.45, car.wid - 8, 4);
  g.fill();
  // Windshield + headlights.
  g.fillStyle = '#cfe8ff';
  g.fillRect(car.len / 2 - 6, -car.wid / 2 + 3, 3, car.wid - 6);
  g.fillStyle = '#fff2a0';
  g.fillRect(car.len / 2 - 2, -car.wid / 2 + 2, 3, 4);
  g.fillRect(car.len / 2 - 2, car.wid / 2 - 6, 3, 4);
  // Cop markings.
  if (car.cop) {
    g.fillStyle = '#fff';
    g.font = 'bold 9px Arial';
    g.textAlign = 'center';
    g.fillText('BAY PD', 0, 3);
  }
  if (car.van) {
    g.fillStyle = '#fff';
    g.font = 'bold 9px Arial';
    g.textAlign = 'center';
    g.fillText('ARMORED', 0, 3);
  }
  // Wreck smoke.
  if (car.wrecked) {
    g.fillStyle = 'rgba(60,60,60,0.6)';
    g.beginPath();
    g.arc(-6, -4, 8 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawPerson(g, x, y, angle, color, phase, fleeing) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  // Legs (two dots that swing while walking).
  const swing = Math.sin(phase) * 4;
  g.fillStyle = '#222';
  g.beginPath();
  g.arc(-4 + swing * 0.4, -5, 3.4, 0, Math.PI * 2);
  g.arc(-4 - swing * 0.4, 5, 3.4, 0, Math.PI * 2);
  g.fill();
  // Body.
  g.fillStyle = color;
  g.beginPath();
  g.arc(0, 0, 9, 0, Math.PI * 2);
  g.fill();
  // Head / facing.
  g.fillStyle = '#f2c89b';
  g.beginPath();
  g.arc(7, 0, 5.5, 0, Math.PI * 2);
  g.fill();
  // Fleeing: arms up (two small dots).
  if (fleeing) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(2, -11, 2.5, 0, Math.PI * 2);
    g.arc(2, 11, 2.5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
