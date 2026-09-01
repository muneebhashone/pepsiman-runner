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

function pickVerticalType(rng) {
  const roll = rng();
  if (roll < 0.42) return 'rail';
  if (roll < 0.72) return 'barrier';
  return 'sign';
}

function typeForLane(lane, openLane, rng, warmup) {
  if (warmup) return WARMUP_TYPES[(rng() * WARMUP_TYPES.length) | 0];
  if (lane === openLane) {
    if (rng() < SPAWN.verticalObstacleBias) return pickVerticalType(rng);
    return TYPES[(rng() * TYPES.length) | 0];
  }
  if (rng() < SPAWN.verticalObstacleBias * 0.85) return pickVerticalType(rng);
  const blockTypes = ['barrier', 'truck', 'sign', 'rail'];
  return blockTypes[(rng() * blockTypes.length) | 0];
}

const SLIDE_TYPES = ['rail'];

/** After rotation.x = -PI/2, PlaneGeometry width → world X, height → world +Z. */
function telegraphColorsFor(type) {
  if (SLIDE_TYPES.includes(type)) {
    return { core: COLORS.telegraphSlide, glow: COLORS.telegraphSlideGlow };
  }
  return { core: COLORS.pepsiRed, glow: COLORS.telegraphGlow };
}

function makeTelegraphMat(color, opacity = 0) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  return mat;
}

function makeTelegraphGlowMat(color, opacity = 0) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  return mat;
}

function layFlatOnRoad(mesh) {
  mesh.rotation.set(-Math.PI / 2, 0, 0);
}

function setTelMaterial(mesh, color, glow = false) {
  if (mesh.material?.dispose) mesh.material.dispose();
  mesh.material = glow ? makeTelegraphGlowMat(color) : makeTelegraphMat(color);
}

function chevronGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.38, 0);
  shape.lineTo(0, 0.5);
  shape.lineTo(0.38, 0);
  shape.lineTo(0.2, 0);
  shape.lineTo(0, 0.24);
  shape.lineTo(-0.2, 0);
  shape.lineTo(-0.38, 0);
  return new THREE.ShapeGeometry(shape);
}

