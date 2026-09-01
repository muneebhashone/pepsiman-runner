import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { CAMERA } from './constants.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.offset = new THREE.Vector3(CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z);
    this.lookTarget = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._jumpBlend = 0;
    this.shakeAmp = 0;
    this.shakeTime = 0;
    this.fovPunch = 0;
    this.baseFov = CAMERA.fovBase;
    this._shakeSeed = 0;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this._pos.copy(camera.position);
  }

  landShake(strength = CAMERA.landShake) {
    this.shakeAmp = Math.max(this.shakeAmp, strength);
    this.shakeTime = CAMERA.landShakeDuration;
    this._shakeSeed = Math.random() * 1000;
  }

  punchFov(amount = CAMERA.fovPunch) {
    this.fovPunch = Math.max(this.fovPunch, amount);
  }

  /** Frame-rate independent exponential smoothing */
  _expSmooth(current, target, rate, dt) {
    const t = 1 - Math.pow(rate, dt * 60);
    return current + (target - current) * t;
  }

  update(dt, playerPos, speedNorm, playerLean = 0, jumping = false, playerY = 0) {
    const jumpTarget = jumping || playerY > 0.12 ? 1 : 0;
    this._jumpBlend = this._expSmooth(this._jumpBlend, jumpTarget, 0.12, dt);

    const lookAhead =
      CAMERA.lookAhead +
      speedNorm * CAMERA.lookAheadSpeedBoost +
      this._jumpBlend * CAMERA.jumpLookBoost;
    const lateralLead = playerLean * 0.55;
    const pullZ = this.offset.z - this._jumpBlend * CAMERA.jumpPullback;
    const liftY = this.offset.y + this._jumpBlend * 0.85;

    this.desired.set(
      playerPos.x * 0.28 + lateralLead,
      playerPos.y + liftY,
      playerPos.z + pullZ
    );

    this._pos.x = this._expSmooth(this._pos.x, this.desired.x, CAMERA.lag, dt);
    this._pos.y = this._expSmooth(this._pos.y, this.desired.y, CAMERA.lagY, dt);
    this._pos.z = this._expSmooth(this._pos.z, this.desired.z, CAMERA.lag, dt);

    this.camera.position.copy(this._pos);

    const lookY = playerPos.y + CAMERA.lookHeight + Math.max(0, playerY) * 0.08;
    this._look.set(
      playerPos.x * 0.16 + lateralLead * 0.35,
      lookY,
      playerPos.z + lookAhead
    );
    this.camera.lookAt(this._look);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const norm = Math.max(0, this.shakeTime / CAMERA.landShakeDuration);
      const damp = norm * norm;
      const t = this._shakeSeed + (CAMERA.landShakeDuration - this.shakeTime) * 42;
      this.camera.position.x += Math.sin(t * 17.3) * this.shakeAmp * damp;
      this.camera.position.y += Math.sin(t * 23.7 + 1.2) * this.shakeAmp * damp * 0.55;
      if (this.shakeTime <= 0) this.shakeAmp = 0;
    }

    this.fovPunch = Math.max(0, this.fovPunch - dt * CAMERA.fovPunchDecay);
    const targetFov = this.baseFov + speedNorm * CAMERA.fovSpeedBoost + this.fovPunch;
    this.camera.fov = this._expSmooth(this.camera.fov, targetFov, 0.08, dt);
    this.camera.updateProjectionMatrix();
  }

  snapTo(playerPos) {
    this._jumpBlend = 0;
    this._pos.set(
      playerPos.x * 0.28,
      playerPos.y + this.offset.y,
      playerPos.z + this.offset.z
    );
    this.camera.position.copy(this._pos);
    this._look.set(
      playerPos.x * 0.16,
      playerPos.y + CAMERA.lookHeight,
      playerPos.z + CAMERA.lookAhead
    );
    this.camera.lookAt(this._look);
  }
}
