import * as THREE from "three";

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.shakeTime = 0;
    this.shakeAmp = 0;
    this.fovPunch = 0;
    this.zoneFov = 0;
    this.reducedMotion = false;
    this._look = new THREE.Vector3();
  }
  snapTo(pos) {
    this.camera.position.set(0, 4.8, pos.z - 9);
    this.camera.fov = this.camera.aspect < 0.75 ? 67 : 55;
    this.camera.lookAt(0, 1.15, pos.z + 11);
    this.camera.updateProjectionMatrix();
    this.shakeTime = 0;
    this.fovPunch = 0;
  }
  update(dt, pos, speedNorm, _lean = 0, jumping = false, playerY = 0) {
    const c = this.camera,
      blend = 1 - Math.exp(-dt * 10);
    c.position.x = THREE.MathUtils.lerp(
      c.position.x,
      pos.x * (c.aspect < 0.75 ? 0.62 : 0.13),
      blend,
    );
    c.position.y = THREE.MathUtils.lerp(
      c.position.y,
      4.8 + playerY * 0.15,
      blend,
    );
    c.position.z = pos.z - 9 - speedNorm * 0.5;
    this._look.set(
      pos.x * (c.aspect < 0.75 ? 0.28 : 0.035),
      1.15 + playerY * 0.1,
      pos.z + 11,
    );
    c.lookAt(this._look);
    if (this.shakeTime > 0 && !this.reducedMotion) {
      this.shakeTime -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeTime / 0.3);
      c.position.x += Math.sin(this.shakeTime * 97) * a;
      c.position.y += Math.cos(this.shakeTime * 71) * a * 0.5;
    }
    this.fovPunch = Math.max(0, this.fovPunch - dt * 12);
    const target =
      (c.aspect < 0.75 ? 67 : 55) +
      (this.reducedMotion ? 0 : speedNorm * 4 + this.fovPunch);
    c.fov = THREE.MathUtils.lerp(c.fov, target, blend);
    c.updateProjectionMatrix();
  }
  menu(time) {
    const mobile = this.camera.aspect < 0.85;
    this.camera.position.set(
      mobile ? 3.8 : 4.3,
      mobile ? 3.1 : 2.7,
      mobile ? -8.5 : -6.5,
    );
    this.camera.lookAt(mobile ? 0.7 : 1.8, mobile ? -0.4 : 1.35, 0.8);
    this.camera.fov = mobile ? 53 : 43;
    this.camera.updateProjectionMatrix();
  }
  landShake(strength = 0.04, duration = 0.12) {
    this.shakeAmp = strength;
    this.shakeTime = duration;
  }
  deathShake(strength, duration) {
    this.landShake(strength, duration);
  }
  punchFov(amount = 1) {
    this.fovPunch = Math.max(this.fovPunch, amount);
  }
  setZoneFov(tick) {
    this.zoneFov = tick;
  }
  notifyLaneSwitch() {}
}
