/** Pepsiman Runner — shared tunables */
export const LANES = [-2.2, 0, 2.2];
export const LANE_COUNT = 3;

export const COLORS = {
  pepsiBlue: 0x0055bf,
  pepsiRed: 0xe32934,
  pepsiWhite: 0xffffff,
  pepsiDark: 0x003a80,
  asphalt: 0x484858,
  asphaltLine: 0xffff88,
  neonCyan: 0x00e5ff,
  neonMagenta: 0xff2d95,
  neonYellow: 0xffe566,
  buildingA: 0x4a5880,
  buildingB: 0x584868,
  buildingC: 0x445878,
  fog: 0x2a3868,
  sky: 0x142040,
  canBody: 0xe32934,
  canTop: 0xc0c0c0,
  telegraph: 0xe32934,
  telegraphGlow: 0xf25560,
  telegraphSlide: 0x00e5ff,
  telegraphSlideGlow: 0x66f0ff,
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
  segmentsAhead: 10,
  segmentsBehind: 2,
  buildingRows: 2,
  fogNear: 42,
  fogFar: 175,
  roadWidth: 8.5,
  poolSize: 14,
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
  /** Seconds of runway warning at current speed */
  telegraphLead: 1.5,
  /** Extra spawn margin beyond leadDist so warnings are fully readable */
  telegraphReactionMargin: 8,
  telegraphStripLength: 8,
  telegraphStripWidth: 2.1,
  telegraphAhead: 14,
  telegraphChevronCount: 10,
  /** Minimum telegraph opacity at far edge of warn zone */
  telegraphMinAlpha: 0.82,
  /** Bias spawn toward jump/slide obstacles after warmup */
  verticalObstacleBias: 0.58,
  patternLookahead: 3,
  doubleChanceBase: 0.05,
  doubleChanceMax: 0.35,
  starterCanSpacing: 5.5,
  starterCanCount: 6,
  hitboxShrink: 0.78,
};

export const SCORE = {
  perMeter: 0.65,
  canBase: 25,
  comboMultStep: 0.12,
  comboMax: 6,
  comboDecay: 1.6,
  /** Min seconds between pickups to advance combo */
  comboSpacing: 0.28,
};

export const CAMERA = {
  offset: { x: 0, y: 8.4, z: -16.5 },
  lookAhead: 24,
  lookAheadSpeedBoost: 9,
  lookHeight: 0.85,
  /** Extra pull-back / look-ahead while airborne */
  jumpPullback: 2.4,
  jumpLookBoost: 5.5,
  /** Exponential lag — lower = snappier, higher = floatier */
  lag: 0.1,
  lagY: 0.14,
  /** Snappier X follow during lane switch (lower = faster) */
  lagLaneSwitch: 0.045,
  /** Hard clamp: camera X stays within playerX ± this */
  maxLateralOff: 0.72,
  /** Tighter clamp during fast lane switches — stay nearer road center */
  maxLateralOffLaneSwitch: 0.48,
  /** Vertical bounds relative to player */
  minYOffset: 6.8,
  maxYOffset: 10.2,
  /** Damp lean-driven lateral lead (0 = none) */
  lateralLeadScale: 0.08,
  fovBase: 58,
  fovSpeedBoost: 6,
  fovPunch: 6,
  fovPunchDecay: 16,
  landShake: 0.14,
  landShakeDuration: 0.24,
};

export const RENDER = {
  maxPixelRatio: 2,
  shadowMapSize: 2048,
};
