// The static city of Sundara Bay: a grid of roads over city blocks, one
// building or park or car park per block, palm trees, a beach and the sea on
// the east edge. Also the geometry helpers every moving thing shares: road
// tests, building collision and circle resolution. No drawing happens here.

import { BUILDING_STYLES, ROADS, WORLD } from './config.js';

/** Distance from a value to the nearest road centre line in `lines`. */
function nearestLine(value, lines) {
  let best = Infinity;
  for (const line of lines) best = Math.min(best, Math.abs(value - line));
  return best;
}

/** True when (x, y) sits on asphalt: within half a road width of a road centre. */
export function isOnRoad(x, y) {
  const half = ROADS.width / 2;
  return nearestLine(x, ROADS.vertical) <= half || nearestLine(y, ROADS.horizontal) <= half;
}

/** True when (x, y) is open water, where nobody walks or drives. */
export function isWater(x, y) {
  return x > WORLD.waterX;
}

/** True when (x, y) is beach sand. */
export function isSand(x, y) {
  return x > WORLD.beachX && x <= WORLD.waterX;
}

/** The block rectangle between two neighbouring vertical and horizontal roads. */
function blockRect(col, row) {
  const inset = ROADS.width / 2 + 14;
  const x0 = ROADS.vertical[col] + inset;
  const x1 = ROADS.vertical[col + 1] - inset;
  const y0 = ROADS.horizontal[row] + inset;
  const y1 = ROADS.horizontal[row + 1] - inset;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Build the whole city from a seeded random source: buildings with styles,
 * parks, car parks with parking spots, palm trees, and the named places the
 * story uses (safehouse, hospital, garage, warung, lookout).
 */
export function createCity(random) {
  const buildings = [];
  const parks = [];
  const carParks = [];
  const palms = [];

  const cols = ROADS.vertical.length - 1;
  const rows = ROADS.horizontal.length - 1;
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const rect = blockRect(col, row);
      const roll = random.next();
      if (roll < 0.14) {
        parks.push(rect);
        for (let i = 0; i < 5; i += 1) {
          palms.push({ x: random.range(rect.x + 16, rect.x + rect.w - 16), y: random.range(rect.y + 16, rect.y + rect.h - 16) });
        }
      } else if (roll < 0.26) {
        const spots = [];
        for (let sx = rect.x + 34; sx < rect.x + rect.w - 20; sx += 52) {
          for (let sy = rect.y + 34; sy < rect.y + rect.h - 20; sy += 64) {
            spots.push({ x: sx, y: sy, angle: 0 });
          }
        }
        carParks.push({ rect, spots });
      } else {
        const style = random.pick(BUILDING_STYLES);
        const floors = random.int(2, 7);
        buildings.push({
          x: rect.x + 10, y: rect.y + 10, w: rect.w - 20, h: rect.h - 20,
          wall: style.wall, roof: style.roof, floors,
          name: '',
        });
      }
    }
  }

  // Palms line the promenade between the last road and the beach.
  for (let y = 60; y < WORLD.height - 40; y += 130) {
    palms.push({ x: WORLD.beachX - random.range(30, 90), y: y + random.range(-16, 16) });
  }

  // Named story places, pinned to fixed buildings so missions can point at them.
  const named = [
    { name: 'Warung Bu Ratna', col: 1, row: 1 },
    { name: 'Bengkel Dedi', col: 3, row: 2 },
    { name: 'Klinik Pesisir', col: 0, row: 3 },
    { name: 'Menara Pandang', col: 4, row: 0 },
    { name: 'Kontrakan Riko', col: 1, row: 3 },
  ];
  const places = {};
  for (const spec of named) {
    const rect = blockRect(spec.col, spec.row);
    places[spec.name] = { name: spec.name, x: rect.x + rect.w / 2, y: rect.y + rect.h + 26 };
  }

  return {
    buildings,
    parks,
    carParks,
    palms,
    places,
    safehouse: places['Kontrakan Riko'],
    hospital: places['Klinik Pesisir'],
  };
}

/** True when a circle at (x, y) with radius r overlaps any building. */
export function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/**
 * Push a circle (an object with x, y) out of every building it overlaps and
 * keep it inside the world and out of the sea. Returns true when it hit.
 */
export function resolveCircle(city, pos, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    let dx = pos.x - nx;
    let dy = pos.y - ny;
    let d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 === 0) { pos.x = b.x - r; continue; }
    const d = Math.sqrt(d2);
    pos.x = nx + (dx / d) * r;
    pos.y = ny + (dy / d) * r;
    dx = pos.x - nx; dy = pos.y - ny; d2 = dx * dx + dy * dy;
  }
  if (pos.x < r) { pos.x = r; hit = true; }
  if (pos.y < r) { pos.y = r; hit = true; }
  if (pos.x > WORLD.waterX - r) { pos.x = WORLD.waterX - r; hit = true; }
  if (pos.y > WORLD.height - r) { pos.y = WORLD.height - r; hit = true; }
  return hit;
}

/** Angle helpers shared by cars, police and the player. */
export function angleLerp(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}
