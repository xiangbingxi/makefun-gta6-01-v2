// SOLMAR BAY — world constants, districts, weapons, missions, ranks.
// All tuning numbers live here so the rest of the game reads them by name.

export const WORLD = {
  w: 4800,
  h: 3600,
  water: 160, // water border thickness around the island
  beach: 120, // sand ring inside the water
};

export const ROADS_X = [600, 1200, 1800, 2400, 3000, 3600, 4200];
export const ROADS_Y = [500, 1100, 1700, 2300, 2900];
export const ROAD_HALF = 60; // half the road width, asphalt + sidewalks

// Six districts, each a rectangle with its own palette and street feel.
export const DISTRICTS = [
  { name: 'Solmar Beach', x: 160, y: 160, w: 440, h: 3280, ground: '#e8d29a', roof: '#d9a066', accent: '#2e9e8f' },
  { name: 'The Strip', x: 1200, y: 160, w: 1800, h: 940, ground: '#3a3f5c', roof: '#7a5fd0', accent: '#ff5a7a' },
  { name: 'Little Havana', x: 160, y: 1700, w: 1640, h: 1740, ground: '#c98f4e', roof: '#e07b39', accent: '#ffd94d' },
  { name: 'Portside', x: 3600, y: 160, w: 1040, h: 1540, ground: '#5c6670', roof: '#8a94a0', accent: '#7dc4ff' },
  { name: 'Torre Heights', x: 3000, y: 1700, w: 1640, h: 1200, ground: '#4a4a58', roof: '#9aa4c0', accent: '#b78cff' },
  { name: 'Marina District', x: 1800, y: 2900, w: 1800, h: 540, ground: '#3f6d6a', roof: '#5fa88f', accent: '#7dffd4' },
];

// Landmark spots the game and the missions point at.
export const PLACES = {
  lunaBar: { x: 1250, y: 560, name: 'La Luna Bar' },
  casa: { x: 700, y: 2400, name: 'Casa del Sol' },
  gunShop: { x: 2350, y: 1150, name: 'Ironworks Guns' },
  spray: { x: 3550, y: 2350, name: 'Spray & Shine' },
  bank: { x: 3950, y: 1750, name: 'Torre Bank' },
  port: { x: 4150, y: 550, name: 'Portside Docks' },
  garage: { x: 2950, y: 2950, name: 'Luna Garage' },
  raceStart: { x: 1250, y: 1750, name: 'Street Kings Start' },
  crewBlock: { x: 900, y: 2350, name: 'Rival Block' },
  debtor: { x: 1850, y: 2350, name: 'Debt House' },
};

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', damage: 12, rate: 0.45, range: 46, auto: false, ammo: Infinity, price: 0 },
  { id: 'pistol', name: 'PISTOL', damage: 22, rate: 0.32, range: 520, auto: false, ammo: 12, price: 250 },
  { id: 'smg', name: 'SMG', damage: 13, rate: 0.09, range: 460, auto: true, ammo: 32, price: 900 },
  { id: 'shotgun', name: 'SHOTGUN', damage: 16, rate: 0.85, range: 300, auto: false, ammo: 6, price: 1400, pellets: 5 },
];

export const RANKS = [
  { at: 0, name: 'Street Punk' },
  { at: 500, name: 'Hustler' },
  { at: 1500, name: 'Wheelman' },
  { at: 3000, name: 'Shot Caller' },
  { at: 6000, name: 'Kingpin' },
];

