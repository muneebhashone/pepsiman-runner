import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';
import { LANES, PLAYER, COLORS } from './constants.js';

function gloss(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.28,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
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

    const silver = gloss(0xd8dde8, { metalness: 0.72, roughness: 0.22 });
    const white = gloss(COLORS.pepsiWhite, { metalness: 0.35, roughness: 0.32 });
    const blue = gloss(COLORS.pepsiBlue, { metalness: 0.68, roughness: 0.2 });
    const red = gloss(COLORS.pepsiRed, { metalness: 0.45, roughness: 0.32 });
    const dark = gloss(0x111122, { metalness: 0.3, roughness: 0.5 });

    // Pelvis / hips
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.34), silver);
    hips.position.y = 0.72;
    hips.castShadow = true;
    root.add(hips);

    // White suit torso with blue chest panel
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.38), white);
    torso.position.y = 1.18;
    torso.castShadow = true;
    root.add(torso);
    this.torso = torso;

    const chestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.08), blue);
    chestPanel.position.set(0, 0.04, 0.2);
    torso.add(chestPanel);

    // Swirl emblem on chest
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

    // Red belt stripe
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.4), red);
    belt.position.y = -0.28;
    torso.add(belt);

    // Oversized mascot head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 18), white);
    head.position.y = 1.72;
    head.castShadow = true;
    root.add(head);
    this.head = head;

    const faceMask = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), blue);
    faceMask.position.set(0, -0.02, 0.08);
    faceMask.rotation.x = 0.15;
    head.add(faceMask);

    const eyeGeo = new THREE.SphereGeometry(0.1, 12, 10);
    const eyeL = new THREE.Mesh(eyeGeo, white);
    eyeL.position.set(-0.13, 0.08, 0.28);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.13;
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), dark);
    pL.position.set(-0.13, 0.08, 0.35);
    const pR = pL.clone();
    pR.position.x = 0.13;
    head.add(eyeL, eyeR, pL, pR);

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.022, 8, 18, Math.PI * 0.88),
      red
    );
    smile.position.set(0, -0.1, 0.3);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    head.add(smile);

    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.44), red);
    crest.position.set(0, 0.32, 0);
    head.add(crest);

    // Arms — white upper, blue forearm, red glove
    this.armL = this._makeArm(white, blue, red);
    this.armR = this._makeArm(white, blue, red);
    this.armL.position.set(-0.42, 1.38, 0);
    this.armR.position.set(0.42, 1.38, 0);
    root.add(this.armL, this.armR);

    // Legs — silver thighs, blue shins, red boots
    this.legL = this._makeLeg(silver, blue, red);
    this.legR = this._makeLeg(silver, blue, red);
    this.legL.position.set(-0.17, 0.72, 0);
    this.legR.position.set(0.17, 0.72, 0);
    root.add(this.legL, this.legR);

    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.06), red);
    flap.position.set(0, 1.05, -0.36);
    root.add(flap);
    this.flap = flap;

    this.group.add(root);
    root.scale.set(0.94, 0.94, 0.94);
  }

  _makeArm(upperMat, lowerMat, gloveMat) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.28, 5, 10), upperMat);
    upper.position.y = -0.2;
    upper.castShadow = true;
    g.add(upper);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.26, 5, 10), lowerMat);
    lower.position.y = -0.52;
    lower.castShadow = true;
    g.add(lower);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), gloveMat);
    glove.position.y = -0.78;
    g.add(glove);
    return g;
  }

  _makeLeg(upperMat, lowerMat, bootMat) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.28, 5, 10), upperMat);
    upper.position.y = -0.22;
    upper.castShadow = true;
    g.add(upper);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 5, 10), lowerMat);
    lower.position.y = -0.54;
    lower.castShadow = true;
    g.add(lower);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.28), bootMat);
    boot.position.set(0, -0.76, 0.04);
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
      { x: 1.12, y: 0.86, z: 1.12 },
      { x: 0.94, y: 0.94, z: 0.94, duration: 0.14, ease: 'power2.out' }
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
    gsap.to(this.root.scale, { x: 1.18, y: 0.5, z: 1.08, duration: 0.1, ease: 'power2.out' });
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
          { x: 1.08, y: 0.78, z: 1.08 },
          { x: 0.94, y: 0.94, z: 0.94, duration: 0.18, ease: 'back.out(2.2)' }
        );
      }
    }

    if (this.sliding) {
      this.slideT += dt / PLAYER.slideDuration;
      this.y = 0;
      if (this.slideT >= 1) {
        this.sliding = false;
        gsap.killTweensOf(this.root.scale);
        gsap.to(this.root.scale, { x: 0.94, y: 0.94, z: 0.94, duration: 0.14, ease: 'power2.out' });
      }
    }

    const speedFactor = 1 + this.speed * 0.012;
    this.runPhase += dt * (10.5 + this.speed * 0.2) * speedFactor;
    const runActive = !this.jumping && !this.sliding;
    const bobAmp = runActive ? 0.11 : this.sliding ? 0.02 : 0.04;
    const bob = Math.sin(this.runPhase) * bobAmp;
    const headBob = Math.sin(this.runPhase * 2) * (runActive ? 0.06 : 0.015);
    const jumpPhase = this.jumping ? Math.min(1, this.jumpT) : 0;
    const armAmp = this.sliding ? 0.2 : this.jumping ? 0.55 : 1.05;
    const legAmp = this.sliding ? 0.1 : this.jumping ? 0.35 : 0.95;
    const armSwing = Math.sin(this.runPhase) * armAmp;
    const legSwing = Math.sin(this.runPhase) * legAmp;

    if (this.sliding) {
      this.armL.rotation.x = 1.05;
      this.armR.rotation.x = 1.05;
      this.armL.rotation.z = -0.35;
      this.armR.rotation.z = 0.35;
      this.legL.rotation.x = -0.55;
      this.legR.rotation.x = 0.55;
      this.head.rotation.x = 0.28;
    } else if (this.jumping) {
      const tuck = Math.sin(jumpPhase * Math.PI);
      this.armL.rotation.x = -0.85 - tuck * 0.4;
      this.armR.rotation.x = -0.85 - tuck * 0.4;
      this.armL.rotation.z = -0.2;
      this.armR.rotation.z = 0.2;
      this.legL.rotation.x = 0.45 + tuck * 0.5;
      this.legR.rotation.x = 0.45 + tuck * 0.5;
      this.head.rotation.x = -0.18;
    } else {
      this.armL.rotation.x = armSwing;
      this.armR.rotation.x = -armSwing;
      this.armL.rotation.z = this.lean * 0.18;
      this.armR.rotation.z = -this.lean * 0.18;
      this.legL.rotation.x = -legSwing;
      this.legR.rotation.x = legSwing;
      this.head.rotation.x = headBob;
    }

    this.head.rotation.z = this.lean * 0.2;

    const bank = this.lean * PLAYER.laneLeanMax;
    this.torso.rotation.z = bank * 0.55;

    if (this.flap) {
      this.flap.rotation.x = 0.22 + Math.sin(this.runPhase * 0.6) * 0.12 + this.speed * 0.004;
    }

    this.group.position.set(this.x, this.y + bob, this.z);
    this.root.rotation.z = bank;
    this.root.rotation.x = this.sliding ? 0.68 : this.jumping ? -0.22 : Math.sin(this.runPhase) * 0.05;
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
    this.root.scale.set(0.94, 0.94, 0.94);
    this.root.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.group.position.set(this.x, 0, 0);
  }

  kill() {
    this.alive = false;
    gsap.killTweensOf(this.root.rotation);
    gsap.killTweensOf(this.group.position);
    gsap.to(this.root.rotation, { x: -1.3, z: 0.9, duration: 0.42, ease: 'power2.in' });
    gsap.to(this.group.position, { y: 0.25, duration: 0.32 });
  }
}
