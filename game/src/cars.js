// Cars: the shared vehicle record, parked cars, traffic that drives the road
// grid on its own, and the player's driving physics when behind the wheel.

import { CAR, CAR_MODELS, ROADS } from './config.js';
import { isOnRoad, resolveCircle } from './world.js';

let nextCarId = 1;

/** Create one car record. kind is 'parked', 'traffic', 'police' or 'player'. */
export function makeCar(x, y, angle, model, color, kind) {
  return {
    id: nextCarId++, x, y, angle, speed: 0,
    model, color, kind, health: 6,
    axis: 'v', dir: 1, lane: 0, cruise: 150, turnCd: 0, hornCd: 0, dead: false,
  };
}

/** The lane offset (right-hand traffic) for a car on `axis` moving with `dir`. */
function laneOffset(axis, dir) {
  // Screen y points down: heading south (+y) the right side is west (-x).
  if (axis === 'v') return dir > 0 ? -38 : 38;
  return dir > 0 ? 38 : -38;
}

/** Put a traffic car on a random road, in its lane, heading along it. */
function placeOnRoad(car, random) {
  car.axis = random.chance(0.5) ? 'v' : 'h';
  car.dir = random.chance(0.5) ? 1 : -1;
  const off = laneOffset(car.axis, car.dir);
  if (car.axis === 'v') {
    const cx = random.pick(ROADS.vertical);
    car.lane = cx + off;
    car.x = car.lane;
    car.y = random.range(80, 2300);
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const cy = random.pick(ROADS.horizontal);
    car.lane = cy + off;
    car.y = car.lane;
    car.x = random.range(80, 2800);
    car.angle = car.dir > 0 ? 0 : Math.PI;
  }
  car.cruise = random.range(130, 205) * car.model.speed;
}

/** Spawn the ambient traffic fleet. */
export function spawnTraffic(random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const model = random.pick(CAR_MODELS);
    const car = makeCar(0, 0, 0, model, random.pick(model.colors), 'traffic');
    placeOnRoad(car, random);
    cars.push(car);
  }
  return cars;
}

/** Spawn parked cars in the city's car parks and along a few kerbs. */
export function spawnParked(city, random) {
  const cars = [];
  for (const park of city.carParks) {
    for (const spot of park.spots) {
      if (!random.chance(0.45)) continue;
      const model = random.pick(CAR_MODELS);
      cars.push(makeCar(spot.x, spot.y, spot.angle + (random.chance(0.5) ? 0 : Math.PI), model, random.pick(model.colors), 'parked'));
    }
  }
  // Kerbside parking along the vertical roads, so every seed's city has cars
  // to steal even when few blocks rolled as car parks.
  for (const roadX of [660, 1180, 1700, 2220]) {
    for (let y = 320; y < 2250; y += 340) {
      if (!random.chance(0.55)) continue;
      const model = random.pick(CAR_MODELS);
      const side = random.chance(0.5) ? -1 : 1;
      cars.push(makeCar(roadX + side * (ROADS.width / 2 + 24), y + random.range(-30, 30), Math.PI / 2, model, random.pick(model.colors), 'parked'));
    }
  }
  // A golden Melati GT waits by the lookout tower: the story's target car.
  const tower = city.places['Menara Pandang'];
  const gt = makeCar(tower.x + 60, tower.y + 30, 0, CAR_MODELS[4], '#ffd21f', 'parked');
  gt.storyTarget = true;
  cars.push(gt);
  return cars;
}

/** Distance to the nearest car ahead in the same lane, or Infinity. */
function carAhead(car, all) {
  let best = Infinity;
  for (const other of all) {
    if (other === car || other.dead) continue;
    let along;
    let across;
    if (car.axis === 'v') { along = (other.y - car.y) * car.dir; across = Math.abs(other.x - car.x); }
    else { along = (other.x - car.x) * car.dir; across = Math.abs(other.y - car.y); }
    if (along > 0 && along < best && across < 30) best = along;
  }
  return best;
}

/**
 * Advance one traffic car: cruise its lane, brake for the car ahead, and
 * sometimes turn at an intersection onto the crossing road.
 */
