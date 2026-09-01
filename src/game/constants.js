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
  laneSwitchDuration: 0.2,
  jumpDuration: 0.45,
  jumpHeight: 2.4,
  slideDuration: 0.5,
  slideHeight: 0.55,
  invulnAfterHit: 0,
  radius: 0.55,
  height: 1.8,
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
  collectibleChance: 0.72,
  collectibleCluster: 4,
  collectibleStartZ: 12,
  telegraphLead: 2.2,
  telegraphDistance: 48,
};

export const SCORE = {
  perMeter: 1.2,
  canBase: 50,
  comboMultStep: 0.15,
  comboMax: 8,
  comboDecay: 2.5,
};

export const CAMERA = {
  offset: { x: 0, y: 5.2, z: -9.5 },
  lookAhead: 14,
  lag: 0.12,
  fovBase: 55,
  fovPunch: 8,
  landShake: 0.18,
};

export const RENDER = {
  maxPixelRatio: 2,
  shadowMapSize: 2048,
};
