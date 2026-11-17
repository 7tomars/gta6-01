// render.js — menggambar dunia Sundara Bay ke canvas: tanah, jalan, gedung
// berparapet & berbayangan, taman, pantai berbusa, laut berkilau, kendaraan
// berdetail, pejalan kaki, pemain, dan partikel. Semua prosedural, tanpa aset.

import { PALETTE, ROADS_V, ROADS_H, ROAD_W, BEACH_X, SEA_X } from './config.js';
import { hash2 } from './rng.js';

export function drawWorld(ctx, state) {
  const cam = state.cam;
  const vw = state.view.w, vh = state.view.h;
  const view = { x: cam.x, y: cam.y, w: vw, h: vh };
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, vw, vh);
  drawGroundDetails(ctx, state, view);
  drawRoads(ctx, view);
  drawParksAndLots(ctx, state, view);
  drawBeachAndSea(ctx, state, view);
  drawBuildings(ctx, state, view);
  for (const car of state.allCars) if (car.parked) drawCar(ctx, state, car, view);
  for (const car of state.allCars) if (!car.parked) drawCar(ctx, state, car, view);
  for (const ped of state.peds) drawPed(ctx, state, ped, view);
  if (!state.player.car) drawPlayer(ctx, state, view);
  drawParticles(ctx, state, view);
  if (state.mode === 'play' && state.missions) drawObjectiveMarkers(ctx, state, view);
}

// Penanda objektif di dunia: cincin berdenyut emas (cerita) / cyan (sampingan).
function drawObjectiveMarkers(ctx, state, view) {
  const story = state.missions.storyObjective(state);
  if (story && !story.noMarker) marker(ctx, story.x - view.x, story.y - view.y, '#ffca28', state.time);
  const side = state.missions.sideObjective(state);
  if (side) marker(ctx, side.x - view.x, side.y - view.y, '#4dd0e1', state.time);
}

function marker(ctx, x, y, color, t) {
  const pulse = Math.sin(t * 5) * 4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 20 + pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(x, y - 34 - pulse);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
}

function inView(view, x, y, w, h) {
  return x + w >= view.x - 40 && y + h >= view.y - 40 && x <= view.x + view.w + 40 && y <= view.y + view.h + 40;
}

