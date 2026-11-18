// hud.js — lapisan layar: panel uang/health/bintang, info kendaraan, bar
// objektif, banner dialog, meter tangkap, minimap hidup, dan layar
// judul / jeda / tertangkap / terluka.

import { WORLD_W, WORLD_H, ROADS_V, ROADS_H, BEACH_X, SEA_X } from './config.js';

export function formatMoney(n) {
  const neg = n < 0;
  const digits = String(Math.abs(Math.round(n)));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return (neg ? '-$ ' : '$ ') + out;
}

export function drawHud(ctx, state) {
  const w = state.view.w, h = state.view.h;
  drawVignette(ctx, w, h);
  if (state.mode === 'title') { drawTitle(ctx, state); return; }
  drawStatusPanel(ctx, state);
  drawMinimap(ctx, state);
  drawDialogue(ctx, state, w);
  drawObjectives(ctx, state, w, h);
  if (state.player.car) drawVehiclePanel(ctx, state, w, h);
  if (state.bust > 0.02) drawBustMeter(ctx, state, w, h);
  if (state.mode === 'pause') drawPause(ctx, state);
  if (state.mode === 'busted') drawEndScreen(ctx, state, 'TERTANGKAP', 'Polisi Sundara Bay menahan Riko. Denda $120 dipotong, utang tetap menunggu.', '#7b1410');
  if (state.mode === 'wasted') drawEndScreen(ctx, state, 'TERLUKA', 'Riko terbangun di RS Sundara. Biaya perawatan $90. Ayo, kota tidak menunggu.', '#4a0f14');
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(70,35,0,0)');
  g.addColorStop(1, 'rgba(70,35,0,0.08)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(14,20,24,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,235,190,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawStatusPanel(ctx, state) {
  panel(ctx, 14, 14, 218, 96);
  ctx.fillStyle = '#ffd54f';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(formatMoney(state.career.money), 26, 44);
  // Bar kesehatan.
  const hp = Math.max(0, state.player.health) / 100;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(26, 54, 150, 10);
  ctx.fillStyle = hp > 0.45 ? '#66bb6a' : hp > 0.22 ? '#ffa726' : '#ef5350';
  ctx.fillRect(26, 54, 150 * hp, 10);
  // Bintang wanted.
  const stars = state.wanted.stars;
  ctx.font = '19px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffca28' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', 26 + i * 23, 88);
  }
  if (stars > 0) {
    const frac = (state.wanted.heat % 100) / 100;
    ctx.fillStyle = 'rgba(255,202,40,0.55)';
    ctx.fillRect(26, 94, 108 * (stars >= 5 ? 1 : frac), 3);
  }
}

