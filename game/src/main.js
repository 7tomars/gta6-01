// main.js — merangkai semua modul: state game, loop langkah-tetap,
// gerak pemain (jalan kaki & menyetir), masuk/keluar mobil, kamera,
// dan boot browser (canvas + adegan screenshot).

import { PLAYER, WANTED, WORLD_W, WORLD_H } from './config.js';
import { makeRng } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { buildWorld, collideCircle } from './world.js';
import { spawnParked, spawnTraffic, stepTraffic, stepPlayerCar, stepLooseCar, collideCars } from './cars.js';
import { spawnPeds, stepPed, checkCarHitsPeds } from './peds.js';
import { Wanted, stepPolice } from './police.js';
import { stepCombat, scarePeds } from './combat.js';
import { Missions } from './missions.js';
import { drawWorld } from './render.js';
import { drawHud } from './hud.js';
import { setupShot } from './shots.js';

const PARTICLE_LIFE = { smoke: 0.9, muzzle: 0.16, spark: 0.4, hit: 0.5, cash: 0.8 };

export function createGame(seed, opts = {}) {
  const rng = makeRng(seed);
  const world = buildWorld(rng);
  const career = loadSave(opts.storage);
  const traffic = spawnTraffic(world, rng, 15);
  const parked = spawnParked(world, rng);
  const home = world.places.home;

  const state = {
    seed, rng, world, career,
    input: opts.input || createInput(null),
    audio: opts.audio || createAudio(),
    player: {
      x: home.x, y: home.y + 10, angle: Math.PI / 2,
      health: PLAYER.maxHealth, car: null, vx: 0, vy: 0, atkCd: 0, lastHurtT: -99,
    },
    traffic, parkedCars: parked,
    allCars: [...parked, ...traffic],
    police: [],
    peds: spawnPeds(world, rng, 26),
    particles: [],
    wanted: new Wanted(),
    dialogues: [],
    cam: { x: 0, y: 0 },
    view: { w: 1280, h: 800 },
    time: 0,
    mode: 'title',
    bust: 0,
    policeTimer: 0,
    danger: null,
    mouseWorld: { x: 0, y: 0 },
    shakeT: 0,
    endTimer: 0,
    shotName: null, shotCam: null, shotDelay: 0, shotStart: 0,
    storage: opts.storage,
  };
  Object.defineProperty(state, 'playerCar', { get() { return this.player.car; } });
  state.missions = new Missions(state);

  state.persist = () => writeSave(state.storage, state.career);
  state.addDialogue = (who, text) => {
    state.dialogues.push({ who, text, t: 0 });
    if (state.dialogues.length > 3) state.dialogues.shift();
  };
  state.addParticle = (x, y, type) => {
    state.particles.push({ x, y, type, t: 0, life: PARTICLE_LIFE[type] || 0.5 });
    if (state.particles.length > 240) state.particles.splice(0, 40);
  };
  state.addMoney = (n) => {
    state.career.money += n;
    if (n > 0) state.career.totalEarned += n;
    state.persist();
    state.audio.cash();
    const p = state.player;
    state.addParticle(p.car ? p.car.x : p.x, (p.car ? p.car.y : p.y) - 22, 'cash');
  };
  state.shake = (t) => { state.shakeT = Math.max(state.shakeT, t); };
  state.reportCrime = (x, y, amount, loud = false) => {
    const range = loud ? WANTED.gunshotRange : WANTED.witnessRange;
    let witnessed = false;
    for (const ped of state.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < range) { witnessed = true; break; }
    }
    if (!witnessed) {
      for (const cop of state.police) {
        if (Math.hypot(cop.x - x, cop.y - y) < range + 70) { witnessed = true; break; }
      }
    }
    if (witnessed) state.wanted.add(amount);
    if (loud || amount >= 40) scarePeds(state, x, y, 230);
    return witnessed;
  };
  state.damagePlayer = (n) => {
    if (state.mode !== 'play') return;
    const p = state.player;
    p.health -= n;
    p.lastHurtT = state.time;
    state.shake(0.14);
    if (p.health <= 0) {
      p.health = 0;
      state.mode = 'wasted';
      state.endTimer = 0;
      state.career.money = Math.max(0, state.career.money - 90);
      state.persist();
    }
  };
  state.doBusted = () => {
    if (state.mode !== 'play') return;
    state.mode = 'busted';
    state.endTimer = 0;
    state.bust = 0;
    state.career.money = Math.max(0, state.career.money - 120);
    state.persist();
    state.wanted.clear();
    if (state.player.car) state.player.car = null;
    for (let i = state.police.length - 1; i >= 0; i--) {
      const ai = state.allCars.indexOf(state.police[i]);
      if (ai >= 0) state.allCars.splice(ai, 1);
    }
    state.police.length = 0;
  };

  state.step = (dt) => stepGame(state, dt);
  return state;
}

