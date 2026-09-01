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
    this.runPhase = 0;
    this.alive = true;
    this.justLanded = false;
    this.lean = 0;
    this.group = new THREE.Group();
    this._buildMesh();
    scene.add(this.group);
    this.hitbox = { w: 0.7, h: 1.7, d: 0.6 };
  }

  _buildMesh() {
    const root = new THREE.Group();
    this.root = root;

    const blue = gloss(COLORS.pepsiBlue, { metalness: 0.65, roughness: 0.22 });
    const red = gloss(COLORS.pepsiRed, { metalness: 0.4, roughness: 0.35 });
    const white = gloss(COLORS.pepsiWhite, { metalness: 0.2, roughness: 0.4 });
    const dark = gloss(0x111122, { metalness: 0.3, roughness: 0.5 });

    // Body
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.55, 6, 12), blue);
    torso.position.y = 1.05;
    torso.castShadow = true;
    root.add(torso);
    this.torso = torso;

    // Chest Pepsi swirl (disk + arcs)
    const emblem = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), white);
    disc.position.z = 0.39;
    emblem.add(disc);
    const swirlR = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.18, 24, 1, 0, Math.PI),
      red
    );
    swirlR.position.z = 0.4;
    emblem.add(swirlR);
    const swirlB = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.18, 24, 1, Math.PI, Math.PI),
      blue
    );
    swirlB.position.z = 0.4;
    emblem.add(swirlB);
    const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), white);
    centerDot.position.z = 0.41;
    emblem.add(centerDot);
    emblem.position.set(0, 1.15, 0);
    torso.add(emblem);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), blue);
    head.position.y = 1.72;
    head.castShadow = true;
    root.add(head);
    this.head = head;

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 12, 10);
    const eyeL = new THREE.Mesh(eyeGeo, white);
    eyeL.position.set(-0.11, 0.05, 0.26);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.11;
    const pupilMat = dark;
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), pupilMat);
    pL.position.set(-0.11, 0.05, 0.32);
    const pR = pL.clone();
    pR.position.x = 0.11;
    head.add(eyeL, eyeR, pL, pR);

    // Smile
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.018, 8, 16, Math.PI),
      white
    );
    smile.position.set(0, -0.08, 0.28);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    head.add(smile);

    // Helmet crest (red)
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.4), red);
    crest.position.set(0, 0.28, 0);
    head.add(crest);

    // Arms
    this.armL = this._makeLimb(blue, red);
    this.armR = this._makeLimb(blue, red);
    this.armL.position.set(-0.48, 1.25, 0);
    this.armR.position.set(0.48, 1.25, 0);
    root.add(this.armL, this.armR);

    // Legs
    this.legL = this._makeLimb(blue, dark, true);
    this.legR = this._makeLimb(blue, dark, true);
    this.legL.position.set(-0.18, 0.55, 0);
    this.legR.position.set(0.18, 0.55, 0);
    root.add(this.legL, this.legR);

    // Cape-ish red flaps
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.05), red);
    flap.position.set(0, 1.0, -0.35);
    root.add(flap);
    this.flap = flap;

    this.group.add(root);
    this.root.scale.set(1, 1, 1);
  }

  _makeLimb(mat, accent, isLeg = false) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(isLeg ? 0.11 : 0.09, isLeg ? 0.28 : 0.32, 4, 8),
      mat
    );
    upper.position.y = isLeg ? -0.2 : -0.22;
    upper.castShadow = true;
    g.add(upper);
    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(isLeg ? 0.09 : 0.07, isLeg ? 0.22 : 0.26, 4, 8),
      accent
    );
    lower.position.y = isLeg ? -0.55 : -0.55;
    lower.castShadow = true;
    g.add(lower);
    return g;
  }

  tryLane(delta) {
    if (!this.alive) return false;
    const next = THREE.MathUtils.clamp(this.targetLane + delta, 0, LANES.length - 1);
    if (next === this.targetLane) return false;
    this.laneFromX = this.x;
    this.targetLane = next;
    this.laneToX = LANES[next];
    this.laneT = 0;
    this.lean = delta > 0 ? -1 : 1;
    return true;
  }

  tryJump() {
    if (!this.alive || this.jumping || this.sliding) return false;
    this.jumping = true;
    this.jumpT = 0;
    gsap.fromTo(
      this.root.scale,
      { x: 1.15, y: 0.85, z: 1.15 },
      { x: 1, y: 1, z: 1, duration: 0.18, ease: 'power2.out' }
    );
    return true;
  }

  trySlide() {
    if (!this.alive || this.jumping || this.sliding) return false;
    this.sliding = true;
    this.slideT = 0;
    gsap.to(this.root.scale, { x: 1.2, y: 0.55, z: 1.1, duration: 0.12, ease: 'power2.out' });
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

  update(dt) {
    this.justLanded = false;
    if (!this.alive) {
      this.group.position.set(this.x, this.y, this.z);
      return;
    }

    // Lane tween with overshoot
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / PLAYER.laneSwitchDuration);
      const t = this.laneT;
      // overshoot ease
      const over = t < 1 ? 1 + 0.12 * Math.sin(t * Math.PI) : 1;
      const eased = t * t * (3 - 2 * t);
      const ox = this.laneFromX + (this.laneToX - this.laneFromX) * eased * over;
      // blend overshoot back at end
      const settle = this.laneFromX + (this.laneToX - this.laneFromX) * eased;
      this.x = t > 0.85 ? settle : ox;
      if (this.laneT >= 1) {
        this.x = this.laneToX;
        this.lane = this.targetLane;
      }
    }
    this.lean = THREE.MathUtils.damp(this.lean, 0, 8, dt);

    // Jump arc
    if (this.jumping) {
      this.jumpT += dt / PLAYER.jumpDuration;
      const t = this.jumpT;
      this.y = Math.sin(Math.min(1, t) * Math.PI) * PLAYER.jumpHeight;
      if (t >= 1) {
        this.jumping = false;
        this.y = 0;
        this.justLanded = true;
        gsap.fromTo(
          this.root.scale,
          { x: 1.25, y: 0.75, z: 1.25 },
          { x: 1, y: 1, z: 1, duration: 0.2, ease: 'back.out(2)' }
        );
      }
    }

    // Slide
    if (this.sliding) {
      this.slideT += dt / PLAYER.slideDuration;
      this.y = 0;
      if (this.slideT >= 1) {
        this.sliding = false;
        gsap.to(this.root.scale, { x: 1, y: 1, z: 1, duration: 0.15, ease: 'power2.out' });
      }
    }

    // Run bob + limbs
    this.runPhase += dt * (8 + this.speed * 0.15);
    const bob = Math.sin(this.runPhase) * (this.jumping || this.sliding ? 0.02 : 0.06);
    const armSwing = Math.sin(this.runPhase) * (this.sliding ? 0.2 : 0.7);
    const legSwing = Math.sin(this.runPhase) * (this.sliding ? 0.1 : 0.6);
    this.armL.rotation.x = armSwing;
    this.armR.rotation.x = -armSwing;
    this.legL.rotation.x = -legSwing;
    this.legR.rotation.x = legSwing;
    if (this.flap) this.flap.rotation.x = 0.15 + Math.sin(this.runPhase * 0.5) * 0.08;

    this.group.position.set(this.x, this.y + bob, this.z);
    this.root.rotation.z = this.lean * 0.35;
    this.root.rotation.x = this.sliding ? 0.55 : this.jumping ? -0.15 : 0;
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
    this.alive = true;
    this.lean = 0;
    this.root.scale.set(1, 1, 1);
    this.root.rotation.set(0, 0, 0);
    this.group.position.set(this.x, 0, 0);
  }

  kill() {
    this.alive = false;
    gsap.to(this.root.rotation, { x: -1.2, z: 0.8, duration: 0.4, ease: 'power2.in' });
    gsap.to(this.group.position, { y: 0.2, duration: 0.3 });
  }
}
