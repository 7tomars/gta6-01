// config.js — semua angka tuning, palet warna, dan katalog kendaraan Sundara Heat.
// Satu-satunya file yang tahu ukuran dunia; modul lain membaca dari sini.

export const WORLD_W = 3600;
export const WORLD_H = 2640;

// Jalan: pusat lajur vertikal & horizontal, lebar total jalan (termasuk bahu).
export const ROAD_W = 108;
export const ROADS_V = [300, 780, 1260, 1740, 2220, 2700];
export const ROADS_H = [300, 780, 1260, 1740, 2220];

// Pantai di timur: pasir mulai BEACH_X, air mulai SEA_X.
export const BEACH_X = 3060;
export const SEA_X = 3300;
export const SEA_EDGE = 3312; // garis keras: tidak ada yang boleh masuk air

export const PLAYER = {
  radius: 14,
  walkSpeed: 168,
  runSpeed: 272,
  maxHealth: 100,
  regenDelay: 6,      // detik tanpa kena damage sebelum regen
  regenRate: 7,       // hp per detik saat regen
  meleeRange: 48,
  meleeDamage: 34,
  meleeCooldown: 0.34,
  gunDamage: 50,
  gunRange: 660,
  gunCooldown: 0.21,
};

export const WANTED = {
  maxHeat: 500,
  perStar: 100,
  decayDelay: 5,      // detik sejak terakhir terlihat polisi / berbuat kriminal
  decayRate: 13,      // heat hilang per detik sesudah delay
  seenRange: 370,     // jarak polisi yang membuat pemain "terlihat"
  witnessRange: 265,  // radius saksi mata untuk kejahatan biasa
  gunshotRange: 400,  // tembakan terdengar lebih jauh
};

// Palet sun-soaked: hangat, berpasir, teal laut.
export const PALETTE = {
  grass: '#79a84f',
  grassDark: '#6b9a44',
  sidewalk: '#cfc4a8',
  sidewalkLine: '#b7ab8d',
  asphalt: '#4a4a52',
  asphaltEdge: '#f2ead2',
  laneDash: '#e8c95a',
  sand: '#ecd28f',
  sandDark: '#dec078',
  seaShallow: '#3fb3ac',
  seaDeep: '#1d7f8c',
  foam: '#f7f3df',
  parkPath: '#d9c491',
  lotAsphalt: '#5b5b63',
  lotLine: '#d8d2bd',
};

export const BUILDING_COLORS = [
  '#e8b04b', '#df8f5a', '#e5d3a1', '#c96f4a', '#a8c686',
  '#e07a5f', '#f2cc8f', '#81b29a', '#d9a05b', '#bc6c25',
];
export const ROOF_COLORS = ['#9c6644', '#7f5539', '#b08968', '#6f4e37', '#8d6e63'];
export const AWNING_COLORS = ['#c0392b', '#117a65', '#b9770e', '#6c3483', '#1a5276'];

// Katalog kendaraan orisinal. speed = px/detik maksimum, accel = px/detik^2.
export const CAR_MODELS = {
  sedan:  { name: 'Cempaka Sedan',  speed: 262, accel: 235, color: '#7fb3d5', r: 21 },
  hatch:  { name: 'Kutilang',       speed: 238, accel: 225, color: '#a9dfbf', r: 19 },
  pickup: { name: 'Banteng Pickup', speed: 228, accel: 205, color: '#d5dbdb', r: 22 },
  van:    { name: 'Angkot Laras',   speed: 205, accel: 185, color: '#f5b041', r: 23 },
  taxi:   { name: 'Taksi Pelita',   speed: 252, accel: 230, color: '#f4d03f', r: 21 },
  gt:     { name: 'Melati GT',      speed: 348, accel: 305, color: '#d4af37', r: 21 },
  police: { name: 'Patroli Kota',   speed: 322, accel: 285, color: '#eef2f3', r: 21 },
};

export const TRAFFIC_MIX = ['sedan', 'sedan', 'hatch', 'hatch', 'pickup', 'van', 'taxi'];
export const PARKED_MIX = ['sedan', 'hatch', 'pickup', 'sedan', 'van', 'hatch'];

export const PLACE_KEYS = ['warung', 'bengkel', 'carpark', 'hideout', 'home', 'hospital'];
