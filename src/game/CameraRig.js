import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { CAMERA } from './constants.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.offset = new THREE.Vector3(CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z);
    this.lookTarget = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.shakeAmp = 0;
    this.shakeTime = 0;
    this.fovPunch = 0;
    this.baseFov = CAMERA.fovBase;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  landShake(strength = CAMERA.landShake) {
    this.shakeAmp = Math.max(this.shakeAmp, strength);
    this.shakeTime = 0.28;
  }

  punchFov(amount = CAMERA.fovPunch) {
    this.fovPunch = Math.max(this.fovPunch, amount);
  }

  update(dt, playerPos, speedNorm) {
    this.desired.set(
      playerPos.x * 0.35,
      playerPos.y + this.offset.y,
      playerPos.z + this.offset.z
    );
    const lag = 1 - Math.pow(CAMERA.lag, dt * 60);
    this.camera.position.lerp(this.desired, lag);
    this.lookTarget.set(playerPos.x * 0.2, playerPos.y + 1.2, playerPos.z + CAMERA.lookAhead);
    this.camera.lookAt(this.lookTarget);
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const damp = Math.max(0, this.shakeTime / 0.28);
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmp * damp;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmp * damp * 0.6;
      if (this.shakeTime <= 0) this.shakeAmp = 0;
    }
    this.fovPunch = Math.max(0, this.fovPunch - dt * 18);
    const fov = this.baseFov + speedNorm * 6 + this.fovPunch;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  snapTo(playerPos) {
    this.camera.position.set(
      playerPos.x * 0.35,
      playerPos.y + this.offset.y,
      playerPos.z + this.offset.z
    );
    this.lookTarget.set(playerPos.x * 0.2, playerPos.y + 1.2, playerPos.z + CAMERA.lookAhead);
    this.camera.lookAt(this.lookTarget);
  }
}
