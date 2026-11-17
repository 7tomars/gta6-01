// Combat and effects: fists, a pocket pistol, hit flashes, and the particle
// pool (sparks, smoke, cash sparkles, splashes) that sells every impact.
// Combat reports crimes through the wanted system — Sundara Bay notices.

import { PLAYER } from './config.js';
import { hurtPed, scarePed } from './peds.js';
import { commitCrime } from './police.js';

/** Create the particle pool and the floating combat state. */
export function createCombat() {
  return { particles: [], tracers: [], shake: 0, flash: 0 };
}

/** Spawn a burst of particles. kind: 'spark' | 'smoke' | 'cash' | 'splash' | 'hit'. */
export function burst(combat, x, y, kind, count, random) {
  const colors = {
    spark: ['#ffd94d', '#ff9f43', '#ffffff'],
    smoke: ['#9aa0a6', '#6e7276', '#c9ced4'],
    cash: ['#2ecc71', '#a3e635', '#ffd94d'],
    splash: ['#7fdbff', '#1fb6c9', '#ffffff'],
    hit: ['#ff6b6b', '#c0392b', '#ffb3b3'],
  }[kind] || ['#ffffff'];
  for (let i = 0; i < count; i += 1) {
    const a = random.range(0, Math.PI * 2);
    const sp = random.range(30, kind === 'spark' ? 260 : 150);
    combat.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: random.range(0.3, 0.8), maxLife: 0.8,
      color: random.pick(colors), size: random.range(2, 5), kind,
    });
  }
}

/** Advance particles and tracers; decay screen shake and muzzle flash. */
export function updateCombat(combat, dt) {
  const list = combat.particles;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) { list.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    if (p.kind === 'smoke') { p.y -= 22 * dt; p.size += 6 * dt; }
  }
  for (let i = combat.tracers.length - 1; i >= 0; i -= 1) {
    combat.tracers[i].life -= dt;
    if (combat.tracers[i].life <= 0) combat.tracers.splice(i, 1);
  }
  combat.shake = Math.max(0, combat.shake - dt * 26);
  combat.flash = Math.max(0, combat.flash - dt * 6);
}

/** Who witnesses a crime at (x, y): 'police', 'ped' or 'none'. */
export function witnessLevel(x, y, policeCars, peds) {
  for (const cop of policeCars) {
    if (Math.hypot(cop.x - x, cop.y - y) < 330) return 'police';
  }
  for (const ped of peds) {
    if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < 150) return 'ped';
  }
  return 'none';
}

/**
 * Throw a punch in the facing direction. Hits the nearest ped or car in a
 * short arc. Returns 'ped' | 'car' | null for what connected.
 */
export function punch(state, events) {
  const { player, peds, cars, police, combat, random } = state;
  const range = PLAYER.punchRange;
  let hitWhat = null;
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (d < range + 10) {
      const fell = hurtPed(ped, PLAYER.punchDamage);
      burst(combat, ped.x, ped.y, 'hit', fell ? 10 : 5, random);
      scarePed(ped, player.x, player.y);
      commitCrime(police, fell ? 1 : 0.5, witnessLevel(player.x, player.y, police.cars, peds));
      hitWhat = 'ped';
      break;
    }
  }
  if (!hitWhat) {
    for (const car of cars) {
      if (car.dead) continue;
      if (Math.hypot(car.x - player.x, car.y - player.y) < range + 16) {
        car.health -= PLAYER.punchDamage;
        burst(combat, car.x, car.y, 'spark', 6, random);
        if (car.health <= 0) { car.dead = true; burst(combat, car.x, car.y, 'smoke', 16, random); }
        hitWhat = 'car';
        break;
      }
    }
  }
  if (hitWhat) events.punchHit = true;
  return hitWhat;
}

/**
 * Fire the pocket pistol toward a world point: a hitscan tracer that wounds
 * the first ped or car along the line, loud enough to draw real heat.
 */
export function shoot(state, tx, ty, events) {
  const { player, peds, cars, police, combat, random } = state;
  const angle = Math.atan2(ty - player.y, tx - player.x);
  player.angle = angle;
  combat.flash = 1;
  const range = 460;
  let endX = player.x + Math.cos(angle) * range;
  let endY = player.y + Math.sin(angle) * range;
  let bestT = Infinity;
  let victim = null;
  let victimKind = null;
  function testTarget(x, y, r, obj, kind) {
    const dx = x - player.x;
    const dy = y - player.y;
    const t = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (t < 0 || t > range) return;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < r && t < bestT) { bestT = t; victim = obj; victimKind = kind; }
  }
  for (const ped of peds) if (ped.state !== 'down') testTarget(ped.x, ped.y, 13, ped, 'ped');
  for (const car of cars) if (!car.dead) testTarget(car.x, car.y, 24, car, 'car');
  for (const cop of police.cars) if (!cop.dead) testTarget(cop.x, cop.y, 24, cop, 'car');
  if (victim) {
    endX = player.x + Math.cos(angle) * bestT;
    endY = player.y + Math.sin(angle) * bestT;
    if (victimKind === 'ped') {
      const fell = hurtPed(victim, PLAYER.shotDamage);
      burst(combat, victim.x, victim.y, 'hit', fell ? 12 : 6, random);
      scarePed(victim, player.x, player.y);
    } else {
      victim.health -= PLAYER.shotDamage;
      burst(combat, endX, endY, 'spark', 8, random);
      if (victim.health <= 0) { victim.dead = true; burst(combat, victim.x, victim.y, 'smoke', 18, random); }
    }
  }
  combat.tracers.push({ x1: player.x, y1: player.y, x2: endX, y2: endY, life: 0.09 });
  commitCrime(police, 1, witnessLevel(player.x, player.y, police.cars, peds));
  events.shot = true;
}