export function updateTraffic(car, all, city, random, dt, events) {
  if (car.kind !== 'traffic' || car.dead) return;
  car.turnCd = Math.max(0, car.turnCd - dt);
  car.hornCd = Math.max(0, car.hornCd - dt);
  const ahead = carAhead(car, all);
  let target = car.cruise;
  if (ahead < 70) target = 0;
  else if (ahead < 130) target = car.cruise * 0.45;
  if (ahead < 55 && car.hornCd <= 0) { events.horn = true; car.hornCd = random.range(2, 5); }
  car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 260 * dt);

  if (car.axis === 'v') car.y += car.dir * car.speed * dt;
  else car.x += car.dir * car.speed * dt;

  // Intersection turn: when crossing a perpendicular road centre, maybe turn.
  const lines = car.axis === 'v' ? ROADS.horizontal : ROADS.vertical;
  const pos = car.axis === 'v' ? car.y : car.x;
  for (const line of lines) {
    if (Math.abs(pos - line) < Math.abs(car.speed * dt) + 2 && car.turnCd <= 0 && random.chance(0.4)) {
      const oldAxis = car.axis;
      car.axis = oldAxis === 'v' ? 'h' : 'v';
      car.dir = random.chance(0.5) ? 1 : -1;
      const off = laneOffset(car.axis, car.dir);
      if (car.axis === 'v') { car.lane = line + off; car.x = car.lane; car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { car.lane = line + off; car.y = car.lane; car.angle = car.dir > 0 ? 0 : Math.PI; }
      car.turnCd = 1.2;
      break;
    }
  }
  if (car.axis === 'v') car.x += (car.lane - car.x) * Math.min(1, dt * 3);
  else car.y += (car.lane - car.y) * Math.min(1, dt * 3);

  // Keep traffic inside the drivable land; turn around at the edges.
  if (car.x < 60 || car.x > 2880 || car.y < 60 || car.y > 2340) {
    car.dir *= -1;
    const off = laneOffset(car.axis, car.dir);
    if (car.axis === 'v') { car.lane = Math.round((car.x - off) / 1) ; car.x = Math.max(60, Math.min(2880, car.x)); car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { car.y = Math.max(60, Math.min(2340, car.y)); car.angle = car.dir > 0 ? 0 : Math.PI; }
    car.x = Math.max(60, Math.min(2880, car.x));
    car.y = Math.max(60, Math.min(2340, car.y));
  }
  resolveCircle(city, car, CAR.radius);
}

/**
 * Drive the player's car from input: throttle/brake/reverse, speed-sensitive
 * steering, simple building collision that costs speed and health.
 * Returns the impact speed when a crash happened this step, else 0.
 */
export function updatePlayerCar(car, held, city, dt) {
  const maxF = CAR.maxSpeed * car.model.speed;
  if (held.up) car.speed += CAR.accel * dt;
  else if (held.down) {
    if (car.speed > 10) car.speed -= CAR.brake * dt;
    else car.speed = Math.max(-CAR.maxReverse, car.speed - CAR.accel * 0.6 * dt);
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(maxF, car.speed));
  const steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (steer !== 0 && car.speed !== 0) {
    const grip = Math.min(1, Math.abs(car.speed) / 120);
    car.angle += steer * CAR.turnRate * grip * dt * Math.sign(car.speed);
  }
  const before = { x: car.x, y: car.y };
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  let impact = 0;
  if (resolveCircle(city, car, CAR.radius)) {
    const moved = Math.hypot(car.x - before.x, car.y - before.y);
    const wanted = Math.abs(car.speed) * dt;
    if (wanted - moved > 2 && Math.abs(car.speed) > 120) impact = Math.abs(car.speed);
    car.speed *= 0.35;
  }
  return impact;
}

/** True when a point is close enough to a car to interact with it. */
export function nearCar(x, y, car, dist) {
  return Math.hypot(car.x - x, car.y - y) <= dist;
}

export function isOnRoadNow(car) {
  return isOnRoad(car.x, car.y);
}
