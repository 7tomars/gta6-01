// The wanted system and the Sundara Bay police: crime points raise stars,
// stars bring patrol cars, patrol cars chase and ram, and standing too close
// to an officer on foot fills the bust meter. Stay unseen and the heat fades.

import { CAR, CAR_MODELS, WANTED } from './config.js';
import { makeCar } from './cars.js';
import { angleLerp, resolveCircle } from './world.js';

const POLICE_MODEL = { name: 'Patroli Bayu', speed: 1.06, colors: ['#2b50c8'] };

/** Create the wanted/police state block. */
export function createPoliceState() {
  return {
    points: 0, stars: 0, unseenTime: 0, bustMeter: 0,
    cars: [], sirenCd: 0, seenNow: false,
  };
}

/** Stars for a points total: one star per point, capped. */
export function starsFor(points) {
  return Math.max(0, Math.min(WANTED.maxStars, Math.floor(points)));
}

/**
 * Report a crime. `severity` is in points (a star each). Witnesses decide how
 * much lands: full when a police car is close, half when only citizens see,
 * a whisper when nobody is watching. Returns the points actually added.
 */
export function commitCrime(state, severity, witnessed) {
  const factor = witnessed === 'police' ? 1 : witnessed === 'ped' ? 0.6 : 0.25;
  state.points += severity * factor;
  state.stars = starsFor(state.points);
  if (factor >= 0.6) state.unseenTime = 0;
  return severity * factor;
}

/** How many patrol cars a star level keeps on the street. */
function desiredCars(stars) {
  return stars <= 0 ? 0 : Math.min(4, stars + 1);
}

/** Spawn or retire patrol cars to match the wanted level, off-screen if possible. */
export function syncPolice(state, player, random) {
  const want = desiredCars(state.stars);
  while (state.cars.length < want) {
    const a = random.range(0, Math.PI * 2);
    const dist = random.range(520, 720);
    const car = makeCar(
      Math.max(60, Math.min(2900, player.x + Math.cos(a) * dist)),
      Math.max(60, Math.min(2340, player.y + Math.sin(a) * dist)),
      0, POLICE_MODEL, '#2b50c8', 'police',
    );
    car.cruise = 300;
    state.cars.push(car);
  }
  while (state.cars.length > want) state.cars.pop();
}

/**
 * Advance the whole police picture one step: visibility, decay, chases and
 * the bust meter. Sets state.seenNow and returns events {siren, ram}.
 */
export function updatePolice(state, player, inCar, city, dt, events) {
  // Visibility: any patrol car with line-of-sight range on the player.
  let seen = false;
  for (const cop of state.cars) {
    if (Math.hypot(cop.x - player.x, cop.y - player.y) < 330) { seen = true; break; }
  }
  state.seenNow = seen;
  if (seen) state.unseenTime = 0;
  else {
    state.unseenTime += dt;
    if (state.unseenTime > WANTED.decayDelay && state.points > 0) {
      state.points = Math.max(0, state.points - WANTED.decayRate * dt * 10);
      state.stars = starsFor(state.points);
    }
  }

  state.sirenCd = Math.max(0, state.sirenCd - dt);
  if (state.stars > 0 && state.cars.length > 0 && state.sirenCd <= 0) {
    events.siren = true;
    state.sirenCd = 3.4;
  }

  let busting = false;
  for (const cop of state.cars) {
    if (cop.dead) continue;
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    cop.angle = angleLerp(cop.angle, wantAngle, Math.min(1, dt * 2.2));
    const topSpeed = (240 + state.stars * 45) * (inCar ? 1.12 : 0.8);
    const target = dist > 46 ? topSpeed : 0;
    cop.speed += Math.sign(target - cop.speed) * Math.min(Math.abs(target - cop.speed), 300 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (resolveCircle(city, cop, CAR.radius)) cop.speed *= 0.4;
    // A close patrol car on a player on foot works the bust meter.
    if (!inCar && dist < 58) busting = true;
    // A ram at speed hurts.
    if (inCar && dist < 44 && Math.abs(cop.speed) > 160) events.ram = true;
  }

  if (busting) state.bustMeter += dt / WANTED.bustTime;
  else state.bustMeter = Math.max(0, state.bustMeter - dt * 0.7);
  return events;
}

/** Clear all heat at once (mission scripted, or after a bust/waste penalty). */
export function clearHeat(state) {
  state.points = 0;
  state.stars = 0;
  state.bustMeter = 0;
  state.cars.length = 0;
  state.unseenTime = 0;
}
