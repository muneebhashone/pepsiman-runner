import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { PLAYER, SCORE, RENDER, DEATH, NEAR_MISS, FIZZ, ZONE } from './constants.js';
import { Input } from './Input.js';
import { CameraRig } from './CameraRig.js';
import { Player } from './Player.js';
import { World } from './World.js';
import { Obstacles } from './Obstacles.js';
import { Collectibles } from './Collectibles.js';
import { FX } from './FX.js';
import { AudioSys } from './Audio.js';
import { UI, loadPersisted, savePersisted } from './UI.js';
import { FizzMeter } from './Fizz.js';
import { Missions } from './Missions.js';

function detectPixelRatioCap() {
  const dpr = window.devicePixelRatio || 1;
  const lowGpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const cap = lowGpu ? RENDER.maxPixelRatioLow : RENDER.maxPixelRatio;
  return Math.min(dpr, cap);
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'menu';
    this.score = 0;
    this.coins = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.comboTimer = 0;
    this.lastPickupAt = -99;
    this.distance = 0;
    this.hitStopT = 0;
    this._graceSlideFired = false;
    this._graceJumpFired = false;
    this._zoneT = 0;
    this._zoneLevel = 0;
    this._rushVisuals = false;
    this._rushEnding = false;
    this._runTime = 0;
    this._persisted = loadPersisted();
    this.clock = new THREE.Clock(false);
    this._raf = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(detectPixelRatioCap());
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.55;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 700);
    this._contextLost = false;

    this.input = new Input(window);
    this.input.setActionCallback((action) => {
      if (this.state !== 'playing') return;
      this._dismissTutorialCueOnInput(action);
    });
    this.input.attach();
    this.rig = new CameraRig(this.camera);
    this.player = new Player(this.scene);
    this.world = new World(this.scene);
    this.obstacles = new Obstacles(this.scene);
    this.obstacles.setTutorialHintCallback((action, kind) => {
      if (action) this.ui.enqueueTutorialCue(action, kind);
    });
    this.obstacles.setTutorialCueGate({
      isBusy: () => this.ui.isCueBusy(),
      whenIdle: (cb) => this.ui.whenCueIdle(cb),
    });
    this.obstacles.setTutorialGraceCallback((action) => this._tutorialGrace(action));
    this.collectibles = new Collectibles(this.scene);
    this.collectibles.setObstacles(this.obstacles);
    this.fx = new FX(this.scene);
    this.audio = new AudioSys();
    this.fizz = new FizzMeter();
    this.missions = new Missions();
    this.ui = new UI();
    this.ui.setTutorialCueCompleteCallback((action, kind) => {
      this.obstacles.onTutorialCueComplete(action, kind);
    });

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
    this._bindContextHandlers();
    this.clock.start();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  _bindContextHandlers() {
    const canvas = this.canvas;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this._contextLost = true;
      console.warn('[Pepsiman] WebGL context lost — stage may appear black until restored.');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[Pepsiman] WebGL context restored — reloading to rebuild GPU resources.');
      this._contextLost = false;
      window.location.reload();
    });
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
      fizzLevel: this.fizz.level,
      rushActive: this.fizz.isRush,
      rushNorm: this.fizz.rushNorm,
      missions: this.missions.snapshot(),
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
    this.renderer.setPixelRatio(detectPixelRatioCap());
    this.renderer.setSize(w, h, false);
  }

  _dismissTutorialCueOnInput(action) {
    if (!this.ui.isTutorialHintVisible() || !this.ui.matchesTutorialAction(action)) return;
    if (!this.obstacles.canDismissTutorialOnInput(action)) return;
    this.obstacles.markTutorialDismissed(action);
    this.ui.clearTutorialHint();
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
    this.hitStopT = 0;
    this._graceSlideFired = false;
    this._graceJumpFired = false;
    this._zoneT = 0;
    this._zoneLevel = 0;
    this._rushVisuals = false;
    this._rushEnding = false;
    this._runTime = 0;
    this.player.reset();
    this.player.setGhost(false);
    this.world.reset();
    this.world.setZoneLevel(0);
    this.world.setRushActive(false);
    this.obstacles.reset();
    this.collectibles.reset();
    this.collectibles.setRushActive(false);
    this.fx.reset();
    this.fx.setRushActive(false);
    this.fizz.reset();
    this.missions.reset();
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

  _applyMissionRewards(rewards) {
    for (const r of rewards) {
      this.score += r.score;
      const rushStarted = this.fizz.add(r.fizz);
      this.audio.missionComplete();
      this.ui.floatMission(r.label);
      if (rushStarted && !this._rushVisuals) {
        this._rushVisuals = true;
        this._startRush();
      }
    }
  }

  _scoreMult() {
    return this.fizz.isRush ? FIZZ.rushScoreMult : 1;
  }

  _addScore(pts) {
    this.score += pts * this._scoreMult();
  }

  _startRush() {
    this.audio.rushStinger();
    this.audio.startRushLoop();
    this.ui.floatRush();
    this.collectibles.setRushActive(true);
    this.fx.setRushActive(true);
    this.world.setRushActive(true);
    this.player.setGhost(true);
    this.player.speed = Math.min(PLAYER.runSpeedMax, this.player.speed * FIZZ.speedBoost);
  }

  _endRush() {
    this.audio.stopRushLoop();
    this.collectibles.setRushActive(false);
    this.fx.setRushActive(false);
    this.world.setRushActive(false);
    this.player.setGhost(false);
  }

  _collectPickup(c) {
    const pos = c.mesh.position.clone();
    const now = performance.now() * 0.001;
    const spaced = now - this.lastPickupAt >= SCORE.comboSpacing;
    this.lastPickupAt = now;
    this.comboTimer = SCORE.comboDecay;
    if (spaced) {
      const prev = this.combo;
      this.combo = Math.min(SCORE.comboMax, this.combo + 1);
      if (this.combo > prev) {
        if (this.combo >= SCORE.shoutNice) {
          this.ui.shoutCombo(this.combo);
          this.audio.comboShout(
            this.combo >= SCORE.shoutPerfect ? 3 : this.combo >= SCORE.shoutWow ? 2 : 1
          );
        }
      }
    } else if (this.combo > 1) {
      this.combo = Math.max(1, this.combo - 1);
    }
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = 1 + SCORE.comboMultStep * (this.combo - 1);
    const pts = SCORE.canBase * this.combo * mult;
    this._addScore(pts);
    this.coins += 1;

    this.fizz.onCanPickup();
    if (this.fizz.isRush && !this._rushVisuals) {
      this._rushVisuals = true;
      this._startRush();
    }

    this._applyMissionRewards(this.missions.bump('cans', 1));
    this._applyMissionRewards(this.missions.checkCombo(this.combo));

    this.audio.pickup(this.combo);
    this.fx.canPop(new THREE.Vector3(this.player.x, 0.12, this.player.z), this.combo);
    this.ui.flashPickup(this.combo);
    this.ui.popCan();
    this.ui.pulseScore();
    this.ui.floatPoints(pts, this.combo);
  }

  _gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.obstacles.clearAllTutorialHints();
    this.ui.clearTutorialHint();
    this.hitStopT = DEATH.hitStopDuration;
    const diedDuringRush = this.fizz.isRush;
    this._rushEnding = diedDuringRush;
    this._endRush();
    this.player.kill();
    this.player.setGhost(false);
    this.audio.crash();
    this.fx.crashBurst(this.player.group.position.clone(), true);
    this.ui.flashHit(this.fx.hitFlashIntensity());
    this.rig.deathShake(DEATH.shakeStrength, DEATH.shakeDuration);
    this.rig.punchFov(DEATH.fovPunch);
    this.input.enabled = false;

    const floored = Math.floor(this.score);
    const distM = Math.floor(this.distance);
    const allTimeBestCombo = Math.max(this._persisted.bestCombo, this.bestCombo);
    const highScore = Math.max(this._persisted.highScore, floored);
    const topScores = [...(this._persisted.topScores || []), floored]
      .sort((a, b) => b - a)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 3);
    const soClose = this._persisted.highScore > 0 && floored >= this._persisted.highScore * 0.9;
    savePersisted({
      highScore,
      bestCombo: allTimeBestCombo,
      totalCans: this._persisted.totalCans + this.coins,
      topScores,
    });
    this._persisted = loadPersisted();

    setTimeout(() => {
      if (this.state === 'gameover') {
        this.audio.gameOver();
        this.ui.showGameOver(floored, this.coins, this.bestCombo, {
          highScore: this._persisted.highScore,
          allTimeBestCombo,
          soClose,
          diedDuringRush,
          distance: distM,
          topScores: this._persisted.topScores || topScores,
        });
      }
    }, 320);
  }

  _nearMiss(bonus) {
    this._addScore(bonus);
    this.fizz.onNearMiss();
    if (this.fizz.isRush && !this._rushVisuals) {
      this._rushVisuals = true;
      this._startRush();
    }
    this._applyMissionRewards(this.missions.bump('nearmiss', 1));
    this.hitStopT = Math.max(this.hitStopT, NEAR_MISS.hitStop);
    this.audio.nearMissWhoosh();
    this.fx.nearMissSpark(this.player.group.position.clone());
    this.ui.floatNearMiss(bonus);
  }

  _tutorialGrace(action) {
    if (action === 'slide') {
      if (this._graceSlideFired) return;
      this._graceSlideFired = true;
      this._applyMissionRewards(this.missions.bump('slides', 1));
    } else if (action === 'jump') {
      if (this._graceJumpFired) return;
      this._graceJumpFired = true;
      this._applyMissionRewards(this.missions.bump('jumps', 1));
    }
    this.combo = 1;
    this.comboTimer = 0;
    this.ui.floatNiceTry();
  }

  _loop() {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
    this.render();
  }

  update(dt) {
    const playing = this.state === 'playing';
    const gameover = this.state === 'gameover';
    const stats = this._stats();

    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      this.player.update(dt);
      this.fx.update(dt, this.player.group.position, stats.speedNorm, playing || gameover);
      this.rig.update(
        dt,
        this.player.group.position,
        playing ? stats.speedNorm : 0,
        this.player.lean,
        this.player.jumping,
        this.player.y
      );
      this.ui.update(this._stats(), dt);
      return;
    }

    if (playing) {
      this.fizz.update(dt);
      if (this.fizz.isRush) {
        if (!this._rushVisuals) {
          this._rushVisuals = true;
          this._startRush();
        }
      } else if (this._rushVisuals) {
        this._endRush();
        this._rushVisuals = false;
      }

      this._zoneT += dt;
      if (this._zoneT >= ZONE.intervalSec) {
        this._zoneT = 0;
        this._zoneLevel = (this._zoneLevel + 1) % 3;
        this.world.setZoneLevel(this._zoneLevel);
        this.rig.setZoneFov(ZONE.fovTick * (this._zoneLevel % 2 === 0 ? 1 : -0.5));
      }

      this._runTime += dt;

      const inp = this.input.consume(this.player.canQueueLane());
      if (inp.laneDelta) {
        if (this.player.tryLane(inp.laneDelta)) {
          this.audio.whoosh(inp.laneDelta * 0.6);
          this.rig.notifyLaneSwitch(inp.laneDelta);
        }
      }
      if (inp.jump) {
        this._dismissTutorialCueOnInput('jump');
        const jumped = this.player.tryJump();
        if (jumped) {
          this.audio.jump();
          this._applyMissionRewards(this.missions.bump('jumps', 1));
        }
      }
      if (inp.slide) {
        this._dismissTutorialCueOnInput('slide');
        const slid = this.player.trySlide();
        if (slid) {
          this.audio.slide();
          this._applyMissionRewards(this.missions.bump('slides', 1));
        }
      }

      this.player.speed = Math.min(
        PLAYER.runSpeedMax,
        this.player.speed + PLAYER.accelPerSec * dt
      );
      if (this._runTime < PLAYER.earlySpeedCapSec) {
        this.player.speed = Math.min(this.player.speed, PLAYER.earlySpeedCap);
      }
      this.player.z += this.player.speed * dt;
      this.distance += this.player.speed * dt;
      const comboMeter = 1 + (this.combo - 1) * 0.04;
      this._addScore(this.player.speed * dt * SCORE.perMeter * comboMeter);

      this.player.update(dt);

      const box = this.player.getHitBox();
      if (this.obstacles.checkRamp(box, this.player.lane) && !this.player.jumping) {
        this.player.tryJump();
        this.audio.jump();
      }

      if (this.fizz.isRush) {
        const smashHit = this.obstacles.collide(box, this.player.jumping, this.player.sliding);
        if (smashHit) {
          const pos = smashHit.mesh.position.clone();
          pos.y += smashHit.hit?.y ?? 0.8;
          this.obstacles.destroyObstacle(smashHit);
          this.fx.smashBurst(pos);
          this.audio.rushSmash();
          this._addScore(35);
        }
      }

      const poseDismiss = this.obstacles.checkTutorialPoseDismiss(
        this.player.sliding,
        this.player.jumping,
        this.player.z,
        this.player.speed
      );
      if (poseDismiss) this._dismissTutorialCueOnInput(poseDismiss);
      if (this.player.justLanded) {
        this.audio.land();
        this.fx.landDust(this.player.group.position, stats.speedNorm);
      }

      this.missions.update(dt, false);

      this.world.update(this.player.z, this.player.speed);
      this.obstacles.update(dt, this.player.z, this.player.speed);

      if (Math.random() < 0.018 && this.player.z > 120) {
        const lane = (Math.random() * 3) | 0;
        const verb = Math.random() < 0.5 ? 'jump' : 'slide';
        this.collectibles.spawnGreedTrail(this.player.z + 45 + Math.random() * 20, lane, verb);
      }

      this.collectibles.update(
        dt,
        this.player.z,
        this.player.x,
        this.player.y,
        this.player.speed,
        this.player.lane
      );

      const hit = this.fizz.isRush
        ? null
        : this.obstacles.collide(box, this.player.jumping, this.player.sliding);
      if (hit) {
        hit.alive = false;
        this.missions.update(0, true);
        this._gameOver();
      } else {
        const nearBonus = this.obstacles.checkNearMiss(
          box,
          this.player.jumping,
          this.player.sliding,
          this.player.z,
          this.player.lane
        );
        if (nearBonus > 0) this._nearMiss(nearBonus);
      }

      const got = this.collectibles.collect(box, this.player.lane);
      if (got.length) {
        const chainBonus = this.collectibles.chainBonus(got);
        if (chainBonus > 0) this._addScore(chainBonus);
      }
      for (const c of got) this._collectPickup(c);

      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 1;
      }
    } else if (this.state === 'menu' || gameover) {
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
    if (this._contextLost) return;
    const gl = this.renderer.getContext();
    if (gl?.isContextLost?.()) {
      this._contextLost = true;
      console.warn('[Pepsiman] WebGL context is lost.');
      return;
    }
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