export class Obstacles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pool = [];
    this.telPool = [];
    this.telOuterPool = [];
    this.shadowPool = [];
    this.chevronPool = [];
    this.nextZ = SPAWN.runwayZ;
    this.patternsSpawned = 0;
    this._pulseT = 0;
    this._rng = Math.random;

    this._geo = {
      barrier: new THREE.BoxGeometry(1.6, 1.1, 0.5),
      rail: new THREE.BoxGeometry(1.85, 0.35, 1.0),
      sign: new THREE.BoxGeometry(1.7, 0.9, 0.45),
      truckCab: new THREE.BoxGeometry(1.8, 1.6, 1.4),
      truckBody: new THREE.BoxGeometry(1.9, 2.0, 3.2),
      tel: new THREE.PlaneGeometry(SPAWN.telegraphStripWidth, SPAWN.telegraphStripLength),
      telOuter: new THREE.PlaneGeometry(SPAWN.telegraphStripWidth * 1.55, SPAWN.telegraphStripLength * 1.4),
      shadow: new THREE.PlaneGeometry(1.3, 1.8),
      chevron: chevronGeometry(),
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
        metalness: 0.7,
        roughness: 0.3,
        emissive: 0x334455,
        emissiveIntensity: 0.2,
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
      signTop: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.25,
      }),
      telegraph: makeTelegraphMat(COLORS.telegraph),
      telegraphOuter: makeTelegraphGlowMat(COLORS.telegraphGlow),
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

      const tel = new THREE.Mesh(this._geo.tel, makeTelegraphMat(COLORS.pepsiRed));
      layFlatOnRoad(tel);
      tel.visible = false;
      tel.frustumCulled = false;
      tel.renderOrder = 48;
      this.scene.add(tel);
      this.telPool.push(tel);

      const telOuter = new THREE.Mesh(this._geo.telOuter, makeTelegraphGlowMat(COLORS.telegraphGlow));
      layFlatOnRoad(telOuter);
      telOuter.visible = false;
      telOuter.frustumCulled = false;
      telOuter.renderOrder = 47;
      this.scene.add(telOuter);
      this.telOuterPool.push(telOuter);

      const sh = new THREE.Mesh(this._geo.shadow, this._mats.shadow.clone());
      layFlatOnRoad(sh);
      sh.visible = false;
      sh.frustumCulled = false;
      this.scene.add(sh);
      this.shadowPool.push(sh);
    }

    const chevCount = POOL_SIZE * SPAWN.telegraphChevronCount;
    for (let i = 0; i < chevCount; i++) {
      const chev = new THREE.Mesh(this._geo.chevron, makeTelegraphMat(COLORS.pepsiRed));
      layFlatOnRoad(chev);
      chev.visible = false;
      chev.frustumCulled = false;
      chev.renderOrder = 49;
      this.scene.add(chev);
      this.chevronPool.push(chev);
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

  _ensureTelMesh(pool, geo, color, renderOrder, glow = false) {
    let mesh = pool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(geo, makeTelegraphMat(color));
      layFlatOnRoad(mesh);
      mesh.frustumCulled = false;
      mesh.renderOrder = renderOrder;
      this.scene.add(mesh);
    }
    setTelMaterial(mesh, color, glow);
    layFlatOnRoad(mesh);
    return mesh;
  }

  _ensureChevron(coreColor) {
    let chev = this.chevronPool.pop();
    if (!chev) {
      chev = new THREE.Mesh(this._geo.chevron, makeTelegraphMat(coreColor));
      layFlatOnRoad(chev);
      chev.frustumCulled = false;
      chev.renderOrder = 49;
      this.scene.add(chev);
    }
    setTelMaterial(chev, coreColor, false);
    layFlatOnRoad(chev);
    return chev;
  }

  _applyTelColors(mesh, colors) {
    mesh.material.color.setHex(colors.core);
    mesh.material.opacity = 0;
  }

  _applyTelOuterColors(mesh, colors) {
    mesh.material.color.setHex(colors.glow);
    mesh.material.opacity = 0;
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
      hit = { w: 1.1, h: 0.95, d: 0.42, y: 0.55, mode: 'jump' };
    } else if (type === 'rail') {
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), this._mats.rail);
      postL.position.set(-0.85, 0.75, 0);
      const postR = postL.clone();
      postR.position.x = 0.85;
      g.add(postL, postR);
      const m = new THREE.Mesh(this._geo.rail, this._mats.rail);
      m.position.y = 1.35;
      m.castShadow = true;
      g.add(m);
      hit = { w: 1.3, h: 0.38, d: 0.8, y: 1.35, mode: 'slide' };
    } else if (type === 'sign') {
      const m = new THREE.Mesh(this._geo.sign, this._mats.sign);
      m.position.y = 0.5;
      m.castShadow = true;
      g.add(m);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.15, 0.5), this._mats.signTop);
      top.position.y = 1.0;
      g.add(top);
      hit = { w: 1.35, h: 0.95, d: 0.42, y: 0.55, mode: 'jump' };
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

    const colors = telegraphColorsFor(type);

    const tel = this._ensureTelMesh(this.telPool, this._geo.tel, colors.core, 48, false);
    tel.visible = true;
    layFlatOnRoad(tel);
    tel.position.set(LANES[lane], 0.08, z);
    tel.scale.set(1, 1, 1);
    this._applyTelColors(tel, colors);

    const telOuter = this._ensureTelMesh(
      this.telOuterPool,
      this._geo.telOuter,
      colors.glow,
      47,
      true
    );
    telOuter.visible = true;
    layFlatOnRoad(telOuter);
    telOuter.position.set(LANES[lane], 0.07, z);
    telOuter.scale.set(1, 1, 1);
    this._applyTelOuterColors(telOuter, colors);

    const shadow = this.shadowPool.pop();
    if (shadow) {
      shadow.visible = true;
      shadow.material.opacity = 0;
      shadow.rotation.set(-Math.PI / 2, 0, 0);
      shadow.scale.set(1, 1, 1);
      shadow.position.set(LANES[lane], 0.06, z);
      const scale =
        type === 'sign' ? 1.15 : type === 'rail' ? 0.65 : type === 'truck' ? 1.25 : 0.9;
      shadow.scale.set(scale, scale * (type === 'sign' ? 1.2 : 1), 1);
    }

    const chevrons = [];
    for (let ci = 0; ci < SPAWN.telegraphChevronCount; ci++) {
      const chev = this._ensureChevron(colors.core);
      chev.visible = true;
      layFlatOnRoad(chev);
      chev.position.set(LANES[lane], 0.09, z);
      chev.scale.set(1, 1, 1);
      this._applyTelColors(chev, colors);
      chevrons.push(chev);
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
      telOuter,
      shadow,
      chevrons,
      telColors: colors,
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
    if (item.telOuter) {
      item.telOuter.visible = false;
      item.telOuter.scale.set(1, 1, 1);
      this.telOuterPool.push(item.telOuter);
      item.telOuter = null;
    }
    if (item.shadow) {
      item.shadow.visible = false;
      item.shadow.scale.set(1, 1, 1);
      this.shadowPool.push(item.shadow);
      item.shadow = null;
    }
    if (item.chevrons) {
      for (const chev of item.chevrons) {
        chev.visible = false;
        chev.scale.set(1, 1, 1);
        this.chevronPool.push(chev);
      }
      item.chevrons = [];
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
        if (otherType === 'rail' && type === 'rail') {
          type = rng() > 0.5 ? 'barrier' : 'sign';
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
    const leadDist = speed * SPAWN.telegraphLead;
    const reaction = SPAWN.telegraphReactionMargin + diff * 6;
    return Math.max(SPAWN.minSpawnAhead + diff * 12, leadDist + reaction);
  }

  update(dt, playerZ, speed) {
    this._pulseT += dt;
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

    const leadDist = speed * SPAWN.telegraphLead;
    const minAlpha = SPAWN.telegraphMinAlpha;
    const pulse = 0.82 + Math.sin(this._pulseT * 11) * 0.18;
    const blink = 0.9 + Math.sin(this._pulseT * 14) * 0.1;
    const baseLength = SPAWN.telegraphStripLength;

    for (const it of this.items) {
      if (!it.alive) continue;
      const dist = it.z - playerZ;
      const inWarn = dist > 0 && dist <= leadDist;
      const urgency = inWarn ? 1 - dist / leadDist : 0;
      const laneX = LANES[it.lane];
      const colors = it.telColors ?? telegraphColorsFor(it.type);

      const stripEndZ = it.z;
      const stripStartZ = Math.max(playerZ + 0.5, it.z - leadDist);
      const activeLen = Math.min(leadDist, stripEndZ - stripStartZ);
      const showStrip = inWarn && activeLen > 0.35;
      const stripCenterZ = stripStartZ + activeLen * 0.5;
      const widthScale = 1 + urgency * 0.06;
      const lengthScale = activeLen / baseLength;
      const alpha = showStrip
        ? Math.min(1, (minAlpha + (1 - minAlpha) * urgency ** 0.55) * blink)
        : 0;

      if (it.tel) {
        layFlatOnRoad(it.tel);
        it.tel.visible = showStrip;
        it.tel.material.opacity = alpha;
        it.tel.material.color.setHex(colors.core);
        it.tel.position.set(laneX, 0.08, stripCenterZ);
        it.tel.scale.set(widthScale, Math.max(0.12, lengthScale), 1);
      }

      if (it.telOuter) {
        layFlatOnRoad(it.telOuter);
        it.telOuter.visible = showStrip;
        it.telOuter.material.opacity = showStrip ? Math.min(1, alpha * 0.65 * pulse) : 0;
        it.telOuter.material.color.setHex(colors.glow);
        it.telOuter.position.set(laneX, 0.07, stripCenterZ);
        it.telOuter.scale.set(widthScale * 1.06, Math.max(0.14, lengthScale * 1.04), 1);
      }

      if (it.shadow) {
        layFlatOnRoad(it.shadow);
        it.shadow.visible = showStrip;
        it.shadow.material.opacity = showStrip ? 0.18 + 0.3 * urgency : 0;
        it.shadow.position.set(laneX, 0.06, stripStartZ + activeLen * 0.72);
      }

      if (it.chevrons?.length) {
        for (let ci = 0; ci < it.chevrons.length; ci++) {
          const chev = it.chevrons[ci];
          layFlatOnRoad(chev);
          const t = (ci + 0.55) / (it.chevrons.length + 0.1);
          const chevZ = stripStartZ + activeLen * t;
          const chevInWarn = inWarn && chevZ > playerZ + 0.25 && chevZ <= it.z;
          const chevUrg = chevInWarn ? 1 - (it.z - chevZ) / leadDist : 0;
          const chevPulse = 0.75 + Math.sin(this._pulseT * 13 + ci * 0.85) * 0.25;
          chev.visible = chevInWarn && chevUrg > 0.04;
          chev.material.opacity = chev.visible
            ? Math.min(1, (minAlpha + (1 - minAlpha) * chevUrg ** 0.5) * chevPulse)
            : 0;
          chev.material.color.setHex(colors.core);
          chev.position.set(laneX, 0.09, chevZ);
          const s = 1 + chevUrg * 0.75;
          chev.scale.set(s, s, 1);
        }
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
      if (dx >= (pw + hw) * 0.5 || dz >= (pd + hd) * 0.5) continue;

      if (it.hit.mode === 'slide' && sliding) continue;
      if (it.hit.mode === 'jump' && jumping && playerBox.y > 0.9) continue;

      const dy = Math.abs(playerBox.y - hy);
      if (dy < (ph + hh) * 0.5) return it;
    }
    return null;
  }

  reset() {
    while (this.items.length) this._release(this.items.shift());
    this.nextZ = SPAWN.runwayZ;
    this.patternsSpawned = 0;
    this._pulseT = 0;
    this._rng = Math.random;
  }
}
