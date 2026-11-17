// cars.js — entitas mobil, spawn parkir & lalu lintas, AI pengemudi kota,
// dan fisika menyetir pemain (arkade: gas, rem, setir tergantung kecepatan).

import { CAR_MODELS, TRAFFIC_MIX, PARKED_MIX } from './config.js';
import { collideCircle, nearestNode, intersections, dist2 } from './world.js';
import { ROADS_V, ROADS_H } from './config.js';

let carSeq = 1;

export function makeCar(modelKey, x, y, angle, colorOverride) {
  const m = CAR_MODELS[modelKey];
  return {
    id: carSeq++,
    model: modelKey,
    name: m.name,
    color: colorOverride || m.color,
    r: m.r,
    x, y, angle,
    speed: 0,
    health: 100,
    police: modelKey === 'police',
    parked: false,
    disabled: false,
    // state AI
    target: null,
    cruise: 0,
    stuckT: 0,
    honkT: 0,
  };
}

export function spawnParked(world, rng) {
  const cars = [];
  for (const lot of world.lots) {
    const cols = Math.max(1, Math.floor(lot.w / 64));
    const rows = Math.max(1, Math.floor(lot.h / 92));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (!rng.chance(0.55)) continue;
        const x = lot.x + 34 + i * 64;
        const y = lot.y + 46 + j * 92;
        const car = makeCar(rng.pick(PARKED_MIX), x, y, rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, rng.pick(['#c0392b', '#2471a3', '#7d3c98', '#b7950b', '#616a6b', '#ca6f1e', '#148f77', '#fdfefe']));
        car.parked = true;
        cars.push(car);
      }
    }
  }
  // Satu Melati GT emas selalu parkir di Parkir Timur: incaran misi 2.
  const lot = world.places.carpark.block;
  const gt = makeCar('gt', lot.x + lot.w / 2, lot.y + 52, Math.PI / 2);
  gt.parked = true;
  gt.isMissionCar = true;
  cars.push(gt);
  // Pickup santai di tepi pantai.
  const pk = makeCar('pickup', 3160, 1320, -Math.PI / 2, '#e67e22');
  pk.parked = true;
  cars.push(pk);
  return cars;
}

export function spawnTraffic(world, rng, count) {
  const cars = [];
  const nodes = intersections();
  for (let i = 0; i < count; i++) {
    const node = rng.pick(nodes);
    const car = makeCar(rng.pick(TRAFFIC_MIX), node.x + rng.range(-20, 20), node.y + rng.range(-20, 20), 0,
      rng.pick(['#c0392b', '#2471a3', '#7d3c98', '#b7950b', '#616a6b', '#ca6f1e', '#148f77', '#2e86c1', '#a93226', '#fdfefe']));
    car.cruise = rng.range(118, 168);
    car.target = pickNextNode(rng, node, null);
    snapToLane(car);
    cars.push(car);
  }
  return cars;
}

// Pilih simpang tetangga (searah baris/kolom), hindari putar balik bila bisa.
function pickNextNode(rng, from, avoid) {
  const options = [];
  for (const x of ROADS_V) if (x !== from.x) options.push({ x, y: from.y });
  for (const y of ROADS_H) if (y !== from.y) options.push({ x: from.x, y });
  const filtered = avoid ? options.filter(o => !(o.x === avoid.x && o.y === avoid.y)) : options;
  return rng.pick(filtered.length ? filtered : options);
}

function laneTarget(car) {
  // Titik bidik = simpang tujuan digeser ke lajur kanan relatif arah jalan.
  const dx = car.target.x - car.x, dy = car.target.y - car.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const off = 26;
  return { x: car.target.x + (-uy) * off, y: car.target.y + ux * off, ux, uy };
}

function snapToLane(car) {
  if (!car.target) return;
  const t = laneTarget(car);
  car.angle = Math.atan2(t.uy, t.ux);
}

