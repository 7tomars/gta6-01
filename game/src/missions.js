// missions.js — rantai cerita Riko (3 misi) + pekerjaan antar berulang.
// Tahap cerita disimpan di karier (save). Dialog masuk antrean state.

import { PLACE_KEYS } from './config.js';

const STORY_TEXT = [
  'Ambil paket di Warung Bu Ratna',
  'Antar paket ke Bengkel Dedi',
  'Curi Melati GT emas di Parkir Timur',
  'Bawa Melati GT ke Gudang Arus Liar',
  'Hilangkan semua bintang wanted',
  'Pulang ke Kos Riko',
  'Cerita tuntas — kerja antar tersedia di Bengkel Dedi',
];

export class Missions {
  constructor(state) {
    this.stage = state.career.storyStage || 0;
    this.side = null; // { phase, fromKey, toKey, reward }
    this.introShown = false;
  }

  storyObjective(state) {
    const pl = state.world.places;
    switch (this.stage) {
      case 0: return { x: pl.warung.x, y: pl.warung.y, text: STORY_TEXT[0] };
      case 1: return { x: pl.bengkel.x, y: pl.bengkel.y, text: STORY_TEXT[1] };
      case 2: return { x: pl.carpark.x, y: pl.carpark.y, text: STORY_TEXT[2] };
      case 3: return { x: pl.hideout.x, y: pl.hideout.y, text: STORY_TEXT[3] };
      case 4: return { x: state.player.x, y: state.player.y, text: STORY_TEXT[4], noMarker: true };
      case 5: return { x: pl.home.x, y: pl.home.y, text: STORY_TEXT[5] };
      default: return { x: pl.bengkel.x, y: pl.bengkel.y, text: STORY_TEXT[6] };
    }
  }

  sideObjective(state) {
    if (!this.side) return null;
    const pl = state.world.places;
    const key = this.side.phase === 'pickup' ? this.side.fromKey : this.side.toKey;
    const spot = pl[key];
    return {
      x: spot.x, y: spot.y,
      text: (this.side.phase === 'pickup' ? 'Jemput paket di ' : 'Antar paket ke ') + spot.label,
    };
  }

  setStage(state, n) {
    this.stage = n;
    state.career.storyStage = n;
    state.persist();
  }

  update(state) {
    const p = state.player;
    const pl = state.world.places;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const near = (spot, r) => Math.hypot(px - spot.x, py - spot.y) < r;

    if (!this.introShown) {
      this.introShown = true;
      if (this.stage === 0) {
        state.addDialogue('Bu Ratna', 'Riko! Ada paket untuk Bengkel Dedi. Antar baik-baik — utangmu ke Arus Liar tidak bisa menunggu.');
      }
    }

    switch (this.stage) {
      case 0:
        if (!p.car && near(pl.warung, 48)) {
          state.addDialogue('Bu Ratna', 'Ini paketnya. Hati-hati di jalan timur, anak buah Arus Liar berkeliaran.');
          state.audio.tick();
          this.setStage(state, 1);
        }
        break;
      case 1:
        if (near(pl.bengkel, 56)) {
          state.addMoney(150);
          state.addDialogue('Dedi', 'Paket utuh, bagus. Dengar — Melati GT emas milik bos Arus Liar parkir di Parkir Timur. Ambil, dan utangmu lunas separuh.');
          this.setStage(state, 2);
        }
        break;
      case 2:
        if (p.car && p.car.isMissionCar) {
          state.wanted.heat = Math.max(state.wanted.heat, 300);
          state.wanted.sinceCrime = 0;
          state.audio.alarm();
          state.addDialogue('Riko', 'Alarmnya bunyi! Gas ke Gudang Arus Liar, jangan sampai tertangkap!');
          this.setStage(state, 3);
        }
        break;
      case 3:
        if (p.car && p.car.isMissionCar && near(pl.hideout, 70)) {
          state.addMoney(300);
          state.addDialogue('Kak Rudi', 'Berani juga kau, Riko. Satu urusan terakhir: hilang dari radar polisi, lalu pulang. Selesai itu, kita impas.');
          this.setStage(state, 4);
        }
        break;
      case 4:
        if (state.wanted.stars === 0) {
          state.addDialogue('Riko', 'Bersih. Saatnya pulang dan tidur tenang.');
          this.setStage(state, 5);
        }
        break;
      case 5:
        if (near(pl.home, 52)) {
          state.addMoney(500);
          state.addDialogue('Riko', 'Lunas. Sundara Bay, kita belum selesai — tapi hari ini aku menang.');
          this.setStage(state, 6);
        }
        break;
    }

    this.updateSide(state, px, py);
  }

  updateSide(state, px, py) {
    const pl = state.world.places;
    // Tawaran kerja muncul otomatis saat dekat bengkel dan cerita sudah jalan.
    if (!this.side && this.stage >= 2) {
      if (Math.hypot(px - pl.bengkel.x, py - pl.bengkel.y) < 72) {
        const keys = PLACE_KEYS.filter(k => k !== 'bengkel');
        const fromKey = keys[state.rng.int(0, keys.length - 1)];
        let toKey = keys[state.rng.int(0, keys.length - 1)];
        if (toKey === fromKey) toKey = keys[(keys.indexOf(fromKey) + 2) % keys.length];
        const a = pl[fromKey], b = pl[toKey];
        const reward = Math.round(50 + Math.hypot(a.x - b.x, a.y - b.y) / 14);
        this.side = { phase: 'pickup', fromKey, toKey, reward };
        state.addDialogue('Dedi', 'Ada kerja antar: jemput di ' + a.label + ', kirim ke ' + b.label + '. Upah $' + reward + '.');
      }
    }
    if (!this.side) return;
    const key = this.side.phase === 'pickup' ? this.side.fromKey : this.side.toKey;
    const spot = pl[key];
    if (Math.hypot(px - spot.x, py - spot.y) < 54) {
      if (this.side.phase === 'pickup') {
        this.side.phase = 'dropoff';
        state.audio.tick();
        state.addDialogue('Kurir', 'Paket di tangan. Antar ke ' + pl[this.side.toKey].label + '.');
      } else {
        state.addMoney(this.side.reward);
        state.career.jobsDone++;
        state.persist();
        state.addDialogue('Pelanggan', 'Tepat waktu. Terima kasih!');
        this.side = null;
      }
    }
  }
}
