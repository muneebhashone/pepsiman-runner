import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS } from './constants.js';

const TRAIL_COLORS = [COLORS.pepsiBlue, COLORS.pepsiRed, 0xffffff, COLORS.neonCyan];

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.streaks = [];
    this.trailTimer = 0;
    this.hitFlashT = 0;
    this._tmp = new THREE.Vector3();

    const streakGeo = new THREE.BoxGeometry(0.04, 0.04, 1.8);
    for (let i = 0; i < 56; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xaaccff : i % 3 === 1 ? 0xff88aa : 0xffffff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const m = new THREE.Mesh(streakGeo, mat);
      m.visible = false;
      scene.add(m);
      this.streaks.push({ mesh: m, life: 0, max: 0, side: 0 });
    }

    this.burstGeo = new THREE.SphereGeometry(0.08, 6, 6);
    this.sparkGeo = new THREE.PlaneGeometry(0.12, 0.12);
    this.dustGeo = new THREE.SphereGeometry(0.06, 5, 5);
  }

  _spawnParticle(mesh, vel, life, gravity = 10, spin = 0, opacity = 1) {
    this.scene.add(mesh);
    this.particles.push({ mesh, vel, life, maxLife: life, gravity, spin, opacity });
  }

  _makeSparkMat(color, opacity = 1) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  runTrail(pos, speedNorm) {
    if (speedNorm < 0.08) return;
    const rate = 0.04 - speedNorm * 0.025;
    this.trailTimer -= rate;
    if (this.trailTimer > 0) return;
    this.trailTimer = 0.02 + Math.random() * 0.03;

    const color = TRAIL_COLORS[(Math.random() * TRAIL_COLORS.length) | 0];
    const mat = this._makeSparkMat(color, 0.55 + speedNorm * 0.35);
    const m = new THREE.Mesh(this.sparkGeo, mat);
    m.position.set(
      pos.x + (Math.random() - 0.5) * 0.35,
      0.12 + Math.random() * 0.08,
      pos.z - 0.35 - Math.random() * 0.25
    );
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      0.4 + Math.random() * 0.6,
      -2 - speedNorm * 6 - Math.random() * 2
    );
    this._spawnParticle(m, vel, 0.28 + Math.random() * 0.15, 4, 4 + Math.random() * 6, 0.55 + speedNorm * 0.35);
  }

  spawnStreaks(playerPos, speedNorm, dt) {
    const rate = 10 + speedNorm * 48;
    if (Math.random() < rate * dt) {
      const s = this.streaks.find((x) => x.life <= 0);
      if (!s) return;
      s.life = 0.22 + Math.random() * 0.28;
      s.max = s.life;
      s.side = Math.random() > 0.5 ? 1 : -1;
      s.mesh.visible = true;
      s.mesh.position.set(
        playerPos.x + s.side * (3.2 + Math.random() * 2.5),
        0.4 + Math.random() * 3.5,
        playerPos.z + 6 + Math.random() * 22
      );
      s.mesh.rotation.y = s.side * 0.15;
      s.mesh.scale.set(0.5 + speedNorm * 0.4, 0.5, 0.7 + speedNorm * 2.2);
      s.mesh.material.opacity = 0.12 + speedNorm * 0.42;
    }

    // center rush lines at high speed
    if (speedNorm > 0.45 && Math.random() < speedNorm * 18 * dt) {
      const s = this.streaks.find((x) => x.life <= 0);
      if (!s) return;
      s.life = 0.18 + Math.random() * 0.12;
      s.max = s.life;
      s.side = 0;
      s.mesh.visible = true;
      s.mesh.position.set(
        playerPos.x + (Math.random() - 0.5) * 1.2,
        1 + Math.random() * 2,
        playerPos.z + 10 + Math.random() * 15
      );
      s.mesh.scale.set(0.3, 0.3, 1.2 + speedNorm * 2.5);
      s.mesh.material.opacity = 0.08 + speedNorm * 0.25;
      s.mesh.material.color.setHex(0xffffff);
    }
  }

  pickupBurst(pos, combo = 1) {
    const count = 12 + Math.min(combo, 6) * 2;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? COLORS.pepsiRed : i % 3 === 1 ? COLORS.pepsiBlue : 0xffffff,
        transparent: true,
        opacity: 1,
        blending: i % 2 ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      });
      const geo = i % 4 === 0 ? this.sparkGeo : this.burstGeo;
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      if (geo === this.sparkGeo) m.lookAt(pos.x, pos.y + 1, pos.z + 1);
      const spread = 5 + combo * 0.4;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        2 + Math.random() * 5 + combo * 0.15,
        (Math.random() - 0.5) * spread
      );
      this._spawnParticle(m, vel, 0.4 + Math.random() * 0.25, 9, 8, 1);
    }

    // expanding ring
    for (let i = 0; i < 8; i++) {
      const mat = this._makeSparkMat(COLORS.neonCyan, 0.85);
      const m = new THREE.Mesh(this.sparkGeo, mat);
      m.position.copy(pos);
      const angle = (i / 8) * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(angle) * 4, 1.5, Math.sin(angle) * 4);
      m.rotation.z = angle;
      this._spawnParticle(m, vel, 0.32, 2, 12, 0.85);
    }
  }

  landDust(pos, speedNorm = 0.5) {
    const n = 8 + Math.floor(speedNorm * 8);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x99aabb : 0x667788,
        transparent: true,
        opacity: 0.65,
      });
      const m = new THREE.Mesh(this.dustGeo.clone(), mat);
      m.scale.setScalar(0.8 + Math.random() * 1.2);
      m.position.set(pos.x + (Math.random() - 0.5) * 0.6, 0.08, pos.z + (Math.random() - 0.5) * 0.4);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * (3 + speedNorm * 4),
        0.8 + Math.random() * 2.5,
        (Math.random() - 0.5) * 2
      );
      this._spawnParticle(m, vel, 0.38 + Math.random() * 0.12, 5, 0, 0.65);
    }

    // ground ripple puff
    const ringMat = this._makeSparkMat(0x88aacc, 0.35);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.35, 12), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.05, pos.z);
    this._spawnParticle(ring, new THREE.Vector3(0, 0.2, 0), 0.25, 0, 0, 0.35);
    ring.userData.expand = true;
  }

  crashBurst(pos) {
    this.hitFlashT = 0.35;
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? COLORS.pepsiRed : i % 3 === 1 ? COLORS.pepsiBlue : 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const m = new THREE.Mesh(i % 2 ? this.sparkGeo : this.burstGeo, mat);
      m.position.copy(pos);
      m.position.y += 0.8 + Math.random() * 0.6;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        2 + Math.random() * 9,
        (Math.random() - 0.5) * 12
      );
      this._spawnParticle(m, vel, 0.75 + Math.random() * 0.2, 11, 6, 1);
    }
  }

  hitFlashIntensity() {
    if (this.hitFlashT <= 0) return 0;
    return Math.pow(this.hitFlashT / 0.35, 0.6);
  }

  update(dt, playerPos, speedNorm, isPlaying = true) {
    if (isPlaying) {
      this.runTrail(playerPos, speedNorm);
      this.spawnStreaks(playerPos, speedNorm, dt);
    }
    if (this.hitFlashT > 0) this.hitFlashT -= dt;

    for (const s of this.streaks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const t = s.life / s.max;
      s.mesh.position.z -= (24 + speedNorm * 50) * dt;
      s.mesh.material.opacity *= 0.94;
      s.mesh.scale.x *= 0.995;
      if (s.life <= 0) s.mesh.visible = false;
      else s.mesh.material.opacity = (0.12 + speedNorm * 0.35) * t;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.spin) p.mesh.rotation.z += p.spin * dt;

      const lifeT = Math.max(0, p.life / p.maxLife);
      p.mesh.material.opacity = Math.max(0, lifeT * p.opacity);

      if (p.mesh.userData.expand) {
        const s = 1 + (1 - lifeT) * 3.5;
        p.mesh.scale.set(s, s, s);
      } else {
        p.mesh.scale.multiplyScalar(0.985);
      }

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
      p.mesh.geometry.dispose?.();
      p.mesh.material.dispose?.();
    }
    this.particles = [];
    for (const s of this.streaks) {
      s.life = 0;
      s.mesh.visible = false;
    }
    this.trailTimer = 0;
    this.hitFlashT = 0;
  }
}