function stepGame(state, dt) {
  state.time += dt;
  const p = state.player;

  // Antrean dialog & partikel selalu berjalan.
  if (state.dialogues.length) {
    state.dialogues[0].t += dt;
    if (state.dialogues[0].t > 4.6) state.dialogues.shift();
  }
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.t += dt;
    if (pt.t >= pt.life) state.particles.splice(i, 1);
  }
  state.shakeT = Math.max(0, state.shakeT - dt);

  if (state.mode === 'busted' || state.mode === 'wasted') {
    state.endTimer += dt;
    if (state.endTimer > 2.6) respawn(state);
    state.input.endStep();
    return;
  }
  if (state.mode === 'pause') { state.input.endStep(); return; }

  // Kota tetap hidup di balik layar judul.
  for (const car of state.traffic) stepTraffic(state, car, dt);
  for (const ped of state.peds) stepPed(state, ped, dt);
  collideCars(state, dt);
  for (const car of state.allCars) {
    if (!car.parked && car !== state.player.car && !state.traffic.includes(car) && !state.police.includes(car)) {
      stepLooseCar(state, car, dt);
    }
  }

  if (state.mode === 'title') {
    const c = state.shotCam || { x: 1740, y: 1260 };
    setCam(state, c.x, c.y);
    state.input.endStep();
    checkShotReady(state);
    return;
  }

  // --- mode play ---
  stepPlayer(state, dt);
  stepPolice(state, dt);
  state.wanted.update(dt);
  if (state.wanted.stars > (state.career.bestStars || 0)) {
    state.career.bestStars = state.wanted.stars;
  }
  checkCarHitsPeds(state, dt);
  stepCombat(state, dt);
  state.missions.update(state);

  // Regen kesehatan setelah aman beberapa detik.
  if (p.health > 0 && p.health < PLAYER.maxHealth && state.time - p.lastHurtT > PLAYER.regenDelay) {
    p.health = Math.min(PLAYER.maxHealth, p.health + PLAYER.regenRate * dt);
  }

  const focus = p.car || p;
  setCam(state, focus.x, focus.y);
  const nearestCop = state.police.length > 0;
  state.audio.update(dt, !!p.car, p.car ? p.car.speed / 320 : 0, nearestCop && state.wanted.stars > 0, state.time);
  state.input.endStep();
  checkShotReady(state);
}

function setCam(state, tx, ty) {
  const vw = state.view.w, vh = state.view.h;
  let x = tx - vw / 2, y = ty - vh / 2;
  x = Math.max(0, Math.min(Math.max(0, WORLD_W - vw), x));
  y = Math.max(0, Math.min(Math.max(0, WORLD_H - vh), y));
  if (state.shakeT > 0) {
    x += Math.sin(state.time * 61) * state.shakeT * 16;
    y += Math.cos(state.time * 53) * state.shakeT * 16;
  }
  state.cam.x = x; state.cam.y = y;
}