export const MISSIONS = [
  {
    id: 'm1', title: 'FIRST WHEELS', reward: 200, respect: 120,
    text: 'Luna needs wheels. Steal any car and bring it to La Luna Bar.',
    steps: [
      { type: 'stealCar', text: 'Steal a car (walk up to one and press E)' },
      { type: 'reach', at: 'lunaBar', radius: 90, text: 'Drive it to La Luna Bar' },
    ],
  },
  {
    id: 'm2', title: 'THE DROP', reward: 450, respect: 200, time: 100,
    text: 'A package for Portside. No questions, no stops, 100 seconds.',
    steps: [
      { type: 'reach', at: 'lunaBar', radius: 90, text: 'Pick up the package at La Luna Bar' },
      { type: 'reach', at: 'port', radius: 100, text: 'Deliver it to the Portside Docks' },
    ],
  },
  {
    id: 'm3', title: 'COLLECT THE DEBT', reward: 600, respect: 260,
    text: 'A debtor in Little Havana owes Luna $600. Go collect it.',
    steps: [
      { type: 'reach', at: 'debtor', radius: 80, text: 'Find the debtor in Little Havana' },
      { type: 'hold', at: 'debtor', radius: 80, seconds: 3, text: 'Hold E to collect the debt' },
      { type: 'reach', at: 'lunaBar', radius: 90, text: 'Bring the cash back to Luna' },
    ],
  },
  {
    id: 'm4', title: 'HOT AND BOTHERED', reward: 500, respect: 300,
    text: 'The cops are all over you. Lose 3 stars of heat, any way you can.',
    steps: [
      { type: 'wanted', stars: 3, text: 'Raise your wanted level to 3 stars' },
      { type: 'loseWanted', text: 'Now lose all of it — hide, or pay for a paint job' },
    ],
  },
  {
    id: 'm5', title: 'THE ARMORED VAN', reward: 1200, respect: 450,
    text: 'An armored van sits at the docks. Take it. Bring it to the garage.',
    steps: [
      { type: 'reach', at: 'port', radius: 110, text: 'Find the armored van at Portside' },
      { type: 'stealVan', text: 'Steal the armored van' },
      { type: 'reach', at: 'garage', radius: 100, text: 'Drive it to Luna Garage' },
    ],
  },
  {
    id: 'm6', title: 'STREET KINGS', reward: 1500, respect: 550, time: 150,
    text: 'Five checkpoints, one street race, no rules. Beat the clock.',
    steps: [
      { type: 'reach', at: 'raceStart', radius: 90, text: 'Get to the start line' },
      { type: 'race', count: 5, text: 'Hit all 5 checkpoints in order' },
    ],
  },
  {
    id: 'm7', title: 'CREW WAR', reward: 1800, respect: 700,
    text: 'A rival crew moved into Little Havana. Clear them out.',
    steps: [
      { type: 'reach', at: 'crewBlock', radius: 120, text: 'Go to the rival block' },
      { type: 'kill', count: 6, text: 'Take out the rival crew (0/6)' },
    ],
  },
  {
    id: 'm8', title: 'THE TORRE JOB', reward: 5000, respect: 1500,
    text: 'The big one. Rob the Torre Bank, then lose 4 stars of heat.',
    steps: [
      { type: 'reach', at: 'bank', radius: 100, text: 'Get to Torre Bank' },
      { type: 'hold', at: 'bank', radius: 100, seconds: 5, text: 'Hold E to crack the vault' },
      { type: 'wanted', stars: 4, text: 'The alarm is up — 4 stars and counting' },
      { type: 'loseWanted', text: 'Lose the heat and get back to La Luna Bar' },
      { type: 'reach', at: 'lunaBar', radius: 90, text: 'Bring the money home' },
    ],
  },
];

export const PLAYER = {
  walkSpeed: 190,
  sprintSpeed: 300,
  radius: 14,
  health: 100,
  armor: 100,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverse: 200,
  maxSpeed: 560,
  turn: 2.6,
  grip: 0.92,
  radius: 20,
};

export const COP = {
  carSpeed: 500,
  footSpeed: 170,
  ramDamage: 8,
  shootRange: 380,
  arrestRange: 40,
};

export const COLORS = {
  player: '#ffd94d',
  playerCar: '#ffd94d',
  cop: '#2f6df6',
  copCar: '#2f6df6',
  heli: '#2f6df6',
  ped: '#e8e8e8',
  enemy: '#ff5a5a',
  marker: '#ffd94d',
  coin: '#ffd94d',
  asphalt: '#33363e',
  roadLine: '#e8d44d',
  sidewalk: '#6a6a72',
};
