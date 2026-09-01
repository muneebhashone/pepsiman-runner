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
  accelPerSec: 0.18,
  /** Hold early pace flat so median run stretches toward 30–45s */
  earlySpeedCap: 19,
  earlySpeedCapSec: 16,
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
  buildingRows: 1,
  fogNear: 42,
  fogFar: 175,
  roadWidth: 8.5,
  poolSize: 14,
};

export const SPAWN = {
  runwayZ: 55,
  minSpawnAhead: 55,
  /** Z gap between patterns — ~1.8–2.5s at base speed, tightens slowly with velocity */
  obstacleMinGap: 38,
  obstacleMaxGap: 48,
  obstacleGapTighten: 0.1,
  obstacleWarmupZ: 320,
  obstacleWarmupGapMin: 52,
  obstacleWarmupGapMax: 68,
  /** Wider Z gap between first forced tutorial obstacles so lesson 2 isn't stacked on lesson 1 */
  obstacleTutorialGapMin: 72,
  obstacleTutorialGapMax: 82,
  /** How many initial tutorial patterns use the wider gap */
  obstacleTutorialWideGapCount: 4,
  /** Post-warmup patterns that keep wide gaps before density ramps */
  postWarmupWideGapCount: 5,
  /** No double-lane blocks until after this many patterns (post-warmup) */
  earlyNoDoublePatterns: 8,
  warmupPatternCount: 10,
  /** First N post-warmup patterns alternate forced slide/jump obstacles in center lane */
  postWarmupTutorialPatterns: 0,
  /** Forced obstacle-type rotation length after center tutorial */
  rotationTableLength: 20,
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
  /** Verb hint pop-in duration (seconds) — hold timer starts after this settles */
  tutorialHintVerbPopSec: 0.18,
  /** Verb hint full-opacity dwell before fade (seconds) — after pop settles */
  tutorialHintVerbVisibleSec: 1.6,
  /** Verb hint fade-out duration (seconds) — runs after hold, not inside it */
  tutorialHintVerbFadeSec: 0.35,
  /** GET READY real-time hold before first verb (seconds) */
  tutorialHintReadyBeforeVerbSec: 0.9,
  /** AGAIN / GET READY beat before grace-retry verb (seconds) */
  tutorialHintRetryBeatSec: 0.7,
  /** Start GET READY when ttc <= readyStartSec (seconds) */
  tutorialHintReadyStartSec: 2.9,
  /** Min spawn lead so first tutorial threats enter teaching range with full dwell */
  tutorialHintMinSpawnTtcSec: 3.2,
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
  comboMultStep: 0.18,
  comboMax: 12,
  comboDecay: 1.85,
  /** Min seconds between pickups to advance combo */
  comboSpacing: 0.28,
  /** Combo shout thresholds */
  shoutNice: 3,
  shoutWow: 5,
  shoutPerfect: 8,
};

export const NEAR_MISS = {
  /** Max lateral miss distance (same lane, tight squeeze) */
  proximityX: 0.52,
  /** Z band behind obstacle front where near-miss registers */
  proximityZ: 2.1,
  scoreBonus: 18,
  cooldown: 0.55,
  hitStop: 0.045,
};

export const FIZZ = {
  max: 1,
  emptyAfterRush: 0,
  perCan: 0.09,
  perCanStreak: 0.008,
  streakWindow: 1.4,
  streakCap: 0.04,
  perNearMiss: 0.16,
  rushDuration: 4,
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
  maxPixelRatio: 1.25,
  maxPixelRatioLow: 1,
  shadowMapSize: 512,
  /** Perf budget: hemi + ambient + 1 directional, 512 shadows, frustum-culled props */
};
