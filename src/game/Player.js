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

/** Elastic overshoot ease — peaks past 1 then settles */
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

    const blue = gloss(COLORS.pepsiBlue, { metalness: 0.68, roughness: 0.2 });
    const red = gloss(COLORS.pepsiRed, { metalness: 0.45, roughness: 0.32 });
    const white = gloss(COLORS.pepsiWhite, { metalness: 0.25, roughness: 0.38 });
    const dark = gloss(0x111122, { metalness: 0.3, roughness: 0.5 });

    // Torso — slightly tapered capsule for mascot bulk
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.58, 8, 14), blue);
    torso.position.y = 1.05;
    torso.castShadow = true;
    root.add(torso);
    this.torso = torso;

    // Chest Pepsi swirl emblem
    const emblem = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.24, 28), white);
    disc.position.z = 0.41;
    emblem.add(disc);
    const swirlR = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.2, 28, 1, 0, Math.PI * 0.85),
      red
    );
    swirlR.position.z = 0.42;
    emblem.add(swirlR);
    const swirlB = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.2, 28, 1, Math.PI * 0.85, Math.PI * 0.85),
      blue
    );
    swirlB.position.z = 0.42;
    emblem.add(swirlB);
    const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), white);
    centerDot.position.z = 0.43;
    emblem.add(centerDot);
    emblem.position.set(0, 1.18, 0);
    torso.add(emblem);

    // Head — oversized for mascot read
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 22, 18), blue);
    head.position.y = 1.78;
    head.castShadow = true;
    root.add(head);
    this.head = head;

    // Eyes — wide, manic
    const eyeGeo = new THREE.SphereGeometry(0.09, 12, 10);
    const eyeL = new THREE.Mesh(eyeGeo, white);
    eyeL.position.set(-0.12, 0.06, 0.27);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), dark);
    pL.position.set(-0.12, 0.06, 0.34);
    const pR = pL.clone();
    pR.position.x = 0.12;
    head.add(eyeL, eyeR, pL, pR);

    // Grin
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.02, 8, 18, Math.PI * 0.9),
      white
    );
    smile.position.set(0, -0.09, 0.29);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    head.add(smile);

    // Red helmet crest
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.42), red);
    crest.position.set(0, 0.3, 0);
    head.add(crest);

    // Arms — pumpable
    this.armL = this._makeLimb(blue, red);
    this.armR = this._makeLimb(blue, red);
    this.armL.position.set(-0.5, 1.28, 0);
    this.armR.position.set(0.5, 1.28, 0);
    root.add(this.armL, this.armR);

    // Legs
    this.legL = this._makeLimb(blue, dark, true);
    this.legR = this._makeLimb(blue, dark, true);
    this.legL.position.set(-0.19, 0.55, 0);
    this.legR.position.set(0.19, 0.55, 0);
    root.add(this.legL, this.legR);

    // Red cape flaps
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.38, 0.06), red);
    flap.position.set(0, 1.02, -0.38);
    root.add(flap);
    this.flap = flap;

    // White gloves (accent spheres)
    const gloveGeo = new THREE.SphereGeometry(0.1, 10, 8);
    this.gloveL = new THREE.Mesh(gloveGeo, white);
    this.gloveL.position.set(0, -0.78, 0);
    this.armL.add(this.gloveL);
    this.gloveR = new THREE.Mesh(gloveGeo, white);
    this.gloveR.position.set(0, -0.78, 0);
    this.armR.add(this.gloveR);

    this.group.add(root);
    this.root.scale.set(1, 1, 1);
  }

  _makeLimb(mat, accent, isLeg = false) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(isLeg ? 0.12 : 0.1, isLeg ? 0.3 : 0.34, 5, 10),
      mat
    );
    upper.position.y = isLeg ? -0.22 : -0.24;
    upper.castShadow = true;
    g.add(upper);
    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(isLeg ? 0.1 : 0.08, isLeg ? 0.24 : 0.28, 5, 10),
      accent
    );
    lower.position.y = isLeg ? -0.58 : -0.58;
    lower.castShadow = true;
    g.add(lower);
    return g;
  }

  /** True when a lane switch tween is still running */
  isLaneSwitching() {
    return this.laneT < 1;
  }

  /** True when buffered lane input can be consumed */
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
      { x: 1.18, y: 0.82, z: 1.18 },
      { x: 1, y: 1, z: 1, duration: 0.14, ease: 'power2.out' }
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
    gsap.to(this.root.scale, { x: 1.25, y: 0.55, z: 1.15, duration: 0.1, ease: 'power2.out' });
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

  /** Normalized lane switch progress 0–1 */
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

    // Coyote timer — brief jump window after leaving ground
    if (grounded) {
      this.coyoteT = PLAYER.coyoteTime;
    } else if (this.coyoteT > 0) {
      this.coyoteT -= dt;
    }
    this.wasGrounded = grounded;

    // Lane tween with elastic overshoot
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / PLAYER.laneSwitchDuration);
      const eased = laneEase(this.laneT);
      this.x = this.laneFromX + (this.laneToX - this.laneFromX) * eased;
      if (this.laneT >= 1) {
        this.x = this.laneToX;
        this.lane = this.targetLane;
      }
    }

    // Lean damp back to upright
    this.lean = THREE.MathUtils.damp(this.lean, 0, PLAYER.laneLeanDamp, dt);

    // Jump sin arc
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
          { x: 1.28, y: 0.72, z: 1.28 },
          { x: 1, y: 1, z: 1, duration: 0.18, ease: 'back.out(2.2)' }
        );
      }
    }

    // Slide
    if (this.sliding) {
      this.slideT += dt / PLAYER.slideDuration;
      this.y = 0;
      if (this.slideT >= 1) {
        this.sliding = false;
        gsap.killTweensOf(this.root.scale);
        gsap.to(this.root.scale, { x: 1, y: 1, z: 1, duration: 0.14, ease: 'power2.out' });
      }
    }

    // Run cycle — chaotic mascot energy
    const speedFactor = 1 + this.speed * 0.012;
    this.runPhase += dt * (9.5 + this.speed * 0.18) * speedFactor;
    const runActive = !this.jumping && !this.sliding;
    const bobAmp = runActive ? 0.085 : this.sliding ? 0.015 : 0.03;
    const bob = Math.sin(this.runPhase) * bobAmp;
    const headBob = Math.sin(this.runPhase * 2) * (runActive ? 0.04 : 0.01);
    const armAmp = this.sliding ? 0.15 : this.jumping ? 0.35 : 0.85;
    const legAmp = this.sliding ? 0.08 : this.jumping ? 0.2 : 0.72;
    const armSwing = Math.sin(this.runPhase) * armAmp;
    const legSwing = Math.sin(this.runPhase) * legAmp;

    // Arm pump + slide pose
    if (this.sliding) {
      this.armL.rotation.x = 0.9;
      this.armR.rotation.x = 0.9;
      this.armL.rotation.z = -0.25;
      this.armR.rotation.z = 0.25;
      this.legL.rotation.x = -0.35;
      this.legR.rotation.x = 0.35;
    } else {
      this.armL.rotation.x = armSwing;
      this.armR.rotation.x = -armSwing;
      this.armL.rotation.z = this.lean * 0.15;
      this.armR.rotation.z = -this.lean * 0.15;
      this.legL.rotation.x = -legSwing;
      this.legR.rotation.x = legSwing;
    }

    // Head bob + lean into lane switch
    this.head.rotation.x = headBob + (this.jumping ? -0.12 : this.sliding ? 0.2 : 0);
    this.head.rotation.z = this.lean * 0.18;

    // Torso bank
    const bank = this.lean * PLAYER.laneLeanMax;
    this.torso.rotation.z = bank * 0.6;

    // Cape flutter
    if (this.flap) {
      this.flap.rotation.x = 0.18 + Math.sin(this.runPhase * 0.6) * 0.1 + this.speed * 0.004;
    }

    this.group.position.set(this.x, this.y + bob, this.z);
    this.root.rotation.z = bank;
    this.root.rotation.x = this.sliding ? 0.62 : this.jumping ? -0.18 : Math.sin(this.runPhase) * 0.04;
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
    this.root.scale.set(1, 1, 1);
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