function drawGroundDetails(ctx, state, view) {
  // Bintik rumput deterministik per sel 90px.
  ctx.fillStyle = PALETTE.grassDark;
  const s = 90;
  const x0 = Math.floor(view.x / s), x1 = Math.floor((view.x + view.w) / s);
  const y0 = Math.floor(view.y / s), y1 = Math.floor((view.y + view.h) / s);
  for (let i = x0; i <= x1; i++) {
    for (let j = y0; j <= y1; j++) {
      if (hash2(i, j) > 0.55) {
        ctx.globalAlpha = 0.25;
        ctx.fillRect(i * s + hash2(j, i) * 50 - view.x, j * s + hash2(i * 3, j) * 50 - view.y, 26, 15);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawRoads(ctx, view) {
  // Trotoar (lebih lebar) lalu aspal di atasnya.
  for (const layer of [{ w: ROAD_W + 38, c: PALETTE.sidewalk }, { w: ROAD_W, c: PALETTE.asphalt }]) {
    ctx.fillStyle = layer.c;
    for (const x of ROADS_V) {
      if (x + layer.w / 2 < view.x || x - layer.w / 2 > view.x + view.w) continue;
      ctx.fillRect(x - layer.w / 2 - view.x, -view.y, layer.w, 2640);
    }
    for (const y of ROADS_H) {
      if (y + layer.w / 2 < view.y || y - layer.w / 2 > view.y + view.h) continue;
      ctx.fillRect(-view.x, y - layer.w / 2 - view.y, 3600, layer.w);
    }
  }
  // Garis tepi jalan.
  ctx.fillStyle = PALETTE.asphaltEdge;
  for (const x of ROADS_V) {
    ctx.fillRect(x - ROAD_W / 2 - view.x, -view.y, 3, 2640);
    ctx.fillRect(x + ROAD_W / 2 - 3 - view.x, -view.y, 3, 2640);
  }
  for (const y of ROADS_H) {
    ctx.fillRect(-view.x, y - ROAD_W / 2 - view.y, 3600, 3);
    ctx.fillRect(-view.x, y + ROAD_W / 2 - 3 - view.y, 3600, 3);
  }
  // Marka putus-putus di tengah, berhenti di simpang.
  ctx.fillStyle = PALETTE.laneDash;
  for (const x of ROADS_V) {
    if (x < view.x - 10 || x > view.x + view.w + 10) continue;
    let prev = 0;
    for (const hy of [...ROADS_H, 2640]) {
      dashV(ctx, x - view.x, prev + ROAD_W / 2 + 10 - view.y, hy - ROAD_W / 2 - 10 - view.y);
      prev = hy;
    }
  }
  for (const y of ROADS_H) {
    if (y < view.y - 10 || y > view.y + view.h + 10) continue;
    let prev = 0;
    for (const vx of [...ROADS_V, 3600]) {
      dashH(ctx, y - view.y, prev + ROAD_W / 2 + 10 - view.x, vx - ROAD_W / 2 - 10 - view.x);
      prev = vx;
    }
  }
  // Zebra cross di keempat sisi tiap simpang.
  ctx.fillStyle = 'rgba(240,238,225,0.85)';
  for (const x of ROADS_V) {
    for (const y of ROADS_H) {
      if (!inView(view, x - ROAD_W / 2, y - ROAD_W / 2, ROAD_W, ROAD_W)) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(x + i * 20 - 6 - view.x, y - ROAD_W / 2 - 14 - view.y, 12, 10);
        ctx.fillRect(x + i * 20 - 6 - view.x, y + ROAD_W / 2 + 4 - view.y, 12, 10);
        ctx.fillRect(x - ROAD_W / 2 - 14 - view.x, y + i * 20 - 6 - view.y, 10, 12);
        ctx.fillRect(x + ROAD_W / 2 + 4 - view.x, y + i * 20 - 6 - view.y, 10, 12);
      }
    }
  }
}

function dashV(ctx, sx, y0, y1) {
  for (let y = y0; y < y1; y += 46) ctx.fillRect(sx - 2, y, 4, 26);
}
function dashH(ctx, sy, x0, x1) {
  for (let x = x0; x < x1; x += 46) ctx.fillRect(x, sy - 2, 26, 4);
}

function drawParksAndLots(ctx, state, view) {
  for (const park of state.world.parks) {
    if (!inView(view, park.x, park.y, park.w, park.h)) continue;
    const x = park.x - view.x, y = park.y - view.y;
    ctx.fillStyle = '#5f9440';
    ctx.fillRect(x, y, park.w, park.h);
    ctx.fillStyle = PALETTE.parkPath;
    ctx.fillRect(x, y + park.h / 2 - 7, park.w, 14);
    ctx.fillRect(x + park.w / 2 - 7, y, 14, park.h);
    for (const palm of park.palms) drawPalm(ctx, palm.x - view.x, palm.y - view.y, palm.s);
  }
  for (const lot of state.world.lots) {
    if (!inView(view, lot.x, lot.y, lot.w, lot.h)) continue;
    const x = lot.x - view.x, y = lot.y - view.y;
    ctx.fillStyle = PALETTE.lotAsphalt;
    ctx.fillRect(x, y, lot.w, lot.h);
    ctx.strokeStyle = PALETTE.lotLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let lx = lot.x + 34; lx < lot.x + lot.w - 10; lx += 64) {
      ctx.moveTo(lx - view.x, y + 8);
      ctx.lineTo(lx - view.x, y + lot.h - 8);
    }
    ctx.stroke();
    if (lot.name) drawLabel(ctx, lot.name, x + lot.w / 2, y + lot.h + 16);
  }
}

function drawBeachAndSea(ctx, state, view) {
  const t = state.time;
  // Pasir.
  const sx = Math.max(BEACH_X, view.x);
  if (sx < view.x + view.w) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(sx - view.x, 0, Math.min(SEA_X, view.x + view.w) - sx, view.h);
    // Tekstur pasir: titik gelap deterministik.
    ctx.fillStyle = PALETTE.sandDark;
    const s = 30;
    for (let i = Math.floor(sx / s); i <= Math.floor(Math.min(SEA_X, view.x + view.w) / s); i++) {
      for (let j = Math.floor(view.y / s); j <= Math.floor((view.y + view.h) / s); j++) {
        if (hash2(i, j * 7) > 0.6) {
          ctx.globalAlpha = 0.35;
          ctx.fillRect(i * s + hash2(j, i) * 18 - view.x, j * s + hash2(i, j * 3) * 18 - view.y, 5, 3);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  // Laut: gradasi dangkal -> dalam.
  if (view.x + view.w > SEA_X) {
    const gx = Math.max(SEA_X, view.x) - view.x;
    const grad = ctx.createLinearGradient(gx, 0, view.x + view.w - view.x, 0);
    grad.addColorStop(0, PALETTE.seaShallow);
    grad.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(gx, 0, view.w - gx, view.h);
    // Kilau ombak: garis pendek berkedip halus mengikuti waktu.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const s = 52;
    const bucket = Math.floor(t * 1.6);
    for (let i = Math.floor(Math.max(SEA_X, view.x) / s); i <= Math.floor((view.x + view.w) / s); i++) {
      for (let j = Math.floor(view.y / s); j <= Math.floor((view.y + view.h) / s); j++) {
        const h = hash2(i + bucket, j);
        if (h > 0.68) {
          const px = i * s + h * 30 - view.x, py = j * s + hash2(i, j + bucket) * 30 - view.y;
          ctx.moveTo(px, py);
          ctx.lineTo(px + 14, py);
        }
      }
    }
    ctx.stroke();
    // Busa di bibir pantai: garis bergelombang.
    ctx.strokeStyle = PALETTE.foam;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const fx = SEA_X - view.x;
    for (let y = -10; y <= view.h + 10; y += 14) {
      const wx = fx + Math.sin((y + view.y) * 0.045 + t * 1.3) * 5;
      if (y === -10) ctx.moveTo(wx, y); else ctx.lineTo(wx, y);
    }
    ctx.stroke();
  }
  for (const palm of state.world.beachPalms) {
    if (!inView(view, palm.x - 30, palm.y - 30, 60, 60)) continue;
    drawPalm(ctx, palm.x - view.x, palm.y - view.y, palm.s);
  }
}

function drawPalm(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + 7 * s, y + 8 * s, 15 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8d6e63';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(x, y + 6 * s);
  ctx.lineTo(x + 2 * s, y - 6 * s);
  ctx.stroke();
  ctx.strokeStyle = '#3e7d32';
  ctx.lineWidth = 3 * s;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x + 2 * s, y - 6 * s);
    ctx.quadraticCurveTo(
      x + 2 * s + Math.cos(a) * 13 * s, y - 6 * s + Math.sin(a) * 8 * s - 4 * s,
      x + 2 * s + Math.cos(a) * 20 * s, y - 6 * s + Math.sin(a) * 13 * s + 3 * s,
    );
    ctx.stroke();
  }
}

function drawBuildings(ctx, state, view) {
  for (const b of state.world.buildings) {
    if (!inView(view, b.x, b.y, b.w, b.h)) continue;
    const x = b.x - view.x, y = b.y - view.y;
    // Bayangan jatuh ke tenggara.
    ctx.fillStyle = 'rgba(30,20,10,0.25)';
    ctx.fillRect(x + 10, y + 12, b.w, b.h);
    // Dinding.
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, b.w, b.h);
    // Atap di dalam parapet.
    ctx.fillStyle = b.roof;
    ctx.fillRect(x + 8, y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(x + 18, y + 18, b.w - 36, b.h - 36);
    // Jendela menyala di sabuk parapet (deterministik per gedung).
    const step = 17;
    for (let wx = x + 12; wx < x + b.w - 12; wx += step) {
      for (const wy of [y + 2.5, y + b.h - 7.5]) {
        ctx.fillStyle = hash2(b.seed, Math.round(wx)) > 0.45 ? '#ffd98a' : 'rgba(40,30,20,0.35)';
        ctx.fillRect(wx, wy, 6, 4);
      }
    }
    for (let wy = y + 12; wy < y + b.h - 12; wy += step) {
      for (const wx of [x + 2.5, x + b.w - 7.5]) {
        ctx.fillStyle = hash2(b.seed + 9, Math.round(wy)) > 0.45 ? '#ffd98a' : 'rgba(40,30,20,0.35)';
        ctx.fillRect(wx, wy, 4, 6);
      }
    }
    // Unit AC di atap.
    ctx.fillStyle = 'rgba(220,220,215,0.75)';
    const acN = 1 + Math.floor(hash2(b.seed, 77) * 3);
    for (let i = 0; i < acN; i++) {
      const ax = x + 22 + hash2(b.seed, i * 3 + 1) * Math.max(10, b.w - 60);
      const ay = y + 22 + hash2(b.seed, i * 5 + 2) * Math.max(10, b.h - 60);
      ctx.fillRect(ax, ay, 13, 10);
    }
    // Kanopi toko + label nama.
    if (b.type === 'shop') {
      const aw = Math.min(b.w, 130);
      const ax = x + (b.w - aw) / 2;
      const ay = y + b.h - 4;
      for (let i = 0; i < aw / 13; i++) {
        ctx.fillStyle = i % 2 ? '#f5efe0' : b.awning;
        ctx.fillRect(ax + i * 13, ay, 13, 11);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(ax, ay + 11, aw, 3);
    }
    if (b.name) drawLabel(ctx, b.name, x + b.w / 2, y + b.h + (b.type === 'shop' ? 26 : 15));
  }
}

export function drawLabel(ctx, text, cx, y) {
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(24,20,14,0.72)';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y - 10, w, 17, 5);
  ctx.fill();
  ctx.fillStyle = '#f7efdb';
  ctx.fillText(text, cx, y + 3);
  ctx.textAlign = 'left';
}

function drawCar(ctx, state, car, view) {
  if (!inView(view, car.x - 44, car.y - 44, 88, 88)) return;
  const x = car.x - view.x, y = car.y - view.y;
  ctx.save();
  ctx.translate(x, y);
  // Bayangan.
  ctx.fillStyle = 'rgba(20,15,5,0.28)';
  ctx.beginPath();
  ctx.ellipse(5, 7, car.r * 1.28, car.r * 0.95, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  const L = car.r * 2.45, W = car.r * 1.5;
  // Roda.
  ctx.fillStyle = '#1c1c1e';
  for (const [wx, wy] of [[-L * 0.32, -W / 2 - 2], [L * 0.32, -W / 2 - 2], [-L * 0.32, W / 2 - 3], [L * 0.32, W / 2 - 3]]) {
    ctx.fillRect(wx - 6, wy, 12, 5);
  }
  // Bodi.
  ctx.fillStyle = car.disabled ? '#6e6e6e' : car.color;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (car.model === 'gt') {
    ctx.fillStyle = 'rgba(60,42,0,0.55)';
    ctx.fillRect(-L / 2 + 4, -3.5, L - 8, 7);
  }
  if (car.model === 'pickup') {
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(-L / 2 + 4, -W / 2 + 5, L * 0.36, W - 10);
  }
  if (car.police) {
    ctx.fillStyle = '#2166ac';
    ctx.fillRect(-L * 0.18, -W / 2 + 2, L * 0.3, W - 4);
  }
  // Kabin & kaca.
  ctx.fillStyle = 'rgba(18,30,40,0.88)';
  ctx.beginPath();
  ctx.roundRect(-L * 0.16, -W / 2 + 5, L * 0.34, W - 10, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,190,220,0.5)';
  ctx.fillRect(L * 0.13, -W / 2 + 6, 4, W - 12);
  // Lampu depan & rem.
  ctx.fillStyle = '#fdf6c9';
  ctx.fillRect(L / 2 - 3, -W / 2 + 4, 3, 7);
  ctx.fillRect(L / 2 - 3, W / 2 - 11, 3, 7);
  ctx.fillStyle = '#d32f2f';
  ctx.fillRect(-L / 2, -W / 2 + 4, 3, 7);
  ctx.fillRect(-L / 2, W / 2 - 11, 3, 7);
  // Lightbar polisi berkedip.
  if (car.police && !car.disabled) {
    const phase = Math.floor(state.time * 6) % 2;
    ctx.fillStyle = phase ? '#ff1744' : 'rgba(255,23,68,0.25)';
    ctx.fillRect(-8, -W / 2 + 6, 7, W / 2 - 6);
    ctx.fillStyle = phase ? 'rgba(41,121,255,0.25)' : '#2979ff';
    ctx.fillRect(1, 0, 7, W / 2 - 6);
  }
  if (car.disabled) {
    ctx.fillStyle = 'rgba(40,40,40,0.35)';
    ctx.beginPath();
    ctx.arc(-L * 0.3, 0, 9 + Math.sin(state.time * 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (car.isMissionCar && !car.parked) return;
  if (car.isMissionCar) {
    // Penanda emas berdenyut untuk incaran misi.
    ctx.strokeStyle = 'rgba(255,205,40,' + (0.65 + Math.sin(state.time * 5) * 0.3) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, car.r + 12 + Math.sin(state.time * 5) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPed(ctx, state, ped, view) {
  if (!inView(view, ped.x - 20, ped.y - 20, 40, 40)) return;
  const x = ped.x - view.x, y = ped.y - view.y;
  ctx.fillStyle = 'rgba(20,15,5,0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 4, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.state === 'down') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -14, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(x + Math.cos(ped.angle) * 2, y + Math.sin(ped.angle) * 2, 5.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, state, view) {
  const p = state.player;
  const x = p.x - view.x, y = p.y - view.y;
  ctx.fillStyle = 'rgba(20,15,5,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 5, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0e7c86';
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#083f45';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffe0b2';
  ctx.beginPath();
  ctx.arc(x + Math.cos(p.angle) * 2.5, y + Math.sin(p.angle) * 2.5, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Topi putih khas Riko.
  ctx.fillStyle = '#f7f3df';
  ctx.beginPath();
  ctx.arc(x + Math.cos(p.angle) * 2.5, y + Math.sin(p.angle) * 2.5, 6.5, p.angle - 2.2, p.angle + 2.2);
  ctx.fill();
}

const PARTICLE_STYLE = {
  smoke: { color: 'rgba(200,200,200,', r: 9, rise: -26 },
  muzzle: { color: 'rgba(255,205,60,', r: 8, rise: 0 },
  spark: { color: 'rgba(255,140,40,', r: 4, rise: -8 },
  hit: { color: 'rgba(220,60,50,', r: 6, rise: -14 },
  cash: { color: 'rgba(80,220,110,', r: 5, rise: -30 },
};

function drawParticles(ctx, state, view) {
  for (const pt of state.particles) {
    const st = PARTICLE_STYLE[pt.type] || PARTICLE_STYLE.spark;
    const k = 1 - pt.t / pt.life;
    ctx.fillStyle = st.color + (k * 0.8).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(pt.x - view.x, pt.y - view.y + st.rise * (pt.t / pt.life), st.r * (0.5 + k * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }
}
