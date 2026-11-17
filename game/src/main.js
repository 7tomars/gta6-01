// Sundara Heat — boot, the game state, the fixed-step loop and the screens.
// Riko, a courier in the coastal city of Sundara Bay, owes the Arus Liar crew
// money; three story missions (deliver, steal, run) pay the debt off, and side
// deliveries keep the cash coming. Everything simulated here is advanced in
// fixed 1/60 s steps; drawing lives in render.js and hud.js.
//
// ?seed=N fixes the city layout. ?shot=cover|chase|mission|beach (with
// &seed=N) stages that screenshot scene instead of running the live game.

import { CAR, PLAYER, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave } from './save.js';
import { createCity, resolveCircle, distance } from './world.js';
import { spawnParked, spawnTraffic, updatePlayerCar, updateTraffic, nearCar } from './cars.js';
import { spawnPeds, updatePed, scarePed, hurtPed } from './peds.js';
import { createPoliceState, commitCrime, syncPolice, updatePolice, clearHeat } from './police.js';
import { createCombat, burst, punch, shoot, updateCombat, witnessLevel } from './combat.js';
import { createMissions, buildSideJob, updateMissions } from './missions.js';
import { createRenderer } from './render.js';
import { drawHud, drawScreen, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './hud.js';
import { idleControl, stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const view = { w: 1280, h: 720 };

function fitCanvas() {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = view.w;
  canvas.height = view.h;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

/** Build a complete fresh game state for a seed. */
export function createGame(gameSeed) {
  const random = createRandom(gameSeed);
  const city = createCity(random);
  const save = loadSave();
  const home = city.safehouse;
  const state = {
    random,
    city,
    save,
    time: 0,
    cars: [...spawnParked(city, random), ...spawnTraffic(random, 15)],
    peds: spawnPeds(city, random, 26),
    police: createPoliceState(),
    combat: createCombat(),
    missions: createMissions(city, save),
    player: {
      x: home.x, y: home.y + 10, angle: 0, health: PLAYER.maxHealth,
      inCar: false, car: null, moving: false,
    },
    cam: { x: 0, y: 0 },
    prompt: '',
    over: null,
    nextMissionIn: 0,
    sideIndex: 0,
  };
  // Resume the story where the save left it, or start the first mission.
  if (save.missionIndex < state.missions.story.length) {
    state.missions.startMission(state.missions.story[save.missionIndex]);
  }
  updateCamera(state, 1);
  return state;
}

/** Centre the camera on the player (or their car), clamped to the world. */
function updateCamera(state, snap = 0) {
  const p = state.player;
  const tx = Math.max(0, Math.min(WORLD.width - view.w, p.x - view.w / 2));
  const ty = Math.max(0, Math.min(WORLD.height - view.h, p.y - view.h / 2));
  const k = snap ? 1 : 0.12;
  state.cam.x += (tx - state.cam.x) * k;
  state.cam.y += (ty - state.cam.y) * k;
}

/** The nearest enterable car to the player, or null. */
function nearestCar(state, dist) {
  let best = null;
  let bestD = dist;
  for (const car of state.cars) {
    if (car.dead) continue;
    const d = distance(state.player.x, state.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Enter (or steal) a car: witnesses decide how much heat it draws. */
function enterCar(state, car, events) {
  const wasParked = car.kind === 'parked';
  car.kind = 'player';
  car.speed = 0;
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  events.door = true;
  // Taking a car that is not yours is a crime when anyone sees it; the golden
  // story car draws extra heat, and nearby citizens scatter either way.
  const wit = witnessLevel(car.x, car.y, state.police.cars, state.peds);
  if (wit !== 'none') commitCrime(state.police, car.storyTarget ? 1.5 : 1, wit);
  for (const ped of state.peds) {
    if (distance(ped.x, ped.y, car.x, car.y) < 130) scarePed(ped, car.x, car.y);
  }
  void wasParked;
}

/** Climb out, leaving the car parked where it stands. */
function exitCar(state, events) {
  const car = state.player.car;
  car.kind = 'parked';
  car.speed = 0;
  state.player.inCar = false;
  state.player.car = null;
  state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  resolveCircle(state.city, state.player, PLAYER.radius);
  events.door = true;
}

/** Car-versus-car and car-versus-ped contact for the player's car. */
function carContacts(state, events) {
  const car = state.player.car;
  if (!car) return;
  const speed = Math.abs(car.speed);
  for (const other of [...state.cars, ...state.police.cars]) {
    if (other === car || other.dead) continue;
    const d = distance(car.x, car.y, other.x, other.y);
    if (d < 42 && d > 0) {
      const push = (42 - d) / 2;
      const nx = (other.x - car.x) / d;
      const ny = (other.y - car.y) / d;
      other.x += nx * push; other.y += ny * push;
      car.x -= nx * push; car.y -= ny * push;
      if (speed > 130) {
        other.health -= 1;
        if (other.health <= 0) { other.dead = true; burst(state.combat, other.x, other.y, 'smoke', 14, state.random); }
        commitCrime(state.police, 0.5, witnessLevel(car.x, car.y, state.police.cars, state.peds));
        events.crash = true;
        state.combat.shake = 7;
        car.speed *= 0.5;
      } else {
        car.speed *= 0.7;
      }
    }
  }
  if (speed > 90) {
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (distance(car.x, car.y, ped.x, ped.y) < 30) {
        hurtPed(ped, 2);
        burst(state.combat, ped.x, ped.y, 'hit', 10, state.random);
        commitCrime(state.police, 1, witnessLevel(car.x, car.y, state.police.cars, state.peds));
        events.crash = true;
        state.combat.shake = 6;
        car.speed *= 0.6;
      }
    }
  }
}

/** Advance the whole simulation one fixed step under control block `ctl`. */
export function stepWorld(state, ctl, dt, events) {
  state.time += dt;
  const { player, police } = state;

  if (player.inCar) {
    const car = player.car;
    const impact = updatePlayerCar(car, ctl.held, state.city, dt);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (impact > 0) {
      events.crash = true;
      state.combat.shake = Math.min(12, impact / 30);
      player.health -= impact / 60;
      burst(state.combat, car.x, car.y, 'spark', 10, state.random);
    }
    carContacts(state, events);
  } else {
    const speed = ctl.held.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mv = ctl.move;
    player.moving = mv.x !== 0 || mv.y !== 0;
    if (player.moving) {
      player.x += mv.x * speed * dt;
      player.y += mv.y * speed * dt;
      player.angle = Math.atan2(mv.y, mv.x);
      resolveCircle(state.city, player, PLAYER.radius);
    }
    if (ctl.actions & ACTION_PUNCH) punch({ ...state, player }, events);
    if (ctl.clicked) shoot({ ...state, player }, ctl.mouseWorld.x, ctl.mouseWorld.y, events);
  }

  if (ctl.actions & ACTION_INTERACT) {
    if (player.inCar) exitCar(state, events);
    else {
      const car = nearestCar(state, 54);
      if (car) enterCar(state, car, events);
    }
  }

  for (const car of state.cars) updateTraffic(car, state.cars, state.city, state.random, dt, events);
  for (const ped of state.peds) updatePed(ped, dt);

  syncPolice(police, player, state.random);
  updatePolice(police, player, player.inCar, state.city, dt, events);
  if (events.ram) {
    player.health -= 14;
    state.combat.shake = 9;
    events.ram = false;
    events.crash = true;
  }
  if (police.bustMeter >= 1 && !state.over) state.over = 'busted';
  if (player.health <= 0 && !state.over) state.over = 'wasted';
  if (police.stars === 0 && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + dt * 2.2);
  }

  // Missions and the career.
  const ctx = { player, inCar: player.inCar, carIsGold: !!(player.car && player.car.storyTarget), police };
  const finished = updateMissions(state.missions, ctx, dt);
  if (finished && finished !== 'stage') {
    state.save.money += finished.reward;
    if (finished.side) state.save.sideJobs += 1;
    else state.save.missionIndex += 1;
    storeSave(state.save);
    events.cash = true;
    burst(state.combat, player.x, player.y, 'cash', 16, state.random);
    state.nextMissionIn = 5;
  }
  if (state.nextMissionIn > 0) {
    state.nextMissionIn -= dt;
    if (state.nextMissionIn <= 0 && !state.missions.current) {
      if (state.save.missionIndex < state.missions.story.length) {
        state.missions.startMission(state.missions.story[state.save.missionIndex]);
      } else {
        state.sideIndex += 1;
        state.missions.startMission(buildSideJob(state.city, state.random, state.sideIndex));
      }
    }
  }

  // Interaction prompt for the HUD.
  state.prompt = '';
  if (!player.inCar) {
    const car = nearestCar(state, 54);
    if (car) state.prompt = `E — masuk / curi ${car.model.name}`;
  }

  updateCombat(state.combat, dt);
  updateCamera(state);
}

/** Apply the busted/wasted penalty and put Riko back on the street. */
function applyPenalty(state) {
  const save = state.save;
  if (state.over === 'busted') {
    save.money = Math.max(0, save.money - (80 + state.police.stars * 25));
    save.busts += 1;
    const home = state.city.safehouse;
    state.player.x = home.x; state.player.y = home.y + 10;
  } else {
    save.money = Math.max(0, save.money - 90);
    save.wasted += 1;
    const hosp = state.city.hospital;
    state.player.x = hosp.x; state.player.y = hosp.y + 10;
  }
  if (state.player.inCar) {
    state.player.car.kind = 'parked';
    state.player.car = null;
    state.player.inCar = false;
  }
  state.player.health = PLAYER.maxHealth;
  clearHeat(state.police);
  state.over = null;
  storeSave(save);
  updateCamera(state, 1);
}

/** Turn a step's event flags into sound. */
function playEvents(audio, events, state) {
  if (events.horn) audio.horn();
  if (events.siren) audio.siren();
  if (events.shot) audio.shot();
  if (events.punchHit) audio.punch();
  if (events.crash) audio.crash();
  if (events.cash) audio.cash();
  if (events.door) audio.door();
  if (state.player.inCar) audio.setEngine(state.player.car.speed / CAR.maxSpeed, true);
  else audio.setEngine(0, false);
}

const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const state = createGame(seed);
  const scene = stageShot(name, state);
  const steps = Math.round(scene.seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const ctl = scene.drive ? scene.drive(state, i * STEP) : idleControl();
    stepWorld(state, ctl, STEP, {});
  }
  updateCamera(state, 1);
  let painted = 0;
  function paint() {
    renderer.draw(state, view);
    if (scene.screen === SCREEN_PLAY) drawHud(canvas.getContext('2d'), state, view);
    else drawScreen(canvas.getContext('2d'), state, view, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const state = createGame(seed);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(msg) { status.textContent = msg; }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    const actions = input.takeActions();
    let clicked = input.takeClick();
    if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM || clicked)) {
      audio.unlock();
      audio.startMusic();
      screen = SCREEN_PLAY;
      clicked = false; // The starting click must not also fire the pistol.
      announce('Playing Sundara Heat.');
    } else if ((screen === SCREEN_BUSTED || screen === SCREEN_WASTED) && (actions & ACTION_CONFIRM)) {
      applyPenalty(state);
      screen = SCREEN_PLAY;
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; audio.setEngine(0, false); }
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }

    if (screen === SCREEN_PLAY) {
      const ctl = {
        move: input.moveVector(),
        held: input.held,
        actions,
        clicked,
        mouseWorld: {
          x: state.cam.x + input.mouse.x,
          y: state.cam.y + input.mouse.y,
        },
      };
      let first = true;
      while (accumulator >= STEP) {
        const events = {};
        stepWorld(state, first ? ctl : { ...ctl, actions: 0, clicked: false }, STEP, events);
        playEvents(audio, events, state);
        first = false;
        accumulator -= STEP;
        if (state.over) {
          screen = state.over === 'busted' ? SCREEN_BUSTED : SCREEN_WASTED;
          audio.setEngine(0, false);
          announce(screen === SCREEN_BUSTED ? 'Busted.' : 'Wasted.');
          break;
        }
      }
    } else {
      accumulator = 0;
      // The title screen keeps the city alive behind it.
      if (screen === SCREEN_TITLE) {
        const events = {};
        stepWorld(state, idleControl(), STEP, events);
      }
    }

    renderer.draw(state, view);
    const ctx = canvas.getContext('2d');
    if (screen === SCREEN_PLAY) drawHud(ctx, state, view);
    else drawScreen(ctx, state, view, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });
  announce('Sundara Heat. Click or press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
