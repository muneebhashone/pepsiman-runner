import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD, PLAYER } from './constants.js';

const POOL_SIZE = 96;
const CAN_SCALE = 1.45;
const SUCK_COLLECT_DIST = 2.5;
const SUCK_HIDE_DIST = 2.5;
const MAX_SUCKING_VISUALS = 2;
const POP_DURATION = 0.16;

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
    this.magnetRange = 2.8;
    this.magnetRangeMax = 4.2;

    this.canGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.72, 16);
    this.canMat = new THREE.MeshStandardMaterial({
      color: COLORS.canBody,
      metalness: 0.72,
      roughness: 0.16,
      emissive: COLORS.canBody,
      emissiveIntensity: 0.48,
    });
    this.topMat = new THREE.MeshStandardMaterial({
      color: COLORS.canTop,
      metalness: 0.94,
      roughness: 0.08,
      emissive: COLORS.canTop,
      emissiveIntensity: 0.22,
    });
    this.bandMat = new THREE.MeshStandardMaterial({
      color: COLORS.pepsiBlue,
      emissive: COLORS.pepsiBlue,
      emissiveIntensity: 0.72,
      metalness: 0.5,
      roughness: 0.25,
    });
    this.logoMat = new THREE.MeshStandardMaterial({
      color: COLORS.pepsiWhite,
      emissive: COLORS.pepsiWhite,
      emissiveIntensity: 0.55,
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

    const body = new THREE.Mesh(this.canGeo, this.canMat.clone());
    body.castShadow = true;
    g.add(body);

    const band = new THREE.Mesh(this.bandGeo, this.bandMat.clone());
    g.add(band);

    const top = new THREE.Mesh(this.topGeo, this.topMat.clone());
    top.position.y = 0.38;
    g.add(top);

    const logo = new THREE.Mesh(this.logoGeo, this.logoMat.clone());
    logo.position.set(0, 0.05, 0.35);
    g.add(logo);

    const logoBack = logo.clone();
    logoBack.position.z = -0.35;
    logoBack.rotation.y = Math.PI;
    g.add(logoBack);

    return g;
  }

  _setCanOpacity(mesh, opacity) {
    mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.transparent = opacity < 1;
        child.material.opacity = opacity;
      }
    });
  }

  _countSuckingVisuals() {
    let n = 0;
    for (const it of this.items) {
      if (it.alive && it.sucking && !it.popping) n++;
    }
    return n;
  }

  _acquire(lane, z, chainId = -1) {
    const mesh = this.pool.pop();
    if (!mesh) return null;
    mesh.visible = true;
    mesh.scale.set(CAN_SCALE, CAN_SCALE, CAN_SCALE);
    mesh.position.set(LANES[lane], 1.18, z);
    mesh.rotation.set(0, 0, 0);
    this._setCanOpacity(mesh, 1);

    const item = {
      lane,
      z,
      mesh,
      alive: true,
      sucking: false,
      suckT: 0,
      popping: false,
      popT: 0,
      chainId,
      spin: 2.4 + Math.random() * 1.2,
      bobPhase: z * 0.18 + Math.random() * Math.PI * 2,
      readyCollect: false,
      instantCollect: false,
      collected: false,
    };
    this.items.push(item);
    return item;
  }

  _release(item) {
    item.alive = false;
    item.sucking = false;
    item.suckT = 0;
    item.popping = false;
    item.readyCollect = false;
    item.instantCollect = false;
    item.collected = false;
    item.mesh.visible = false;
    this._setCanOpacity(item.mesh, 1);
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
        const useLane = this._pickOpenLane(lz, (Math.random() * 3) | 0);
        if (!this._acquire(useLane, lz, chainId)) break;
      }
    } else {
      const n = 1 + ((Math.random() * SPAWN.collectibleCluster) | 0);
      for (let i = 0; i < n; i++) {
        const lz = z + i * 2.6;
        const useLane =
          forceLane >= 0
            ? forceLane
            : this._pickOpenLane(lz, ((i + lane) % 3));
        if (!this._acquire(useLane, lz)) break;
      }
    }
  }

  _seedStarterCans() {
    const startZ = 10;
    const lanes = [0, 1, 2];
    for (let i = 0; i < SPAWN.starterCanCount; i++) {
      const lane = lanes[i % lanes.length];
      this._acquire(lane, startZ + i * SPAWN.starterCanSpacing);
    }
    this.nextZ = startZ + SPAWN.starterCanCount * SPAWN.starterCanSpacing + 8;
  }

  _beginPop(item, hideMesh = false, instantCollect = false) {
    item.popping = true;
    item.popT = 0;
    item.sucking = false;
    item.suckT = 0;
    item.readyCollect = true;
    item.instantCollect = instantCollect;
    if (hideMesh) item.mesh.visible = false;
    this._setCanOpacity(item.mesh, hideMesh ? 0 : 1);
  }

  update(dt, playerZ, playerX, playerY, speed) {
    this.bobT += dt;
    const diff = speedNorm(speed);
    const inWarmup = playerZ < SPAWN.collectibleWarmupZ;
    const magnet =
      (inWarmup ? 3.6 : this.magnetRange) + diff * (this.magnetRangeMax - this.magnetRange);
    const horizon = playerZ + WORLD.segmentLength * WORLD.segmentsAhead * 0.9;

    while (this.nextZ < horizon) {
      this._spawnCluster(this.nextZ, diff, -1);
      this.nextZ += (inWarmup ? 6 : 8) + Math.random() * (inWarmup ? 7 : 10) - diff * 1.2;
    }

    for (const it of this.items) {
      if (!it.alive) continue;

      if (it.popping) {
        it.popT += dt;
        const t = it.popT / POP_DURATION;
        if (it.mesh.visible) {
          const s = CAN_SCALE * (1 + t * 1.4);
          it.mesh.scale.set(s, s, s);
          it.mesh.position.y += dt * 6;
          it.mesh.rotation.y += dt * 12;
        }
        if (it.popT >= POP_DURATION) {
          this._release(it);
        }
        continue;
      }

      const mesh = it.mesh;
      const bob = Math.sin(this.bobT * 3.8 + it.bobPhase) * 0.22;
      if (!it.sucking) {
        mesh.position.y = 1.18 + bob;
      }
      mesh.rotation.y += dt * it.spin;

      const dx = playerX - mesh.position.x;
      const dz = playerZ - mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const pullStrength = inWarmup ? 0.38 : 0.24 + diff * 0.16;

      if (dist < magnet && dist > 0.01) {
        if (dist <= SUCK_HIDE_DIST) {
          this._beginPop(it, true);
          continue;
        }

        const suckingCount = this._countSuckingVisuals();
        if (!it.sucking && suckingCount >= MAX_SUCKING_VISUALS) {
          this._beginPop(it, true, true);
          continue;
        }

        it.sucking = true;
        it.suckT += dt;
        const pull = ((magnet - dist) / magnet) ** 1.15;
        const step = pull * pullStrength * dt * 60;
        mesh.position.x += dx * step * 0.22;
        mesh.position.z += dz * step * 0.22;
        const targetY = playerY + 1.35;
        mesh.position.y += (targetY - mesh.position.y) * step * 0.14;
        mesh.rotation.y += dt * 12;

        const shrink = THREE.MathUtils.clamp(1 - pull * 0.82, 0.12, 1);
        const s = CAN_SCALE * shrink;
        mesh.scale.set(s, s, s);
        const fade = THREE.MathUtils.clamp(1 - pull * 0.95, 0.08, 1);
        this._setCanOpacity(mesh, fade);

        if (dist <= SUCK_HIDE_DIST + 0.35) {
          this._beginPop(it, true);
        }
      } else if (it.sucking) {
        it.sucking = false;
        it.suckT = 0;
        mesh.scale.set(CAN_SCALE, CAN_SCALE, CAN_SCALE);
        this._setCanOpacity(mesh, 1);
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
      if (!it.alive || it.collected) continue;
      if (it.popping && !it.readyCollect) continue;

      const mx = it.mesh.position.x;
      const mz = it.mesh.position.z;
      const my = it.mesh.position.y;
      const dx = Math.abs(playerBox.x - mx);
      const dz = Math.abs(playerBox.z - mz);
      const dy = Math.abs(playerBox.y + 0.5 - my);
      const laneReach = dx < 1.35;
      const trackReach = dz < 1.45;
      const heightReach = dy < 1.5;
      const sweptThrough = dz < 1.0 && dx < 2.4;
      const dist2d = Math.hypot(dx, dz);
      const suckedIn = it.sucking && dist2d < SUCK_COLLECT_DIST;
      const poppedNear = it.popping && it.readyCollect && dist2d < SUCK_COLLECT_DIST + 0.5;
      const instant = it.popping && it.instantCollect;

      if ((laneReach && trackReach && heightReach) || sweptThrough || suckedIn || poppedNear || instant) {
        if (!it.popping) this._beginPop(it, true);
        it.collected = true;
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
