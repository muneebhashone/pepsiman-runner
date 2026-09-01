/**
 * Headless sim: verify post-warmup rotation hazards are *reached* in contact-time.
 * Run: node scripts/sim-spawn-contact.mjs
 */
import { PLAYER, SPAWN } from '../src/game/constants.js';

const ROTATION = ['truck', 'mover', 'barrel', 'pepsiWide', 'ramp'];

function spawnHorizon(speed) {
  const diff = Math.min(1, (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase));
  const segmentLead = 40 * SPAWN.patternLookahead;
  return Math.max(
    SPAWN.obstacleSpawnAheadMin,
    Math.min(SPAWN.obstacleSpawnAheadMax, segmentLead + diff * 8)
  );
}

function spawnAheadLead(speed) {
  const diff = Math.min(1, (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase));
  return Math.max(
    SPAWN.obstacleSpawnAheadMin,
    Math.min(SPAWN.obstacleSpawnAheadMax, SPAWN.obstacleSpawnAheadMin + 5 + diff * 12)
  );
}

function gap(speed, warmup) {
  if (warmup) return 42;
  return SPAWN.obstacleMinGap + 5;
}

function simulate() {
  let playerZ = 0;
  let speed = PLAYER.runSpeedBase;
  let t = 0;
  const dt = 1 / 60;
  let nextZ = SPAWN.runwayZ;
  let rot = 0;
  let wasWarmup = true;
  const first = {};

  const inWarmup = (z) => z < SPAWN.runwayZ || z < SPAWN.obstacleWarmupZ;

  while (t < 35) {
    speed = Math.min(PLAYER.runSpeedMax, speed + PLAYER.accelPerSec * dt);
    if (t < PLAYER.earlySpeedCapSec) speed = Math.min(speed, PLAYER.earlySpeedCap);
    playerZ += speed * dt;
    t += dt;

    const warmup = inWarmup(playerZ);
    const horizon = spawnHorizon(speed);
    const minAhead = Math.max(SPAWN.minSpawnAhead, speed * SPAWN.telegraphLead + SPAWN.telegraphReactionMargin);

    if (wasWarmup && !warmup) nextZ = playerZ + spawnAheadLead(speed);
    wasWarmup = warmup;

    if (playerZ >= SPAWN.runwayZ - 5) {
      nextZ = Math.max(nextZ, Math.max(SPAWN.runwayZ, playerZ + minAhead));
    }

    // One pattern per frame (matches typical blocker cap behavior)
    if (nextZ < playerZ + horizon) {
      if (!warmup) {
        const type = ROTATION[rot % ROTATION.length];
        rot++;
        if (!first[type]) first[type] = { z: nextZ, spawnT: t, lead: nextZ - playerZ };
      }
      nextZ += gap(speed, warmup);
    }
  }

  // Contact times
  let z = 0;
  let ct = 0;
  speed = PLAYER.runSpeedBase;
  const contact = {};
  while (ct < 35) {
    speed = Math.min(PLAYER.runSpeedMax, speed + PLAYER.accelPerSec * dt);
    if (ct < PLAYER.earlySpeedCapSec) speed = Math.min(speed, PLAYER.earlySpeedCap);
    z += speed * dt;
    ct += dt;
    for (const type of ROTATION) {
      if (!contact[type] && first[type] && z >= first[type].z) {
        contact[type] = ct;
      }
    }
  }

  return { first, contact };
}

const { first, contact } = simulate();
const kit = ['truck', 'mover', 'barrel', 'pepsiWide'];
const kitBy15 = kit.filter((k) => contact[k] <= 15).length;

console.log('First rotation spawns:');
for (const type of ROTATION) {
  const s = first[type];
  if (!s) continue;
  console.log(`  ${type}: z=${s.z.toFixed(0)} spawnT=${s.spawnT.toFixed(1)}s lead=${s.lead.toFixed(0)}m`);
}
console.log('\nContact times (playerZ crosses z):');
for (const type of ROTATION) {
  console.log(`  ${type}: t=${contact[type]?.toFixed(1) ?? '?'}s`);
}
console.log(`\nKit by t≤15s: ${kitBy15}/4 (need ≥3)`);
console.log(`Ramp: t=${contact.ramp?.toFixed(1)}s (want ~18–22s)`);

const ok =
  kitBy15 >= 3 &&
  contact.truck >= 8 &&
  contact.truck <= 14 &&
  contact.ramp >= 17 &&
  contact.ramp <= 23 &&
  first.truck.lead >= 80 &&
  first.truck.lead <= 150;

process.exit(ok ? 0 : 1);
