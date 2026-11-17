// peds.js — pejalan kaki: jalan di trotoar mengikuti sumbu jalan,
// kadang menyeberang ganti sumbu di simpang; lari saat bahaya; bisa tumbang.

import { ROADS_V, ROADS_H, ROAD_W, BEACH_X, SEA_X, WORLD_H } from './config.js';
import { collideCircle, dist2 } from './world.js';

const SHIRTS = ['#e74c3c', '#f39c12', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#c2185b', '#5d6d7e', '#b9770e', '#1f618d'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function spawnPeds(world, rng, count) {
  const peds = [];
  for (let i = 0; i < count - 6; i++) {
    const onV = rng.chance(0.55);
    const ped = {
      x: 0, y: 0, angle: 0, speed: rng.range(38, 66),
      axis: onV ? 'v' : 'h',
      roadIdx: onV ? rng.int(0, ROADS_V.length - 1) : rng.int(0, ROADS_H.length - 1),
      along: 0, lateral: (ROAD_W / 2 + 15) * rng.sign(),
      shirt: rng.pick(SHIRTS), skin: rng.pick(SKINS),
      health: 100, state: 'walk', stateT: 0, dirSign: rng.sign(),
      beach: false,
    };
    ped.along = rng.range(80, (onV ? WORLD_H : 2900) - 80);
    placeOnSidewalk(ped);
    peds.push(ped);
  }
  // Pengunjung pantai: mondar-mandir di pasir.
  for (let i = 0; i < 6; i++) {
    const ped = {
      x: rng.range(BEACH_X + 30, SEA_X - 60), y: rng.range(120, WORLD_H - 120),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(30, 48),
      shirt: rng.pick(SHIRTS), skin: rng.pick(SKINS),
      health: 100, state: 'walk', stateT: 0, dirSign: 1, beach: true,
      target: null,
    };
    ped.target = { x: rng.range(BEACH_X + 30, SEA_X - 60), y: rng.range(120, WORLD_H - 120) };
    peds.push(ped);
  }
  return peds;
}

function placeOnSidewalk(ped) {
  if (ped.axis === 'v') {
    ped.x = ROADS_V[ped.roadIdx] + ped.lateral;
    ped.y = ped.along;
  } else {
    ped.x = ped.along;
    ped.y = ROADS_H[ped.roadIdx] + ped.lateral;
  }
}

export function stepPed(state, ped, dt) {
  const world = state.world;
  ped.stateT -= dt;
  if (ped.state === 'down') {
    if (ped.stateT <= 0 && ped.health > 0) ped.state = 'walk';
    return;
  }
  if (ped.state === 'flee') {
    const d = state.danger;
    if (d) {
      const away = Math.atan2(ped.y - d.y, ped.x - d.x);
      ped.angle = away;
      movePed(state, ped, 148 * dt);
    }
    if (ped.stateT <= 0) ped.state = 'walk';
    return;
  }
  // Jalan biasa.
  if (ped.beach) {
    if (!ped.target || dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 30 * 30) {
      ped.target = { x: state.rng.range(BEACH_X + 30, SEA_X - 60), y: state.rng.range(120, world.h - 120) };
    }
    ped.angle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    movePed(state, ped, ped.speed * dt);
    return;
  }
  ped.along += ped.dirSign * ped.speed * dt;
  const limit = ped.axis === 'v' ? world.h : 2960;
  if (ped.along > limit - 70) { ped.along = limit - 70; ped.dirSign = -1; }
  if (ped.along < 70) { ped.along = 70; ped.dirSign = 1; }
  // Di dekat simpang, kadang pindah sumbu (menyeberang).
  const crossCenters = ped.axis === 'v' ? ROADS_H : ROADS_V;
  for (const c of crossCenters) {
    if (Math.abs(ped.along - c) < 8 && state.rng.chance(0.012)) {
      const alongHere = ped.axis === 'v' ? ped.y : ped.x;
      ped.axis = ped.axis === 'v' ? 'h' : 'v';
      ped.roadIdx = crossCenters.indexOf(c);
      ped.along = alongHere;
      ped.lateral = (ROAD_W / 2 + 15) * state.rng.sign();
      break;
    }
  }
  const ox = ped.x, oy = ped.y;
  placeOnSidewalk(ped);
  ped.angle = Math.atan2(ped.y - oy, ped.x - ox);
}

function movePed(state, ped, stepLen) {
  const nx = ped.x + Math.cos(ped.angle) * stepLen;
  const ny = ped.y + Math.sin(ped.angle) * stepLen;
  const res = collideCircle(state.world, nx, ny, 11);
  ped.x = res.x; ped.y = res.y;
}

export function knockDown(ped, seconds) {
  ped.state = 'down';
  ped.stateT = seconds;
}

// Mobil cepat menabrak pejalan kaki.
export function checkCarHitsPeds(state, dt) {
  for (const car of state.allCars) {
    if (car.disabled || Math.abs(car.speed) < 55) continue;
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (dist2(car.x, car.y, ped.x, ped.y) < (car.r + 12) * (car.r + 12)) {
        ped.health -= Math.abs(car.speed) > 170 ? 70 : 40;
        knockDown(ped, ped.health > 0 ? 5 : 9999);
        state.addParticle(ped.x, ped.y, 'hit');
        if (car === state.playerCar) {
          state.reportCrime(ped.x, ped.y, 55);
          state.audio.thud();
          state.shake(0.18);
        }
      }
    }
    // Pemain jalan kaki tertabrak mobil lain.
    const p = state.player;
    if (!p.car && car !== state.playerCar && dist2(car.x, car.y, p.x, p.y) < (car.r + 13) * (car.r + 13)) {
      state.damagePlayer(Math.abs(car.speed) > 170 ? 26 : 14);
      const away = Math.atan2(p.y - car.y, p.x - car.x);
      p.x += Math.cos(away) * 26;
      p.y += Math.sin(away) * 26;
      car.speed *= 0.4;
    }
  }
}
