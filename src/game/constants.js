/** Pepsiman Runner — shared tunables */
export const LANES = [-2.2, 0, 2.2];
export const LANE_COUNT = 3;

export const COLORS = {
  pepsiBlue: 0x0055bf,
  pepsiRed: 0xe32934,
  pepsiWhite: 0xffffff,
  pepsiDark: 0x003a80,
  asphalt: 0x1a1a22,
  asphaltLine: 0xffcc33,
  neonCyan: 0x00e5ff,
  neonMagenta: 0xff2d95,
  neonYellow: 0xffe566,
  buildingA: 0x1e2840,
  buildingB: 0x2a1a35,
  buildingC: 0x162030,
  fog: 0x0a0e1a,
  sky: 0x050810,
  canBody: 0xe32934,
  canTop: 0xc0c0c0,
  telegraph: 0xff4466,
  truckCab: 0x2255aa,
  truckTrailer: 0xe32934,
  barrier: 0xffaa00,
  rail: 0x8899aa,
  sign: 0xe32934,
};

export const PLAYER = {
  runSpeedBase: 18,
  runSpeedMax: 42,
  accelPerSec: 0.35,
  /** Lane switch: 0.18–0.22s with overshoot settle */
  laneSwitchDuration: 0.2,
  laneOvershoot: 0.14,
  laneLeanMax: 0.42,
  laneLeanDamp: 10,
  /** Jump: ~0.45s sin arc apex */
  jumpDuration: 0.45,
  jumpHeight: 2.4,
  /** Coyote-ish forgiveness after leaving ground */
  coyoteTime: 0.1,
  /** Slide: ~0.5s flat squash */
  slideDuration: 0.5,
  slideHeight: 0.55,
  invulnAfterHit: 0,
  radius: 0.55,
  height: 1.8,
};

export const INPUT = {
  /** Buffer one queued lane change during active switch */
  laneBufferMax: 1,
  /** Touch swipe minimum distance (px) */
  swipeMin: 24,
  /** Touch swipe max time (ms) before ignored */
  swipeMaxMs: 280,
};

export const WORLD = {
  segmentLength: 40,
  segmentsAhead: 8,
  segmentsBehind: 2,
  buildingRows: 2,
  fogNear: 25,
  fogFar: 120,
  roadWidth: 8.5,
};

export const SPAWN = {
  obstacleMinGap: 18,
  obstacleMaxGap: 32,
  collectibleChance: 0.55,
  collectibleCluster: 3,
  telegraphLead: 1.2,
};

export const SCORE = {
  perMeter: 1.2,
  canBase: 50,
  comboMultStep: 0.15,
  comboMax: 8,
  comboDecay: 2.5,
};

export const CAMERA = {
  offset: { x: 0, y: 5.4, z: -9.8 },
  lookAhead: 14,
  lookAheadSpeedBoost: 6,
  /** Exponential lag — lower = snappier, higher = floatier */
  lag: 0.1,
  lagY: 0.14,
  fovBase: 55,
  fovSpeedBoost: 7,
  fovPunch: 8,
  fovPunchDecay: 16,
  landShake: 0.16,
  landShakeDuration: 0.24,
};

export const RENDER = {
  maxPixelRatio: 2,
  shadowMapSize: 2048,
};
