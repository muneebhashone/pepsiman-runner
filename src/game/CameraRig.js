import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { CAMERA } from './constants.js';

/** Dolly-on-rails chase cam — locked to road center, no lean hunt or FOV yo-yo. */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.offset = new THREE.Vector3(CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z);
    this.desired = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._jumpBlend = 0;
    this.shakeAmp = 0;
    this.shakeTime = 0;
    this.fovPunch = 0;
    this.baseFov = CAMERA.fovBase;
    this.zoneFov = 0;
    this._shakeSeed = 0;
    this.camera.fov = this.baseFov;
    this.camera.up.set(0, 1, 0);
    this.camera.updateProjectionMatrix();
    this._pos.copy(camera.position);
  }

  landShake(strength = CAMERA.landShake, duration = CAMERA.landShakeDuration) {
    if (strength <= 0.02) return;
    this.shakeAmp = Math.max(this.shakeAmp, strength);
    this.shakeTime = duration;
    this._shakeDuration = duration;
    this._shakeSeed = Math.random() * 1000;
  }

  deathShake(strength, duration) {
    this.landShake(strength, duration);
  }

  punchFov(amount = CAMERA.fovPunch) {
    if (amount <= 0) return;
    this.fovPunch = Math.max(this.fovPunch, amount);
  }

  setZoneFov(tick) {
    this.zoneFov = tick;
  }

  _expSmooth(current, target, rate, dt) {
    const t = 1 - Math.pow(rate, dt * 60);
    return current + (target - current) * t;
  }

  update(dt, playerPos, speedNorm, _playerLean = 0, jumping = false, playerY = 0) {
    this.camera.up.set(0, 1, 0);

    const jumpTarget = jumping || playerY > 0.12 ? 1 : 0;
    this._jumpBlend = this._expSmooth(this._jumpBlend, jumpTarget, 0.14, dt);

    const lookAhead =
      CAMERA.lookAhead +
      speedNorm * CAMERA.lookAheadSpeedBoost +
      this._jumpBlend * CAMERA.jumpLookBoost;
    const pullZ = this.offset.z - this._jumpBlend * CAMERA.jumpPullback;
    const liftY = this.offset.y + this._jumpBlend * 0.35;
    const lateralClamp = CAMERA.maxLateralOff;

    // Tiny follow of player X — camera stays near track center
    const targetX = THREE.MathUtils.clamp(
      playerPos.x * CAMERA.lateralFollow,
      playerPos.x - lateralClamp,
      playerPos.x + lateralClamp
    );
    const targetY = THREE.MathUtils.clamp(
      playerPos.y + liftY,
      playerPos.y + CAMERA.minYOffset,
      playerPos.y + CAMERA.maxYOffset
    );

    this.desired.set(targetX, targetY, playerPos.z + pullZ);

    this._pos.x = this._expSmooth(this._pos.x, this.desired.x, CAMERA.lag, dt);
    this._pos.y = this._expSmooth(this._pos.y, this.desired.y, CAMERA.lagY, dt);
    this._pos.z = this._expSmooth(this._pos.z, this.desired.z, CAMERA.lag, dt);

    this._pos.x = THREE.MathUtils.clamp(
      this._pos.x,
      playerPos.x - lateralClamp,
      playerPos.x + lateralClamp
    );
    this._pos.y = THREE.MathUtils.clamp(
      this._pos.y,
      playerPos.y + CAMERA.minYOffset,
      playerPos.y + CAMERA.maxYOffset
    );

    this.camera.position.copy(this._pos);

    // Look down the road — fixed X anchor, no lateral hunt
    const lookY = playerPos.y + CAMERA.lookHeight + Math.max(0, playerY) * 0.04;
    const lookZ = playerPos.z + lookAhead;
    this._look.set(0, lookY, lookZ);
    this.camera.lookAt(this._look);
    this.camera.up.set(0, 1, 0);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const duration = this._shakeDuration || CAMERA.landShakeDuration;
      const norm = Math.max(0, this.shakeTime / duration);
      const damp = norm * norm;
      const t = this._shakeSeed + (duration - this.shakeTime) * 42;
      this.camera.position.x += Math.sin(t * 17.3) * this.shakeAmp * damp;
      this.camera.position.y += Math.sin(t * 23.7 + 1.2) * this.shakeAmp * damp * 0.5;
      this.camera.position.z += Math.sin(t * 11.1 + 0.7) * this.shakeAmp * damp * 0.25;
      this.camera.position.x = THREE.MathUtils.clamp(
        this.camera.position.x,
        playerPos.x - lateralClamp,
        playerPos.x + lateralClamp
      );
      if (this.shakeTime <= 0) this.shakeAmp = 0;
    }

    this.fovPunch = Math.max(0, this.fovPunch - dt * CAMERA.fovPunchDecay);
    const targetFov =
      this.baseFov + speedNorm * CAMERA.fovSpeedBoost + this.fovPunch + this.zoneFov;
    this.camera.fov = this._expSmooth(this.camera.fov, targetFov, 0.1, dt);
    this.camera.updateProjectionMatrix();
  }

  snapTo(playerPos) {
    this._jumpBlend = 0;
    this.shakeAmp = 0;
    this.shakeTime = 0;
    this._shakeDuration = 0;
    this.fovPunch = 0;
    this.zoneFov = 0;
    this.camera.fov = this.baseFov;
    this.camera.up.set(0, 1, 0);

    this._pos.set(
      THREE.MathUtils.clamp(
        playerPos.x * CAMERA.lateralFollow,
        playerPos.x - CAMERA.maxLateralOff,
        playerPos.x + CAMERA.maxLateralOff
      ),
      THREE.MathUtils.clamp(
        playerPos.y + this.offset.y,
        playerPos.y + CAMERA.minYOffset,
        playerPos.y + CAMERA.maxYOffset
      ),
      playerPos.z + this.offset.z
    );
    this.camera.position.copy(this._pos);
    this._look.set(0, playerPos.y + CAMERA.lookHeight, playerPos.z + CAMERA.lookAhead);
    this.camera.lookAt(this._look);
    this.camera.up.set(0, 1, 0);
    this.camera.updateProjectionMatrix();
  }
}
