import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD, PLAYER } from './constants.js';

const TYPES = ['barrier', 'rail', 'sign', 'truck'];
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

function typeForLane(lane, openLane, rng) {
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
    this.nextZ = 42;
    this._rng = Math.random;

    this._geo = {
      barrier: new THREE.BoxGeometry(1.6, 1.1, 0.5),
      rail: new THREE.BoxGeometry(1.8, 0.45, 1.2),
      sign: new THREE.BoxGeometry(1.9, 1.4, 0.3),
      pole: new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8),
      truckCab: new THREE.BoxGeometry(1.8, 1.6, 1.4),
      truckBody: new THREE.BoxGeometry(1.9, 2.0, 3.2),
      tel: new THREE.PlaneGeometry(2.0, 8),
      shadow: new THREE.PlaneGeometry(1.6, 2.4),
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
      this.scene.add(tel);
      this.telPool.push(tel);

      const sh = new THREE.Mesh(this._geo.shadow, this._mats.shadow.clone());
      sh.rotation.x = -Math.PI / 2;
      sh.visible = false;
      this.scene.add(sh);
      this.shadowPool.push(sh);
    }
  }

  _buildMesh(type) {
    const g = new THREE.Group();
    let hit = { w: 1.4, h: 1.1, d: 0.6, y: 0.55, mode: 'block' };

    if (type === 'barrier') {
      const m = new THREE.Mesh(this._geo.barrier, this._mats.barrier);
      m.position.y = 0.55;
      m.castShadow = true;
      g.add(m);
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.2, 0.52), this._mats.stripe);
      s.position.y = 0.7;
      g.add(s);
      hit = { w: 1.5, h: 1.1, d: 0.55, y: 0.55, mode: 'block' };
    } else if (type === 'rail') {
      const m = new THREE.Mesh(this._geo.rail, this._mats.rail);
      m.position.y = 0.25;
      m.castShadow = true;
      g.add(m);
      hit = { w: 1.7, h: 0.5, d: 1.1, y: 0.25, mode: 'slide' };
    } else if (type === 'sign') {
      const pole = new THREE.Mesh(this._geo.pole, this._mats.rail);
      pole.position.set(-0.7, 1.1, 0);
      g.add(pole);
      const m = new THREE.Mesh(this._geo.sign, this._mats.sign);
      m.position.y = 2.0;
      m.castShadow = true;
      g.add(m);
      hit = { w: 1.8, h: 1.2, d: 0.4, y: 2.0, mode: 'jump' };
    } else {
      const cab = new THREE.Mesh(this._geo.truckCab, this._mats.truckCab);
      cab.position.set(0, 1.0, 1.4);
      cab.castShadow = true;
      g.add(cab);
      const body = new THREE.Mesh(this._geo.truckBody, this._mats.truckBody);
      body.position.set(0, 1.2, -0.6);
      body.castShadow = true;
      g.add(body);
      hit = { w: 1.85, h: 2.1, d: 3.5, y: 1.1, mode: 'block' };
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

    const tel = this.telPool.pop();
    if (tel) {
      tel.visible = true;
      tel.material.opacity = 0;
      tel.position.set(LANES[lane], 0.03, z - 5);
    }

    const shadow = this.shadowPool.pop();
    if (shadow) {
      shadow.visible = true;
      shadow.material.opacity = 0;
      shadow.position.set(LANES[lane], 0.025, z - 3.5);
      const scale =
        type === 'sign' ? 1.3 : type === 'rail' ? 0.7 : type === 'truck' ? 1.5 : 1.0;
      shadow.scale.set(scale, scale * (type === 'sign' ? 1.4 : 1), 1);
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
      telZ: z - 5,
      shadowZ: z - 3.5,
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
      this.telPool.push(item.tel);
      item.tel = null;
    }
    if (item.shadow) {
      item.shadow.visible = false;
      this.shadowPool.push(item.shadow);
      item.shadow = null;
    }
  }

  _spawnPattern(z, diff) {
    const rng = this._rng;
    const doubleChance =
      SPAWN.doubleChanceBase + (SPAWN.doubleChanceMax - SPAWN.doubleChanceBase) * diff;
    const count = rng() < doubleChance ? 2 : 1;
    const blocked = pickLanes(count, rng);
    const open = [0, 1, 2].find((l) => !blocked.includes(l));

    for (const lane of blocked) {
      let type = typeForLane(lane, open, rng);
      if (count === 2 && blocked.length === 2) {
        const other = blocked.find((l) => l !== lane);
        const otherType = typeForLane(other, open, rng);
        if (otherType === 'barrier' && type === 'barrier') {
          type = rng() > 0.5 ? 'sign' : 'rail';
        }
        if (otherType === 'truck' && type === 'truck') {
          type = rng() > 0.5 ? 'sign' : 'rail';
        }
      }
      const zOff = count === 2 && rng() > 0.6 ? (rng() - 0.5) * 2.5 : 0;
      this._acquire(type, lane, z + zOff);
    }
  }

  _gapForSpeed(speed) {
    const diff = speedNorm(speed);
    const min = SPAWN.obstacleMinGap - diff * SPAWN.obstacleGapTighten * 12;
    const max = SPAWN.obstacleMaxGap - diff * SPAWN.obstacleGapTighten * 10;
    return min + this._rng() * Math.max(6, max - min);
  }

  update(dt, playerZ, speed) {
    const diff = speedNorm(speed);
    const horizon = playerZ + WORLD.segmentLength * WORLD.segmentsAhead * 0.9;

    while (this.nextZ < horizon) {
      this._spawnPattern(this.nextZ, diff);
      this.nextZ += this._gapForSpeed(speed);
    }

    const leadDist = SPAWN.telegraphLead * (22 + diff * 10);

    for (const it of this.items) {
      if (!it.alive) continue;
      const dist = it.z - playerZ;

      if (it.tel) {
        const alpha =
          dist < leadDist && dist > 2
            ? 0.12 + 0.5 * (1 - dist / leadDist) ** 1.6
            : dist <= 2
              ? 0.55
              : 0;
        it.tel.material.opacity = alpha;
        it.tel.position.z = it.telZ;
        const pulse = 0.92 + Math.sin(playerZ * 0.35 + it.lane) * 0.08;
        it.tel.scale.set(pulse, pulse, 1);
      }

      if (it.shadow) {
        const shAlpha =
          dist < leadDist * 0.85 && dist > 1.5
            ? 0.08 + 0.35 * (1 - dist / (leadDist * 0.85))
            : dist <= 1.5
              ? 0.42
              : 0;
        it.shadow.material.opacity = shAlpha;
        it.shadow.position.z = it.shadowZ;
      }
    }

    while (this.items.length && this.items[0].z < playerZ - 14) {
      this._release(this.items.shift());
    }
  }

  collide(playerBox, jumping, sliding) {
    for (const it of this.items) {
      if (!it.alive) continue;
      const hx = it.mesh.position.x;
      const hz = it.z;
      const hy = it.hit.y;
      const dx = Math.abs(playerBox.x - hx);
      const dz = Math.abs(playerBox.z - hz);
      const dy = Math.abs(playerBox.y - hy);
      if (dx < (playerBox.w + it.hit.w) * 0.5 && dz < (playerBox.d + it.hit.d) * 0.5) {
        if (it.hit.mode === 'jump' && jumping && playerBox.y > 1.0) continue;
        if (it.hit.mode === 'slide' && sliding) continue;
        if (it.hit.mode === 'jump' && !jumping) {
          if (playerBox.y + playerBox.h * 0.5 < hy - it.hit.h * 0.35) continue;
        }
        if (dy < (playerBox.h + it.hit.h) * 0.5) return it;
      }
    }
    return null;
  }

  reset() {
    while (this.items.length) this._release(this.items.shift());
    this.nextZ = 42;
    this._rng = Math.random;
  }
}