function drawVehiclePanel(ctx, state, w, h) {
  const car = state.player.car;
  panel(ctx, w - 232, h - 74, 218, 60);
  ctx.fillStyle = '#f5efe0';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText(car.name, w - 218, h - 48);
  ctx.fillStyle = '#ffd54f';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillText(Math.round(Math.abs(car.speed) * 0.42) + ' km/j', w - 218, h - 24);
  const hp = Math.max(0, car.health) / 100;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(w - 92, h - 32, 66, 7);
  ctx.fillStyle = hp > 0.4 ? '#66bb6a' : '#ef5350';
  ctx.fillRect(w - 92, h - 32, 66 * hp, 7);
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawDialogue(ctx, state, w) {
  const d = state.dialogues[0];
  if (!d) return;
  ctx.font = '14px system-ui, sans-serif';
  const lines = wrapText(ctx, d.text, 600).slice(0, 2);
  const bw = 660, bh = 30 + lines.length * 19;
  const x = (w - bw) / 2, y = 14;
  ctx.fillStyle = 'rgba(14,20,24,0.85)';
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd54f';
  ctx.font = '700 14px system-ui, sans-serif';
  const label = d.who + ': ';
  ctx.fillText(label, x + 16, y + 24);
  const off = ctx.measureText(label).width;
  ctx.fillStyle = '#f5efe0';
  ctx.font = '14px system-ui, sans-serif';
  lines.forEach((ln, i) => {
    ctx.fillText(ln, x + 16 + (i === 0 ? off : 0), y + 24 + i * 19);
  });
}

function drawObjectives(ctx, state, w, h) {
  const story = state.missions.storyObjective(state);
  const side = state.missions.sideObjective(state);
  let y = h - 40;
  if (side) { drawObjectivePill(ctx, state, side, w, y, '#4dd0e1'); y -= 34; }
  drawObjectivePill(ctx, state, story, w, y, '#ffca28');
}

function drawObjectivePill(ctx, state, obj, w, y, color) {
  ctx.font = '600 13.5px system-ui, sans-serif';
  const tw = ctx.measureText(obj.text).width;
  const bw = tw + 42;
  const x = (w - bw) / 2;
  ctx.fillStyle = 'rgba(14,20,24,0.8)';
  ctx.beginPath();
  ctx.roundRect(x, y - 17, bw, 27, 13);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 16, y - 3.5, 4.5 + Math.sin(state.time * 5) * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5efe0';
  ctx.fillText(obj.text, x + 28, y + 1);
}

function drawBustMeter(ctx, state, w, h) {
  const bw = 300, x = (w - bw) / 2, y = h - 96;
  ctx.fillStyle = 'rgba(14,20,24,0.8)';
  ctx.beginPath();
  ctx.roundRect(x - 10, y - 24, bw + 20, 48, 10);
  ctx.fill();
  ctx.fillStyle = '#ef9a9a';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DITANGKAP…', w / 2, y - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y + 2, bw, 9);
  ctx.fillStyle = '#e53935';
  ctx.fillRect(x, y + 2, bw * state.bust, 9);
  ctx.textAlign = 'left';
}

function drawMinimap(ctx, state) {
  const mw = 188, mh = 140, x = state.view.w - mw - 14, y = 14;
  const s = Math.min(mw / WORLD_W, mh / WORLD_H);
  const ox = x + (mw - WORLD_W * s) / 2, oy = y + (mh - WORLD_H * s) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, mw, mh, 10);
  ctx.clip();
  ctx.fillStyle = '#14535e';
  ctx.fillRect(x, y, mw, mh);
  ctx.fillStyle = '#7fae56';
  ctx.fillRect(ox, oy, BEACH_X * s, WORLD_H * s);
  ctx.fillStyle = '#e8cf8d';
  ctx.fillRect(ox + BEACH_X * s, oy, (SEA_X - BEACH_X) * s, WORLD_H * s);
  ctx.fillStyle = '#2b93a5';
  ctx.fillRect(ox + SEA_X * s, oy, (WORLD_W - SEA_X) * s, WORLD_H * s);
  ctx.strokeStyle = 'rgba(245,240,220,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const rx of ROADS_V) { ctx.moveTo(ox + rx * s, oy); ctx.lineTo(ox + rx * s, oy + WORLD_H * s); }
  for (const ry of ROADS_H) { ctx.moveTo(ox, oy + ry * s); ctx.lineTo(ox + BEACH_X * s, oy + ry * s); }
  ctx.stroke();
  // Blip objektif cerita (emas) & sampingan (cyan).
  const story = state.missions.storyObjective(state);
  if (!story.noMarker) blip(ctx, ox + story.x * s, oy + story.y * s, '#ffca28', 4 + Math.sin(state.time * 5) * 1.1);
  const side = state.missions.sideObjective(state);
  if (side) blip(ctx, ox + side.x * s, oy + side.y * s, '#4dd0e1', 3.5);
  for (const cop of state.police) blip(ctx, ox + cop.x * s, oy + cop.y * s, '#42a5f5', 3.2);
  // Pemain: titik putih bercincin gelap + arah hadap.
  const p = state.player;
  const px = ox + (p.car ? p.car.x : p.x) * s, py = oy + (p.car ? p.car.y : p.y) * s;
  const ang = p.car ? p.car.angle : p.angle;
  ctx.strokeStyle = '#f5efe0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(ang) * 9, py + Math.sin(ang) * 9);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#10222a';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Label kota, di dalam peta dengan ruang cukup.
  ctx.fillStyle = 'rgba(10,25,30,0.55)';
  ctx.fillRect(x + 5, y + mh - 19, 76, 14);
  ctx.fillStyle = '#eaf6f6';
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.fillText('SUNDARA BAY', x + 9, y + mh - 8.5);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,235,190,0.35)';
  ctx.beginPath();
  ctx.roundRect(x, y, mw, mh, 10);
  ctx.stroke();
}

function blip(ctx, x, y, color, r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTitle(ctx, state) {
  const w = state.view.w, h = state.view.h;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(30,16,4,0.07)');
  g.addColorStop(0.55, 'rgba(30,16,4,0.03)');
  g.addColorStop(1, 'rgba(30,16,4,0.14)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(70,35,0,0.45)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffca28';
  ctx.font = '800 66px Georgia, serif';
  ctx.fillText('SUNDARA HEAT', w / 2, h * 0.34);
  ctx.fillStyle = '#fdf6e0';
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillText('Sundara Bay — kota pantai, utang lama, dan satu nama: Riko.', w / 2, h * 0.34 + 40);
  ctx.font = '15.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(253,246,224,0.95)';
  ctx.fillText('WASD / Panah — jalan & menyetir   ·   E — masuk / curi mobil   ·   Shift — lari', w / 2, h * 0.34 + 92);
  ctx.fillText('Spasi — pukul   ·   Klik mouse — tembak   ·   P / Esc — jeda', w / 2, h * 0.34 + 118);
  ctx.fillText('Selesaikan 3 misi cerita untuk melunasi utang Riko ke geng Arus Liar.', w / 2, h * 0.34 + 144);
  ctx.fillStyle = '#ffca28';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillText('Klik atau tekan Enter untuk mulai', w / 2, h * 0.34 + 186);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
}

function drawPause(ctx, state) {
  const w = state.view.w, h = state.view.h;
  ctx.fillStyle = 'rgba(10,14,18,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fdf6e0';
  ctx.font = '800 44px Georgia, serif';
  ctx.fillText('JEDA', w / 2, h / 2 - 16);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('P / Esc — lanjut   ·   E — masuk mobil   ·   Spasi — pukul   ·   Klik — tembak', w / 2, h / 2 + 22);
  ctx.textAlign = 'left';
}

function drawEndScreen(ctx, state, title, line, tint) {
  const w = state.view.w, h = state.view.h;
  ctx.fillStyle = tint;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 52px Georgia, serif';
  ctx.fillText(title, w / 2, h / 2 - 10);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(line, w / 2, h / 2 + 28);
  ctx.textAlign = 'left';
}
