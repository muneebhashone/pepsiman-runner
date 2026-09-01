import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';
import { LANES, PLAYER, COLORS } from './constants.js';

const HERO_SCALE = 0.88;

function suitMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.18,
    roughness: opts.roughness ?? 0.42,
    emissive: opts.emissive ?? color,
    emissiveIntensity: opts.emissiveIntensity ?? 0.12,
  });
}

function accentMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.35,
    roughness: opts.roughness ?? 0.32,
    emissive: opts.emissive ?? color,
    emissiveIntensity: opts.emissiveIntensity ?? 0.2,
  });
}

function laneEase(t, overshoot = PLAYER.laneOvershoot) {
  if (t >= 1) return 1;
  const smooth = t * t * (3 - 2 * t);
  const bounce = 1 + overshoot * Math.sin(t * Math.PI);
  return smooth * bounce;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.lane = 1;
    this.targetLane = 1;
    this.x = LANES[1];
    this.y = 0;
    this.z = 0;
    this.speed = PLAYER.runSpeedBase;
    this.jumping = false;
    this.sliding = false;
    this.jumpT = 0;
    this.slideT = 0;
    this.laneT = 1;
    this.laneFromX = this.x;
    this.laneToX = this.x;
    this.laneDir = 0;
    this.runPhase = 0;
    this.alive = true;
    this.justLanded = false;
    this.lean = 0;
    this.coyoteT = 0;
    this.wasGrounded = true;
    this.group = new THREE.Group();
    this._buildMesh();
    scene.add(this.group);
    this.hitbox = { w: 0.7, h: 1.7, d: 0.6 };
  }

  _buildMesh() {
    const root = new THREE.Group();
    this.root = root;

    const white = suitMat(COLORS.pepsiWhite, { emissiveIntensity: 0.18 });
    const silver = suitMat(0xd4dae6, { metalness: 0.28, roughness: 0.38, emissiveIntensity: 0.1 });
    const blue = accentMat(COLORS.pepsiBlue, { emissiveIntensity: 0.28 });
    const red = accentMat(COLORS.pepsiRed, { emissiveIntensity: 0.24 });
    const dark = accentMat(0x111122, { emissiveIntensity: 0 });

    // Pelvis — compact block, not a cylinder silhouette
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.26, 0.36), silver);
    hips.position.y = 0.68;
    hips.castShadow = true;
    root.add(hips);

    // Wide torso — clearly wider-than-tall mascot block
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.58, 0.42), white);
    torso.position.y = 1.12;
    torso.castShadow = true;
    root.add(torso);
    this.torso = torso;

    // Front blue chest panel + swirl (face-forward only)
    const chestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.46, 0.07), blue);
    chestPanel.position.set(0, 0.06, 0.22);
    torso.add(chestPanel);

    const emblem = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), white);
    disc.position.z = 0.05;
    emblem.add(disc);
    const swirlR = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.18, 24, 1, 0, Math.PI * 0.85),
      red
    );
    swirlR.position.z = 0.06;
    emblem.add(swirlR);
    const swirlB = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.18, 24, 1, Math.PI * 0.85, Math.PI * 0.85),
      blue
    );
    swirlB.position.z = 0.06;
    emblem.add(swirlB);
    emblem.position.set(0, 0.02, 0);
    chestPanel.add(emblem);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.44), red);
    belt.position.y = -0.22;
    torso.add(belt);

    // Back panel — white/silver, red accent (no blue stripe from behind)
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.06), silver);
    backPanel.position.set(0, 0.04, -0.22);
    torso.add(backPanel);
    const backV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.04), red);
    backV.position.set(0, 0.02, -0.26);
    torso.add(backV);

    // Shoulder blocks — read as human shoulders from chase cam
    const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.34), white);
    shoulderL.position.set(-0.46, 0.28, 0);
    shoulderL.castShadow = true;
    torso.add(shoulderL);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.46;
    torso.add(shoulderR);

    // Short thick neck
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), silver);
    neck.position.y = 1.48;
    neck.castShadow = true;
    root.add(neck);

    // Oversized round mascot head — matte sphere, no chrome dome
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 20), white);
    head.position.y = 1.82;
    head.castShadow = true;
    root.add(head);
    this.head = head;

    const faceMask = new THREE.Mesh(
      new THREE.SphereGeometry(0.41, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      blue
    );
    faceMask.position.set(0, -0.02, 0.1);
    faceMask.rotation.x = 0.15;
    head.add(faceMask);

    const eyeGeo = new THREE.SphereGeometry(0.11, 12, 10);
    const eyeL = new THREE.Mesh(eyeGeo, white);
    eyeL.position.set(-0.15, 0.09, 0.32);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.15;
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), dark);
    pL.position.set(-0.15, 0.09, 0.39);
    const pR = pL.clone();
    pR.position.x = 0.15;
    head.add(eyeL, eyeR, pL, pR);

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.024, 8, 18, Math.PI * 0.88),
      red
    );
    smile.position.set(0, -0.11, 0.34);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    head.add(smile);

    // Crest visible from behind — breaks round head into mascot silhouette
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.48), red);
    crest.position.set(0, 0.36, 0);
    head.add(crest);

    // Thick arms — white upper, blue forearm, red glove
    this.armL = this._makeArm(white, blue, red);
    this.armR = this._makeArm(white, blue, red);
    this.armL.position.set(-0.5, 1.32, 0);
    this.armR.position.set(0.5, 1.32, 0);
    root.add(this.armL, this.armR);

    // Thick legs — silver thighs, blue shins, red boots
    this.legL = this._makeLeg(silver, blue, red);
    this.legR = this._makeLeg(silver, blue, red);
    this.legL.position.set(-0.2, 0.68, 0);
    this.legR.position.set(0.2, 0.68, 0);
    root.add(this.legL, this.legR);

    // Red cape flap — prominent from chase cam behind
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.38, 0.08), red);
    flap.position.set(0, 1.02, -0.4);
    root.add(flap);
    this.flap = flap;

    this.group.add(root);
    root.scale.set(HERO_SCALE, HERO_SCALE, HERO_SCALE);
  }

  _makeArm(upperMat, lowerMat, gloveMat) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.32, 6, 12), upperMat);
    upper.position.y = -0.22;
    upper.castShadow = true;
    g.add(upper);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 6, 12), lowerMat);
    lower.position.y = -0.58;
    lower.castShadow = true;
    g.add(lower);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), gloveMat);
    glove.position.y = -0.86;
    g.add(glove);
    return g;
  }

  _makeLeg(upperMat, lowerMat, bootMat) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 6, 12), upperMat);
    upper.position.y = -0.24;
    upper.castShadow = true;
    g.add(upper);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.28, 6, 12), lowerMat);
    lower.position.y = -0.58;
    lower.castShadow = true;
    g.add(lower);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.32), bootMat);
    boot.position.set(0, -0.82, 0.05);
    boot.castShadow = true;
    g.add(boot);
    return g;
  }

  isLaneSwitching() {
    return this.laneT < 1;
  }

  canQueueLane() {
    return !this.isLaneSwitching() || this.laneT > 0.35;
  }

  tryLane(delta) {
    if (!this.alive) return false;
    const next = THREE.MathUtils.clamp(this.targetLane + delta, 0, LANES.length - 1);
    if (next === this.targetLane) return false;
    this.laneFromX = this.x;
    this.targetLane = next;
    this.laneToX = LANES[next];
    this.laneT = 0;
    this.laneDir = delta;
    this.lean = delta > 0 ? -1 : 1;
    return true;
  }

  tryJump() {
    if (!this.alive || this.sliding) return false;
    const grounded = !this.jumping || this.coyoteT > 0;
    if (!grounded) return false;
    this.jumping = true;
    this.jumpT = 0;
    this.coyoteT = 0;
    gsap.killTweensOf(this.root.scale);
    gsap.fromTo(
      this.root.scale,
      { x: HERO_SCALE * 1.12, y: HERO_SCALE * 0.86, z: HERO_SCALE * 1.12 },
      { x: HERO_SCALE, y: HERO_SCALE, z: HERO_SCALE, duration: 0.14, ease: 'power2.out' }
    );
    return true;
  }

  trySlide() {
    if (!this.alive || this.sliding) return false;
    if (this.jumping) {
      this.jumping = false;
      this.y = 0;
      this.jumpT = 1;
    }
    this.sliding = true;
    this.slideT = 0;
    gsap.killTweensOf(this.root.scale);
    gsap.to(this.root.scale, { x: HERO_SCALE * 1.18, y: HERO_SCALE * 0.5, z: HERO_SCALE * 1.08, duration: 0.1, ease: 'power2.out' });
    return true;
  }

  getHitBox() {
    const h = this.sliding ? PLAYER.slideHeight + 0.35 : this.jumping ? 1.5 : this.hitbox.h;
    const y = this.y + (this.sliding ? 0.35 : h * 0.5);
    return {
      x: this.x,
      y,
      z: this.z,
      w: this.hitbox.w,
      h: this.sliding ? 0.7 : h,
      d: this.hitbox.d,
    };
  }

  getLaneProgress() {
    return this.laneT;
  }

  update(dt) {
    this.justLanded = false;
    if (!this.alive) {
      this.group.position.set(this.x, this.y, this.z);
      return;
    }

    const grounded = !this.jumping && this.y <= 0.01;

    if (grounded) {
      this.coyoteT = PLAYER.coyoteTime;
    } else if (this.coyoteT > 0) {
      this.coyoteT -= dt;
    }
    this.wasGrounded = grounded;

    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / PLAYER.laneSwitchDuration);
      const eased = laneEase(this.laneT);
      this.x = this.laneFromX + (this.laneToX - this.laneFromX) * eased;
      if (this.laneT >= 1) {
        this.x = this.laneToX;
        this.lane = this.targetLane;
      }
    }

    this.lean = THREE.MathUtils.damp(this.lean, 0, PLAYER.laneLeanDamp, dt);

    if (this.jumping) {
      this.jumpT += dt / PLAYER.jumpDuration;
      const t = Math.min(1, this.jumpT);
      this.y = Math.sin(t * Math.PI) * PLAYER.jumpHeight;
      if (t >= 1) {
        this.jumping = false;
        this.y = 0;
        this.justLanded = true;
        gsap.killTweensOf(this.root.scale);
        gsap.fromTo(
          this.root.scale,
          { x: HERO_SCALE * 1.08, y: HERO_SCALE * 0.78, z: HERO_SCALE * 1.08 },
          { x: HERO_SCALE, y: HERO_SCALE, z: HERO_SCALE, duration: 0.18, ease: 'back.out(2.2)' }
        );
      }
    }

    if (this.sliding) {
      this.slideT += dt / PLAYER.slideDuration;
      this.y = 0;
      if (this.slideT >= 1) {
        this.sliding = false;
        gsap.killTweensOf(this.root.scale);
        gsap.to(this.root.scale, { x: HERO_SCALE, y: HERO_SCALE, z: HERO_SCALE, duration: 0.14, ease: 'power2.out' });
      }
    }

    const speedFactor = 1 + this.speed * 0.012;
    this.runPhase += dt * (13.5 + this.speed * 0.28) * speedFactor;
    const runActive = !this.jumping && !this.sliding;
    const bobAmp = runActive ? 0.17 : this.sliding ? 0.03 : 0.05;
    const bob = Math.sin(this.runPhase) * bobAmp;
    const headBob = Math.sin(this.runPhase * 2) * (runActive ? 0.1 : 0.02);
    const jumpPhase = this.jumping ? Math.min(1, this.jumpT) : 0;
    const armAmp = this.sliding ? 0.32 : this.jumping ? 0.72 : 1.62;
    const legAmp = this.sliding ? 0.18 : this.jumping ? 0.48 : 1.52;
    const armSwing = Math.sin(this.runPhase) * armAmp;
    const legSwing = Math.sin(this.runPhase) * legAmp;
    const runLean = runActive ? Math.sin(this.runPhase) * 0.1 : 0;

    if (this.sliding) {
      this.armL.rotation.x = 1.22;
      this.armR.rotation.x = 1.22;
      this.armL.rotation.z = -0.48;
      this.armR.rotation.z = 0.48;
      this.legL.rotation.x = -0.72;
      this.legR.rotation.x = 0.72;
      this.head.rotation.x = 0.38;
    } else if (this.jumping) {
      const tuck = Math.sin(jumpPhase * Math.PI);
      this.armL.rotation.x = -1.05 - tuck * 0.55;
      this.armR.rotation.x = -1.05 - tuck * 0.55;
      this.armL.rotation.z = -0.32;
      this.armR.rotation.z = 0.32;
      this.legL.rotation.x = 0.62 + tuck * 0.65;
      this.legR.rotation.x = 0.62 + tuck * 0.65;
      this.head.rotation.x = -0.28;
    } else {
      this.armL.rotation.x = armSwing;
      this.armR.rotation.x = -armSwing;
      this.armL.rotation.z = this.lean * 0.34 - legSwing * 0.08;
      this.armR.rotation.z = -this.lean * 0.34 + legSwing * 0.08;
      this.legL.rotation.x = -legSwing;
      this.legR.rotation.x = legSwing;
      this.head.rotation.x = headBob + runLean * 0.35;
    }

    this.head.rotation.z = this.lean * 0.28;

    const bank = this.lean * PLAYER.laneLeanMax * 1.12;
    this.torso.rotation.z = bank * 0.68;
    this.torso.rotation.x = runActive ? runLean * 0.45 : this.sliding ? 0.15 : 0;

    if (this.flap) {
      this.flap.rotation.x = 0.22 + Math.sin(this.runPhase * 0.6) * 0.16 + this.speed * 0.004;
    }

    this.group.position.set(this.x, this.y + bob, this.z);
    this.root.rotation.z = bank;
    this.root.rotation.x = this.sliding ? 0.78 : this.jumping ? -0.32 : 0.09 + runLean;
  }

  reset() {
    this.lane = 1;
    this.targetLane = 1;
    this.x = LANES[1];
    this.y = 0;
    this.z = 0;
    this.speed = PLAYER.runSpeedBase;
    this.jumping = false;
    this.sliding = false;
    this.laneT = 1;
    this.laneDir = 0;
    this.alive = true;
    this.lean = 0;
    this.coyoteT = PLAYER.coyoteTime;
    this.wasGrounded = true;
    gsap.killTweensOf(this.root.scale);
    gsap.killTweensOf(this.root.rotation);
    gsap.killTweensOf(this.group.position);
    gsap.killTweensOf(this.armL.rotation);
    gsap.killTweensOf(this.armR.rotation);
    gsap.killTweensOf(this.legL.rotation);
    gsap.killTweensOf(this.legR.rotation);
    gsap.killTweensOf(this.head.rotation);
    this.root.scale.set(HERO_SCALE, HERO_SCALE, HERO_SCALE);
    this.root.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.group.position.set(this.x, 0, 0);
  }

  kill() {
    this.alive = false;
    this.jumping = false;
    this.sliding = false;
    gsap.killTweensOf(this.root.rotation);
    gsap.killTweensOf(this.root.scale);
    gsap.killTweensOf(this.group.position);
    gsap.to(this.root.rotation, {
      x: -1.55,
      z: 1.35,
      y: (Math.random() - 0.5) * 0.6,
      duration: 0.38,
      ease: 'power3.in',
    });
    gsap.to(this.root.scale, {
      x: HERO_SCALE * 0.92,
      y: HERO_SCALE * 0.88,
      z: HERO_SCALE * 1.05,
      duration: 0.28,
      ease: 'power2.out',
    });
    gsap.to(this.group.position, {
      y: 0.35,
      z: this.z + 1.8,
      duration: 0.42,
      ease: 'power2.out',
    });
    gsap.to(this.armL.rotation, { x: 2.1, z: -0.9, duration: 0.3, ease: 'power2.out' });
    gsap.to(this.armR.rotation, { x: 1.8, z: 0.75, duration: 0.3, ease: 'power2.out' });
    gsap.to(this.legL.rotation, { x: -1.4, duration: 0.28, ease: 'power2.out' });
    gsap.to(this.legR.rotation, { x: 0.9, duration: 0.28, ease: 'power2.out' });
    gsap.to(this.head.rotation, { x: 0.65, z: 0.4, duration: 0.25, ease: 'power2.out' });
  }
}
