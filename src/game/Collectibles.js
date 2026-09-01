import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD, PLAYER } from './constants.js';

const POOL_SIZE = 96;
const CAN_SCALE = 1.45;

function speedNorm(speed) {
  return Math.min(1, (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase));
}

export class Collectibles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pool = [];
    this.obstacles = null;
    this.nextZ = 14;
    this.bobT = 0;
    this.magnetRange = 4.8;
    this.magnetRangeMax = 6.2;

    this.canGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.72, 16);
    this.canMat = new THREE.MeshStandardMaterial({
      color: COLORS.canBody,
      metalness: 0.82,
      roughness: 0.2,
      emissive: COLORS.pepsiRed,
      emissiveIntensity: 0.22,
    });
    this.topMat = new THREE.MeshStandardMaterial({
      color: COLORS.canTop,
      metalness: 0.94,
      roughness: 0.1,
    });
    this.bandMat = new THREE.MeshStandardMaterial({
      color: COLORS.pepsiBlue,
      emissive: COLORS.pepsiBlue,
      emissiveIntensity: 0.45,
      metalness: 0.5,
      roughness: 0.3,
    });
    this.logoMat = new THREE.MeshStandardMaterial({
      color: COLORS.pepsiWhite,
      emissive: COLORS.pepsiWhite,
      emissiveIntensity: 0.25,
    });
    this.topGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.08, 16);
    this.bandGeo = new THREE.CylinderGeometry(0.345, 0.345, 0.14, 16, 1, true);
    this.logoGeo = new THREE.CircleGeometry(0.14, 20);

    for (let i = 0; i < POOL_SIZE; i++) {
      const g = this._createCanMesh();
      g.visible = false;
      this.scene.add(g);
      this.pool.push(g);
    }
  }

  setObstacles(obstacles) {
    this.obstacles = obstacles;
  }

  _pickOpenLane(z, preferred = 1) {
    if (this.obstacles?.openLanesNear) {
      const open = this.obstacles.openLanesNear(z, 6);
      if (open.includes(preferred)) return preferred;
      return open[(Math.random() * open.length) | 0];
    }
    return preferred;
  }

  _createCanMesh() {
    const g = new THREE.Group();
    g.scale.set(CAN_SCALE, CAN_SCALE, CAN_SCALE);

    const body = new THREE.Mesh(this.canGeo, this.canMat);
    body.castShadow = true;
    g.add(body);

    const band = new THREE.Mesh(this.bandGeo, this.bandMat);
    g.add(band);

    const top = new THREE.Mesh(this.topGeo, this.topMat);
    top.position.y = 0.38;
    g.add(top);

    const logo = new THREE.Mesh(this.logoGeo, this.logoMat);
    logo.position.set(0, 0.05, 0.35);
    g.add(logo);

    const logoBack = logo.clone();
    logoBack.position.z = -0.35;
    logoBack.rotation.y = Math.PI;
    g.add(logoBack);

    return g;
  }

  _acquire(lane, z, chainId = -1) {
    const mesh = this.pool.pop();
    if (!mesh) return null;
    mesh.visible = true;
    mesh.scale.set(CAN_SCALE, CAN_SCALE, CAN_SCALE);
    mesh.position.set(LANES[lane], 1.05, z);
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
      spin: 2.4 + Math.random() * 1.2,
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

  _spawnCluster(z, diff, forceLane = -1) {
    const lane =
      forceLane >= 0 ? forceLane : this._pickOpenLane(z, (Math.random() * 3) | 0);
    const chain = forceLane < 0 && Math.random() < SPAWN.chainChance + diff * 0.1;
    const chainId = chain ? (z * 100 + lane) | 0 : -1;

    if (chain) {
      const len = SPAWN.chainLength + ((Math.random() * 2) | 0);
      const spacing = 2.4 - diff * 0.15;
      for (let i = 0; i < len; i++) {
        const lz = z + i * spacing;
        const useLane = this._pickOpenLane(lz, lane);
        if (!this._acquire(useLane, lz, chainId)) break;
      }
    } else {
      const n = 1 + ((Math.random() * SPAWN.collectibleCluster) | 0);
      for (let i = 0; i < n; i++) {
        const lz = z + i * 2.6;
        const useLane =
          forceLane >= 0 ? forceLane : this._pickOpenLane(lz, lane);
        if (!this._acquire(useLane, lz)) break;
      }
    }
  }

  _seedStarterCans() {
    const startZ = 10;
    for (let i = 0; i < SPAWN.starterCanCount; i++) {
      this._acquire(1, startZ + i * SPAWN.starterCanSpacing);
    }
    this.nextZ = startZ + SPAWN.starterCanCount * SPAWN.starterCanSpacing + 8;
  }

  update(dt, playerZ, playerX, playerY, speed) {
    this.bobT += dt;
    const diff = speedNorm(speed);
    const inWarmup = playerZ < SPAWN.collectibleWarmupZ;
    const magnet =
      (inWarmup ? 6.2 : this.magnetRange) + diff * (this.magnetRangeMax - this.magnetRange);
    const horizon = playerZ + WORLD.segmentLength * WORLD.segmentsAhead * 0.9;

    while (this.nextZ < horizon) {
      const laneBias = inWarmup ? 1 : -1;
      this._spawnCluster(this.nextZ, diff, laneBias >= 0 && inWarmup ? 1 : -1);
      this.nextZ += (inWarmup ? 6 : 8) + Math.random() * (inWarmup ? 7 : 10) - diff * 1.2;
    }

    for (const it of this.items) {
      if (!it.alive) continue;

      if (it.popping) {
        it.popT += dt;
        const t = it.popT / 0.18;
        const s = CAN_SCALE * (1 + t * 1.4);
        it.mesh.scale.set(s, s, s);
        it.mesh.position.y += dt * 6;
        it.mesh.rotation.y += dt * 12;
        if (it.popT >= 0.18) {
          this._release(it);
        }
        continue;
      }

      const mesh = it.mesh;
      const bob = Math.sin(this.bobT * 3.5 + it.bobPhase) * 0.14;
      mesh.position.y = 1.05 + bob;
      mesh.rotation.y += dt * it.spin;

      const dx = playerX - mesh.position.x;
      const dz = playerZ - mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const pullStrength = inWarmup ? 0.65 : 0.45 + diff * 0.25;
      if (dist < magnet && dist > 0.01) {
        it.sucking = true;
        const pull = ((magnet - dist) / magnet) ** 1.25;
        const step = pull * pullStrength * dt * 60;
        mesh.position.x += dx * step * 0.2;
        mesh.position.z += dz * step * 0.2;
        mesh.position.y += (playerY + 1.1 - mesh.position.y) * step * 0.16;
        mesh.rotation.y += dt * 10;
      }
      it.z = mesh.position.z;
    }

    this.items = this.items.filter((it) => {
      if (!it.alive && !it.popping) return false;
      const z = it.mesh.position.z;
      if (!it.popping && z < playerZ - 10 && !it.sucking) {
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
      const mx = it.mesh.position.x;
      const mz = it.mesh.position.z;
      const my = it.mesh.position.y;
      const dx = Math.abs(playerBox.x - mx);
      const dz = Math.abs(playerBox.z - mz);
      const dy = Math.abs(playerBox.y + 0.5 - my);
      const laneReach = dx < 1.15;
      const trackReach = dz < 1.25;
      const heightReach = dy < 1.4;
      const sweptThrough = dz < 0.85 && dx < 2.2;
      if ((laneReach && trackReach && heightReach) || sweptThrough) {
        it.popping = true;
        it.popT = 0;
        got.push(it);
      }
    }
    return got;
  }

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
    this.nextZ = 14;
    this.bobT = 0;
    this._seedStarterCans();
  }
}
