// Save and load: localStorage, one slot, autosave after every mission.

const KEY = 'solmar-bay-save-v1';

export function saveGame(state, silent) {
  try {
    const p = state.player;
    const data = {
      x: p.x, y: p.y,
      health: p.health, armor: p.armor,
      cash: p.cash, respect: p.respect, coins: p.coins,
      weapon: p.weapon, ammo: p.ammo,
      missionIndex: state.missions.index,
      wanted: state.wanted,
      dayTime: state.dayTime,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    if (!silent) state.toast('Game saved');
    return true;
  } catch {
    return false;
  }
}

export function loadGame(state) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const p = state.player;
    p.x = d.x; p.y = d.y;
    p.health = d.health; p.armor = d.armor;
    p.cash = d.cash; p.respect = d.respect; p.coins = d.coins || 0;
    p.weapon = d.weapon || 0; p.ammo = d.ammo || [Infinity, 12, 0, 0];
    state.missions.index = d.missionIndex || 0;
    state.missions.step = 0;
    state.missions.started = false;
    state.wanted = 0;
    state.dayTime = d.dayTime || 0.35;
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}
