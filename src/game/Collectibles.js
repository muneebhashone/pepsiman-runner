import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD, PLAYER } from './constants.js';

const POOL_SIZE = 64;

function speedNorm(speed) {
  return Math.min(1, (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase));
}

export class Collectibles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pool = [];
    this.nextZ = 28;
    this.bobT = 0;
    this.magnetRange = 3.2;
    this.magnetRangeMax = 4.6;

    this.canGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.55, 12);
    this.canMat = new THREE.MeshStandardMaterial({
      color: COLORS.canBody,
      metalness: 0.8,
      roughness: 0.22,
      emissive: COLORS.pepsiRed,
      emissiveIntensity: 0.28,
    });
    this.topMat = new THREE.MeshStandardMaterial({
      color: COLORS.canTop,
      metalness: 0.92,
      roughness: 0.12,
    });
    this.stickerMat = new THREE.MeshStandardMaterial({
      color: COLORS.pepsiBlue,
      emissive: COLORS.pepsiBlue,
      emissiveIntensity: 0.55,
    });
    this.topGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12);
    this.stickerGeo = new THREE.BoxGeometry(0.5, 0.2, 0.02);

    for (let i = 0; i < POOL_SIZE; i++) {
      const g = this._createCanMesh();
      g.visible = false;
      this.scene.add(g);
      this.pool.push(g);
    }
  }

  _createCanMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.canGeo, this.canMat);
    body.castShadow = true;
    g.add(body);
    const top = new THREE.Mesh(this.topGeo, this.topMat);
    top.position.y = 0.3;
    g.add(top);
    const sticker = new THREE.Mesh(this.stickerGeo, this.stickerMat);
    sticker.position.z = 0.29;
    g.add(sticker);
    return g;
  }

  _acquire(lane, z, chainId = -1) {
    const mesh = this.pool.pop();
    if (!mesh) return null;
    mesh.visible = true;
    mesh.scale.set(1, 1, 1);
    mesh.position.set(LANES[lane], 1.0, z);
    mesh.rotation.set(0, 0, 0);

    const item = {
      lane,
      z,
      mesh,
      alive: true,
      sucking: false,
      popping: false,
      popT: 0,
      chainId,
      spin: 2.2 + Math.random() * 1.5,
      bobPhase: z * 0.18 + Math.random() * Math.PI * 2,
    };
    this.items.push(item);
    return item;
  }

  _release(item) {
    item.alive = false;
    item.sucking = false;
    item.popping = false;
    item.mesh.visible = false;
    this.pool.push(item.mesh);
  }

  _spawnCluster(z, diff) {
    const lane = (Math.random() * 3) | 0;
    const chain = Math.random() < SPAWN.chainChance + diff * 0.15;
    const chainId = chain ? (z * 100 + lane) | 0 : -1;

    if (chain) {
      const len = SPAWN.chainLength + ((Math.random() * 3) | 0);
      const spacing = 2.0 - diff * 0.25;
      for (let i = 0; i < len; i++) {
        this._acquire(lane, z + i * spacing, chainId);
      }
    } else {
      const n = 1 + ((Math.random() * SPAWN.collectibleCluster) | 0);
      for (let i = 0; i < n; i++) {
        const useLane = Math.random() > 0.65 ? (Math.random() * 3) | 0 : lane;
        this._acquire(useLane, z + i * 2.1);
      }
    }
  }

  update(dt, playerZ, playerX, playerY, speed) {
    this.bobT += dt;
    const diff = speedNorm(speed);
    const magnet = this.magnetRange + diff * (this.magnetRangeMax - this.magnetRange);
    const horizon = playerZ + WORLD.segmentLength * WORLD.segmentsAhead * 0.85;

    while (this.nextZ < horizon) {
      if (Math.random() < SPAWN.collectibleChance + diff * 0.08) {
        this._spawnCluster(this.nextZ, diff);
      }
      this.nextZ += 9 + Math.random() * 12 - diff * 2;
    }

    for (const it of this.items) {
      if (!it.alive) continue;

      if (it.popping) {
        it.popT += dt;
        const t = it.popT / 0.18;
        const s = 1 + t * 1.4;
        it.mesh.scale.set(s, s, s);
        it.mesh.position.y += dt * 6;
        it.mesh.rotation.y += dt * 12;
        if (it.popT >= 0.18) {
          this._release(it);
        }
        continue;
      }

      const mesh = it.mesh;
      const bob = Math.sin(this.bobT * 3.5 + it.bobPhase) * 0.18;
      mesh.position.y = 1.0 + bob;
      mesh.rotation.y += dt * it.spin;
      mesh.rotation.z = Math.sin(this.bobT * 2 + it.bobPhase) * 0.08;

      const dx = playerX - mesh.position.x;
      const dz = playerZ - mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < magnet && dist > 0.01) {
        it.sucking = true;
        const pull = ((magnet - dist) / magnet) ** 1.5;
        const step = pull * (0.35 + diff * 0.2) * dt * 60;
        mesh.position.x += dx * step * 0.12;
        mesh.position.z += dz * step * 0.12;
        mesh.position.y += (playerY + 1.05 - mesh.position.y) * step * 0.1;
        mesh.rotation.y += dt * 8;
      }
    }

    this.items = this.items.filter((it) => {
      if (!it.alive && !it.popping) return false;
      if (!it.popping && it.z < playerZ - 12 && !it.sucking) {
        this._release(it);
        return false;
      }
      return true;
    });
  }

  collect(playerBox) {
    const got = [];
    for (const it of this.items) {
      if (!it.alive || it.popping) continue;
      const dx = Math.abs(playerBox.x - it.mesh.position.x);
      const dz = Math.abs(playerBox.z - it.mesh.position.z);
      const dy = Math.abs(playerBox.y - it.mesh.position.y);
      if (dx < 0.9 && dz < 0.9 && dy < 1.5) {
        it.popping = true;
        it.popT = 0;
        got.push(it);
      }
    }
    return got;
  }

  /** Chain bonus: consecutive same-chain pickups in one frame tick */
  chainBonus(got) {
    if (got.length < 2) return 0;
    const chains = new Map();
    for (const it of got) {
      if (it.chainId < 0) continue;
      chains.set(it.chainId, (chains.get(it.chainId) || 0) + 1);
    }
    let bonus = 0;
    for (const n of chains.values()) {
      if (n >= 3) bonus += (n - 2) * 25;
    }
    return bonus;
  }

  reset() {
    for (const it of [...this.items]) this._release(it);
    this.items = [];
    this.nextZ = 28;
    this.bobT = 0;
  }
}
