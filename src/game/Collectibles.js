import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD } from './constants.js';

export class Collectibles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.nextZ = SPAWN.collectibleStartZ;
    this.magnetRange = 3.6;
    this.bobT = 0;

    this.canGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.58, 16);
    this.canMat = new THREE.MeshStandardMaterial({
      color: COLORS.canBody,
      metalness: 0.8,
      roughness: 0.18,
      emissive: COLORS.pepsiRed,
      emissiveIntensity: 0.45,
    });
    this.topMat = new THREE.MeshStandardMaterial({
      color: COLORS.canTop,
      metalness: 0.95,
      roughness: 0.1,
      emissive: 0xdddddd,
      emissiveIntensity: 0.15,
    });
    this.glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.neonCyan,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ringGeo = new THREE.RingGeometry(0.38, 0.52, 24);
  }

  _makeCan(lane, z) {
    const g = new THREE.Group();

    const glow = new THREE.Mesh(this.ringGeo, this.glowMat.clone());
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    g.add(glow);

    const body = new THREE.Mesh(this.canGeo, this.canMat.clone());
    body.castShadow = true;
    g.add(body);

    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), this.topMat);
    top.position.y = 0.32;
    g.add(top);

    const sticker = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.22, 0.02),
      new THREE.MeshStandardMaterial({
        color: COLORS.pepsiBlue,
        emissive: COLORS.pepsiBlue,
        emissiveIntensity: 0.65,
        metalness: 0.4,
        roughness: 0.3,
      })
    );
    sticker.position.z = 0.31;
    g.add(sticker);

    g.position.set(LANES[lane], 1.0, z);
    this.scene.add(g);
    const item = { lane, z, mesh: g, glow, body, alive: true, sucking: false, popT: 0 };
    this.items.push(item);
    return item;
  }

  seedStarterLine() {
    for (let i = 0; i < 3; i++) {
      this._makeCan(i, 14 + i * 5);
    }
    this._makeCan(1, 32);
    this._makeCan(0, 38);
    this._makeCan(2, 44);
  }

  update(dt, playerZ, playerX, playerY, speed) {
    this.bobT += dt;

    while (this.nextZ < playerZ + WORLD.segmentLength * WORLD.segmentsAhead * 0.85) {
      if (Math.random() < SPAWN.collectibleChance) {
        const lane = (Math.random() * 3) | 0;
        const n = 1 + ((Math.random() * SPAWN.collectibleCluster) | 0);
        for (let i = 0; i < n; i++) {
          const useLane = Math.random() > 0.65 ? (Math.random() * 3) | 0 : lane;
          this._makeCan(useLane, this.nextZ + i * 2.0);
        }
      }
      this.nextZ += 8 + Math.random() * 12;
    }

    for (const it of this.items) {
      if (!it.alive) continue;
      const mesh = it.mesh;

      if (it.popT > 0) {
        it.popT -= dt;
        const t = Math.max(0, it.popT / 0.12);
        mesh.scale.setScalar(1 + (1 - t) * 0.6);
        if (it.glow?.material) it.glow.material.opacity = t * 0.8;
        if (it.popT <= 0) it.alive = false;
        continue;
      }

      const bob = Math.sin(this.bobT * 4 + it.z * 0.25) * 0.18;
      mesh.position.y = 1.0 + bob;
      mesh.rotation.y += dt * 3.2;

      const pulse = 0.35 + Math.sin(this.bobT * 5 + it.z) * 0.2;
      if (it.glow?.material) it.glow.material.opacity = pulse;
      if (it.body?.material) it.body.material.emissiveIntensity = 0.4 + pulse * 0.35;

      const dx = playerX - mesh.position.x;
      const dz = playerZ - mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < this.magnetRange && dist > 0.01) {
        it.sucking = true;
        const norm = (this.magnetRange - dist) / this.magnetRange;
        const pull = norm * speed * 0.18 * dt * 60;
        mesh.position.x += dx * pull * 0.12;
        mesh.position.z += dz * pull * 0.12;
        mesh.position.y += (playerY + 1.1 - mesh.position.y) * pull * 0.08;
        mesh.scale.setScalar(1 + norm * 0.15);
      }

      it.z = mesh.position.z;
    }

    while (this.items.length && this.items[0].z < playerZ - 12 && !this.items[0].sucking) {
      const old = this.items.shift();
      if (old.alive) this.scene.remove(old.mesh);
    }

    this.items = this.items.filter((it) => {
      if (!it.alive) {
        this.scene.remove(it.mesh);
        return false;
      }
      return true;
    });
  }

  collect(playerBox) {
    const got = [];
    for (const it of this.items) {
      if (!it.alive || it.popT > 0) continue;
      const p = it.mesh.position;
      const dx = Math.abs(playerBox.x - p.x);
      const dz = Math.abs(playerBox.z - p.z);
      const dy = Math.abs(playerBox.y - p.y);
      if (dx < 1.15 && dz < 1.15 && dy < 1.65) {
        it.popT = 0.12;
        got.push(it);
      }
    }
    return got;
  }

  reset() {
    for (const it of this.items) this.scene.remove(it.mesh);
    this.items = [];
    this.nextZ = SPAWN.collectibleStartZ;
    this.seedStarterLine();
  }
}
