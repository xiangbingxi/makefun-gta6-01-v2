// The island city: layout, districts, buildings, roads, and the
// prerendered static layer the renderer blits every frame.
// The city is generated once from a fixed seed, so it is identical every load.

import { WORLD, ROADS_X, ROADS_Y, ROAD_HALF, DISTRICTS, PLACES } from './config.js';
import { clamp, mulberry32, rand } from './util.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

// A point is on a road if it is close to any road centerline.
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_HALF) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_HALF) return true;
  return false;
}

// Nearest point on the road network (used to snap traffic and parked cars).
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

// A random point on a road, away from the map edge.
export function randomRoadPoint() {
  if (Math.random() < 0.5) {
    const rx = ROADS_X[Math.floor(Math.random() * ROADS_X.length)];
    return { x: rx + rand(-28, 28), y: rand(300, WORLD.h - 300), vertical: true };
  }
  const ry = ROADS_Y[Math.floor(Math.random() * ROADS_Y.length)];
  return { x: rand(300, WORLD.w - 300), y: ry + rand(-28, 28), vertical: false };
}

// Build the city: blocks of buildings between the roads, plus parks,
// the marina water, the port cranes and the beach. Returns { buildings, parks, piers }.
export function buildCity() {
  const rng = mulberry32(20261121);
  const buildings = [];
  const parks = [];
  const piers = [];

  const xs = [WORLD.water + WORLD.beach, ...ROADS_X, WORLD.w - WORLD.water - WORLD.beach];
  const ys = [WORLD.water + WORLD.beach, ...ROADS_Y, WORLD.h - WORLD.water - WORLD.beach];

  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + ROAD_HALF + 14;
      const x1 = xs[bi + 1] - ROAD_HALF - 14;
      const y0 = ys[bj] + ROAD_HALF + 14;
      const y1 = ys[bj + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // A few blocks are parks, the rest are buildings.
      if (rng() < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: Math.floor(rng() * 8) + 4 });
        continue;
      }
      const cols = Math.max(1, Math.floor((x1 - x0) / 150));
      const rows = Math.max(1, Math.floor((y1 - y0) / 150));
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < 0.12) continue; // empty lot
          const bx = x0 + c * cw + 8;
          const by = y0 + r * ch + 8;
          const bw = cw - 16;
          const bh = ch - 16;
          const d = districtAt(bx + bw / 2, by + bh / 2);
          const tall = d.name === 'Torre Heights' || d.name === 'The Strip';
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            roof: d.roof, edge: shade(d.roof, -24),
            tall,
            windows: tall ? Math.floor(rng() * 5) + 3 : 0,
            sign: d.name === 'The Strip' && rng() < 0.3,
          });
        }
      }
    }
  }

  // Marina piers on the south-east water.
  for (let i = 0; i < 4; i++) {
    piers.push({ x: 2100 + i * 320, y: WORLD.h - WORLD.water - 30, w: 60, h: 130 });
  }
  return { buildings, parks, piers };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

