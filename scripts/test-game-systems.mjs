import assert from 'node:assert/strict';
import { FizzMeter } from '../src/game/Fizz.js';
import { Missions } from '../src/game/Missions.js';
import { Input } from '../src/game/Input.js';
import { loadPersisted, savePersisted } from '../src/game/UI.js';
import { Game } from '../src/game/Game.js';
import { FIZZ } from '../src/game/constants.js';

const fizz = new FizzMeter();
assert.equal(fizz.isRush, false);
for (let i = 0; i < 20; i++) fizz.onCanPickup();
assert.equal(fizz.isRush, false, 'Starter lines must not hand out Rush');
for (let i = 0; i < 10 && !fizz.isRush; i++) fizz.onCanPickup();
assert.equal(fizz.isRush, true, 'A collectible streak activates Rush');
const time = fizz.rushT;
fizz.onCanPickup();
assert.equal(fizz.rushT, time, 'Pickups cannot extend Rush indefinitely');
fizz.update(FIZZ.rushDuration + 1);
assert.equal(fizz.isRush, false, 'Rush expires');
assert.equal(fizz.level, 0, 'Rush must recharge after expiring');
fizz.add(1);
assert.equal(fizz.isRush, false, 'Rewards cannot bypass the recharge delay');
assert.equal(fizz.startRush(), false, 'Direct activation respects recharge');
fizz.update(FIZZ.rechargeDelay);
fizz.add(.8);
fizz.onHit();
assert.ok(Math.abs(fizz.level - .45) < 1e-9, 'A hit drains accumulated fizz');
fizz.reset();
assert.equal(fizz.level, 0, 'A new run clears fizz');
assert.equal(fizz.cooldownT, 0, 'A new run has no inherited cooldown');
console.log('PASS fizz activation, duration, and restart');

// Exercise the actual award path without a renderer or sound system.
const noop = new Proxy({}, { get: () => () => {} });
const game = Object.assign(Object.create(Game.prototype), {
  score: 0, coins: 0, combo: 1, bestCombo: 1, comboTimer: 0,
  _streakCans: 0, _runTime: 0,
  fizz: new FizzMeter(), missions: new Missions(),
  audio: noop, fx: noop, ui: noop, player: { x: 0, z: 0 },
  _startRush() {},
});
function pickup() { game._runTime += .1; game._collectPickup({}); }
for (let i = 0; i < 4; i++) pickup();
assert.equal(game.score, 40, 'Starter cans score at ×1');
assert.equal(game.combo, 1);
for (let i = 4; i < 24; i++) pickup();
assert.equal(game.combo, 5, 'All 24 pickups count toward the top multiplier, even at top speed');
game.fizz.startRush();
const streak = game._streakCans;
for (let i = 0; i < 100; i++) pickup();
assert.equal(game._streakCans, streak, 'Magnet pickups cannot build combo');
assert.equal(game.combo, 5, 'Rush preserves the earned multiplier');
game._resetCombo();
assert.equal(game.combo, 1);
assert.equal(game._streakCans, 0);
game.fizz.reset();
game.missions.active = [{ type: 'jumps', target: 1, progress: 0, done: false }];
game._tutorialGrace('jump');
assert.equal(game.missions.active[0].progress, 0, 'Forgiven mistakes do not complete action missions');
console.log('PASS gradual scoring, Rush farming prevention, and tutorial reward gating');

const missions = new Missions();
missions.active = [{ type: 'nohit', label: 'Stay clean', target: 20, progress: 0, done: false, score: 150, fizz: .14 }];
assert.deepEqual(missions.update(19), []);
missions.update(0, true);
assert.equal(missions.active[0].progress, 0, 'A collision resets unfinished no-hit progress');
assert.deepEqual(missions.update(20), [{ score: 150, fizz: .14, label: 'Stay clean' }], 'Survival missions actually award their reward');
assert.deepEqual(missions.update(20), [], 'Completed missions never pay twice');
missions.reset();
assert.equal(new Set(missions.active.map(m => m.id)).size, 3, 'Each run receives three distinct missions');
assert.ok(missions.active.every(m => !m.done && m.progress === 0));
console.log('PASS mission rewards, collision reset, and one-time completion');

const input = new Input({});
input.action('left');
assert.equal(input.consume().laneDelta, 0, 'Menus cannot queue movement');
input.enabled = true;
input.action('left');
assert.equal(input.consume(false).laneDelta, 0, 'A lane input waits during a committed switch');
assert.equal(input.consume(true).laneDelta, 1, 'Buffered left moves along positive X in the +Z chase view');
assert.equal(input.consume().laneDelta, 0, 'Buffered actions are consumed once');
input.action('jump');
assert.equal(input.consume().jump, true);
assert.equal(input.consume().jump, false);
input.action('right');
input.reset();
assert.equal(input.consume().laneDelta, 0, 'Pause and restart clear queued input');
console.log('PASS input gating, buffering, and reset');

globalThis.localStorage = { getItem: () => '{invalid' };
assert.equal(loadPersisted().highScore, 0, 'Corrupt records cannot prevent startup');
globalThis.localStorage = { getItem: () => JSON.stringify({ highScore: 900, timedHighScore: 450 }) };
assert.equal(loadPersisted().highScore, 900);
assert.equal(loadPersisted().timedHighScore, 450);
globalThis.localStorage = { getItem: () => JSON.stringify({ highScore: -20, timedHighScore: 'Infinity' }) };
assert.equal(loadPersisted().highScore, 0);
assert.equal(loadPersisted().timedHighScore, 0);
delete globalThis.localStorage;
console.log('PASS separate mode records and corrupt-storage recovery');

const records = new Map([['pepsiman-runner-v1', JSON.stringify({ highScore: 90000 })]]);
globalThis.localStorage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
assert.equal(loadPersisted().highScore, 0, 'New scoring starts a comparable score table');
savePersisted({ highScore: 1200 });
assert.equal(loadPersisted().highScore, 1200);
assert.equal(JSON.parse(records.get('pepsiman-runner-v1')).highScore, 90000, 'Previous records remain intact');
delete globalThis.localStorage;
console.log('PASS preservation of previous scoring records');
