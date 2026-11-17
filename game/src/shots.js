// shots.js — penata adegan screenshot (?shot=cover|chase|mission|beach&seed=1).
// Menata keadaan representatif lalu main.js menaikkan __shotReady setelah
// simulasi berjalan sebentar, supaya frame yang tertangkap hidup.

import { makeCar } from './cars.js';

export function setupShot(state, name) {
  const pl = state.world.places;
  state.shotName = name;
  switch (name) {
    case 'cover': {
      state.mode = 'title';
      state.shotCam = { x: 1740, y: 1260 };
      state.shotDelay = 1.0;
      break;
    }
    case 'chase': {
      state.mode = 'play';
      const gt = state.allCars.find(c => c.isMissionCar);
      gt.x = 2700; gt.y = 1560; gt.angle = -Math.PI / 2; gt.speed = 150; gt.parked = false;
      state.player.car = gt;
      state.player.x = gt.x; state.player.y = gt.y;
      state.career.money = 120;
      state.missions.stage = 1;
      state.wanted.heat = 300;
      state.wanted.sinceCrime = 0;
      state.addDialogue('Bu Ratna', 'Riko, antar paket ini ke Bengkel Dedi sebelum geng Arus Liar mencegatmu. Upahnya kontan.');
      for (const dy of [150, 300]) {
        const cop = makeCar('police', 2700 + (dy === 150 ? -14 : 10), 1560 + dy, -Math.PI / 2);
        cop.speed = 165;
        cop.target = { x: 2700, y: 300 };
        state.police.push(cop);
        state.allCars.push(cop);
      }
      state.shotDelay = 0.85;
      break;
    }
    case 'mission': {
      state.mode = 'play';
      state.player.x = pl.warung.x + 6;
      state.player.y = pl.warung.y + 14;
      state.player.angle = -Math.PI / 2;
      // Dua pejalan kaki dipindah dekat warung supaya frame ramai.
      const near = state.peds.slice(0, 2);
      if (near[0]) { near[0].beach = false; near[0].x = pl.warung.x - 60; near[0].y = pl.warung.y + 30; near[0].state = 'walk'; }
      if (near[1]) { near[1].beach = false; near[1].x = pl.warung.x + 74; near[1].y = pl.warung.y + 8; near[1].state = 'walk'; }
      state.shotDelay = 0.6;
      break;
    }
    case 'beach': {
      state.mode = 'play';
      state.missions.stage = 6;
      state.dialogues.length = 0;
      state.player.x = 3172;
      state.player.y = 1246;
      state.player.angle = Math.PI / 3;
      state.shotDelay = 0.6;
      break;
    }
    default: {
      state.mode = 'title';
      state.shotDelay = 0.5;
    }
  }
  state.shotStart = state.time;
}
