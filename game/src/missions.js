// The story of Sundara Heat, as a chain of missions plus endless side jobs.
// Riko, a broke courier, owes money to the Arus Liar crew. Bu Ratna's warung,
// Dedi's workshop and the lookout tower carry the three story beats: deliver,
// steal, run. Each mission is a list of stages with a marker, an objective
// line and a check; finishing pays cash and advances the saved career.

import { distance } from './world.js';
import { clearHeat } from './police.js';

export const MARKER_REACH = 56;

/** One story stage: go somewhere, or do something, then the next stage. */
function stage(objective, x, y, check, onArrive) {
  return { objective, x, y, check: check || 'arrive', onArrive: onArrive || null };
}

/**
 * Build the story chain against the city's named places.
 * Returns an array of missions: {id, title, intro, reward, stages}.
 */
export function buildStory(city) {
  const warung = city.places['Warung Bu Ratna'];
  const bengkel = city.places['Bengkel Dedi'];
  const menara = city.places['Menara Pandang'];
  const kontrakan = city.places['Kontrakan Riko'];
  return [
    {
      id: 'paket-bu-ratna',
      title: 'Paket untuk Bu Ratna',
      intro: 'Bu Ratna: "Riko, antar paket ini ke Bengkel Dedi sebelum geng Arus Liar mencegatmu. Upahnya kontan."',
      reward: 150,
      stages: [
        stage('Ambil paket di Warung Bu Ratna', warung.x, warung.y),
        stage('Antar paket ke Bengkel Dedi', bengkel.x, bengkel.y),
      ],
    },
    {
      id: 'melati-emas',
      title: 'Melati Emas',
      intro: 'Dedi: "Melati GT emas di Menara Pandang itu milik bos Arus Liar. Curi, bawa ke bengkelku, utangmu lunas sebagian."',
      reward: 300,
      stages: [
        stage('Pergi ke Menara Pandang', menara.x, menara.y),
        stage('Curi Melati GT emas (dekati mobil, tekan E)', menara.x + 60, menara.y + 30, 'steal-gold'),
        stage('Bawa Melati GT ke Bengkel Dedi', bengkel.x, bengkel.y, 'deliver-gold'),
      ],
    },
    {
      id: 'kabur-terakhir',
      title: 'Kabur Terakhir',
      intro: 'Riko: "Arus Liar tahu semuanya. Polisi juga. Aku harus sampai kontrakan dan hilang dari pandangan mereka."',
      reward: 500,
      stages: [
        stage('Picu perhatian polisi (buat kejahatan sampai 2 bintang)', kontrakan.x, kontrakan.y, 'raise-heat'),
        stage('Kabur ke Kontrakan Riko', kontrakan.x, kontrakan.y, 'arrive-with-heat'),
        stage('Bersembunyi sampai wanted hilang', kontrakan.x, kontrakan.y, 'lose-heat'),
      ],
    },
  ];
}

/** A repeatable side delivery between two named places, for steady cash. */
export function buildSideJob(city, random, index) {
  const names = Object.keys(city.places);
  const from = city.places[names[index % names.length]];
  const to = city.places[names[(index + 2) % names.length]];
  const reward = 60 + random.int(0, 5) * 15;
  return {
    id: `antar-${index}`,
    title: 'Antar Kilat',
    intro: `Warga: "Tolong antar ini dari ${from.name} ke ${to.name}. Bayaran $${reward}."`,
    reward,
    side: true,
    stages: [
      stage(`Ambil paket di ${from.name}`, from.x, from.y),
      stage(`Antar ke ${to.name}`, to.x, to.y),
    ],
  };
}

/**
 * Create the mission tracker: current mission, stage, banner text and the
 * completion events the main loop turns into cash and story progress.
 */
export function createMissions(city, save) {
  const story = buildStory(city);
  return {
    story,
    current: null,
    stageIndex: 0,
    banner: '',
    bannerTime: 0,
    startMission(mission) {
      this.current = mission;
      this.stageIndex = 0;
      this.banner = mission.intro;
      this.bannerTime = 7;
    },
    /** The active stage, or null when no mission is running. */
    stage() {
      if (!this.current) return null;
      return this.current.stages[this.stageIndex] || null;
    },
    /** Objective line for the HUD. */
    objective() {
      const s = this.stage();
      if (!s) return this.banner && this.bannerTime > 0 ? '' : 'Jelajahi Sundara Bay — misi baru akan datang.';
      return `${this.current.title}: ${s.objective}`;
    },
  };
}

/**
 * Check the active stage against the world. ctx carries the facts the checks
 * need: {player, inCar, carIsGold, police}. Returns 'stage' when a stage
 * completed, 'mission' when the whole mission did, else null.
 */
export function updateMissions(missions, ctx, dt) {
  if (missions.bannerTime > 0) missions.bannerTime = Math.max(0, missions.bannerTime - dt);
  const s = missions.stage();
  if (!s) return null;
  const near = distance(ctx.player.x, ctx.player.y, s.x, s.y) < MARKER_REACH;
  let done = false;
  if (s.check === 'arrive') done = near;
  else if (s.check === 'steal-gold') done = ctx.inCar && ctx.carIsGold;
  else if (s.check === 'deliver-gold') done = near && ctx.inCar && ctx.carIsGold;
  else if (s.check === 'raise-heat') done = ctx.police.stars >= 2;
  else if (s.check === 'arrive-with-heat') done = near;
  else if (s.check === 'lose-heat') done = ctx.police.stars <= 0;
  if (!done) return null;
  if (s.onArrive) s.onArrive(ctx);
  missions.stageIndex += 1;
  if (missions.stageIndex >= missions.current.stages.length) {
    const finished = missions.current;
    missions.current = null;
    missions.stageIndex = 0;
    missions.banner = `Misi selesai: ${finished.title} (+$${finished.reward})`;
    missions.bannerTime = 6;
    return finished;
  }
  return 'stage';
}

/** When the escape mission ends, make sure the heat really is gone. */
export function settleEscape(police) {
  clearHeat(police);
}
