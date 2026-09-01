import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { PLAYER, SCORE, RENDER } from './constants.js';
import { Input } from './Input.js';
import { CameraRig } from './CameraRig.js';
import { Player } from './Player.js';
import { World } from './World.js';
import { Obstacles } from './Obstacles.js';
import { Collectibles } from './Collectibles.js';
import { FX } from './FX.js';
import { AudioSys } from './Audio.js';
import { UI } from './UI.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'menu'; // menu | playing | paused | gameover
    this.score = 0;
    this.coins = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.comboTimer = 0;
    this.lastPickupAt = -99;
    this.distance = 0;
    this.clock = new THREE.Clock(false);
    this._raf = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);

    this.input = new Input(window);
    this.input.attach();
    this.rig = new CameraRig(this.camera);
    this.player = new Player(this.scene);
    this.world = new World(this.scene);
    this.obstacles = new Obstacles(this.scene);
    this.collectibles = new Collectibles(this.scene);
    this.collectibles.setObstacles(this.obstacles);
    this.fx = new FX(this.scene);
    this.audio = new AudioSys();
    this.ui = new UI();

    this.ui.onStart(() => this.start());
    this.ui.onRetry(() => this.start());
    this.ui.onResume(() => this.resume());
    this.ui.onPause(() => this.pause());
    this.ui.showStart();
    this.ui.update(this._stats());

    this._onResize = () => this._resize();
    this._onKey = (e) => this._onGlobalKey(e);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('keydown', this._onKey);

    this.rig.snapTo(this.player.group.position);
    this.clock.start();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  _stats() {
    const speedNorm =
      (this.player.speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase);
    return {
      score: this.score,
      coins: this.coins,
      combo: this.combo,
      speed: this.player.speed,
      speedNorm: Math.max(0, Math.min(1, speedNorm)),
    };
  }

  _onGlobalKey(e) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      e.preventDefault();
      return;
    }
    if (this.state === 'menu' && (e.code === 'Space' || e.code === 'Enter')) {
      this.start();
      e.preventDefault();
    }
    if (this.state === 'gameover' && (e.code === 'Space' || e.code === 'Enter')) {
      this.start();
      e.preventDefault();
    }
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
    this.renderer.setSize(w, h, false);
  }

  async start() {
    await this.audio.ensure();
    this.state = 'playing';
    this.score = 0;
    this.coins = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.comboTimer = 0;
    this.lastPickupAt = -99;
    this.distance = 0;
    this.player.reset();
    this.world.reset();
    this.obstacles.reset();
    this.collectibles.reset();
    this.fx.reset();
    this.input.reset();
    this.input.enabled = true;
    this.rig.snapTo(this.player.group.position);
    this.ui.resetHudAnim();
    this.ui.hideOverlays();
    this.ui.update(this._stats());
    this.audio.startSting();
    if (this.clock.running === false) this.clock.start();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.ui.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.enabled = true;
    this.input.reset();
    this.ui.hidePause();
  }

  _collectPickup(c) {
    const pos = c.mesh.position.clone();
    const now = performance.now() * 0.001;
    const spaced = now - this.lastPickupAt >= SCORE.comboSpacing;
    this.lastPickupAt = now;
    this.comboTimer = SCORE.comboDecay;
    if (spaced) {
      this.combo = Math.min(SCORE.comboMax, this.combo + 1);
    } else if (this.combo > 1) {
      this.combo = Math.max(1, this.combo - 1);
    }
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const pts = SCORE.canBase * this.combo * (1 + SCORE.comboMultStep * (this.combo - 1));
    this.score += pts;
    this.coins += 1;

    this.audio.pickup(this.combo);
    this.fx.canPop(pos, this.combo, this.camera);
    this.rig.punchFov(2 + this.combo * 0.2);
    this.ui.flashPickup(this.combo);
    this.ui.popCan();
    this.ui.pulseScore();
    this.ui.floatPoints(pts, this.combo);
  }

  _gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.player.kill();
    this.audio.crash();
    this.fx.crashBurst(this.player.group.position.clone());
    this.ui.flashHit(this.fx.hitFlashIntensity());
    this.rig.landShake(0.28);
    this.input.enabled = false;
    setTimeout(() => {
      if (this.state === 'gameover') {
        this.audio.gameOver();
        this.ui.showGameOver(this.score, this.coins, this.bestCombo);
      }
    }, 280);
  }

  _loop() {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
    this.render();
  }

  update(dt) {
    const playing = this.state === 'playing';
    const stats = this._stats();

    if (playing) {
      const inp = this.input.consume(this.player.canQueueLane());
      if (inp.laneDelta) {
        if (this.player.tryLane(inp.laneDelta)) {
          this.audio.whoosh(inp.laneDelta * 0.6);
          this.rig.punchFov(3.5);
        }
      }
      if (inp.jump && this.player.tryJump()) {
        this.audio.jump();
        this.rig.punchFov(2.8);
      }
      if (inp.slide && this.player.trySlide()) this.audio.slide();

      this.player.speed = Math.min(
        PLAYER.runSpeedMax,
        this.player.speed + PLAYER.accelPerSec * dt
      );
      this.player.z += this.player.speed * dt;
      this.distance += this.player.speed * dt;
      this.score += this.player.speed * dt * SCORE.perMeter * (1 + (this.combo - 1) * 0.03);

      this.player.update(dt);
      if (this.player.justLanded) {
        this.audio.land();
        this.rig.landShake();
        this.fx.landDust(this.player.group.position, stats.speedNorm);
      }

      this.world.update(this.player.z, this.player.speed);
      this.obstacles.update(dt, this.player.z, this.player.speed);
      this.collectibles.update(
        dt,
        this.player.z,
        this.player.x,
        this.player.y,
        this.player.speed
      );

      const box = this.player.getHitBox();
      const hit = this.obstacles.collide(box, this.player.jumping, this.player.sliding);
      if (hit) {
        hit.alive = false;
        this._gameOver();
      }

      const got = this.collectibles.collect(box);
      if (got.length) {
        const chainBonus = this.collectibles.chainBonus(got);
        if (chainBonus > 0) this.score += chainBonus;
      }
      for (const c of got) this._collectPickup(c);

      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 1;
      }
    } else if (this.state === 'menu' || this.state === 'gameover') {
      this.player.update(dt);
      this.world.update(this.player.z, this.player.speed);
    }

    const speedNorm = playing ? stats.speedNorm : this.state === 'menu' ? 0.12 : 0.08;
    this.fx.update(dt, this.player.group.position, speedNorm, playing || this.state === 'menu');
    this.rig.update(
      dt,
      this.player.group.position,
      playing ? stats.speedNorm : 0,
      this.player.lean,
      this.player.jumping,
      this.player.y
    );

    this.ui.update(this._stats(), dt);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKey);
    this.input.detach();
    this.renderer.dispose();
  }
}
