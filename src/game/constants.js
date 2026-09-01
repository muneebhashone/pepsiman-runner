/** Pepsiman Runner — shared tunables */
export const LANES = [-2.2, 0, 2.2];
export const LANE_COUNT = 3;

export const COLORS = {
  pepsiBlue: 0x0055bf,
  pepsiRed: 0xe32934,
  pepsiWhite: 0xffffff,
  pepsiSilver: 0xd8dde8,
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
  laneSwitchDuration: 0.18,
  laneOvershoot: 0.08,
  laneLeanMax: 0.42,
  laneLeanDamp: 12,
  jumpDuration: 0.45,
  jumpHeight: 2.4,
  coyoteTime: 0.1,
  slideDuration: 0.5,
  slideHeight: 0.55,
  invulnAfterHit: 0,
  radius: 0.55,
  height: 1.8,
  /** Tight hitboxes matched to visible white-suit silhouette */
  hitbox: { w: 0.62, h: 1.72, d: 0.48 },
  hitboxSlide: { w: 0.56, h: 0.52, d: 0.42 },
  hitboxJump: { w: 0.58, h: 1.08, d: 0.44 },
  /** Visual mesh bounds — hitbox derives from these */
  meshBounds: { w: 0.64, h: 1.78, d: 0.5, feetOffset: 0 },
};

export const INPUT = {
  laneBufferMax: 1,
  swipeMin: 24,
  swipeMaxMs: 280,
};

export const WORLD = {
  segmentLength: 40,
  segmentsAhead: 8,
  segmentsBehind: 2,
  buildingRows: 2,
  fogNear: 22,
  fogFar: 110,
  roadWidth: 8.5,
  poolSize: 10,
};

export const SPAWN = {
  runwayZ: 180,
  minSpawnAhead: 55,
  obstacleMinGap: 24,
  obstacleMaxGap: 38,
  obstacleGapTighten: 0.22,
  obstacleWarmupZ: 180,
  obstacleWarmupGapMin: 42,
  obstacleWarmupGapMax: 56,
  warmupPatternCount: 5,
  collectibleChance: 0.9,
  collectibleWarmupZ: 200,
  collectibleCluster: 3,
  chainChance: 0.22,
  chainLength: 5,
  telegraphLead: 1.6,
  telegraphStripLength: 4.5,
  telegraphAhead: 14,
  patternLookahead: 3,
  doubleChanceBase: 0.05,
  doubleChanceMax: 0.35,
  starterCanSpacing: 5.5,
  starterCanCount: 6,
  hitboxShrink: 0.78,
};

export const SCORE = {
  perMeter: 1.2,
  canBase: 50,
  comboMultStep: 0.15,
  comboMax: 8,
  comboDecay: 2.5,
};

/** Subway Surfers-style elevated chase — high, pulled back, wide FOV for telegraph */
export const CAMERA = {
  offset: { x: 0, y: 8.2, z: -16.5 },
  lookAhead: 24,
  lookAheadSpeedBoost: 8,
  lookHeight: 1.65,
  lateralFollow: 0.3,
  lag: 0.09,
  lagY: 0.12,
  fovBase: 60,
  fovSpeedBoost: 5,
  fovPunch: 7,
  fovPunchDecay: 16,
  landShake: 0.14,
  landShakeDuration: 0.22,
};

export const RENDER = {
  maxPixelRatio: 2,
  shadowMapSize: 2048,
};
