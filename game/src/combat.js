// combat.js — pukul (Spasi) dan tembak (klik mouse) untuk pemain jalan kaki.
// Setiap kejahatan dilaporkan lewat state.reportCrime (saksi menentukan wanted)
// dan menakuti pejalan kaki di sekitar.

import { PLAYER, WANTED } from './config.js';
import { dist2 } from './world.js';
import { knockDown } from './peds.js';

export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist2(ped.x, ped.y, x, y) < radius * radius) {
      ped.state = 'flee';
      ped.stateT = 2.6;
    }
  }
  state.danger = { x, y };
}

export function meleeAttack(state) {
  const p = state.player;
  const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
  let hitSomething = false;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - p.x, dy = ped.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < PLAYER.meleeRange + 10 && (dx * fx + dy * fy) / (d || 1) > 0.25) {
      ped.health -= PLAYER.meleeDamage;
      knockDown(ped, ped.health > 0 ? 3.5 : 9999);
      state.addParticle(ped.x, ped.y, 'hit');
      hitSomething = true;
      state.reportCrime(ped.x, ped.y, 26);
    }
  }
  for (const cop of state.police) {
    if (cop.disabled) continue;
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < PLAYER.meleeRange + cop.r) {
      cop.health -= PLAYER.meleeDamage * 0.7;
      if (cop.health <= 0) { cop.disabled = true; state.reportCrime(cop.x, cop.y, 90); }
      state.addParticle(cop.x, cop.y, 'hit');
      hitSomething = true;
    }
  }
  state.audio.punch();
  if (hitSomething) scarePeds(state, p.x, p.y, 130);
  return hitSomething;
}

export function gunAttack(state, targetX, targetY) {
  const p = state.player;
  const ang = Math.atan2(targetY - p.y, targetX - p.x);
  p.angle = ang;
  const ux = Math.cos(ang), uy = Math.sin(ang);
  state.audio.shot();
  state.addParticle(p.x + ux * 20, p.y + uy * 20, 'muzzle');
  scarePeds(state, p.x, p.y, 300);

  // Cari sasaran terdekat di sepanjang garis tembak.
  let best = null, bestT = PLAYER.gunRange;
  function consider(obj, radius, kind) {
    const dx = obj.x - p.x, dy = obj.y - p.y;
    const t = dx * ux + dy * uy;
    if (t < 12 || t > bestT) return;
    const side = Math.abs(dx * -uy + dy * ux);
    if (side < radius + 3) { best = { obj, kind, t }; bestT = t; }
  }
  for (const ped of state.peds) if (ped.state !== 'down') consider(ped, 11, 'ped');
  for (const car of state.allCars) if (!car.disabled) consider(car, car.r, 'car');

  if (best) {
    const o = best.obj;
    state.addParticle(o.x, o.y, 'spark');
    if (best.kind === 'ped') {
      o.health -= PLAYER.gunDamage;
      knockDown(o, o.health > 0 ? 4 : 9999);
      state.reportCrime(o.x, o.y, 45, true);
    } else {
      o.health -= PLAYER.gunDamage * 0.8;
      if (o.police) {
        if (o.health <= 0 && !o.disabled) { o.disabled = true; state.reportCrime(o.x, o.y, 110, true); }
        else state.reportCrime(o.x, o.y, 60, true);
      } else {
        state.reportCrime(o.x, o.y, 30, true);
      }
    }
  } else {
    // Tembakan meleset pun terdengar saksi.
    state.reportCrime(p.x + ux * 120, p.y + uy * 120, 16, true);
  }
  return best !== null;
}

// Dipanggil tiap langkah dari main: menangani input serang + cooldown.
export function stepCombat(state, dt) {
  const p = state.player;
  p.atkCd = Math.max(0, (p.atkCd || 0) - dt);
  if (p.car || state.mode !== 'play') return;
  if (state.input.down('Space') && p.atkCd <= 0) {
    p.atkCd = PLAYER.meleeCooldown;
    meleeAttack(state);
  }
  if (state.input.mouse.clicked && p.atkCd <= 0) {
    p.atkCd = PLAYER.gunCooldown;
    gunAttack(state, state.mouseWorld.x, state.mouseWorld.y);
  }
}

export { WANTED };
