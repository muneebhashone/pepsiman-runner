import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';
import { LANES, PLAYER, COLORS } from './constants.js';

function gloss(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.28,
    emissive: opts.emissive ?? color,
    emissiveIntensity: opts.emissiveIntensity ?? 0.06,
  });
}

function laneEase(t, overshoot = PLAYER.laneOvershoot) {
  if (t >= 1) return 1;
  const smooth = t * t * (3 - 2 * t);
  const bounce = 1 + overshoot * Math.sin(t * Math.PI);
  return smooth * bounce;
}

/** Pepsi swirl emblem — readable from chase cam (chest or back) */
function makeEmblem(materials, flipZ = false) {
  const g = new THREE.Group();
  const z = flipZ ? -0.44 : 0.44;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.26, 28), materials.white);
  disc.position.z = z;
  if (flipZ) disc.rotation.y = Math.PI;
  g.add(disc);
  const swirlR = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.22, 28, 1, 0, Math.PI * 0.85),
    materials.red
  );
  swirlR.position.z = flipZ ? z - 0.01 : z + 0.01;
  if (flipZ) swirlR.rotation.y = Math.PI;
  g.add(swirlR);
  const swirlB = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.22, 28, 1, Math.PI * 0.85, Math.PI * 0.85),
    materials.blue
  );
  swirlB.position.z = flipZ ? z - 0.01 : z + 0.01;
  if (flipZ) swirlB.rotation.y = Math.PI;
  g.add(swirlB);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), materials.white);
  dot.position.z = flipZ ? z - 0.02 : z + 0.02;
  if (flipZ) dot.rotation.y = Math.PI;
  g.add(dot);
  return g;
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
    this.bounds = { ...PLAYER.meshBounds };
  }

  _buildMesh() {
    const root = new THREE.Group();
    this.root = root;

    const mats = {
      suit: gloss(COLORS.pepsiWhite, { metalness: 0.35, roughness: 0.22, emissiveIntensity: 0.14 }),
      silver: gloss(COLORS.pepsiSilver, { metalness: 0.72, roughness: 0.18, emissiveIntensity: 0.1 }),
      blue: gloss(COLORS.pepsiBlue, { metalness: 0.6, roughness: 0.2, emissiveIntensity: 0.18 }),
      red: gloss(COLORS.pepsiRed, { metalness: 0.4, roughness: 0.3, emissiveIntensity: 0.2 }),
      white: gloss(COLORS.pepsiWhite, { metalness: 0.2, roughness: 0.35, emissiveIntensity: 0.22 }),
      dark: gloss(0x1a1a2a, { metalness: 0.2, roughness: 0.5, emissiveIntensity: 0 }),
    };

    // ── White/silver suit torso (bright from chase cam) ──
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.6, 8, 14), mats.suit);
    torso.position.y = 1.02;
    torso.castShadow = true;
    root.add(torso);
    this.torso = torso;

    // Silver shoulder pads — break up silhouette, read from behind
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mats.silver);
    shoulderL.position.set(-0.42, 1.32, 0);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.42;
    root.add(shoulderL, shoulderR);

    // Chest emblem (front)
    const chestEmblem = makeEmblem(mats, false);
    chestEmblem.position.set(0, 1.12, 0);
    torso.add(chestEmblem);

    // Back emblem — critical for chase-cam readability
    const backEmblem = makeEmblem(mats, true);
    backEmblem.position.set(0, 1.1, 0);
    torso.add(backEmblem);

    // Bold red back cape — pops against dark highway
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.55, 0.07), mats.red);
    cape.position.set(0, 1.05, -0.4);
    root.add(cape);
    this.cape = cape;

    // Red waist stripe
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.42), mats.red);
    waist.position.set(0, 0.78, 0);
    root.add(waist);

    // ── Blue helmet head (iconic Pepsiman) ──
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 22, 18), mats.blue);
    head.position.y = 1.74;
    head.castShadow = true;
    root.add(head);
    this.head = head;

    // Red helmet crest — visible silhouette from behind
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.48), mats.red);
    crest.position.set(0, 0.28, -0.02);
    head.add(crest);

    // Face (front only) — manic eyes + grin
    const eyeGeo = new THREE.SphereGeometry(0.085, 12, 10);
    const eyeL = new THREE.Mesh(eyeGeo, mats.white);
    eyeL.position.set(-0.11, 0.05, 0.26);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.11;
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), mats.dark);
    pL.position.set(-0.11, 0.05, 0.32);
    const pR = pL.clone();
    pR.position.x = 0.11;
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.018, 8, 16, Math.PI * 0.9),
      mats.white
    );
    smile.position.set(0, -0.08, 0.28);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    head.add(eyeL, eyeR, pL, pR, smile);

    // ── Arms: white suit + red cuffs + big white gloves ──
    this.armL = this._makeArm(mats);
    this.armR = this._makeArm(mats);
    this.armL.position.set(-0.48, 1.3, 0);
    this.armR.position.set(0.48, 1.3, 0);
    root.add(this.armL, this.armR);

    // ── Legs: white suit + blue boots + red stripe ──
    this.legL = this._makeLeg(mats);
    this.legR = this._makeLeg(mats);
    this.legL.position.set(-0.17, 0.52, 0);
    this.legR.position.set(0.17, 0.52, 0);
    root.add(this.legL, this.legR);

    this.group.add(root);
    this.root.scale.set(1, 1, 1);
  }

  _makeArm(mats) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 5, 10), mats.suit);
    upper.position.y = -0.22;
    upper.castShadow = true;
    g.add(upper);
    const cuff = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.12, 4, 8), mats.red);
    cuff.position.y = -0.52;
    g.add(cuff);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mats.white);
    glove.position.y = -0.72;
    glove.castShadow = true;
    g.add(glove);
    return g;
  }

  _makeLeg(mats) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.28, 5, 10), mats.suit);
    upper.position.y = -0.2;
    upper.castShadow = true;
    g.add(upper);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.14), mats.red);
    stripe.position.y = -0.42;
    g.add(stripe);
    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.18, 4, 8), mats.blue);
    boot.position.y = -0.6;
    boot.castShadow = true;
    g.add(boot);
    return g;
  }

  isLaneSwitching() {
    return this.laneT < 1;
  }

  canQueueLane() {
    return !this.isLaneSwitching() || this.laneT > 0.2;
  }

  _collisionX() {
    if (this.laneT >= 1) return this.x;
    const t = Math.min(1, this.laneT);
    const smooth = t * t * (3 - 2 * t);
    return this.laneFromX + (this.laneToX - this.laneFromX) * smooth;
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
      { x: 1.16, y: 0.84, z: 1.16 },
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
    gsap.to(this.root.scale, { x: 1.22, y: 0.55, z: 1.12, duration: 0.1, ease: 'power2.out' });
    return true;
  }

  /** Hitbox tightly matches visible white-suit silhouette */
  getHitBox() {
    const cx = this._collisionX();
    const feet = this.y + this.bounds.feetOffset;
    const scaleY = this.root.scale.y;

    if (this.sliding) {
      const hb = PLAYER.hitboxSlide;
      const h = hb.h * scaleY;
      return {
        x: cx,
        y: feet + h * 0.5,
        z: this.z,
        w: hb.w * this.root.scale.x,
        h,
        d: hb.d * this.root.scale.z,
        mode: 'slide',
        feetY: feet,
      };
    }

    if (this.jumping) {
      const hb = PLAYER.hitboxJump;
      const rise = Math.min(1, this.y / PLAYER.jumpHeight);
      const h = hb.h * (1 - rise * 0.08) * scaleY;
      return {
        x: cx,
        y: feet + h * 0.5,
        z: this.z,
        w: hb.w * this.root.scale.x,
        h,
        d: hb.d * this.root.scale.z,
        mode: 'jump',
        feetY: feet,
        apexY: this.y,
      };
    }

    const hb = PLAYER.hitbox;
    const h = hb.h * scaleY;
    return {
      x: cx,
      y: feet + h * 0.5,
      z: this.z,
      w: hb.w * this.root.scale.x,
      h,
      d: hb.d * this.root.scale.z,
      mode: 'run',
      feetY: feet,
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
          { x: 1.26, y: 0.74, z: 1.26 },
          { x: 1, y: 1, z: 1, duration: 0.18, ease: 'back.out(2.2)' }
        );
      }
    }

    if (this.sliding) {
      this.slideT += dt / PLAYER.slideDuration;
      this.y = 0;
      if (this.slideT >= 1) {
        this.sliding = false;
        gsap.killTweensOf(this.root.scale);
        gsap.to(this.root.scale, { x: 1, y: 1, z: 1, duration: 0.14, ease: 'power2.out' });
      }
    }

    // Exaggerated run cycle — readable from chase cam behind
    const speedFactor = 1 + this.speed * 0.014;
    this.runPhase += dt * (10 + this.speed * 0.2) * speedFactor;
    const runActive = !this.jumping && !this.sliding;
    const bobAmp = runActive ? 0.1 : this.sliding ? 0.02 : 0.04;
    const bob = Math.sin(this.runPhase) * bobAmp;
    const headBob = Math.sin(this.runPhase * 2) * (runActive ? 0.06 : 0.015);
    const armAmp = this.sliding ? 0.2 : this.jumping ? 0.4 : 1.05;
    const legAmp = this.sliding ? 0.12 : this.jumping ? 0.25 : 0.9;
    const armSwing = Math.sin(this.runPhase) * armAmp;
    const legSwing = Math.sin(this.runPhase) * legAmp;
    const hipSway = Math.sin(this.runPhase) * (runActive ? 0.08 : 0.02);

    if (this.sliding) {
      this.armL.rotation.x = 0.95;
      this.armR.rotation.x = 0.95;
      this.armL.rotation.z = -0.3;
      this.armR.rotation.z = 0.3;
      this.legL.rotation.x = -0.4;
      this.legR.rotation.x = 0.4;
    } else {
      this.armL.rotation.x = armSwing;
      this.armR.rotation.x = -armSwing;
      this.armL.rotation.z = this.lean * 0.2 - 0.05;
      this.armR.rotation.z = -this.lean * 0.2 + 0.05;
      this.legL.rotation.x = -legSwing;
      this.legR.rotation.x = legSwing;
    }

    this.head.rotation.x = headBob + (this.jumping ? -0.14 : this.sliding ? 0.22 : 0);
    this.head.rotation.z = this.lean * 0.2;

    const bank = this.lean * PLAYER.laneLeanMax;
    this.torso.rotation.z = bank * 0.65;

    // Cape + hip sway — big motion from behind
    if (this.cape) {
      this.cape.rotation.x = 0.22 + Math.sin(this.runPhase * 0.7) * 0.14 + this.speed * 0.005;
      this.cape.rotation.z = Math.sin(this.runPhase * 0.5) * 0.06;
    }
    this.root.rotation.y = hipSway;

    this.group.position.set(this.x, this.y + bob, this.z);
    this.root.rotation.z = bank;
    this.root.rotation.x = this.sliding ? 0.65 : this.jumping ? -0.2 : Math.sin(this.runPhase) * 0.05;
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
