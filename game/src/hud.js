// The HUD and the screens: money, health, wanted stars, the mission objective
// and banner, the bust meter, context prompts, a live minimap, and the title,
// pause, BUSTED and WASTED overlays. Everything the player reads lives here.

import { CITY_NAME, FONT, GAME_TITLE, HERO_NAME, PALETTE, ROADS, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const MAP_W = 216;
const MAP_H = 152;

/** Draw the minimap: roads, coast, and blips for player, police and mission. */
function drawMinimap(ctx, state, view) {
  const x0 = view.w - MAP_W - 14;
  const y0 = 14;
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  ctx.fillStyle = 'rgba(20,26,20,0.82)';
  ctx.beginPath(); ctx.roundRect(x0, y0, MAP_W, MAP_H, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x0, y0, MAP_W, MAP_H, 8); ctx.clip();
  ctx.fillStyle = '#2c7a3f';
  ctx.fillRect(x0 + WORLD.beachX * sx, y0, (WORLD.waterX - WORLD.beachX) * sx, MAP_H);
  ctx.fillStyle = '#1299ad';
  ctx.fillRect(x0 + WORLD.waterX * sx, y0, MAP_W, MAP_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const x of ROADS.vertical) { ctx.moveTo(x0 + x * sx, y0); ctx.lineTo(x0 + x * sx, y0 + MAP_H); }
  for (const y of ROADS.horizontal) { ctx.moveTo(x0, y0 + y * sy); ctx.lineTo(x0 + MAP_W, y0 + y * sy); }
  ctx.stroke();
  const blip = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const cop of state.police.cars) blip(cop.x, cop.y, Math.floor(state.time * 4) % 2 ? '#ff3b30' : '#4d7cff', 3);
  for (const car of state.cars) if (car.storyTarget && !car.dead) blip(car.x, car.y, '#ffd21f', 3.5);
  const s = state.missions.stage();
  if (s) {
    const pulse = 3.5 + Math.sin(state.time * 6) * 1.2;
    blip(s.x, s.y, PALETTE.gold, pulse);
  }
  blip(state.player.x, state.player.y, '#ffffff', 4);
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(CITY_NAME.toUpperCase(), x0 + 8, y0 + MAP_H - 8);
}

/** Draw five wanted stars, filled up to the current level. */
function drawStars(ctx, stars, x, y) {
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? PALETTE.gold : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', x + i * 24, y);
  }
}

/** The in-play HUD: stats top-left, minimap top-right, objective bottom. */
export function drawHud(ctx, state, view) {
  const { player, police, save } = state;
  ctx.save();
  // Stats panel.
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath(); ctx.roundRect(14, 14, 238, 126, 10); ctx.fill();
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`$${save.money}`, 28, 46);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(28, 58, 150, 12);
  ctx.fillStyle = player.health > 30 ? '#2ecc71' : PALETTE.danger;
  ctx.fillRect(28, 58, 150 * Math.max(0, player.health) / 100, 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(player.inCar ? `${player.car.model.name} — ${Math.round(Math.abs(player.car.speed))} km/j` : `${HERO_NAME} — jalan kaki`, 28, 92);
  drawStars(ctx, police.stars, 28, 134);

  drawMinimap(ctx, state, view);

  // Objective line, bottom centre.
  const objective = state.missions.objective();
  if (objective) {
    ctx.font = `bold 16px ${FONT}`;
    const w = Math.min(view.w - 40, ctx.measureText(objective).width + 36);
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath(); ctx.roundRect((view.w - w) / 2, view.h - 52, w, 36, 9); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(objective, view.w / 2, view.h - 29);
  }
  // Story banner, top centre.
  if (state.missions.bannerTime > 0 && state.missions.banner) {
    ctx.font = `15px ${FONT}`;
    const lines = wrapText(ctx, state.missions.banner, view.w * 0.62);
    const h = lines.length * 21 + 22;
    ctx.fillStyle = 'rgba(16,20,28,0.85)';
    ctx.beginPath(); ctx.roundRect(view.w * 0.19, 22, view.w * 0.62, h, 10); ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, view.w / 2, 48 + i * 21));
  }
  // Bust meter.
  if (police.bustMeter > 0.02) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(view.w / 2 - 90, 120, 180, 12);
    ctx.fillStyle = PALETTE.danger;
    ctx.fillRect(view.w / 2 - 90, 120, 180 * Math.min(1, police.bustMeter), 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('DITANGKAP…', view.w / 2, 112);
  }
  // Context prompt.
  if (state.prompt) {
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = PALETTE.panel;
    const w = ctx.measureText(state.prompt).width + 30;
    ctx.beginPath(); ctx.roundRect(view.w / 2 - w / 2, view.h - 100, w, 32, 8); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(state.prompt, view.w / 2, view.h - 79);
  }
  ctx.restore();
}

/** Greedy word wrap for banner text. */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** A dim full-screen overlay with a big word and a few lines under it. */
function overlay(ctx, view, title, titleColor, lines) {
  ctx.fillStyle = 'rgba(8,10,16,0.66)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText(title, view.w / 2, view.h / 2 - 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = `17px ${FONT}`;
  lines.forEach((line, i) => ctx.fillText(line, view.w / 2, view.h / 2 + 16 + i * 26));
}

/** Draw the non-play screens (title, pause, busted, wasted). */
export function drawScreen(ctx, state, view, screen) {
  const save = state.save;
  if (screen === SCREEN_TITLE) {
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, 'rgba(255,140,66,0.35)');
    grad.addColorStop(1, 'rgba(10,16,28,0.78)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = `bold 84px ${FONT}`;
    ctx.fillText(GAME_TITLE, view.w / 2, view.h * 0.34);
    ctx.fillStyle = '#ffffff';
    ctx.font = `20px ${FONT}`;
    ctx.fillText(`${CITY_NAME} — kota pantai, utang lama, dan satu nama: ${HERO_NAME}.`, view.w / 2, view.h * 0.34 + 42);
    ctx.font = `16px ${FONT}`;
    const lines = [
      'WASD / Panah — jalan & menyetir    •    E — masuk / curi mobil    •    Shift — lari',
      'Spasi — pukul    •    Klik mouse — tembak    •    P / Esc — jeda',
      save.missionIndex > 0 || save.money !== 120
        ? `Karier tersimpan: $${save.money} • misi cerita ${Math.min(save.missionIndex, 3)}/3`
        : 'Selesaikan 3 misi cerita untuk melunasi utang Riko ke geng Arus Liar.',
      '',
      'Klik atau tekan Enter untuk mulai',
    ];
    lines.forEach((line, i) => ctx.fillText(line, view.w / 2, view.h * 0.52 + i * 28));
  } else if (screen === SCREEN_PAUSED) {
    overlay(ctx, view, 'JEDA', '#ffffff', ['P / Esc / Enter — lanjut main', 'Progres tersimpan otomatis di browser ini.']);
  } else if (screen === SCREEN_BUSTED) {
    overlay(ctx, view, 'BUSTED', '#4d7cff', ['Polisi Sundara Bay menangkap Riko.', 'Sebagian uang disita. Tekan Enter untuk lanjut dari kontrakan.']);
  } else if (screen === SCREEN_WASTED) {
    overlay(ctx, view, 'WASTED', PALETTE.danger, ['Riko terbangun di Klinik Pesisir.', 'Biaya perawatan dipotong dari uangnya. Tekan Enter untuk lanjut.']);
  }
}
