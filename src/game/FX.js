import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS } from './constants.js';

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.streaks = [];
    this._tmp = new THREE.Vector3();

    // speed streaks pool
    const streakGeo = new THREE.BoxGeometry(0.04, 0.04, 1.8);
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xaaccff,
      transparent: true,
      opacity: 0.35,
    });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(streakGeo, streakMat.clone());
      m.visible = false;
      scene.add(m);
      this.streaks.push({ mesh: m, life: 0, max: 0 });
    }

    this.burstGeo = new THREE.SphereGeometry(0.08, 6, 6);
  }

  spawnStreaks(playerPos, speedNorm, dt) {
    const rate = 8 + speedNorm * 40;
    if (Math.random() < rate * dt) {
      const s = this.streaks.find((x) => x.life <= 0);
      if (!s) return;
      s.life = 0.25 + Math.random() * 0.25;
      s.max = s.life;
      s.mesh.visible = true;
      s.mesh.position.set(
        playerPos.x + (Math.random() - 0.5) * 6,
        0.5 + Math.random() * 4,
        playerPos.z + 4 + Math.random() * 20
      );
      s.mesh.scale.z = 0.6 + speedNorm * 1.5;
      s.mesh.material.opacity = 0.15 + speedNorm * 0.35;
    }
  }

  pickupBurst(pos) {
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 ? COLORS.pepsiRed : COLORS.pepsiBlue,
        transparent: true,
        opacity: 1,
      });
      const m = new THREE.Mesh(this.burstGeo, mat);
      m.position.copy(pos);
      this.scene.add(m);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        2 + Math.random() * 5,
        (Math.random() - 0.5) * 6
      );
      this.particles.push({ mesh: m, vel, life: 0.45 + Math.random() * 0.2, gravity: 10 });
    }
  }

  landDust(pos) {
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8899aa,
        transparent: true,
        opacity: 0.7,
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.08, 5, 5), mat);
      m.position.set(pos.x, 0.1, pos.z);
      this.scene.add(m);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 2, (Math.random() - 0.5) * 2);
      this.particles.push({ mesh: m, vel, life: 0.35, gravity: 6 });
    }
  }

  crashBurst(pos) {
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? COLORS.pepsiRed : i % 3 === 1 ? COLORS.pepsiBlue : 0xffffff,
        transparent: true,
        opacity: 1,
      });
      const m = new THREE.Mesh(this.burstGeo, mat);
      m.position.copy(pos);
      m.position.y += 1;
      this.scene.add(m);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        2 + Math.random() * 8,
        (Math.random() - 0.5) * 10
      );
      this.particles.push({ mesh: m, vel, life: 0.7, gravity: 12 });
    }
  }

  update(dt, playerPos, speedNorm) {
    this.spawnStreaks(playerPos, speedNorm, dt);

    for (const s of this.streaks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.position.z -= (20 + speedNorm * 40) * dt;
      s.mesh.material.opacity *= 0.96;
      if (s.life <= 0) s.mesh.visible = false;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.max(0, p.life * 2);
      p.mesh.scale.multiplyScalar(0.98);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose?.();
        p.mesh.material.dispose?.();
        this.particles.splice(i, 1);
      }
    }
  }

  reset() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];
    for (const s of this.streaks) {
      s.life = 0;
      s.mesh.visible = false;
    }
  }
}
