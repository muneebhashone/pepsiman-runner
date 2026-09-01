/**
 * Headless sim: post-warmup rotation hazards reached at contact-time.
 * Models leftover warmup rail/sign, blocker cap, and rotation-pack gaps.
 * Run: node scripts/sim-spawn-contact.mjs
 */
import { PLAYER, SPAWN, WORLD } from '../src/game/constants.js';

const ROTATION = ['truck', 'mover', 'barrel', 'pepsiWide', 'ramp'];
const WARMUP_TYPES = ['rail', 'sign'];
const BLOCKER_RANGE = 90;
const BLOCKER_CAP = SPAWN.maxConcurrentBlockers;

function speedNorm(speed) {
  return Math.min(1, (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase));
}

function spawnHorizon(speed) {
  const diff = speedNorm(speed);
  const segmentLead = WORLD.segmentLength * SPAWN.patternLookahead;
  return Math.max(
    SPAWN.obstacleSpawnAheadMin,
    Math.min(SPAWN.obstacleSpawnAheadMax, segmentLead + diff * 8)
  );
}

function spawnAheadLead(speed) {
  const diff = speedNorm(speed);
  return Math.max(SPAWN.obstacleSpawnAheadMin, Math.min(70, SPAWN.obstacleSpawnAheadMin + diff * 10));
}

function minAhead(speed) {
  const diff = speedNorm(speed);
  const leadDist = speed * SPAWN.telegraphLead;
  const reaction = SPAWN.telegraphReactionMargin + diff * 6;
  return Math.max(SPAWN.minSpawnAhead + diff * 12, leadDist + reaction);
}

function warmupGap() {
  return (SPAWN.obstacleWarmupGapMin + SPAWN.obstacleWarmupGapMax) * 0.5;
}

function rotationGap(rotationIndex) {
  if (rotationIndex === 4) {
    return (SPAWN.rotationRampGapMin + SPAWN.rotationRampGapMax) * 0.5;
  }
  return (SPAWN.rotationGapMin + SPAWN.rotationGapMax) * 0.5;
}

function gap(speed, playerZ, warmup, rotationBandPack, rotationIndex) {
  if (warmup) return warmupGap();
  if (
    rotationBandPack &&
    rotationIndex > 0 &&
    rotationIndex < SPAWN.rotationPackCount
  ) {
    return rotationGap(rotationIndex);
  }
  return SPAWN.obstacleMinGap + 5;
}

function countBlockers(items, playerZ) {
  let n = 0;
  for (const it of items) {
    if (it.z > playerZ - 8 && it.z < playerZ + BLOCKER_RANGE) n++;
  }
  return n;
}

function recycleWarmupBand(items, playerZ) {
  const recycleZ = playerZ + SPAWN.warmupRecycleAhead;
  let nearest = null;
  let nearestLead = Infinity;
  for (const it of items) {
    if (it.tutorial) continue;
    if (it.type !== 'rail' && it.type !== 'sign') continue;
    if (it.z <= playerZ) continue;
    const lead = it.z - playerZ;
    if (lead < nearestLead) {
      nearestLead = lead;
      nearest = it;
    }
  }
  return items.filter((it) => {
    if (it.tutorial) return true;
    if (it.type !== 'rail' && it.type !== 'sign') return true;
    if (it.z <= playerZ) return true;
    if (it === nearest && it.z <= recycleZ) return true;
    return it.z <= recycleZ;
  });
}

function inWarmup(playerZ) {
  return playerZ < SPAWN.runwayZ || playerZ < SPAWN.obstacleWarmupZ;
}

function simulate() {
  let playerZ = 0;
  let speed = PLAYER.runSpeedBase;
  let t = 0;
  const dt = 1 / 60;
  let nextZ = SPAWN.runwayZ;
  let rot = 0;
  let wasWarmup = true;
  let rotationBandPack = false;
  let warmupPattern = 0;
  const items = [];
  const first = {};

  while (t < 35) {
    speed = Math.min(PLAYER.runSpeedMax, speed + PLAYER.accelPerSec * dt);
    if (t < PLAYER.earlySpeedCapSec) speed = Math.min(speed, PLAYER.earlySpeedCap);
    playerZ += speed * dt;
    t += dt;

    const warmup = inWarmup(playerZ);
    const horizon = spawnHorizon(speed);

    if (wasWarmup && !warmup) {
      const kept = recycleWarmupBand(items, playerZ);
      items.length = 0;
      items.push(...kept);
      nextZ = playerZ + spawnAheadLead(speed);
      rotationBandPack = true;
    }
    wasWarmup = warmup;

    if (rotationBandPack && rot >= SPAWN.rotationPackCount) {
      rotationBandPack = false;
    }

    if (playerZ >= SPAWN.runwayZ - 5) {
      if (rotationBandPack && rot < SPAWN.rotationPackCount) {
        nextZ = Math.max(nextZ, SPAWN.runwayZ);
      } else {
        nextZ = Math.max(nextZ, Math.max(SPAWN.runwayZ, playerZ + minAhead(speed)));
      }
    }

    while (nextZ < playerZ + horizon) {
      if (countBlockers(items, playerZ) >= BLOCKER_CAP + 1) break;
      if (nextZ < SPAWN.runwayZ) {
        nextZ = SPAWN.runwayZ;
        if (nextZ >= playerZ + horizon) break;
      }

      if (warmup) {
        const type = WARMUP_TYPES[warmupPattern % WARMUP_TYPES.length];
        warmupPattern++;
        items.push({ type, z: nextZ, tutorial: warmupPattern <= 2 });
      } else {
        const type = ROTATION[rot % ROTATION.length];
        rot++;
        if (!first[type]) {
          first[type] = { z: nextZ, spawnT: t, lead: nextZ - playerZ };
        }
        items.push({ type, z: nextZ, tutorial: false });
      }

      nextZ += gap(speed, playerZ, warmup, rotationBandPack, rot);
    }

    // Despawn passed items (matches Obstacles shift threshold)
    while (items.length && items[0].z < playerZ - 14) items.shift();
  }

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

  return { first, contact, leftoverWarmup: items.filter((it) => it.type === 'rail' || it.type === 'sign').length };
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
console.log('\nContact times (playerZ crosses z, any lane):');
for (const type of ROTATION) {
  console.log(`  ${type}: t=${contact[type]?.toFixed(1) ?? '?'}s`);
}
console.log(`\nKit by t≤15s: ${kitBy15}/4 (need ≥3)`);
console.log(`Ramp: t=${contact.ramp?.toFixed(1)}s (want ~18–22s)`);

const ok =
  kitBy15 >= 3 &&
  contact.truck >= 8 &&
  contact.truck <= 12 &&
  contact.ramp >= 17 &&
  contact.ramp <= 23 &&
  first.truck.lead >= 55 &&
  first.truck.lead <= 140;

if (!ok) {
  console.error('\nFAIL spawn-contact checks');
  process.exit(1);
}
console.log('\nPASS spawn-contact checks');
process.exit(0);
