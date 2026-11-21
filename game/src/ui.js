// HUD, minimap, menus and toasts: everything drawn on DOM or on the
// small minimap canvas. The world itself is drawn by render.js.

import { WEAPONS, PLACES, WORLD } from './config.js';
import { clamp, dist, fmtCash } from './util.js';
import { currentMission, currentStep, rankName } from './missions.js';
import { districtAt } from './city.js';

export function createUI(state) {
  const $ = (id) => document.getElementById(id);
  const ui = {
    stars: $('stars'),
    cash: $('cash'),
    respect: $('respect'),
    missionTitle: $('mission-title'),
    missionText: $('mission-text'),
    missionTimer: $('mission-timer'),
    district: $('district'),
    healthFill: $('health-fill'),
    healthText: $('health-text'),
    armorFill: $('armor-fill'),
    armorText: $('armor-text'),
    weaponName: $('weapon-name'),
    ammo: $('ammo'),
    speed: $('speed'),
    radio: $('radio'),
    toastEl: $('toast'),
    hint: $('hint'),
    menu: $('menu'),
    pause: $('pause'),
    dead: $('dead'),
    deadTitle: $('dead-title'),
    deadText: $('dead-text'),
    help: $('help'),
    minimap: $('minimap'),
    lastDistrict: '',
    toastTimer: 0,
  };

  ui.showToast = function (text, seconds) {
    ui.toastEl.textContent = text;
    ui.toastEl.style.opacity = '1';
    ui.toastTimer = seconds || 2.5;
  };

  ui.update = function (dt) {
    const p = state.player;
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < state.wanted ? '★' : '<span class="dim">★</span>';
    }
    ui.stars.innerHTML = stars;
    ui.cash.textContent = fmtCash(p.cash);
    ui.respect.textContent = rankName(p.respect);
    // Mission line.
    const m = currentMission(state);
    const step = currentStep(state);
    if (m && state.missions.started) {
      ui.missionTitle.textContent = m.title;
      let text = step ? step.text : m.text;
      if (step && step.type === 'kill') {
        text = `Take out the rival crew (${state.missions.kills}/${step.count})`;
      }
      if (step && step.type === 'hold') {
        text = `${step.text} (${Math.max(0, step.seconds - state.missions.holdT).toFixed(1)}s)`;
      }
      if (step && step.type === 'race') {
        text = `Hit all 5 checkpoints in order (${state.missions.raceIndex}/5)`;
      }
      ui.missionText.textContent = text;
      ui.missionTimer.textContent = m.time ? Math.ceil(Math.max(0, state.missions.timer)) + 's' : '';
    } else if (m) {
      ui.missionTitle.textContent = 'NEXT JOB: ' + m.title;
      ui.missionText.textContent = 'Go to La Luna Bar and talk to Luna (E)';
      ui.missionTimer.textContent = '';
    } else {
      ui.missionTitle.textContent = 'SOLMAR BAY';
      ui.missionText.textContent = 'All jobs done — the city is yours';
      ui.missionTimer.textContent = '';
    }
    // District banner.
    const d = districtAt(p.x, p.y);
    if (d.name !== ui.lastDistrict) {
      ui.lastDistrict = d.name;
      ui.district.textContent = d.name;
      ui.district.style.opacity = '1';
      setTimeout(() => { ui.district.style.opacity = '0.55'; }, 2600);
    }
    // Health / armor.
    ui.healthFill.style.width = clamp(p.health, 0, 100) + '%';
    ui.healthText.textContent = 'HEALTH ' + Math.ceil(p.health);
    ui.armorFill.style.width = clamp(p.armor, 0, 100) + '%';
    ui.armorText.textContent = p.armor > 0 ? 'ARMOR ' + Math.ceil(p.armor) : '';
    // Weapon, ammo, speed, radio.
    const w = WEAPONS[p.weapon];
    ui.weaponName.textContent = w.name;
    ui.ammo.textContent = w.ammo === Infinity ? '∞' : `AMMO ${p.ammo[p.weapon]}`;
    const spd = p.car ? Math.abs(p.car.speed) : 0;
    ui.speed.textContent = p.car ? Math.round(spd * 0.14) + ' mph' : '';
    ui.radio.textContent = state.audio.stationName();
    // Toast fade.
    if (ui.toastTimer > 0) {
      ui.toastTimer -= dt;
      if (ui.toastTimer <= 0) ui.toastEl.style.opacity = '0';
    }
    // Context hint.
    ui.hint.textContent = state.hintText || '';
    // Minimap.
    ui.drawMinimap();
  };

  ui.drawMinimap = function () {
    const c = ui.minimap;
    const g = c.getContext('2d');
    const W = c.width;
    const H = c.height;
    const sx = W / WORLD.w;
    const sy = H / WORLD.h;
    g.clearRect(0, 0, W, H);
    // Water and land.
    g.fillStyle = '#1d5f8a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#4a4a52';
    g.fillRect(WORLD.water * sx, WORLD.water * sy, (WORLD.w - WORLD.water * 2) * sx, (WORLD.h - WORLD.water * 2) * sy);
    // Roads.
    g.strokeStyle = '#8a8a92';
    g.lineWidth = 1;
    for (const rx of [600, 1200, 1800, 2400, 3000, 3600, 4200]) {
      g.beginPath(); g.moveTo(rx * sx, 0); g.lineTo(rx * sx, H); g.stroke();
    }
    for (const ry of [500, 1100, 1700, 2300, 2900]) {
      g.beginPath(); g.moveTo(0, ry * sy); g.lineTo(W, ry * sy); g.stroke();
    }
    // Landmarks.
    g.fillStyle = '#ffd94d';
    for (const key of Object.keys(PLACES)) {
      const pl = PLACES[key];
      g.fillRect(pl.x * sx - 2, pl.y * sy - 2, 4, 4);
    }
    // Mission target.
    const target = state.missionTarget();
    if (target) {
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      g.strokeStyle = '#ffd94d';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(target.x * sx, target.y * sy, pulse, 0, Math.PI * 2);
      g.stroke();
    }
    // Coins.
    g.fillStyle = '#ffd94d';
    for (const coin of state.coins) {
      g.fillRect(coin.x * sx - 1, coin.y * sy - 1, 2, 2);
    }
    // Cop cars (blue) and helicopter.
    g.fillStyle = '#5a8dff';
    for (const car of state.copCars) {
      g.fillRect(car.x * sx - 2, car.y * sy - 2, 4, 4);
    }
    if (state.heli) {
      g.beginPath();
      g.arc(state.heli.x * sx, state.heli.y * sy, 4, 0, Math.PI * 2);
      g.fill();
    }
    // Player (white dot with yellow ring).
    const p = state.player;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffd94d';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x * sx, p.y * sy, 6, 0, Math.PI * 2);
    g.stroke();
    // View rectangle.
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 1;
    g.strokeRect(state.camera.x * sx, state.camera.y * sy, state.camera.w * sx, state.camera.h * sy);
  };

  return ui;
}