export function stepTraffic(state, car, dt) {
  if (car.parked || car.disabled || car === state.playerCar) return;
  const world = state.world;
  if (!car.target) { car.target = pickNextNode(state.rng, nearestNode(car.x, car.y), null); }
  const t = laneTarget(car);
  const distT = Math.hypot(t.x - car.x, t.y - car.y);
  if (distT < 42) {
    const prev = nearestNode(car.x, car.y);
    car.target = pickNextNode(state.rng, car.target, prev);
    return;
  }
  const want = Math.atan2(t.y - car.y, t.x - car.x);
  car.angle = turnToward(car.angle, want, 2.4 * dt);

  // Jaga jarak dengan mobil di depan (searah, dekat).
  let speedCap = car.cruise;
  for (const other of state.allCars) {
    if (other === car || other.disabled) continue;
    const d2 = dist2(car.x, car.y, other.x, other.y);
    if (d2 > 95 * 95) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    if (ahead > 6 && ahead < 78) speedCap = Math.min(speedCap, Math.max(0, (ahead - 34) * 2.2));
  }
  // Pemain jalan kaki di depan mobil -> berhenti & klakson.
  const p = state.player;
  if (!p.car) {
    const aheadP = (p.x - car.x) * Math.cos(car.angle) + (p.y - car.y) * Math.sin(car.angle);
    const sideP = Math.abs((p.x - car.x) * -Math.sin(car.angle) + (p.y - car.y) * Math.cos(car.angle));
    if (aheadP > 0 && aheadP < 66 && sideP < 24) {
      speedCap = 0;
      if (car.honkT <= 0) { car.honkT = 2.4; state.audio.honk(); }
    }
  }
  car.honkT -= dt;
  car.speed = approach(car.speed, speedCap, (speedCap > car.speed ? 120 : 320) * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const res = collideCircle(world, nx, ny, car.r);
  if (res.hit && car.speed > 40) car.speed = 40;
  car.x = res.x; car.y = res.y;
}

// Fisika mobil pemain. input: {throttle:-1..1, steer:-1..1}
export function stepPlayerCar(state, car, ctrl, dt) {
  const m = CAR_MODELS[car.model];
  if (car.disabled) { car.speed = approach(car.speed, 0, 300 * dt); return; }
  const accel = ctrl.throttle > 0 ? m.accel : m.accel * 0.62;
  car.speed += ctrl.throttle * accel * dt;
  // Hambatan udara + gesekan.
  car.speed -= car.speed * 0.55 * dt;
  if (ctrl.throttle === 0) car.speed = approach(car.speed, 0, 60 * dt);
  car.speed = Math.max(-m.speed * 0.32, Math.min(m.speed, car.speed));
  const steerPower = ctrl.steer * (1.9 - Math.min(1.15, Math.abs(car.speed) / m.speed * 1.15));
  if (Math.abs(car.speed) > 4) car.angle += steerPower * dt * Math.sign(car.speed);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const res = collideCircle(state.world, nx, ny, car.r);
  if (res.hit) {
    if (Math.abs(car.speed) > 150) {
      state.damagePlayer(4);
      state.audio.crash();
      state.shake(0.22);
    }
    car.speed *= 0.35;
  }
  car.x = res.x; car.y = res.y;
  // Asap ban saat belok tajam dalam kecepatan.
  if (Math.abs(car.speed) > 170 && Math.abs(ctrl.steer) > 0.6 && state.rng.chance(0.35)) {
    state.addParticle(car.x - Math.cos(car.angle) * 16, car.y - Math.sin(car.angle) * 16, 'smoke');
  }
}

// Tabrakan antar mobil (lingkaran sederhana, saling dorong).
export function collideCars(state, dt) {
  const cars = state.allCars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      const rr = a.r + b.r - 4;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) / 2;
      const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
      const relSpeed = Math.abs(a.speed - b.speed);
      if (!a.parked) { a.x -= ux * push; a.y -= uy * push; }
      if (!b.parked) { b.x += ux * push; b.y += uy * push; }
      if (a.parked) a.parked = false;
      if (b.parked) b.parked = false;
      if (relSpeed > 120) {
        a.health -= 9; b.health -= 9;
        if (a === state.playerCar || b === state.playerCar) {
          state.damagePlayer(5);
          state.audio.crash();
          state.shake(0.3);
          state.reportCrime(a.x, a.y, 18);
        }
      }
      const avg = (a.speed + b.speed) / 2;
      if (!a.disabled) a.speed = avg * 0.7;
      if (!b.disabled) b.speed = avg * 0.7;
      if (a.health <= 0) a.disabled = true;
      if (b.health <= 0) b.disabled = true;
    }
  }
}

export function turnToward(angle, want, maxStep) {
  let d = want - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return want;
  return angle + Math.sign(d) * maxStep;
}

export function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  return Math.max(target, v - step);
}
