import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD } from './constants.js';

const TYPES = ['barrier', 'rail', 'sign', 'truck'];

export class Obstacles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.telegraphs = [];
    this.nextZ = 40;
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
      telegraph: new THREE.MeshBasicMaterial({
        color: COLORS.telegraph,
        transparent: true,
        opacity: 0.35,
      }),
    };
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
      // stripes
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
      hit = { w: 1.7, h: 0.5, d: 1.1, y: 0.25, mode: 'slide' }; // must slide
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
      hit = { w: 1.8, h: 1.2, d: 0.4, y: 2.0, mode: 'jump' }; // must jump
    } else {
      // truck
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

    // telegraph glow on lane
    const tel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 6),
      this._mats.telegraph.clone()
    );
    tel.rotation.x = -Math.PI / 2;
    tel.position.set(LANES[lane], 0.02, z - 4);
    this.scene.add(tel);

    this.scene.add(g);
    const item = { type, lane, z, mesh: g, hit, alive: true, tel, telZ: z - 4 };
    this.items.push(item);
    return item;
  }

  update(dt, playerZ, speed) {
    // spawn
    while (this.nextZ < playerZ + WORLD.segmentLength * WORLD.segmentsAhead * 0.85) {
      const type = TYPES[(Math.random() * TYPES.length) | 0];
      const lane = (Math.random() * 3) | 0;
      // occasionally double lane block
      this._makeObstacle(type, lane, this.nextZ);
      if (Math.random() > 0.72) {
        const other = (lane + 1 + ((Math.random() * 2) | 0)) % 3;
        const t2 = TYPES[(Math.random() * TYPES.length) | 0];
        this._makeObstacle(t2, other, this.nextZ + (Math.random() * 4 - 1));
      }
      const gap = SPAWN.obstacleMinGap + Math.random() * (SPAWN.obstacleMaxGap - SPAWN.obstacleMinGap);
      this.nextZ += gap * (0.85 + Math.min(0.4, speed / 50));
    }

    // recycle & telegraph fade
    for (const it of this.items) {
      if (it.tel) {
        const dist = it.z - playerZ;
        const lead = SPAWN.telegraphLead * 20;
        it.tel.material.opacity = dist < lead && dist > 0 ? 0.15 + 0.35 * (1 - dist / lead) : 0;
        it.tel.position.z = it.telZ;
      }
    }

    // remove behind
    while (this.items.length && this.items[0].z < playerZ - 12) {
      const old = this.items.shift();
      this.scene.remove(old.mesh);
      if (old.tel) this.scene.remove(old.tel);
    }
  }

  /** AABB vs player hitbox. Returns colliding item or null. */
  collide(playerBox, jumping, sliding) {
    const mode = playerBox.mode || (sliding ? 'slide' : jumping ? 'jump' : 'run');
    const feetY = playerBox.feetY ?? playerBox.y - playerBox.h * 0.5;
    const headY = feetY + playerBox.h;

    for (const it of this.items) {
      if (!it.alive) continue;
      const hx = it.mesh.position.x;
      const hz = it.z;
      const hy = it.hit.y;
      const dx = Math.abs(playerBox.x - hx);
      const dz = Math.abs(playerBox.z - hz);
      if (dx >= (playerBox.w + it.hit.w) * 0.5 || dz >= (playerBox.d + it.hit.d) * 0.5) {
        continue;
      }

      // Jump obstacles — clear when airborne with enough lift
      if (it.hit.mode === 'jump') {
        if (mode === 'jump' && playerBox.apexY > 0.3) continue;
        const signBottom = hy - it.hit.h * 0.48;
        if (headY < signBottom + 0.08) continue;
      }

      // Slide obstacles — duck under overhead rails
      if (it.hit.mode === 'slide') {
        if (mode === 'slide') continue;
        const railTop = hy + it.hit.h * 0.48;
        if (headY < railTop + 0.05) continue;
      }

      const dy = Math.abs(playerBox.y - hy);
      if (dy < (playerBox.h + it.hit.h) * 0.5) return it;
    }
    return null;
  }

  reset() {
    for (const it of this.items) {
      this.scene.remove(it.mesh);
      if (it.tel) this.scene.remove(it.tel);
    }
    this.items = [];
    this.nextZ = 40;
  }
}
