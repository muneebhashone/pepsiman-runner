import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD } from './constants.js';

const TYPES = ['barrier', 'rail', 'sign', 'truck'];

const TELEGRAPH_COLORS = {
  barrier: { core: 0xffaa00, glow: 0xff6600 },
  rail: { core: 0x00e5ff, glow: 0x0088cc },
  sign: { core: 0xff4466, glow: 0xff1133 },
  truck: { core: 0xff2244, glow: 0xaa0022 },
};

export class Obstacles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.nextZ = 40;
    this._pulseT = 0;
    this._geo = {
      barrier: new THREE.BoxGeometry(1.6, 1.1, 0.5),
      rail: new THREE.BoxGeometry(1.8, 0.45, 1.2),
      sign: new THREE.BoxGeometry(1.9, 1.4, 0.3),
      truckCab: new THREE.BoxGeometry(1.8, 1.6, 1.4),
      truckBody: new THREE.BoxGeometry(1.9, 2.0, 3.2),
    };
    this._mats = {
      barrier: new THREE.MeshStandardMaterial({
        color: COLORS.barrier,
        emissive: COLORS.barrier,
        emissiveIntensity: 0.25,
        metalness: 0.3,
        roughness: 0.45,
      }),
      rail: new THREE.MeshStandardMaterial({
        color: COLORS.rail,
        metalness: 0.7,
        roughness: 0.3,
      }),
      sign: new THREE.MeshStandardMaterial({
        color: COLORS.sign,
        emissive: COLORS.sign,
        emissiveIntensity: 0.3,
        metalness: 0.2,
        roughness: 0.5,
      }),
      truckCab: new THREE.MeshStandardMaterial({
        color: COLORS.truckCab,
        metalness: 0.5,
        roughness: 0.35,
      }),
      truckBody: new THREE.MeshStandardMaterial({
        color: COLORS.truckTrailer,
        emissive: COLORS.pepsiBlue,
        emissiveIntensity: 0.15,
        metalness: 0.4,
        roughness: 0.4,
      }),
    };
  }

  _glowMat(color, opacity = 0.5) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  _makeTelegraph(lane, z, type) {
    const colors = TELEGRAPH_COLORS[type] || TELEGRAPH_COLORS.barrier;
    const g = new THREE.Group();
    g.position.set(LANES[lane], 0, z - 5);

    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 12),
      this._glowMat(colors.glow, 0.22)
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = 0.03;
    g.add(outer);

    const core = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 12),
      this._glowMat(colors.core, 0.45)
    );
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.04;
    g.add(core);

    const edgeL = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 12),
      this._glowMat(0xffffff, 0.55)
    );
    edgeL.rotation.x = -Math.PI / 2;
    edgeL.position.set(-0.82, 0.05, 0);
    g.add(edgeL);

    const edgeR = edgeL.clone();
    edgeR.position.x = 0.82;
    g.add(edgeR);

    for (let i = 0; i < 4; i++) {
      const chev = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.5),
        this._glowMat(colors.core, 0.7)
      );
      chev.rotation.x = -Math.PI / 2;
      chev.position.set(0, 0.06, -4 + i * 2.8);
      g.add(chev);
    }

    const pillarGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
    for (const side of [-0.9, 0.9]) {
      const pillar = new THREE.Mesh(pillarGeo, this._glowMat(colors.core, 0.65));
      pillar.position.set(side, 0.25, -5);
      g.add(pillar);
    }

    this.scene.add(g);
    return { group: g, outer, core, edgeL, edgeR, colors };
  }

  _makeObstacle(type, lane, z) {
    const g = new THREE.Group();
    g.position.set(LANES[lane], 0, z);
    let hit = { w: 1.4, h: 1.1, d: 0.6, y: 0.55, mode: 'block' };

    if (type === 'barrier') {
      const m = new THREE.Mesh(this._geo.barrier, this._mats.barrier);
      m.position.y = 0.55;
      m.castShadow = true;
      g.add(m);
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.2, 0.52),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
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
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8),
        this._mats.rail
      );
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

    const tel = this._makeTelegraph(lane, z, type);
    this.scene.add(g);
    const item = { type, lane, z, mesh: g, hit, alive: true, tel };
    this.items.push(item);
    return item;
  }

  update(dt, playerZ, speed) {
    this._pulseT += dt;

    while (this.nextZ < playerZ + WORLD.segmentLength * WORLD.segmentsAhead * 0.85) {
      const type = TYPES[(Math.random() * TYPES.length) | 0];
      const lane = (Math.random() * 3) | 0;
      this._makeObstacle(type, lane, this.nextZ);
      if (Math.random() > 0.72) {
        const other = (lane + 1 + ((Math.random() * 2) | 0)) % 3;
        const t2 = TYPES[(Math.random() * TYPES.length) | 0];
        this._makeObstacle(t2, other, this.nextZ + (Math.random() * 4 - 1));
      }
      const gap = SPAWN.obstacleMinGap + Math.random() * (SPAWN.obstacleMaxGap - SPAWN.obstacleMinGap);
      this.nextZ += gap * (0.85 + Math.min(0.4, speed / 50));
    }

    const leadDist = SPAWN.telegraphDistance;
    const pulse = 0.65 + Math.sin(this._pulseT * 9) * 0.35;

    for (const it of this.items) {
      if (!it.tel) continue;
      const dist = it.z - playerZ;
      const inRange = dist > 0 && dist < leadDist;
      it.tel.group.visible = inRange;
      if (!inRange) continue;

      const t = 1 - dist / leadDist;
      const urgency = Math.pow(t, 0.7);
      const blink = 0.75 + Math.sin(this._pulseT * 14 + it.z * 0.3) * 0.25;

      it.tel.group.position.set(LANES[it.lane], 0, it.z - 5 - (1 - t) * 2);
      it.tel.outer.material.opacity = (0.12 + urgency * 0.28) * pulse;
      it.tel.core.material.opacity = (0.25 + urgency * 0.55) * blink;
      it.tel.edgeL.material.opacity = (0.35 + urgency * 0.45) * blink;
      it.tel.edgeR.material.opacity = it.tel.edgeL.material.opacity;

      const scale = 1 + urgency * 0.08;
      it.tel.group.scale.set(scale, 1, 1 + urgency * 0.15);
    }

    while (this.items.length && this.items[0].z < playerZ - 12) {
      const old = this.items.shift();
      this.scene.remove(old.mesh);
      if (old.tel) this.scene.remove(old.tel.group);
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
    for (const it of this.items) {
      this.scene.remove(it.mesh);
      if (it.tel) this.scene.remove(it.tel.group);
    }
    this.items = [];
    this.nextZ = 40;
    this._pulseT = 0;
  }
}
