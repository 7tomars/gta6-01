// Sundara Heat — every tuning number, name and colour in one place.
// The game is an original open-world crime game set in the fictional coastal
// city of Sundara Bay. All names, people, vehicles and story are invented here.

export const GAME_TITLE = 'SUNDARA HEAT';
export const CITY_NAME = 'Sundara Bay';
export const HERO_NAME = 'Riko';

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

/** World size in pixels. Land ends at BEACH_X, then sand, then open water. */
export const WORLD = { width: 3440, height: 2400, beachX: 2920, waterX: 3140 };

/** Road grid: centres of the vertical and horizontal roads, and the road width. */
export const ROADS = {
  width: 150,
  vertical: [140, 660, 1180, 1700, 2220, 2740],
  horizontal: [140, 660, 1180, 1700, 2220],
};

/** Sun-soaked palette: coral roofs, cream walls, turquoise water, hot asphalt. */
export const PALETTE = {
  grass: '#7ec850',
  grassDark: '#6db843',
  sand: '#f2dda0',
  water: '#1fb6c9',
  waterDeep: '#1299ad',
  road: '#4a4a52',
  roadEdge: '#e8e3d5',
  lane: '#f7d154',
  sidewalk: '#d9d2c0',
  park: '#8fd45e',
  player: '#ffcf3f',
  police: '#2b50c8',
  panel: 'rgba(16,20,28,0.72)',
  text: '#ffffff',
  gold: '#ffd94d',
  danger: '#ff5252',
};

/** Building wall/roof colour pairs, picked per block so districts feel different. */
export const BUILDING_STYLES = [
  { wall: '#f6e3c5', roof: '#e2725b' },
  { wall: '#f9f1dc', roof: '#d95f43' },
  { wall: '#ffe9a8', roof: '#c94f6d' },
  { wall: '#d9f0e3', roof: '#3f9d8f' },
  { wall: '#fdebd0', roof: '#e8912d' },
  { wall: '#e8e0f5', roof: '#7a6fc9' },
];

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  runSpeed: 320,
  maxHealth: 100,
  punchRange: 42,
  punchDamage: 1,
  shotDamage: 2,
};

export const CAR = {
  radius: 21,
  maxSpeed: 430,
  maxReverse: 130,
  accel: 340,
  brake: 620,
  drag: 0.9,
  turnRate: 2.4,
};

/** Wanted tuning: crime points needed per star, and how fast heat fades unseen. */
export const WANTED = {
  maxStars: 5,
  decayDelay: 5,
  decayRate: 0.045,
  bustTime: 1.6,
};

/** Original vehicle models of Sundara Bay, with a top speed factor and colours. */
export const CAR_MODELS = [
  { name: 'Kencana LX', speed: 1.0, colors: ['#e74c3c', '#ecf0f1', '#3498db', '#f39c12'] },
  { name: 'Taksi Arunika', speed: 0.92, colors: ['#ffd21f'] },
  { name: 'Bakso Van', speed: 0.78, colors: ['#fdfefe', '#aed6f1'] },
  { name: 'Pesisir Pickup', speed: 0.95, colors: ['#27ae60', '#7dcea0', '#5d6d7e'] },
  { name: 'Melati GT', speed: 1.18, colors: ['#8e44ad', '#151515', '#c0392b'] },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** localStorage key for the saved career (money, story progress). */
export const SAVE_KEY = 'sundara-heat.save.v1';
