// world.js — membangun Sundara Bay: grid jalan, blok bangunan/taman/lahan parkir,
// tempat-tempat bernama, pantai & laut; plus helper tabrakan dan jaringan jalan.

import {
  WORLD_W, WORLD_H, ROAD_W, ROADS_V, ROADS_H, BEACH_X, SEA_X, SEA_EDGE,
  BUILDING_COLORS, ROOF_COLORS, AWNING_COLORS,
} from './config.js';

// Rentang blok di antara jalan: [awal, akhir] per sumbu.
function blockSpans(centers, limit) {
  const spans = [];
  let prev = 0;
  for (const c of centers) {
    spans.push([prev, c - ROAD_W / 2]);
    prev = c + ROAD_W / 2;
  }
  spans.push([prev, limit]);
  return spans;
}

const SHOP_NAMES = ['Toko Kelontong Sinar', 'Kedai Kopi Pagi', 'Foto Studio Laras', 'Toko Roti Melati', 'Bengkel Kecil Jaya', 'Salon Ayu', 'Toko Buku Sore', 'Warung Nasi Padang Rindu', 'Apotek Sehat', 'Toko Bunga Segar', 'Laundry Kilat', 'Kedai Mie Bakso'];
const OFFICE_NAMES = ['Kantor Pos Cabang', 'Bank Nusantara Kecil', 'Studio Arsitek Garis', 'Kantor Lurah Sundara', 'Klinik Gigi Senyum'];

export function buildWorld(rng) {
  const cols = blockSpans(ROADS_V, BEACH_X); // kolom terakhir berhenti di pasir
  const rows = blockSpans(ROADS_H, WORLD_H);
  const buildings = [];
  const parks = [];
  const lots = [];
  const places = {};

  // Penempatan blok khusus: [kolom, baris] -> kunci tempat.
  const special = {
    '1,1': 'warung', '2,4': 'bengkel', '4,2': 'carpark',
    '5,5': 'hideout', '0,3': 'home', '5,0': 'hospital',
  };
  const placeLabel = {
    warung: 'Warung Bu Ratna', bengkel: 'Bengkel Dedi', carpark: 'Parkir Timur',
    hideout: 'Gudang Arus Liar', home: 'Kos Riko', hospital: 'RS Sundara',
  };

  let shopIdx = 0, officeIdx = 0;
  for (let ci = 0; ci < cols.length; ci++) {
    for (let ri = 0; ri < rows.length; ri++) {
      const [x0, x1] = cols[ci];
      const [y0, y1] = rows[ri];
      const key = ci + ',' + ri;
      const bx = x0 + 16, by = y0 + 16, bw = (x1 - x0) - 32, bh = (y1 - y0) - 32;
      if (bw < 90 || bh < 90) continue;
      const spec = special[key];
      if (spec === 'carpark') {
        lots.push({ x: bx, y: by, w: bw, h: bh, name: placeLabel.carpark });
        places.carpark = { x: bx + bw / 2, y: by + bh + 26, label: placeLabel.carpark, block: { x: bx, y: by, w: bw, h: bh } };
        continue;
      }
      if (spec) {
        const b = makeBuilding(rng, bx, by, bw, bh, spec === 'warung' || spec === 'bengkel' ? 'shop' : spec === 'hideout' ? 'warehouse' : spec === 'hospital' ? 'office' : 'house', placeLabel[spec]);
        buildings.push(b);
        places[spec] = { x: bx + bw / 2, y: by + bh + 26, label: placeLabel[spec], block: { x: bx, y: by, w: bw, h: bh } };
        continue;
      }
      const roll = rng.next();
      if (roll < 0.16) {
        parks.push({ x: bx, y: by, w: bw, h: bh, palms: scatterPalms(rng, bx, by, bw, bh) });
      } else if (roll < 0.34) {
        lots.push({ x: bx, y: by, w: bw, h: bh, name: '' });
      } else {
        fillBuildings(rng, bx, by, bw, bh, buildings, () => {
          if (rng.chance(0.42)) return { type: 'shop', name: SHOP_NAMES[shopIdx++ % SHOP_NAMES.length] };
          if (rng.chance(0.3)) return { type: 'office', name: OFFICE_NAMES[officeIdx++ % OFFICE_NAMES.length] };
          return { type: rng.chance(0.5) ? 'house' : 'office', name: '' };
        });
      }
    }
  }

  // Palem di sepanjang pantai.
  const beachPalms = [];
  for (let y = 90; y < WORLD_H - 60; y += rng.int(150, 260)) {
    beachPalms.push({ x: BEACH_X + rng.int(36, 150), y, s: rng.range(0.8, 1.3) });
  }

  return {
    w: WORLD_W, h: WORLD_H, buildings, parks, lots, places, beachPalms,
    colliders: buildings, seaEdge: SEA_EDGE,
  };
}

