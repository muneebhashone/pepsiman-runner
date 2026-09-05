import * as THREE from "three";
import { PLAYER, LANES } from "./constants.js";
import { logoMap, decal, canvasTexture, makeCan } from "./Art.js";

/** Articulated superhero: shoulder/elbow and hip/knee rigs share a grounded gait. */
export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    this.root = new THREE.Group();
    this.group.add(this.root);
    scene.add(this.group);
    this.silver = new THREE.MeshPhysicalMaterial({
      color: 0xe1ebf5,
      metalness: 1,
      roughness: 0.22,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18,
    });
    this.blue = new THREE.MeshPhysicalMaterial({
      color: 0x004ed4,
      metalness: 0.58,
      roughness: 0.26,
      clearcoat: 1,
    });
    this.dark = new THREE.MeshStandardMaterial({
      color: 0x10335c,
      metalness: 0.4,
      roughness: 0.42,
    });
    this.red = new THREE.MeshStandardMaterial({
      color: 0xec263e,
      metalness: 0.4,
      roughness: 0.34,
    });
    this._build();
    this.reset();
    const shadowMap = canvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(16,32,48,.45)");
      g.addColorStop(1, "rgba(16,32,48,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.45),
      new THREE.MeshBasicMaterial({
        map: shadowMap,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
  }
  shape(parent, mat, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  _build() {
    this.torso = new THREE.Group();
    this.torso.position.y = 1.56;
    this.root.add(this.torso);
    // A sculpted tapered torso, with the broad blue chest and polished silver waist.
    const points = [
      new THREE.Vector2(0.24, -0.4),
      new THREE.Vector2(0.3, -0.28),
      new THREE.Vector2(0.34, -0.07),
      new THREE.Vector2(0.47, 0.24),
      new THREE.Vector2(0.43, 0.4),
      new THREE.Vector2(0.23, 0.48),
    ];
    const core = new THREE.Mesh(new THREE.LatheGeometry(points, 32), this.blue);
    core.scale.z = 0.63;
    core.castShadow = true;
    this.torso.add(core);
    this.shape(this.torso, this.silver, 0, -0.32, 0.015, 0.28, 0.28, 0.195);
    this.shape(this.torso, this.blue, -0.19, 0.23, 0.24, 0.22, 0.145, 0.055);
    this.shape(this.torso, this.blue, 0.19, 0.23, 0.24, 0.22, 0.145, 0.055);
    decal(this.torso, logoMap(), 0, 0.2, 0.311, 0.38, 0.38, 0);
    decal(this.torso, logoMap(), 0, 0.18, -0.307, 0.39, 0.39);
    this.shape(this.root, this.silver, 0, 2.08, 0, 0.125, 0.16, 0.13);
    this.head = new THREE.Group();
    this.head.position.set(0, 2.35, 0.015);
    this.root.add(this.head);
    this.shape(this.head, this.silver, 0, 0, 0, 0.23, 0.3, 0.23);
    this.shape(this.head, this.silver, 0, -0.07, 0.125, 0.17, 0.19, 0.145);
    this.shape(this.head, this.silver, 0, 0.01, 0.228, 0.045, 0.07, 0.045);
    // Fine brow and jaw planes give the faceless chrome mask a human silhouette.

    this.armL = this._arm(-1);
    this.armR = this._arm(1);
    this.legL = this._leg(-1);
    this.legR = this._leg(1);
    this.menuCan = makeCan();
    this.menuCan.scale.setScalar(0.68);
    this.menuCan.position.set(0, -0.5, 0.065);
    this.menuCan.rotation.x = 1.4;
    this.armL.userData.elbow.add(this.menuCan);
  }
  _arm(side) {
    const a = new THREE.Group();
    a.position.set(side * 0.45, 1.91, 0);
    this.root.add(a);
    this.shape(a, this.silver, 0, -0.045, 0, 0.173, 0.19, 0.178);
    this.shape(a, this.silver, side * 0.015, -0.28, 0, 0.137, 0.285, 0.145);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.49, 0);
    a.add(elbow);
    this.shape(elbow, this.silver, 0, 0, 0, 0.12, 0.13, 0.13);
    this.shape(elbow, this.silver, 0, -0.21, 0.012, 0.12, 0.25, 0.13);
    this.shape(elbow, this.blue, 0, -0.37, 0.012, 0.115, 0.09, 0.12);
    this.shape(elbow, this.silver, 0, -0.46, 0.015, 0.105, 0.135, 0.12);
    a.userData.elbow = elbow;
    return a;
  }
  _leg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.18, 1.24, 0);
    this.root.add(leg);
    this.shape(leg, this.silver, 0, -0.26, 0, 0.16, 0.33, 0.175);
    const knee = new THREE.Group();
    knee.position.y = -0.53;
    leg.add(knee);
    this.shape(knee, this.silver, 0, -0.04, 0.025, 0.125, 0.15, 0.145);
    this.shape(knee, this.silver, 0, -0.28, -0.025, 0.13, 0.27, 0.135);
    this.shape(knee, this.blue, 0, -0.49, 0.005, 0.105, 0.14, 0.115);
    this.shape(knee, this.blue, 0, -0.59, 0.105, 0.12, 0.095, 0.25);
    this.shape(knee, this.silver, 0, -0.635, 0.13, 0.125, 0.035, 0.235);
    leg.userData.knee = knee;
    return leg;
  }
  tryLane(delta) {
    if (!this.alive) return false;
    const next = THREE.MathUtils.clamp(this.targetLane + delta, 0, 2);
    if (next === this.targetLane) return false;
    this.laneFromX = this.x;
    this.targetLane = next;
    this.laneToX = LANES[next];
    this.laneT = 0;
    this.lean = delta;
    return true;
  }
  canQueueLane() {
    return this.laneT > 0.62;
  }
  isLaneSwitching() {
    return this.laneT < 1;
  }
  getLaneProgress() {
    return this.laneT;
  }
  tryJump() {
    if (!this.alive || this.jumping) return false;
    this.sliding = false;
    this.jumping = true;
    this.jumpT = 0;
    return true;
  }
  trySlide() {
    if (!this.alive || this.sliding) return false;
    this.jumping = false;
    this.y = 0;
    this.sliding = true;
    this.slideT = 0;
    return true;
  }
  getHitBox() {
    const h = this.sliding ? 0.72 : 2.25;
    return { x: this.x, y: this.y + h / 2, z: this.z, w: 0.62, h, d: 0.64 };
  }
  setGhost(active) {
    this.ghost = active;
    this.blue.emissive.set(active ? 0x0077ff : 0x000000);
    this.blue.emissiveIntensity = active ? 0.65 : 0;
  }
  update(dt, running = true) {
    this.justLanded = false;
    this.menuCan.visible = !running;
    if (!this.alive) {
      this.deathT = Math.min(1, this.deathT + dt * 2.7);
      this.root.rotation.z = -this.deathT * 1.25;
      this.root.rotation.x = -this.deathT * 0.6;
      this.group.position.y = 0.15;
      return;
    }
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / PLAYER.laneSwitchDuration);
      const e = 1 - Math.pow(1 - this.laneT, 3);
      this.x = THREE.MathUtils.lerp(this.laneFromX, this.laneToX, e);
      if (this.laneT === 1) this.lane = this.targetLane;
    }
    this.lean = THREE.MathUtils.damp(this.lean, 0, 9, dt);
    if (this.jumping) {
      this.jumpT = Math.min(1, this.jumpT + dt / PLAYER.jumpDuration);
      this.y = Math.sin(this.jumpT * Math.PI) * PLAYER.jumpHeight;
      if (this.jumpT === 1) {
        this.jumping = false;
        this.y = 0;
        this.justLanded = true;
        this.landT = 0.18;
      }
    }
    if (this.sliding) {
      this.slideT += dt;
      if (this.slideT >= PLAYER.slideDuration) this.sliding = false;
    }
    this.landT = Math.max(0, this.landT - dt);
    this.runPhase += dt * (running ? 10.5 + this.speed * 0.18 : 1.5);
    const p = this.runPhase,
      swing = Math.sin(p),
      stride = running ? 0.82 : 0.06;
    const slideBlend = this.sliding ? 1 : 0;
    this.root.position.y = this.sliding
      ? -0.68
      : running
        ? Math.abs(Math.cos(p)) * 0.07 - this.landT * 0.5
        : Math.sin(p) * 0.015;
    this.root.rotation.x = this.sliding
      ? -0.65
      : this.jumping
        ? -0.08
        : running
          ? 0.15
          : 0;
    this.root.rotation.z = -this.lean * 0.23;
    this.torso.rotation.y = running ? swing * 0.075 : 0;
    this.head.rotation.x = running ? -0.09 : 0.025;
    this.head.rotation.y = running ? 0 : -0.12;
    for (const [limb, sign] of [
      [this.armL, 1],
      [this.armR, -1],
    ]) {
      limb.rotation.x = this.sliding
        ? 1.2
        : this.jumping
          ? -0.75
          : -swing * stride * sign;
      limb.rotation.z = sign * (running ? 0.07 : 0.12);
      limb.userData.elbow.rotation.x = this.sliding
        ? -0.35
        : running
          ? -1.1
          : -0.24;
    }
    for (const [limb, sign] of [
      [this.legL, 1],
      [this.legR, -1],
    ]) {
      limb.rotation.x = this.sliding
        ? sign === 1
          ? -0.9
          : 1.15
        : this.jumping
          ? -0.75
          : swing * stride * sign;
      limb.userData.knee.rotation.x = this.sliding
        ? sign === 1
          ? 1.9
          : 0.35
        : this.jumping
          ? 1.4
          : Math.max(0, -Math.sin(p) * sign) * 1.5 * (running ? 1 : 0);
    }
    if (!running) {
      this.armL.rotation.x = -0.18;
      this.armL.userData.elbow.rotation.x = -1.22;
      this.legL.rotation.x = 0.1;
      this.legR.rotation.x = -0.075;
    }
    this.group.position.set(this.x, this.y, this.z);
    if (this.shadow) {
      this.shadow.position.set(this.x, 0.035, this.z);
      this.shadow.scale.setScalar(1 - this.y * 0.12);
      this.shadow.material.opacity = this.jumping ? 0.55 : 1;
    }
  }
  reset() {
    this.lane = this.targetLane = 1;
    this.x = this.y = this.z = 0;
    this.speed = PLAYER.runSpeedBase;
    this.laneT = 1;
    this.laneToX = this.laneFromX = 0;
    this.jumping = this.sliding = false;
    this.jumpT =
      this.slideT =
      this.runPhase =
      this.lean =
      this.landT =
      this.deathT =
        0;
    this.alive = true;
    this.setGhost(false);
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.scale.setScalar(1);
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.root.visible = true;
  }
  kill() {
    this.alive = false;
    this.jumping = this.sliding = false;
    this.deathT = 0;
  }
}
