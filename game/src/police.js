// police.js — sistem wanted berbasis saksi (heat -> bintang) dan AI polisi:
// patroli datang dari jauh, mengejar lewat jaringan jalan, mendekat langsung
// saat pemain terlihat, dan mengisi meter tangkap bila pemain terpojok.

import { WANTED } from './config.js';
import { makeCar, turnToward, approach } from './cars.js';
import { collideCircle, nearestNode, randomRoadPoint, dist2 } from './world.js';

export class Wanted {
  constructor() {
    this.heat = 0;
    this.sinceCrime = 99;  // detik sejak kejahatan terakhir
    this.sinceSeen = 99;   // detik sejak terakhir terlihat polisi
  }
  get stars() {
    if (this.heat <= 0) return 0;
    return Math.min(5, Math.ceil(this.heat / WANTED.perStar));
  }
  add(amount) {
    this.heat = Math.min(WANTED.maxHeat, this.heat + amount);
    this.sinceCrime = 0;
  }
  markSeen() { this.sinceSeen = 0; }
  update(dt) {
    this.sinceCrime += dt;
    this.sinceSeen += dt;
    if (this.sinceCrime > WANTED.decayDelay && this.sinceSeen > 2.5) {
      this.heat = Math.max(0, this.heat - WANTED.decayRate * dt);
    }
  }
  clear() { this.heat = 0; this.sinceCrime = 99; this.sinceSeen = 99; }
}

function desiredPolice(stars) {
  return stars === 0 ? 0 : Math.min(6, 1 + stars);
}

function policeTopSpeed(stars) {
  return Math.min(338, 226 + stars * 24);
}

export function stepPolice(state, dt) {
  const wanted = state.wanted;
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const stars = wanted.stars;

  // Terlihat? polisi mana pun dalam jangkauan pandang.
  let anyNear = false;
  for (const cop of state.police) {
    if (dist2(cop.x, cop.y, px, py) < WANTED.seenRange * WANTED.seenRange) { anyNear = true; break; }
  }
  if (anyNear) wanted.markSeen();

  // Spawn / despawn menjaga jumlah sesuai bintang.
  state.policeTimer -= dt;
  if (state.police.length < desiredPolice(stars) && state.policeTimer <= 0) {
    state.policeTimer = 1.6;
    const spot = randomRoadPoint(state.rng);
    if (dist2(spot.x, spot.y, px, py) > 640 * 640) {
      const cop = makeCar('police', spot.x, spot.y, 0);
      cop.cruise = policeTopSpeed(stars);
      cop.target = nearestNode(px, py);
      state.police.push(cop);
      state.allCars.push(cop);
    }
  }
  if (stars === 0) {
    for (let i = state.police.length - 1; i >= 0; i--) {
      const cop = state.police[i];
      if (dist2(cop.x, cop.y, px, py) > 780 * 780) removeCop(state, i);
    }
  }

  // Gerak tiap mobil polisi + logika tangkap.
  let busting = false;
  for (const cop of state.police) {
    if (cop.disabled) continue;
    cop.cruise = policeTopSpeed(Math.max(1, stars));
    driveCop(state, cop, px, py, dt);
    const d = Math.hypot(cop.x - px, cop.y - py);
    if (stars > 0 && d < 74) {
      const playerSpeed = p.car ? Math.abs(p.car.speed) : Math.hypot(p.vx || 0, p.vy || 0);
      if (playerSpeed < 42) busting = true;
    }
  }
  if (busting) {
    state.bust = Math.min(1, state.bust + dt / 2.4);
    if (state.bust >= 1) state.doBusted();
  } else {
    state.bust = Math.max(0, state.bust - dt / 1.4);
  }
}

function driveCop(state, cop, px, py, dt) {
  const dPlayer = Math.hypot(px - cop.x, py - cop.y);
  let aimX, aimY;
  if (dPlayer < 250) {
    aimX = px; aimY = py; // kejar langsung
  } else {
    if (!cop.target || state.time - (cop.retargetT || 0) > 1.4) {
      cop.target = nearestNode(px, py);
      cop.retargetT = state.time;
    }
    // Jalan menuju simpang terdekat dari polisi dulu bila belum di jalan yang sama.
    const myNode = nearestNode(cop.x, cop.y);
    const dNode = Math.hypot(myNode.x - cop.x, myNode.y - cop.y);
    if (dNode > 46 && Math.hypot(cop.target.x - cop.x, cop.target.y - cop.y) > 60) {
      aimX = myNode.x; aimY = myNode.y;
      if (Math.abs(cop.target.x - myNode.x) > 4 && Math.abs(cop.target.y - myNode.y) > 4) {
        aimX = myNode.x; aimY = myNode.y;
      }
    } else {
      aimX = cop.target.x; aimY = cop.target.y;
    }
  }
  const want = Math.atan2(aimY - cop.y, aimX - cop.x);
  cop.angle = turnToward(cop.angle, want, 2.7 * dt);
  let speedCap = cop.cruise;
  // Jangan menabrak pemain terlalu keras dari belakang saat sudah dekat.
  if (dPlayer < 60) speedCap = Math.min(speedCap, 60);
  cop.speed = approach(cop.speed, speedCap, 260 * dt);
  const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
  const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
  const res = collideCircle(state.world, nx, ny, cop.r);
  if (res.hit) cop.speed *= 0.5;
  cop.x = res.x; cop.y = res.y;
}

function removeCop(state, idx) {
  const cop = state.police[idx];
  state.police.splice(idx, 1);
  const ai = state.allCars.indexOf(cop);
  if (ai >= 0) state.allCars.splice(ai, 1);
}
