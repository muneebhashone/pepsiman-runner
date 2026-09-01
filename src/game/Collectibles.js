import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD } from './constants.js';

export class Collectibles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.nextZ = 25;
    this.magnetRange = 2.8;
    this.canGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.55, 16);
    this.canMat = new THREE.MeshStandardMaterial({
      color: COLORS.canBody,
      metalness: 0.75,
      roughness: 0.25,
      emissive: COLORS.pepsiRed,
      emissiveIntensity: 0.2,
    });
    this.topMat = new THREE.MeshStandardMaterial({
      color: COLORS.canTop,
      metalness: 0.9,
      roughness: 0.15,
    });
    this.bobT = 0;
  }

  _makeCan(lane, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.canGeo, this.canMat);
    body.castShadow = true;
    g.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 16), this.topMat);
    top.position.y = 0.3;
    g.add(top);
    // swirl sticker
    const sticker = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.02),
      new THREE.MeshStandardMaterial({
        color: COLORS.pepsiBlue,
        emissive: COLORS.pepsiBlue,
        emissiveIntensity: 0.4,
      })
    );
    sticker.position.z = 0.29;
    g.add(sticker);
    g.position.set(LANES[lane], 1.0, z);
    this.scene.add(g);
    const item = { lane, z, mesh: g, alive: true, sucking: false };
    this.items.push(item);
    return item;
  }

  update(dt, playerZ, playerX, playerY, speed) {
    this.bobT += dt;
    // spawn clusters
    while (this.nextZ < playerZ + WORLD.segmentLength * WORLD.segmentsAhead * 0.8) {
      if (Math.random() < SPAWN.collectibleChance) {
        const lane = (Math.random() * 3) | 0;
        const n = 1 + ((Math.random() * SPAWN.collectibleCluster) | 0);
        for (let i = 0; i < n; i++) {
          const useLane = Math.random() > 0.7 ? (Math.random() * 3) | 0 : lane;
          this._makeCan(useLane, this.nextZ + i * 2.2);
        }
      }
      this.nextZ += 10 + Math.random() * 14;
    }

    for (const it of this.items) {
      if (!it.alive) continue;
      const mesh = it.mesh;
      mesh.position.y = 1.0 + Math.sin(this.bobT * 3 + it.z * 0.2) * 0.15;
      mesh.rotation.y += dt * 2.5;

      // magnet suck
      const dx = playerX - mesh.position.x;
      const dz = playerZ - mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < this.magnetRange && dist > 0.01) {
        it.sucking = true;
        const pull = Math.min(1, (this.magnetRange - dist) / this.magnetRange) * speed * 0.15 * dt * 60;
        mesh.position.x += dx * pull * 0.08;
        mesh.position.z += dz * pull * 0.08;
        mesh.position.y += (playerY + 1.0 - mesh.position.y) * pull * 0.05;
      }
    }

    while (this.items.length && this.items[0].z < playerZ - 10 && !this.items[0].sucking) {
      const old = this.items.shift();
      if (old.alive) this.scene.remove(old.mesh);
    }
    // clean dead
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
      if (!it.alive) continue;
      const dx = Math.abs(playerBox.x - it.mesh.position.x);
      const dz = Math.abs(playerBox.z - it.mesh.position.z);
      const dy = Math.abs(playerBox.y - it.mesh.position.y);
      if (dx < 0.85 && dz < 0.85 && dy < 1.4) {
        it.alive = false;
        got.push(it);
      }
    }
    return got;
  }

  reset() {
    for (const it of this.items) this.scene.remove(it.mesh);
    this.items = [];
    this.nextZ = 25;
  }
}
