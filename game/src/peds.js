// Pedestrians: citizens of Sundara Bay who stroll the sidewalks around their
// block, flee from danger, and fall when hurt. Pure ambience until the player
// gives them a reason to run — witnesses matter to the wanted system.

import { WORLD } from './config.js';

const SHIRTS = ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#fd79a8', '#a29bfe', '#fab1a0', '#81ecec'];
let nextPedId = 1;

/** Create one pedestrian walking the sidewalk loop of `rect`. */
function makePed(random, rect) {
  const x = random.range(rect.x, rect.x + rect.w);
  return {
    id: nextPedId++,
    x, y: rect.y,
    rect, corner: random.int(0, 3),
    speed: random.range(46, 78),
    shirt: random.pick(SHIRTS),
    hp: 2, state: 'walk', stateTime: 0,
    angle: 0, fleeX: 0, fleeY: 0,
  };
}

/** Spawn the walking population across building blocks, parks and the beach. */
export function spawnPeds(city, random, count) {
  const rects = [];
  for (const b of city.buildings) rects.push({ x: b.x - 12, y: b.y - 12, w: b.w + 24, h: b.h + 24 });
  for (const p of city.parks) rects.push(p);
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    peds.push(makePed(random, random.pick(rects)));
  }
  // Beach walkers stroll the promenade up and down.
  for (let i = 0; i < 5; i += 1) {
    const ped = makePed(random, { x: WORLD.beachX + 30, y: 100, w: 120, h: WORLD.height - 200 });
    ped.x = random.range(WORLD.beachX + 40, WORLD.waterX - 60);
    ped.y = random.range(120, WORLD.height - 120);
    ped.beach = true;
    peds.push(ped);
  }
  return peds;
}

/** The four corners of a ped's sidewalk loop, in walking order. */
function cornersOf(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
}

/** Make a ped flee directly away from (x, y) for a few seconds. */
export function scarePed(ped, x, y) {
  if (ped.state === 'down') return;
  ped.state = 'flee';
  ped.stateTime = 2.6;
  ped.fleeX = x;
  ped.fleeY = y;
}

/** Hurt a ped; at zero health it goes down for a while. Returns true if it fell. */
export function hurtPed(ped, damage) {
  ped.hp -= damage;
  if (ped.hp <= 0 && ped.state !== 'down') {
    ped.state = 'down';
    ped.stateTime = 8;
    return true;
  }
  return false;
}

/** Advance one pedestrian for a step. */
export function updatePed(ped, dt) {
  ped.stateTime = Math.max(0, ped.stateTime - dt);
  if (ped.state === 'down') {
    if (ped.stateTime <= 0) { ped.state = 'walk'; ped.hp = 2; }
    return;
  }
  let tx;
  let ty;
  let speed = ped.speed;
  if (ped.state === 'flee') {
    if (ped.stateTime <= 0) { ped.state = 'walk'; }
    const dx = ped.x - ped.fleeX;
    const dy = ped.y - ped.fleeY;
    const d = Math.hypot(dx, dy) || 1;
    tx = ped.x + (dx / d) * 60;
    ty = ped.y + (dy / d) * 60;
    speed *= 2.1;
  } else if (ped.beach) {
    const corners = cornersOf(ped.rect);
    const c = corners[ped.corner];
    tx = c.x; ty = c.y;
    if (Math.hypot(tx - ped.x, ty - ped.y) < 6) ped.corner = (ped.corner + 1) % 4;
  } else {
    const corners = cornersOf(ped.rect);
    const c = corners[ped.corner];
    tx = c.x; ty = c.y;
    if (Math.hypot(tx - ped.x, ty - ped.y) < 6) ped.corner = (ped.corner + 1) % 4;
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * Math.min(d, speed * dt);
    ped.y += (dy / d) * Math.min(d, speed * dt);
  }
}
