import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD, PLAYER } from './constants.js';

const TYPES = ['barrier', 'rail', 'sign', 'truck'];
const WARMUP_TYPES = ['rail', 'sign'];
const POOL_SIZE = 48;

function speedNorm(speed) {
  return Math.min(1, (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase));
}

function pickLanes(n, rng) {
  const lanes = [0, 1, 2];
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes.slice(0, n);
}

function typeForLane(lane, openLane, rng, warmup) {
  if (warmup) return WARMUP_TYPES[(rng() * WARMUP_TYPES.length) | 0];
  if (lane === openLane) return TYPES[(rng() * TYPES.length) | 0];
  const blockTypes = ['barrier', 'truck', 'sign', 'rail'];
  return blockTypes[(rng() * blockTypes.length) | 0];
}

export class Obstacles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pool = [];
    this.telPool = [];
    this.shadowPool = [];
    this.nextZ = SPAWN.runwayZ;
    this.patternsSpawned = 0;
    this._rng = Math.random;

    this._geo = {
      barrier: new THREE.BoxGeometry(1.6, 1.1, 0.5),
      rail: new THREE.BoxGeometry(1.8, 0.45, 1.2),
      sign: new THREE.BoxGeometry(1.9, 1.4, 0.3),
      pole: new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8),
      truckCab: new THREE.BoxGeometry(1.8, 1.6, 1.4),
      truckBody: new THREE.BoxGeometry(1.9, 2.0, 3.2),
      tel: new THREE.PlaneGeometry(1.7, SPAWN.telegraphStripLength),
      shadow: new THREE.PlaneGeometry(1.3, 1.8),
    };
    this._mats = {
      barrier: new THREE.MeshStandardMaterial({
        color: COLORS.barrier,
        emissive: COLORS.barrier,
        emissiveIntensity: 0.35,
        metalness: 0.35,
        roughness: 0.4,
      }),
      rail: new THREE.MeshStandardMaterial({
        color: COLORS.rail,
        metalness: 0.75,
        roughness: 0.25,
      }),
      sign: new THREE.MeshStandardMaterial({
        color: COLORS.sign,
        emissive: COLORS.sign,
        emissiveIntensity: 0.45,
        metalness: 0.25,
        roughness: 0.45,
      }),
      truckCab: new THREE.MeshStandardMaterial({
        color: COLORS.truckCab,
        metalness: 0.55,
        roughness: 0.3,
      }),
      truckBody: new THREE.MeshStandardMaterial({
        color: COLORS.truckTrailer,
        emissive: COLORS.pepsiBlue,
        emissiveIntensity: 0.22,
        metalness: 0.45,
        roughness: 0.35,
      }),
      stripe: new THREE.MeshStandardMaterial({ color: 0x111111 }),
      telegraph: new THREE.MeshBasicMaterial({
        color: COLORS.telegraph,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      shadow: new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    };

    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Group();
      mesh.visible = false;
      this.scene.add(mesh);
      this.pool.push(mesh);

      const tel = new THREE.Mesh(this._geo.tel, this._mats.telegraph.clone());
      tel.rotation.x = -Math.PI / 2;
      tel.visible = false;
      tel.frustumCulled = true;
      this.scene.add(tel);
      this.telPool.push(tel);

      const sh = new THREE.Mesh(this._geo.shadow, this._mats.shadow.clone());
      sh.rotation.x = -Math.PI / 2;
      sh.visible = false;
      sh.frustumCulled = true;
      this.scene.add(sh);
      this.shadowPool.push(sh);
    }
  }

  _inWarmup(playerZ) {
    return (
      playerZ < SPAWN.runwayZ ||
      this.patternsSpawned < SPAWN.warmupPatternCount
    );
  }

  /** Lanes without an obstacle near z (for collectible placement). */
  openLanesNear(z, tolerance = 5) {
    const blocked = new Set();
    for (const it of this.items) {
      if (!it.alive) continue;
      if (Math.abs(it.z - z) < tolerance) blocked.add(it.lane);
    }
    const open = [];
    for (let i = 0; i < LANES.length; i++) {
      if (!blocked.has(i)) open.push(i);
    }
    return open.length ? open : [1];
  }

  _buildMesh(type) {
    const g = new THREE.Group();
    let hit = { w: 1.0, h: 0.95, d: 0.45, y: 0.55, mode: 'block' };

    if (type === 'barrier') {
      const m = new THREE.Mesh(this._geo.barrier, this._mats.barrier);
      m.position.y = 0.55;
      m.castShadow = true;
      g.add(m);
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.2, 0.52), this._mats.stripe);
      s.position.y = 0.7;
      g.add(s);
      hit = { w: 1.1, h: 0.95, d: 0.42, y: 0.55, mode: 'block' };
    } else if (type === 'rail') {
      const m = new THREE.Mesh(this._geo.rail, this._mats.rail);
      m.position.y = 0.25;
      m.castShadow = true;
      g.add(m);
      hit = { w: 1.3, h: 0.38, d: 0.8, y: 0.25, mode: 'slide' };
    } else if (type === 'sign') {
      const pole = new THREE.Mesh(this._geo.pole, this._mats.rail);
      pole.position.set(-0.7, 1.1, 0);
      g.add(pole);
      const m = new THREE.Mesh(this._geo.sign, this._mats.sign);
      m.position.y = 2.0;
      m.castShadow = true;
      g.add(m);
      hit = { w: 1.35, h: 0.95, d: 0.25, y: 2.0, mode: 'jump' };
    } else {
      const cab = new THREE.Mesh(this._geo.truckCab, this._mats.truckCab);
      cab.position.set(0, 1.0, 1.4);
      cab.castShadow = true;
      g.add(cab);
      const body = new THREE.Mesh(this._geo.truckBody, this._mats.truckBody);
      body.position.set(0, 1.2, -0.6);
      body.castShadow = true;
      g.add(body);
      hit = { w: 1.45, h: 1.75, d: 2.1, y: 1.05, mode: 'block' };
    }
    g.userData.hit = hit;
    return g;
  }

  _acquire(type, lane, z) {
    let mesh = this.pool.pop();
    if (!mesh) {
      mesh = this._buildMesh(type);
      this.scene.add(mesh);
    } else {
      mesh.clear();
      const built = this._buildMesh(type);
      built.children.forEach((c) => mesh.add(c));
      mesh.userData.hit = built.userData.hit;
    }

    const telLead = SPAWN.telegraphAhead;
    const tel = this.telPool.pop();
    if (tel) {
      tel.visible = true;
      tel.material.opacity = 0;
      tel.rotation.set(-Math.PI / 2, 0, 0);
      tel.position.set(LANES[lane], 0.04, z - telLead);
    }

    const shadow = this.shadowPool.pop();
    if (shadow) {
      shadow.visible = true;
      shadow.material.opacity = 0;
      shadow.rotation.set(-Math.PI / 2, 0, 0);
      shadow.scale.set(1, 1, 1);
      shadow.position.set(LANES[lane], 0.03, z - telLead * 0.55);
      const scale =
        type === 'sign' ? 1.15 : type === 'rail' ? 0.65 : type === 'truck' ? 1.25 : 0.9;
      shadow.scale.set(scale, scale * (type === 'sign' ? 1.2 : 1), 1);
    }

    mesh.position.set(LANES[lane], 0, z);
    mesh.visible = true;
    const hit = mesh.userData.hit;

    const item = {
      type,
      lane,
      z,
      mesh,
      hit,
      alive: true,
      tel,
      shadow,
      telZ: z - telLead,
      shadowZ: z - telLead * 0.55,
    };
    this.items.push(item);
    return item;
  }

  _release(item) {
    item.alive = false;
    item.mesh.visible = false;
    this.pool.push(item.mesh);
    if (item.tel) {
      item.tel.visible = false;
      item.tel.scale.set(1, 1, 1);
      this.telPool.push(item.tel);
      item.tel = null;
    }
    if (item.shadow) {
      item.shadow.visible = false;
      item.shadow.scale.set(1, 1, 1);
      this.shadowPool.push(item.shadow);
      item.shadow = null;
    }
  }

  _spawnPattern(z, diff, playerZ) {
    const rng = this._rng;
    const warmup = this._inWarmup(playerZ);
    const doubleChance = warmup
      ? 0
      : SPAWN.doubleChanceBase + (SPAWN.doubleChanceMax - SPAWN.doubleChanceBase) * diff;
    const count = warmup ? 1 : rng() < doubleChance ? 2 : 1;
    const blocked = pickLanes(count, rng);
    const open = [0, 1, 2].find((l) => !blocked.includes(l));

    for (const lane of blocked) {
      let type = typeForLane(lane, open, rng, warmup);
      if (!warmup && count === 2 && blocked.length === 2) {
        const other = blocked.find((l) => l !== lane);
        const otherType = typeForLane(other, open, rng, false);
        if (otherType === 'barrier' && type === 'barrier') {
          type = rng() > 0.5 ? 'sign' : 'rail';
        }
        if (otherType === 'truck' && type === 'truck') {
          type = rng() > 0.5 ? 'sign' : 'rail';
        }
      }
      const zOff = !warmup && count === 2 && rng() > 0.7 ? (rng() - 0.5) * 1.5 : 0;
      this._acquire(type, lane, z + zOff);
    }
    this.patternsSpawned += 1;
  }

  _gapForSpeed(speed, playerZ) {
    const diff = speedNorm(speed);
    if (this._inWarmup(playerZ)) {
      return (
        SPAWN.obstacleWarmupGapMin +
        this._rng() * (SPAWN.obstacleWarmupGapMax - SPAWN.obstacleWarmupGapMin)
      );
    }
    const min = SPAWN.obstacleMinGap - diff * SPAWN.obstacleGapTighten * 10;
    const max = SPAWN.obstacleMaxGap - diff * SPAWN.obstacleGapTighten * 8;
    return min + this._rng() * Math.max(10, max - min);
  }

  _minAhead(speed) {
    const diff = speedNorm(speed);
    return SPAWN.minSpawnAhead + diff * 12;
  }

  update(dt, playerZ, speed) {
    const diff = speedNorm(speed);
    const horizon = playerZ + WORLD.segmentLength * WORLD.segmentsAhead * 0.9;
    const minAhead = this._minAhead(speed);

    if (playerZ < SPAWN.runwayZ) {
      this.nextZ = Math.max(this.nextZ, SPAWN.runwayZ);
    } else {
      this.nextZ = Math.max(this.nextZ, playerZ + minAhead);
      while (this.nextZ < horizon) {
        this._spawnPattern(this.nextZ, diff, playerZ);
        this.nextZ += this._gapForSpeed(speed, playerZ);
      }
    }

    const leadDist = SPAWN.telegraphLead * (30 + diff * 10);

    for (const it of this.items) {
      if (!it.alive) continue;
      const dist = it.z - playerZ;

      if (it.tel) {
        const alpha =
          dist < leadDist && dist > 3
            ? 0.18 + 0.5 * (1 - dist / leadDist) ** 1.4
            : dist <= 3
              ? 0.55
              : 0;
        it.tel.material.opacity = alpha;
        it.tel.position.set(LANES[it.lane], 0.04, it.telZ);
        const pulse = 0.94 + Math.sin(playerZ * 0.3 + it.lane) * 0.06;
        it.tel.scale.set(pulse, pulse, 1);
      }

      if (it.shadow) {
        const shAlpha =
          dist < leadDist * 0.9 && dist > 2
            ? 0.12 + 0.38 * (1 - dist / (leadDist * 0.9))
            : dist <= 2
              ? 0.4
              : 0;
        it.shadow.material.opacity = shAlpha;
        it.shadow.position.set(LANES[it.lane], 0.03, it.shadowZ);
      }
    }

    while (this.items.length && this.items[0].z < playerZ - 14) {
      this._release(this.items.shift());
    }
  }

  collide(playerBox, jumping, sliding) {
    const shrink = SPAWN.hitboxShrink;
    const pw = playerBox.w * shrink;
    const ph = playerBox.h * shrink;
    const pd = playerBox.d * shrink;

    for (const it of this.items) {
      if (!it.alive) continue;
      const hx = it.mesh.position.x;
      const hz = it.z;
      const hy = it.hit.y;
      const hw = it.hit.w * shrink;
      const hh = it.hit.h * shrink;
      const hd = it.hit.d * shrink;
      const dx = Math.abs(playerBox.x - hx);
      const dz = Math.abs(playerBox.z - hz);
      const dy = Math.abs(playerBox.y - hy);
      if (dx < (pw + hw) * 0.5 && dz < (pd + hd) * 0.5) {
        if (it.hit.mode === 'jump' && jumping && playerBox.y > 1.05) continue;
        if (it.hit.mode === 'slide' && sliding) continue;
        if (it.hit.mode === 'jump' && !jumping) {
          if (playerBox.y + ph * 0.5 < hy - hh * 0.4) continue;
        }
        if (dy < (ph + hh) * 0.5) return it;
      }
    }
    return null;
  }

  reset() {
    while (this.items.length) this._release(this.items.shift());
    this.nextZ = SPAWN.runwayZ;
    this.patternsSpawned = 0;
    this._rng = Math.random;
  }
}
