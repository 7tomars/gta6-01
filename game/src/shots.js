// The screenshot scenes behind ?shot=cover|chase|mission|beach. Each scene
// poses the real game state — player, cars, police, wanted level, mission —
// then plays the real rules forward under a small scripted driver, so the
// frame is a moment the game itself can produce and the same seed always
// gives the same frame. The cover sells the chase; the others show the
// mission on foot, and the beach the city lives beside.

import { ROADS } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

/** An idle control block: nobody presses anything. */
export function idleControl() {
  return {
    move: { x: 0, y: 0 },
    held: { up: false, down: false, left: false, right: false, run: false },
    actions: 0,
    clicked: false,
    mouseWorld: { x: 0, y: 0 },
  };
}

/** Find the story target car (the golden Melati GT) in a car list. */
function goldCar(state) {
  return state.cars.find((c) => c.storyTarget);
}

/** Teleport the player into a car as its driver. */
function putPlayerInCar(state, car) {
  car.kind = 'player';
  car.speed = 0;
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
}

/**
 * Pose the named scene on a fresh game state.
 * Returns { screen, seconds, drive(state, t) } — drive returns the control
 * block for the step at time t, or null to idle.
 */
export function stageShot(name, state) {
  const { player, police, missions } = state;
  if (name === 'chase') {
    // Cover: flat out along the coast road in the golden GT, police behind,
    // three stars, a delivery marker ahead on the HUD's minimap.
    const gt = goldCar(state);
    gt.x = ROADS.vertical[5];
    gt.y = 1150;
    gt.angle = -Math.PI / 2;
    gt.speed = 300;
    putPlayerInCar(state, gt);
    missions.startMission(missions.story[0]);
    missions.stageIndex = 1;
    police.points = 3;
    police.stars = 3;
    return {
      screen: SCREEN_PLAY,
      seconds: 2.2,
      drive() {
        const ctl = idleControl();
        ctl.held.up = true;
        return ctl;
      },
    };
  }
  if (name === 'mission') {
    // On foot, a few steps from Bu Ratna's warung, package marker glowing,
    // townsfolk on the sidewalk and traffic rolling past.
    const warung = state.city.places['Warung Bu Ratna'];
    player.x = warung.x - 90;
    player.y = warung.y + 46;
    player.angle = 0.4;
    missions.startMission(missions.story[0]);
    return {
      screen: SCREEN_PLAY,
      seconds: 1.6,
      drive() {
        const ctl = idleControl();
        ctl.move = { x: 0.8, y: 0.2 };
        return ctl;
      },
    };
  }
  if (name === 'beach') {
    // Golden hour on the sand: Riko beside his parked pickup, sea behind,
    // the city skyline across the frame, no heat at all.
    player.x = 3030;
    player.y = 700;
    player.angle = Math.PI / 2.4;
    const car = state.cars.find((c) => !c.storyTarget && c.kind === 'parked') || state.cars[0];
    car.x = 2985;
    car.y = 760;
    car.angle = 0.5;
    return { screen: SCREEN_PLAY, seconds: 1.2, drive: null };
  }
  // 'cover' and anything else: the title over the living city, Riko outside
  // his rented room with the first mission waiting.
  const home = state.city.safehouse;
  player.x = home.x;
  player.y = home.y + 10;
  missions.startMission(missions.story[0]);
  return { screen: SCREEN_TITLE, seconds: 1.5, drive: null };
}
