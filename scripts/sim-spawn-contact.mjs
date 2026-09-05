/** Exercise the real spawner, movement, and collision code without WebGL. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ChallengeDirector, patternGap } from '../src/game/Difficulty.js';
import { Obstacles } from '../src/game/Obstacles.js';
import { Player } from '../src/game/Player.js';
import { seeded } from '../src/game/Art.js';
import { PLAYER, SPAWN, LANES } from '../src/game/constants.js';

// Only texture painting is stubbed. Geometry, hitboxes, spawning, and motion are real.
const paint = new Proxy({}, { get: (_, key) => key === 'measureText'
  ? text => ({ width: text.length * 20 })
  : key.includes('Gradient') ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => paint }) };

for (let seed = 1; seed <= 100; seed++) {
  const director = new ChallengeDirector();
  const rng = seeded(seed);
  let previousRoute = 1;
  let stationaryRows = 0;
  for (let i = 0; i < 120; i++) {
    const speed = Math.min(40, 20 + i * .3);
    const row = director.next(speed, rng);
    assert.ok(Math.abs(row.routeLane - previousRoute) <= 1, 'Routes never require an abrupt two-lane reversal');
    const onRoute = row.hazards.filter(h => h.lane === row.routeLane);
    assert.ok(onRoute.every(h => !['truck', 'pepsiWide', 'mover'].includes(h.type)), 'Every row has a passable route');
    for (const h of row.hazards.filter(h => h.type === 'mover')) {
      assert.ok(row.routeLane < Math.min(h.lane, h.endLane) || row.routeLane > Math.max(h.lane, h.endLane), 'Sweeping trucks stay outside the safe route');
    }
    assert.equal(new Set(row.hazards.map(h => h.lane)).size, row.hazards.length, 'No incompatible actions stacked in one lane');
    stationaryRows = row.routeLane === previousRoute ? stationaryRows + 1 : 0;
    if (i > 6) assert.ok(stationaryRows <= 2, 'The route changes before camping becomes viable');
    previousRoute = row.routeLane;
    const gapSeconds = patternGap(speed, rng) / speed;
    assert.ok(gapSeconds >= 1.05, 'Top-speed patterns retain a reaction window');
  }
}
assert.ok(patternGap(40, () => 0) / 40 < patternGap(20, () => 0) / 20, 'Pressure increases with speed');
console.log('PASS 12,000 generated rows: safe routes, lane pressure, and reaction spacing');

const scene = new THREE.Scene();
const obstacles = new Obstacles(scene);
const player = new Player(scene);
const box = (z, feet = 0) => ({ x: 0, y: 1.125 + feet, z, w: .62, h: 2.25, d: .64 });
let hazard = obstacles._acquire('barrier', 1, 10);
assert.equal(obstacles.collide(box(10, .02), true, false), hazard, 'Pressing jump at contact does not bypass a barrier');
assert.equal(obstacles.collide(box(10, 1.2), true, false), null);
assert.deepEqual(obstacles.collectClears(box(10, 1.2)), [], 'Wait until the entire hitbox clears');
assert.equal(obstacles.collectClears(box(11, 1.2))[0].action, 'jumps');
assert.deepEqual(obstacles.collectClears(box(12, 1.2)), [], 'A hazard only pays once');
obstacles.reset();
hazard = obstacles._acquire('barrier', 1, 10);
assert.equal(obstacles.collide({ ...box(12), previousZ: 8 }, false, false), hazard, 'Low frame rates cannot tunnel through a hazard');
obstacles.reset();
hazard = obstacles._acquire('rail', 1, 10);
hazard.isFirstTutorialRail = true;
assert.equal(obstacles.collide(box(10), false, false), null);
assert.deepEqual(obstacles.collectClears(box(11)), [], 'Tutorial grace cannot count as a clear');
obstacles.reset();
obstacles._acquire('barrier', 1, 10);
obstacles.collide(box(10, 1.2), true, false);
assert.deepEqual(obstacles.collectClears(box(11), true), [], 'Protection cannot award skill clears');
assert.deepEqual(obstacles.collectClears(box(12)), [], 'Ending protection cannot collect an old reward');
console.log('PASS feet clearance, swept collision, completed clears, and reward gating');

const allTypes = new Set();
let totalClears = 0;
const originalRandom = Math.random;
for (const dt of [1 / 60, 1 / 20]) {
  for (const seed of [17, 43, 91, 137, 251, 389]) {
    Math.random = seeded(seed);
    obstacles.reset();
    player.reset();
    const seen = new WeakSet();
    for (let t = 0; t < 90; t += dt) {
      const upcoming = obstacles.items.filter(it => it.alive &&
        it.z + (it.hit.d + .64) * SPAWN.hitboxShrink * .5 >= player.z)
        .sort((a, b) => a.z - b.z);
      if (upcoming.length) {
        const first = upcoming[0];
        const row = obstacles.items.filter(it => it.alive && Math.abs(it.z - first.z) < 1);
        const routes = [0, 1, 2].filter(lane => !row.some(it => {
          if (it.type === 'mover') return lane >= Math.min(it.moverStartLane, it.moverEndLane) && lane <= Math.max(it.moverStartLane, it.moverEndLane);
          return it.lane === lane && it.hit.mode === 'block';
        })).sort((a, b) => Math.abs(a - player.targetLane) - Math.abs(b - player.targetLane));
        assert.ok(routes.length, 'Actual spawned rows retain their safe route');
        const lane = routes[0];
        const ttc = (first.z - player.z) / player.speed;
        if (ttc < 1 && ttc > 0 && lane !== player.targetLane && player.canQueueLane()) player.tryLane(Math.sign(lane - player.targetLane));
        const action = row.find(it => it.lane === lane)?.hit.mode;
        if (ttc > 0 && ttc < .35 && action === 'jump' && !player.jumping) player.tryJump();
        if (ttc > 0 && ttc < .42 && action === 'slide' && !player.sliding) player.trySlide();
      }
      player.speed = Math.min(PLAYER.runSpeedMax, player.speed + PLAYER.accelPerSec * dt);
      if (t < PLAYER.earlySpeedCapSec) player.speed = Math.min(player.speed, PLAYER.earlySpeedCap);
      const previousZ = player.z;
      player.z += player.speed * dt;
      player.update(dt);
      const hitbox = { ...player.getHitBox(), previousZ };
      if (obstacles.checkRamp(hitbox, player.lane) && !player.jumping) player.tryJump();
      obstacles.update(dt, player.z, player.speed);
      for (const it of obstacles.items) {
        allTypes.add(it.type);
        if (!seen.has(it)) {
          seen.add(it);
          assert.ok(it.z - player.z >= SPAWN.minSpawnAhead - 1, 'New hazards have visible warning distance');
        }
      }
      const hit = obstacles.collide(hitbox, player.jumping, player.sliding, { allowGrace: false });
      assert.equal(hit?.type, undefined, `Fair route failed: seed ${seed}, ${1/dt}fps, ${t.toFixed(2)}s, lane ${player.lane}, ${hit?.type}, x ${player.x}, z ${player.z}, upcoming ${JSON.stringify(upcoming.slice(0,6).map(it => [it.type,it.lane,it.z,it.moverStartLane,it.moverEndLane]))}`);
      totalClears += obstacles.collectClears(hitbox).length;
    }
  }
}
Math.random = originalRandom;
obstacles.reset();
assert.equal(allTypes.size, 8, 'The full obstacle kit remains represented');
assert.ok(totalClears > 100, 'Simulations actually clear hazards');
delete globalThis.document;
console.log(`PASS twelve 90-second runs at 60/20fps with real movement and collisions (${totalClears} clears, all 8 obstacle types)`);