// Paint the whole static city onto one offscreen canvas, once.
export function prerenderCity(city) {
  const c = document.createElement('canvas');
  c.width = WORLD.w;
  c.height = WORLD.h;
  const g = c.getContext('2d');

  // Ocean.
  g.fillStyle = '#1d5f8a';
  g.fillRect(0, 0, WORLD.w, WORLD.h);
  // Gentle waves.
  g.strokeStyle = 'rgba(255,255,255,0.10)';
  g.lineWidth = 3;
  for (let y = 40; y < WORLD.h; y += 130) {
    g.beginPath();
    for (let x = 0; x <= WORLD.w; x += 90) {
      const yy = y + Math.sin(x * 0.01 + y) * 8;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
  // Sand ring.
  g.fillStyle = '#e8d29a';
  g.fillRect(WORLD.water, WORLD.water, WORLD.w - WORLD.water * 2, WORLD.h - WORLD.water * 2);
  // Land base.
  g.fillStyle = '#4a4a52';
  g.fillRect(
    WORLD.water + WORLD.beach, WORLD.water + WORLD.beach,
    WORLD.w - (WORLD.water + WORLD.beach) * 2, WORLD.h - (WORLD.water + WORLD.beach) * 2,
  );
  // District ground tints.
  for (const d of DISTRICTS) {
    g.fillStyle = d.ground;
    g.globalAlpha = 0.55;
    g.fillRect(d.x, d.y, d.w, d.h);
    g.globalAlpha = 1;
  }
  // Parks.
  for (const p of city.parks) {
    g.fillStyle = '#3f7a3a';
    g.fillRect(p.x, p.y, p.w, p.h);
    g.fillStyle = '#2f6b2f';
    const prng = mulberry32(Math.floor(p.x + p.y));
    for (let i = 0; i < p.trees; i++) {
      const tx = p.x + 14 + prng() * (p.w - 28);
      const ty = p.y + 14 + prng() * (p.h - 28);
      g.beginPath();
      g.arc(tx, ty, 10 + prng() * 8, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Marina water inlet.
  g.fillStyle = '#1d5f8a';
  g.fillRect(1900, WORLD.h - WORLD.water - WORLD.beach - 40, 1500, 200);
  // Roads: sidewalks then asphalt.
  g.fillStyle = '#6a6a72';
  for (const rx of ROADS_X) g.fillRect(rx - ROAD_HALF, WORLD.water + WORLD.beach, ROAD_HALF * 2, WORLD.h - (WORLD.water + WORLD.beach) * 2);
  for (const ry of ROADS_Y) g.fillRect(WORLD.water + WORLD.beach, ry - ROAD_HALF, WORLD.w - (WORLD.water + WORLD.beach) * 2, ROAD_HALF * 2);
  g.fillStyle = '#33363e';
  for (const rx of ROADS_X) g.fillRect(rx - ROAD_HALF + 14, WORLD.water + WORLD.beach, (ROAD_HALF - 14) * 2, WORLD.h - (WORLD.water + WORLD.beach) * 2);
  for (const ry of ROADS_Y) g.fillRect(WORLD.water + WORLD.beach, ry - ROAD_HALF + 14, WORLD.w - (WORLD.water + WORLD.beach) * 2, (ROAD_HALF - 14) * 2);
  // Lane dashes.
  g.fillStyle = '#e8d44d';
  for (const rx of ROADS_X) {
    for (let y = WORLD.water + WORLD.beach + 30; y < WORLD.h - WORLD.water - WORLD.beach; y += 70) {
      g.fillRect(rx - 2, y, 4, 34);
    }
  }
  for (const ry of ROADS_Y) {
    for (let x = WORLD.water + WORLD.beach + 30; x < WORLD.w - WORLD.water - WORLD.beach; x += 70) {
      g.fillRect(x, ry - 2, 34, 4);
    }
  }
  // Crosswalks at intersections.
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      for (let i = -3; i <= 3; i++) {
        g.fillRect(rx - ROAD_HALF + 18 + i * 12, ry - ROAD_HALF + 6, 6, 16);
        g.fillRect(rx - ROAD_HALF + 18 + i * 12, ry + ROAD_HALF - 22, 6, 16);
      }
    }
  }
  // Buildings: rooftop, edge, windows, neon signs on The Strip.
  for (const b of city.buildings) {
    g.fillStyle = b.roof;
    g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = b.edge;
    g.lineWidth = 3;
    g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    if (b.tall) {
      g.fillStyle = 'rgba(255,255,180,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + Math.floor(b.x)) % 5 === 0) {
            g.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 26, 10, 8);
          }
        }
      }
    }
    if (b.sign) {
      g.fillStyle = '#ff5a7a';
      g.fillRect(b.x + b.w / 2 - 14, b.y - 6, 28, 10);
    }
  }
  // Port cranes.
  g.strokeStyle = '#c8a24d';
  g.lineWidth = 8;
  for (let i = 0; i < 3; i++) {
    const cx = 3900 + i * 180;
    g.beginPath();
    g.moveTo(cx, 300);
    g.lineTo(cx, 180);
    g.lineTo(cx + 120, 180);
    g.stroke();
  }
  // Piers.
  g.fillStyle = '#8a6f4d';
  for (const p of city.piers) g.fillRect(p.x, p.y, p.w, p.h);
  // District name labels painted on the ground.
  g.font = 'bold 44px Arial';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,255,255,0.28)';
  for (const d of DISTRICTS) {
    g.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
  }
  // Landmark labels.
  g.font = 'bold 20px Arial';
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    g.fillText(p.name, p.x, p.y - 26);
  }
  return c;
}

// Is a point blocked by a building (for on-foot collision)?
export function blockedByBuilding(city, x, y, pad) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

// Push a circle out of buildings; returns corrected position.
export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 === 0) { x = b.x - r; continue; }
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      y = ny + (dy / d) * r;
    }
  }
  return { x, y };
}