function stepPlayer(state, dt) {
  const p = state.player;
  const input = state.input;

  if (input.justPressed('KeyP') || input.justPressed('Escape')) {
    state.mode = 'pause';
    return;
  }

  if (p.car) {
    const ctrl = {
      throttle: (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) + (input.down('KeyS') || input.down('ArrowDown') ? -1 : 0),
      steer: (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) + (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0),
    };
    stepPlayerCar(state, p.car, ctrl, dt);
    p.x = p.car.x; p.y = p.car.y;
    p.vx = Math.cos(p.car.angle) * p.car.speed;
    p.vy = Math.sin(p.car.angle) * p.car.speed;
    if (input.justPressed('KeyE')) exitCar(state);
    return;
  }

  const ax = input.axis();
  const running = input.down('ShiftLeft') || input.down('ShiftRight');
  const spd = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.vx = ax.x * spd; p.vy = ax.y * spd;
  if (ax.x !== 0 || ax.y !== 0) p.angle = Math.atan2(ax.y, ax.x);
  else if (state.input.mouse.down) p.angle = Math.atan2(state.mouseWorld.y - p.y, state.mouseWorld.x - p.x);
  const res = collideCircle(state.world, p.x + p.vx * dt, p.y + p.vy * dt, PLAYER.radius);
  p.x = res.x; p.y = res.y;

  if (input.justPressed('KeyE')) {
    let best = null, bd = 56 * 56;
    for (const car of state.allCars) {
      if (car.disabled) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d * d < bd) { bd = d * d; best = car; }
    }
    if (best) enterCar(state, best);
  }
}

function enterCar(state, car) {
  const p = state.player;
  p.car = car;
  p.x = car.x; p.y = car.y;
  state.audio.door();
  if (car.parked) {
    car.parked = false;
    if (!car.isMissionCar) state.reportCrime(car.x, car.y, 35);
  }
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  p.car = null;
  const side = car.angle + Math.PI / 2;
  const res = collideCircle(state.world, car.x + Math.cos(side) * (car.r + 18), car.y + Math.sin(side) * (car.r + 18), PLAYER.radius);
  p.x = res.x; p.y = res.y;
  car.speed = 0;
  state.audio.door();
}

function respawn(state) {
  const p = state.player;
  const hosp = state.world.places.hospital;
  p.car = null;
  p.x = hosp.x; p.y = hosp.y + 8;
  p.health = PLAYER.maxHealth;
  state.bust = 0;
  state.mode = 'play';
  state.addDialogue('Riko', 'Kembali ke jalan. Sundara Bay belum selesai denganku.');
}

function checkShotReady(state) {
  if (state.shotName && typeof window !== 'undefined' && !window.__shotReady) {
    if (state.time - state.shotStart >= state.shotDelay) window.__shotReady = true;
  }
}

// --- Boot browser ---
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || 20261117) >>> 0;
  const input = createInput(canvas);
  const state = createGame(seed, { input });
  window.__game = state;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.view.w = canvas.width;
    state.view.h = canvas.height;
  }
  window.addEventListener('resize', resize);
  resize();

  const shot = params.get('shot');
  if (shot) setupShot(state, shot);
  else state.mode = 'title';

  function startIfTitle() {
    if (state.mode === 'title') {
      state.audio.unlock();
      state.mode = 'play';
    } else if (state.mode === 'pause' && (input.justPressed('KeyP') || input.justPressed('Escape'))) {
      state.mode = 'play';
    }
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') startIfTitle();
    if ((e.code === 'KeyP' || e.code === 'Escape') && state.mode === 'pause') state.mode = 'play';
  });
  canvas.addEventListener('mousedown', () => {
    state.audio.unlock();
    if (state.mode === 'title') state.mode = 'play';
  });

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    const step = 1 / 60;
    let n = 0;
    while (acc >= step && n < 5) {
      state.mouseWorld.x = input.mouse.x + state.cam.x;
      state.mouseWorld.y = input.mouse.y + state.cam.y;
      state.step(step);
      acc -= step;
      n++;
    }
    if (n === 5) acc = 0;
    drawWorld(ctx, state);
    drawHud(ctx, state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
