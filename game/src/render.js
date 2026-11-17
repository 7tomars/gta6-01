// Drawing the world of Sundara Bay: sun-soaked ground, roads with lane paint,
// buildings with shaded roofs and lit windows, palms, the beach and the sea,
// then every moving thing — cars, pedestrians, police, the player, combat
// effects and the mission marker. Camera is a simple world offset.

import { PALETTE, ROADS, WORLD } from './config.js';

/** True when a world point is inside the camera view (with margin). */
function inView(cam, view, x, y, m = 90) {
  return x > cam.x - m && x < cam.x + view.w + m && y > cam.y - m && y < cam.y + view.h + m;
}

/** Draw all ground layers: grass, sand, water, roads, parks, car parks. */
function drawGround(ctx, city, cam, view, time) {
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, view.w, view.h);
  // Mown stripes on the grass for a cared-for tropical feel.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 120;
  for (let x = Math.floor(cam.x / stripe) * stripe; x < cam.x + view.w; x += stripe * 2) {
    ctx.fillRect(x - cam.x, 0, stripe, view.h);
  }
  // Sand and sea on the east edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(WORLD.beachX - cam.x, 0, WORLD.waterX - WORLD.beachX, view.h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(WORLD.waterX - cam.x, 0, WORLD.width - WORLD.waterX + 400, view.h);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let y = 30; y < WORLD.height; y += 90) {
    const wob = Math.sin(time * 1.4 + y) * 14;
    ctx.fillRect(WORLD.waterX + 40 + wob - cam.x, y - cam.y, 130, 7);
  }
  // Roads: asphalt slabs along every grid line, then dashes.
  ctx.fillStyle = PALETTE.road;
  for (const x of ROADS.vertical) ctx.fillRect(x - ROADS.width / 2 - cam.x, -cam.y, ROADS.width, WORLD.height);
  for (const y of ROADS.horizontal) ctx.fillRect(-cam.x, y - ROADS.width / 2 - cam.y, WORLD.beachX + 60, ROADS.width);
  ctx.fillStyle = PALETTE.roadEdge;
  for (const x of ROADS.vertical) {
    ctx.fillRect(x - ROADS.width / 2 - cam.x, -cam.y, 5, WORLD.height);
    ctx.fillRect(x + ROADS.width / 2 - 5 - cam.x, -cam.y, 5, WORLD.height);
  }
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const x of ROADS.vertical) { ctx.moveTo(x - cam.x, -cam.y); ctx.lineTo(x - cam.x, WORLD.height - cam.y); }
  for (const y of ROADS.horizontal) { ctx.moveTo(-cam.x, y - cam.y); ctx.lineTo(WORLD.beachX - cam.x, y - cam.y); }
  ctx.stroke();
  ctx.setLineDash([]);
  // Parks and car parks.
  for (const p of city.parks) {
    if (!inView(cam, view, p.x + p.w / 2, p.y + p.h / 2, 320)) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
  }
  for (const cp of city.carParks) {
    const r = cp.rect;
    if (!inView(cam, view, r.x + r.w / 2, r.y + r.h / 2, 320)) continue;
    ctx.fillStyle = '#8b8b93';
    ctx.fillRect(r.x - cam.x, r.y - cam.y, r.w, r.h);
    ctx.strokeStyle = '#e8e3d5';
    ctx.lineWidth = 2;
    for (const s of cp.spots) ctx.strokeRect(s.x - 20 - cam.x, s.y - 26 - cam.y, 40, 52);
  }
}

/** Draw one building: drop shadow, wall, roof slab and a grid of windows. */
function drawBuilding(ctx, b, cam) {
  const x = b.x - cam.x;
  const y = b.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 12, y + 16, b.w, b.h);
  ctx.fillStyle = b.wall;
  ctx.fillRect(x, y, b.w, b.h);
  ctx.fillStyle = b.roof;
  const inset = 12 + b.floors * 1.5;
  ctx.fillRect(x + inset, y + inset, b.w - inset * 2, b.h - inset * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const cols = Math.max(2, Math.floor(b.w / 44));
  const rowsWin = Math.max(2, Math.floor(b.h / 44));
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rowsWin; j += 1) {
      ctx.fillRect(x + 14 + i * 44, y + 14 + j * 44, 16, 10);
    }
  }
}

/** Draw a palm: curved trunk and a star of fronds. */
function drawPalm(ctx, p, cam) {
  const x = p.x - cam.x;
  const y = p.y - cam.y;
  ctx.strokeStyle = '#8a6b45';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 5, y - 10, x + 9, y - 18);
  ctx.stroke();
  ctx.strokeStyle = '#2f9e44';
  ctx.lineWidth = 4;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + 9, y - 18);
    ctx.quadraticCurveTo(x + 9 + Math.cos(a) * 16, y - 24 + Math.sin(a) * 6, x + 9 + Math.cos(a) * 26, y - 14 + Math.sin(a) * 12);
    ctx.stroke();
  }
}

