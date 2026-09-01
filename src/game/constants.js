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
  canBody: 0xffd54f,
  canBand: 0x00e5ff,
  canTop: 0xfff8e8,
  telegraph: 0xe32934,
  telegraphGlow: 0xf25560,
  telegraphSlide: 0xff6600,
  telegraphSlideGlow: 0xff2d95,
  truckCab: 0x2255aa,
  truckTrailer: 0xe32934,
  barrier: 0xffaa00,
  rail: 0x8899aa,
  sign: 0xf0f4ff,
  signFrame: 0xffaa00,
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
  runwayZ: 55,
  minSpawnAhead: 55,
  /** Z gap between patterns — ~1.8–2.5s at base speed, tightens slowly with velocity */
  obstacleMinGap: 32,
  obstacleMaxGap: 42,
  obstacleGapTighten: 0.14,
  obstacleWarmupZ: 180,
  obstacleWarmupGapMin: 32,
  obstacleWarmupGapMax: 42,
  warmupPatternCount: 2,
  /** First N post-warmup patterns alternate forced slide/jump obstacles in center lane */
  postWarmupTutorialPatterns: 8,
  /** Max hazards visible ahead of player at once */
  maxConcurrentBlockers: 4,
  /** Rolling window (seconds) — must include jump + slide threats */
  varietyWindowSec: 15,
  varietyHistorySize: 10,
  collectibleChance: 0.9,
  collectibleWarmupZ: 200,
  collectibleCluster: 1,
  chainChance: 0.06,
  chainLength: 3,
  /** Seconds of runway warning at current speed (~0.7–0.9s strip) */
  telegraphLead: 0.8,
  /** Extra spawn margin beyond leadDist so warnings are fully readable */
  telegraphReactionMargin: 8,
  telegraphStripLength: 4,
  telegraphStripWidth: 2.1,
  /** World-Z gap between strip end and obstacle front */
  telegraphObstacleGap: 1.5,
  telegraphAhead: 14,
  telegraphChevronCount: 4,
  /** Minimum telegraph opacity at far edge of warn zone */
  telegraphMinAlpha: 0.42,
  /** Opacity ramps to full only in the last N seconds before hazard */
  telegraphRampSec: 0.35,
  /** Tutorial DOM hint: fire when obstacle enters this travel-time window (seconds) */
  tutorialHintApproachSec: 1.8,
  /** Optional pre-warn for first forced tutorial threats (seconds before contact) */
  tutorialHintPreWarnSec: 2.4,
  /** Total DOM hint visible duration (ms) — plateau ~1.1s inside 1.5s animation */
  tutorialHintVisibleMs: 1500,
  /** Shorter flash for GET READY pre-warn (ms) */
  tutorialHintReadyMs: 900,
  /** Bias spawn toward jump/slide obstacles after warmup */
  verticalObstacleBias: 0.82,
  patternLookahead: 3,
  doubleChanceBase: 0.03,
  doubleChanceMax: 0.16,
  starterCanSpacing: 8,
  starterCanCount: 4,
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

export const NEAR_MISS = {
  /** Max lateral miss distance (same lane, tight squeeze) */
  proximityX: 0.62,
  /** Z band behind obstacle front where near-miss registers */
  proximityZ: 2.4,
  scoreBonus: 12,
  cooldown: 0.4,
};

export const DEATH = {
  hitStopDuration: 0.1,
  fovPunch: 12,
  shakeStrength: 0.62,
  shakeDuration: 0.42,
};

export const CAMERA = {
  offset: { x: 0, y: 5.8, z: -11.5 },
  lookAhead: 16,
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
