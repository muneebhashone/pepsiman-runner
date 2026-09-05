import * as THREE from "three";
import { makeCan } from "./Art.js";
import { COLORS, LANES, SPAWN, WORLD, PLAYER, FIZZ } from "./constants.js";

const POOL_SIZE = 64;
const CAN_SCALE = 1.05;
const CAN_FLOAT_Y = 1.05;
/** Half lane spacing is 1.1 — stay well inside one lane for pickup */
const LANE_PICKUP_DX = 0.95;
const SUCK_COLLECT_DIST = 1.2;
const SUCK_HIDE_DIST = 1.2;
const MAX_SUCKING_VISUALS = 2;
const POP_DURATION = 0.16;

function speedNorm(speed) {
  return Math.min(
    1,
    (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase),
  );
}

function sameLane(playerLane, canLane, dx) {
  return playerLane === canLane && dx < LANE_PICKUP_DX;
}

export class Collectibles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pool = [];
    this.obstacles = null;
    this.nextZ = 14;
    this.bobT = 0;
    this._laneCursor = 0;
    this.magnetRange = 1.2;
    this.magnetRangeMax = 1.6;
    this.rushActive = false;

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

  _pickOpenLane(z, preferred = -1) {
    // Prefer cycling across all three lanes rather than center-only chains.
    const cycle =
      preferred >= 0
        ? preferred
        : ((this._laneCursor = (this._laneCursor || 0) + 1) - 1) % 3;
    if (this.obstacles?.openLanesNear) {
      const open = this.obstacles.openLanesNear(z, 6);
      if (!open.length) return -1;
      if (open.includes(cycle)) return cycle;
      // Prefer any open non-center lane if available, else any open
      const nonCenter = open.filter((l) => l !== 1);
      if (nonCenter.length)
        return nonCenter[(Math.random() * nonCenter.length) | 0];
      return open[(Math.random() * open.length) | 0];
    }
    return cycle >= 0 ? cycle : (Math.random() * 3) | 0;
  }

  _createCanMesh() {
    const g = makeCan();
    g.scale.setScalar(CAN_SCALE);
    // Opacity is animated per can; materials stay independent within the fixed pool.
    g.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.userData.baseTransparent = child.material.transparent;
      }
    });
    return g;
  }

  _setCanOpacity(mesh, opacity) {
    mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.transparent =
          child.material.userData.baseTransparent || opacity < 1;
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
    mesh.position.set(LANES[lane], CAN_FLOAT_Y, z);
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
    const candidates = [0, 1, 2].filter((lane) => lane !== this._lastClusterLane);
    const preferred = candidates[(Math.random() * candidates.length) | 0];
    const lane =
      forceLane >= 0
        ? forceLane
        : this._pickOpenLane(z, preferred);
    if (lane < 0) return;
    this._lastClusterLane = lane;
    const count = 4;
    for (let i = 0; i < count; i++) {
      const lz = z + i * 4.4;
      if (this.obstacles && !this.obstacles.openLanesNear(lz, 6).includes(lane))
        continue;
      if (!this._acquire(lane, lz)) break;
    }
  }

  setRushActive(active) {
    this.rushActive = active;
  }

  /** Snake cans through a jump arc or slide gutter — greed is a choice */
  spawnGreedTrail(z, lane, verb = "jump") {
    const len = 5 + ((Math.random() * 2) | 0);
    const spacing = 3.6;
    for (let i = 0; i < len; i++) {
      const lz = z + i * spacing;
      const item = this._acquire(lane, lz);
      if (!item) continue;
      const t = i / (len - 1);
      let y = CAN_FLOAT_Y;
      if (verb === "jump") y = 0.9 + Math.sin(t * Math.PI) * 2.1;
      else if (verb === "slide") y = 0.55 + (1 - t) * 0.25;
      item.mesh.position.y = y;
    }
  }

  _seedStarterCans() {
    const startZ = 10;
    // Four starter cans introduce collection without handing out a multiplier.
    for (let i = 0; i < SPAWN.starterCanCount; i++) {
      const lane = 1;
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

  update(dt, playerZ, playerX, playerY, speed, playerLane) {
    this.bobT += dt;
    const diff = speedNorm(speed);
    const inWarmup = playerZ < SPAWN.collectibleWarmupZ;
    const magnet = this.rushActive
      ? 3.8
      : (inWarmup ? 1.4 : this.magnetRange) +
        diff * (this.magnetRangeMax - this.magnetRange);
    const horizon = playerZ + 100;

    while (this.nextZ < horizon) {
      // Never force center-only; bias across all three lanes even in warmup
      this._spawnCluster(this.nextZ, diff, -1);
      this.nextZ += 24 + Math.random() * 9;
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
      const laneX = LANES[it.lane];
      const bob = Math.sin(this.bobT * 3.2 + it.bobPhase) * 0.14;
      if (!it.sucking) {
        mesh.position.set(laneX, CAN_FLOAT_Y + bob, it.z);
      }
      mesh.rotation.y += dt * it.spin;

      const dx = Math.abs(playerX - laneX);
      const dz = Math.abs(playerZ - mesh.position.z);
      const dist = Math.hypot(dx, dz);
      const inLane =
        this.rushActive && FIZZ.magnetAllLanes
          ? true
          : this.rushActive
            ? dx < LANE_PICKUP_DX * 2.8
            : sameLane(playerLane, it.lane, dx);
      const pullStrength = this.rushActive
        ? 0.62
        : inWarmup
          ? 0.32
          : 0.2 + diff * 0.12;

      if (inLane && dist < magnet && dist > 0.01) {
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
        if (this.rushActive && FIZZ.magnetAllLanes) {
          mesh.position.x += (playerX - mesh.position.x) * step * 0.28;
        } else {
          mesh.position.x = laneX;
        }
        mesh.position.z += (playerZ - mesh.position.z) * step * 0.22;
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
        mesh.position.set(laneX, CAN_FLOAT_Y + bob, it.z);
        this._setCanOpacity(mesh, 1);
      }

      it.z = mesh.position.z;
    }

    this.items = this.items.filter((it) => {
      if (!it.alive && !it.popping) return false;
      const z = it.mesh.position.z;
      if (!it.popping && z < playerZ - 2.5 && !it.sucking) {
        this._release(it);
        return false;
      }
      return true;
    });
  }

  collect(playerBox, playerLane) {
    const got = [];
    for (const it of this.items) {
      if (!it.alive || it.collected) continue;
      if (it.popping && !it.readyCollect) continue;

      const mx = LANES[it.lane];
      const mz = it.mesh.position.z;
      const my = it.mesh.position.y;
      const dx = Math.abs(playerBox.x - mx);
      const dz = Math.abs(playerBox.z - mz);
      const dy = Math.abs(playerBox.y + 0.5 - my);
      const inLane =
        this.rushActive && FIZZ.magnetAllLanes
          ? true
          : this.rushActive
            ? dx < LANE_PICKUP_DX * 2.8
            : sameLane(playerLane, it.lane, dx);
      const trackReach = dz < 1.45;
      const heightReach = dy < 1.5;
      const dist2d = Math.hypot(dx, dz);
      const suckedIn = it.sucking && inLane && dist2d < SUCK_COLLECT_DIST;
      const poppedNear =
        it.popping &&
        it.readyCollect &&
        inLane &&
        dist2d < SUCK_COLLECT_DIST + 0.35;
      const instant = it.popping && it.instantCollect && inLane;

      if (
        (inLane && trackReach && heightReach) ||
        suckedIn ||
        poppedNear ||
        instant
      ) {
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
    this._laneCursor = 0;
    this._lastClusterLane = 1;
    this.rushActive = false;
    this._seedStarterCans();
  }
}