/** Draw one car with body, cabin, wheels and (for police) a light bar. */
export function drawCar(ctx, car, cam, time) {
  const x = car.x - cam.x;
  const y = car.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-20, -8, 48, 26);
  ctx.fillStyle = car.dead ? '#3a3a3a' : car.color;
  ctx.beginPath();
  ctx.roundRect(-23, -12, 46, 24, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -9, 18, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#f7d154';
  ctx.fillRect(20, -9, 4, 5);
  ctx.fillRect(20, 4, 4, 5);
  ctx.fillStyle = '#ff5252';
  ctx.fillRect(-24, -9, 3, 5);
  ctx.fillRect(-24, 4, 3, 5);
  ctx.fillStyle = '#151515';
  ctx.fillRect(-16, -15, 10, 4); ctx.fillRect(7, -15, 10, 4);
  ctx.fillRect(-16, 11, 10, 4); ctx.fillRect(7, 11, 10, 4);
  if (car.kind === 'police') {
    const blink = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#2b50c8';
    ctx.fillRect(-4, -8, 8, 7);
    ctx.fillStyle = blink ? '#2b50c8' : '#ff3b30';
    ctx.fillRect(-4, 1, 8, 7);
  }
  if (car.storyTarget) {
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-25, -14, 50, 28, 8);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw one pedestrian (or the player, with `hero` colours and a ring). */
export function drawPerson(ctx, x, y, angle, shirt, cam, opts = {}) {
  const sx = x - cam.x;
  const sy = y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(sx, sy + 8, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (opts.down) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.roundRect(-14, -6, 28, 12, 6); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(17, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const stride = opts.moving ? Math.sin(opts.walkPhase || 0) * 5 : 0;
  ctx.strokeStyle = '#2d3436';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sx, sy + 4); ctx.lineTo(sx + Math.cos(angle + 2.6) * (7 + stride), sy + 10 + Math.abs(stride));
  ctx.moveTo(sx, sy + 4); ctx.lineTo(sx + Math.cos(angle - 2.6) * (7 - stride), sy + 10 + Math.abs(stride));
  ctx.stroke();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(sx + Math.cos(angle) * 3, sy + Math.sin(angle) * 3, 5.5, 0, Math.PI * 2); ctx.fill();
  if (opts.hero) {
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.stroke();
  }
}

/** The tall pulsing pillar that marks the active mission target. */
function drawMarker(ctx, x, y, cam, time) {
  const sx = x - cam.x;
  const sy = y - cam.y;
  const pulse = 1 + Math.sin(time * 5) * 0.15;
  const grad = ctx.createLinearGradient(0, sy - 190, 0, sy);
  grad.addColorStop(0, 'rgba(255,217,77,0)');
  grad.addColorStop(1, 'rgba(255,217,77,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(sx - 16, sy - 190, 32, 190);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath(); ctx.ellipse(sx, sy, 26 * pulse, 12 * pulse, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a5b00';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', sx, sy - 196 + Math.sin(time * 5) * 4);
}

/**
 * Create the world renderer. draw(state, view) paints everything in world
 * space; state carries city, cars, peds, police, combat, player and camera.
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(state, view) {
      const { city, cam, time } = state;
      ctx.save();
      if (state.combat.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.combat.shake, (Math.random() - 0.5) * state.combat.shake);
      }
      drawGround(ctx, city, cam, view, time);
      for (const b of city.buildings) {
        if (inView(cam, view, b.x + b.w / 2, b.y + b.h / 2, 340)) drawBuilding(ctx, b, cam);
      }
      ctx.fillStyle = PALETTE.sidewalk;
      // Sidewalk rims are implied by building spacing; palms give the shade.
      for (const p of city.palms) if (inView(cam, view, p.x, p.y, 60)) drawPalm(ctx, p, cam);

      const s = state.missions ? state.missions.stage() : null;
      if (s) drawMarker(ctx, s.x, s.y, cam, time);

      const allCars = [...state.cars, ...state.police.cars];
      for (const car of allCars) {
        if (inView(cam, view, car.x, car.y, 80)) drawCar(ctx, car, cam, time);
      }
      for (const ped of state.peds) {
        if (!inView(cam, view, ped.x, ped.y, 50)) continue;
        drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, cam, { down: ped.state === 'down', moving: ped.state !== 'down', walkPhase: time * 9 + ped.id });
      }
      if (!state.player.inCar) {
        drawPerson(ctx, state.player.x, state.player.y, state.player.angle, PALETTE.player, cam, { hero: true, moving: state.player.moving, walkPhase: time * 11 });
      }
      // Tracers, then particles.
      ctx.strokeStyle = 'rgba(255,240,170,0.9)';
      ctx.lineWidth = 2;
      for (const t of state.combat.tracers) {
        ctx.beginPath();
        ctx.moveTo(t.x1 - cam.x, t.y1 - cam.y);
        ctx.lineTo(t.x2 - cam.x, t.y2 - cam.y);
        ctx.stroke();
      }
      for (const p of state.combat.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - cam.x - p.size / 2, p.y - cam.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      if (state.combat.flash > 0 && !state.player.inCar) {
        ctx.fillStyle = `rgba(255,230,150,${0.25 * state.combat.flash})`;
        ctx.beginPath();
        ctx.arc(state.player.x - cam.x + Math.cos(state.player.angle) * 20, state.player.y - cam.y + Math.sin(state.player.angle) * 20, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}
