import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS } from './constants.js';

const TRAIL_COLORS = [COLORS.pepsiBlue, COLORS.pepsiRed, COLORS.neonCyan];
const MAX_FX_Y = 2.8;
const STREAK_Y_MAX = 1.4;
const MAX_NEAR_PICKUP_PARTICLES = 6;
const NEAR_PICKUP_RADIUS = 2.8;
const NEAR_PICKUP_RADIUS_SQ = NEAR_PICKUP_RADIUS * NEAR_PICKUP_RADIUS;

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.streaks = [];
    this.trailTimer = 0;
    this.hitFlashT = 0;
    this._tmp = new THREE.Vector3();

    const streakGeo = new THREE.BoxGeometry(0.02, 0.02, 0.55);
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x88bbdd,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const m = new THREE.Mesh(streakGeo, mat);
      m.visible = false;
      m.frustumCulled = true;
      scene.add(m);
      this.streaks.push({ mesh: m, life: 0, max: 0, side: 0 });
    }

    this.burstGeo = new THREE.SphereGeometry(0.07, 5, 5);
    this.sparkGeo = new THREE.PlaneGeometry(0.08, 0.08);
    this.dustGeo = new THREE.SphereGeometry(0.05, 5, 5);
  }

  _spawnParticle(mesh, vel, life, gravity = 10, spin = 0, opacity = 1, pickup = false) {
    mesh.frustumCulled = true;
    this.scene.add(mesh);
    this.particles.push({ mesh, vel, life, maxLife: life, gravity, spin, opacity, pickup });
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

  _clampGroundY(y, maxY = MAX_FX_Y) {
    return Math.min(maxY, Math.max(0.05, y));
  }

  _countNearPickupParticles(pos) {
    let n = 0;
    for (const p of this.particles) {
      if (!p.pickup) continue;
      if (p.mesh.position.distanceToSquared(pos) < NEAR_PICKUP_RADIUS_SQ) n++;
    }
    return n;
  }

  runTrail(pos, speedNorm) {
    if (speedNorm < 0.08) return;
    const rate = 0.04 - speedNorm * 0.025;
    this.trailTimer -= rate;
    if (this.trailTimer > 0) return;
    this.trailTimer = 0.025 + Math.random() * 0.03;

    const color = TRAIL_COLORS[(Math.random() * TRAIL_COLORS.length) | 0];
    const mat = this._makeSparkMat(color, 0.35 + speedNorm * 0.22);
    const m = new THREE.Mesh(this.sparkGeo, mat);
    m.position.set(
      pos.x + (Math.random() - 0.5) * 0.3,
      0.1 + Math.random() * 0.06,
      pos.z - 0.3 - Math.random() * 0.2
    );
    m.rotation.set(0, Math.random() * Math.PI, 0);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      0.2 + Math.random() * 0.4,
      -1.5 - speedNorm * 4
    );
    this._spawnParticle(m, vel, 0.22 + Math.random() * 0.1, 3, 3, 0.5 + speedNorm * 0.3);
  }

  spawnStreaks(playerPos, speedNorm, dt) {
    if (speedNorm < 0.15) return;
    const rate = 6 + speedNorm * 28;
    if (Math.random() >= rate * dt) return;

    const s = this.streaks.find((x) => x.life <= 0);
    if (!s) return;

    s.life = 0.16 + Math.random() * 0.14;
    s.max = s.life;
    s.side = Math.random() > 0.5 ? 1 : -1;
    s.mesh.visible = true;

    const sideX = playerPos.x + s.side * (3.4 + Math.random() * 1.2);
    const y = 0.2 + Math.random() * (STREAK_Y_MAX - 0.2);
    s.mesh.position.set(sideX, y, playerPos.z + 5 + Math.random() * 12);
    s.mesh.rotation.set(0, 0, 0);
    const len = 0.5 + speedNorm * 0.7;
    s.mesh.scale.set(1, 1, len);
    s.mesh.material.opacity = 0.08 + speedNorm * 0.22;
    s.mesh.material.color.setHex(s.side > 0 ? 0x88ccff : 0xff99bb);
  }

  canPop(pos, combo = 1) {
    const burstPos = pos.clone();
    burstPos.y = this._clampGroundY(burstPos.y, 1.4);

    const budget = MAX_NEAR_PICKUP_PARTICLES - this._countNearPickupParticles(burstPos);
    if (budget <= 0) return;

    const count = Math.min(budget, 3 + Math.min(combo, 3));
    for (let i = 0; i < count; i++) {
      const mat = this._makeSparkMat(
        i % 3 === 0 ? COLORS.pepsiRed : i % 3 === 1 ? COLORS.pepsiBlue : 0xffffff,
        0.75
      );
      const m = new THREE.Mesh(this.burstGeo, mat);
      m.position.copy(burstPos);
      m.position.y += 0.35 + Math.random() * 0.25;

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const speed = 5 + combo * 0.35 + Math.random() * 2;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        0.5 + Math.random() * 1.1,
        Math.sin(angle) * speed
      );
      this._spawnParticle(m, vel, 0.12 + Math.random() * 0.06, 9, 7, 0.75, true);
    }
  }

  pickupBurst(pos, combo = 1) {
    this.canPop(pos, combo);
  }

  landDust(pos, speedNorm = 0.5) {
    const n = 4 + Math.floor(speedNorm * 4);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x99aabb : 0x667788,
        transparent: true,
        opacity: 0.4,
      });
      const m = new THREE.Mesh(this.dustGeo.clone(), mat);
      m.scale.setScalar(0.6 + Math.random() * 0.8);
      m.position.set(pos.x + (Math.random() - 0.5) * 0.6, 0.08, pos.z + (Math.random() - 0.5) * 0.4);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + speedNorm * 3 + Math.random() * 2;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        0.5 + Math.random() * 1.2,
        Math.sin(angle) * speed
      );
      this._spawnParticle(m, vel, 0.22 + Math.random() * 0.08, 6, 0, 0.4);
    }
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
      m.position.y += 0.6 + Math.random() * 0.5;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        1.5 + Math.random() * 6,
        (Math.random() - 0.5) * 10
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
      s.mesh.position.z -= (20 + speedNorm * 35) * dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
      } else {
        s.mesh.material.opacity = (0.08 + speedNorm * 0.2) * t;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.spin) p.mesh.rotation.z += p.spin * dt;

      if (p.mesh.position.y > MAX_FX_Y) {
        p.mesh.position.y = MAX_FX_Y;
        p.vel.y = Math.min(0, p.vel.y);
      }

      const lifeT = Math.max(0, p.life / p.maxLife);
      p.mesh.material.opacity = Math.max(0, lifeT * p.opacity);

      if (p.mesh.userData.expand) {
        const sc = 1 + (1 - lifeT) * 1.2;
        p.mesh.scale.set(sc, sc, sc);
      } else {
        p.mesh.scale.multiplyScalar(0.96);
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