function makeBuilding(rng, x, y, w, h, type, name) {
  return {
    x, y, w, h, type, name: name || '',
    color: rng.pick(BUILDING_COLORS),
    roof: rng.pick(ROOF_COLORS),
    awning: rng.pick(AWNING_COLORS),
    seed: rng.int(1, 1e9),
    floors: rng.int(2, 5),
  };
}

function fillBuildings(rng, bx, by, bw, bh, out, styleFn) {
  // Satu gedung besar atau petak 2x2 dengan gang sempit.
  if (rng.chance(0.45)) {
    const s = styleFn();
    out.push(makeBuilding(rng, bx + 8, by + 8, bw - 16, bh - 16, s.type, s.name));
    return;
  }
  const gap = 16;
  const cw = (bw - gap) / 2, ch = (bh - gap) / 2;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const s = styleFn();
      out.push(makeBuilding(rng, bx + i * (cw + gap) + 4, by + j * (ch + gap) + 4, cw - 8, ch - 8, s.type, s.name));
    }
  }
}

function scatterPalms(rng, x, y, w, h) {
  const palms = [];
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    palms.push({ x: x + rng.range(24, w - 24), y: y + rng.range(24, h - 24), s: rng.range(0.75, 1.25) });
  }
  return palms;
}

// --- Helper geometri & tabrakan ---

export function clampToWorld(world, x, y, r) {
  return {
    x: Math.max(r, Math.min(world.w - r, x)),
    y: Math.max(r, Math.min(world.h - r, y)),
  };
}

// Geser lingkaran keluar dari semua rect bangunan + garis laut.
// Mengembalikan posisi terkoreksi dan apakah terjadi tabrakan.
export function collideCircle(world, x, y, r) {
  let hit = false;
  if (x + r > world.seaEdge) { x = world.seaEdge - r; hit = true; }
  if (x < r) { x = r; hit = true; }
  if (y < r) { y = r; hit = true; }
  if (y > world.h - r) { y = world.h - r; hit = true; }
  const rects = world.colliders;
  for (let i = 0; i < rects.length; i++) {
    const b = rects[i];
    if (x < b.x - r || x > b.x + b.w + r || y < b.y - r || y > b.y + b.h + r) continue;
    const cx = Math.max(b.x, Math.min(b.x + b.w, x));
    const cy = Math.max(b.y, Math.min(b.y + b.h, y));
    let dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    } else {
      // Pusat di dalam rect: dorong lewat sisi terdekat.
      const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
      const m = Math.min(left, right, top, bot);
      if (m === left) x = b.x - r;
      else if (m === right) x = b.x + b.w + r;
      else if (m === top) y = b.y - r;
      else y = b.y + b.h + r;
    }
  }
  return { x, y, hit };
}

export function isOnRoad(x, y) {
  for (const cx of ROADS_V) if (Math.abs(x - cx) <= ROAD_W / 2) return true;
  for (const cy of ROADS_H) if (Math.abs(y - cy) <= ROAD_W / 2) return true;
  return false;
}

// Semua titik simpang jalan (node jaringan lalu lintas).
export function intersections() {
  const nodes = [];
  for (const x of ROADS_V) for (const y of ROADS_H) nodes.push({ x, y });
  return nodes;
}

export function nearestNode(x, y) {
  let best = null, bd = Infinity;
  for (const nx of ROADS_V) for (const ny of ROADS_H) {
    const d = (nx - x) * (nx - x) + (ny - y) * (ny - y);
    if (d < bd) { bd = d; best = { x: nx, y: ny }; }
  }
  return best;
}

// Titik acak di atas jalan (untuk spawn polisi / traffic jauh dari pemain).
export function randomRoadPoint(rng, minX = 0) {
  if (rng.chance(0.55)) {
    const x = rng.pick(ROADS_V);
    return { x: x + rng.range(-ROAD_W / 4, ROAD_W / 4), y: rng.range(60, WORLD_H - 60) };
  }
  const y = rng.pick(ROADS_H);
  return { x: Math.max(minX, rng.range(60, 2900)), y: y + rng.range(-ROAD_W / 4, ROAD_W / 4) };
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
