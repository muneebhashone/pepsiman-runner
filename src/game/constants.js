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
  runSpeedBase: 20,
  runSpeedMax: 40,
  accelPerSec: 0.42,
  /** A short teaching runway, then continuous acceleration. */
  earlySpeedCap: 21,
  earlySpeedCapSec: 6,
  /** Lane switch: 0.18–0.22s with overshoot settle */
  laneSwitchDuration: 0.2,
  laneOvershoot: 0.14,
  laneLeanMax: 0.42,
  laneLeanDamp: 10,
  /** Jump: ~0.45s sin arc apex */
  jumpDuration: 0.72,
  jumpHeight: 2.25,
  /** Coyote-ish forgiveness after leaving ground */
  coyoteTime: 0.1,
  /** Slide: ~0.5s flat squash */
  slideDuration: 0.82,
  slideHeight: 0.55,
  invulnAfterHit: 1.15,
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
  buildingRows: 1,
  fogNear: 42,
  fogFar: 175,
  roadWidth: 8.5,
  poolSize: 14,
};

export const SPAWN = {
  runwayZ: 55,
  minSpawnAhead: 55,
  /** Hazards enter the visible preview 55–140m ahead. */
  obstacleSpawnAheadMin: 55,
  obstacleSpawnAheadMax: 140,
  obstacleWarmupZ: 105,
  obstacleWarmupGapMin: 36,
  obstacleWarmupGapMax: 48,
  /** Enough capacity for complete three-lane rows inside the preview band. */
  maxConcurrentBlockers: 12,
  rowSecondsStart: 1.7,
  rowSecondsMin: 1.05,
  rowSecondsJitter: 0.22,
  varietyHistorySize: 10,
  collectibleWarmupZ: 200,
  /** Seconds of runway warning at current speed (~0.7–0.9s strip) */
  telegraphLead: 0.8,
  /** Extra spawn margin beyond leadDist so warnings are fully readable */
  telegraphReactionMargin: 8,
  telegraphStripLength: 4,
  telegraphStripWidth: 2.1,
  /** World-Z gap between strip end and obstacle front */
  telegraphObstacleGap: 1.5,
  telegraphChevronCount: 4,
  /** Minimum telegraph opacity at far edge of warn zone */
  telegraphMinAlpha: 0.42,
  /** Opacity ramps to full only in the last N seconds before hazard */
  telegraphRampSec: 0.35,
  /** Mover destination lane strip — earlier than body warn (~2s TTC, clamped 60–80m) */
  moverDestTelegraphLeadSec: 2.0,
  moverDestTelegraphMinDist: 60,
  moverDestTelegraphMaxDist: 80,
  /** Verb hint pop-in duration (seconds) — hold timer starts after this settles */
  tutorialHintVerbPopSec: 0.18,
  /** Verb hint full-opacity dwell before fade (seconds) — after pop settles */
  tutorialHintVerbVisibleSec: 1.6,
  /** Verb hint fade-out duration (seconds) — runs after hold, not inside it */
  tutorialHintVerbFadeSec: 0.35,
  /** GET READY real-time hold before first verb (seconds) */
  tutorialHintReadyBeforeVerbSec: 2.1,
  /** AGAIN / GET READY beat before grace-retry verb (seconds) */
  tutorialHintRetryBeatSec: 0.7,
  /** Start GET READY when ttc <= readyStartSec (seconds) */
  tutorialHintReadyStartSec: 2.9,
  /** Min spawn lead so first tutorial threats enter teaching range with full dwell */
  tutorialHintMinSpawnTtcSec: 3.2,
  /** Obstacle fill horizon in segment lengths (~120m) — decoupled from WORLD.segmentsAhead */
  patternLookahead: 3,
  starterCanSpacing: 8,
  starterCanCount: 4,
  hitboxShrink: 0.78,
};

export const SCORE = {
  perMeter: 0.2,
  canBase: 10,
  clearBase: 8,
  smashBase: 10,
  cansPerCombo: 6,
  comboMax: 5,
  comboDecay: 1.5,
  /** Combo shout thresholds */
  shoutNice: 2,
  shoutWow: 4,
  shoutPerfect: 5,
};

export const NEAR_MISS = {
  /** Max lateral miss distance (same lane, tight squeeze) */
  proximityX: 0.52,
  /** Z band behind obstacle front where near-miss registers */
  proximityZ: 2.1,
  scoreBonus: 10,
  cooldown: 0.55,
  hitStop: 0.045,
};

export const FIZZ = {
  max: 1,
  emptyAfterRush: 0,
  perCan: 0.03,
  perCanStreak: 0.002,
  streakWindow: 1.4,
  streakCap: 0.008,
  perNearMiss: 0.05,
  rushDuration: 3,
  rechargeDelay: 4,
  hitPenalty: 0.35,
  speedBoost: 1.12,
  magnetAllLanes: true,
  /** Fizz bar pulses when this full — rush is imminent */
  readyPulseAt: 0.85,
  /** Score multiplier while rush is active */
  rushScoreMult: 2,
};

export const MISSIONS = {
  perRun: 3,
};

export const ZONE = {
  /** Speed-band palette / FOV tick every ~20s */
  intervalSec: 20,
  fovTick: 0.75,
};

export const DEATH = {
  hitStopDuration: 0.1,
  fovPunch: 4,
  shakeStrength: 0.45,
  shakeDuration: 0.28,
};

export const CAMERA = {
  offset: { x: 0, y: 5.8, z: -11.5 },
  lookAhead: 16,
  lookAheadSpeedBoost: 2.5,
  lookHeight: 0.85,
  /** Minimal pull-back while airborne — horizon stays stable */
  jumpPullback: 0.6,
  jumpLookBoost: 1.2,
  /** Dolly-on-rails: tiny X follow fraction of player offset from center */
  lateralFollow: 0.06,
  /** Brief lateral settle toward new lane on commit (world units) */
  laneSettleAmp: 0.12,
  /** Damp settle back to center — lambda for THREE.MathUtils.damp, <0.25s feel */
  laneSettleDecay: 16,
  /** Exponential lag — lower = snappier */
  lag: 0.08,
  lagY: 0.12,
  /** Hard clamp: camera X within playerX ± this (tight — road center anchor) */
  maxLateralOff: 0.35,
  /** Vertical bounds relative to player */
  minYOffset: 6.8,
  maxYOffset: 9.8,
  /** No lean-driven camera hunt */
  lateralLeadScale: 0,
  fovBase: 58,
  fovSpeedBoost: 2.5,
  fovPunch: 0,
  fovPunchDecay: 20,
  landShake: 0.03,
  landShakeDuration: 0.12,
};

export const RENDER = {
  maxPixelRatio: 1.5,
  maxPixelRatioLow: 1,
  shadowMapSize: 1024,
  /** Image-based lighting strength — realistic reflections on metal/gloss */
  envIntensity: 1.15,
  /** Perf budget: hemi + ambient + 1 directional, 1024 shadows, frustum-culled props */
};
