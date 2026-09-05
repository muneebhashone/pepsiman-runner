import * as THREE from "three";
import {
  PLAYER,
  SCORE,
  RENDER,
  DEATH,
  NEAR_MISS,
  FIZZ,
  ZONE,
} from "./constants.js";
import { Input } from "./Input.js";
import { CameraRig } from "./CameraRig.js";
import { Player } from "./Player.js";
import { World } from "./World.js";
import { Obstacles } from "./Obstacles.js";
import { Collectibles } from "./Collectibles.js";
import { FX } from "./FX.js";
import { AudioSys } from "./Audio.js";
import { UI, loadPersisted, savePersisted } from "./UI.js";
import { FizzMeter } from "./Fizz.js";
import { Missions } from "./Missions.js";

function detectPixelRatioCap() {
  const dpr = window.devicePixelRatio || 1;
  const lowGpu =
    navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const cap = lowGpu ? RENDER.maxPixelRatioLow : RENDER.maxPixelRatio;
  return Math.min(dpr, cap);
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = "menu";
    this.mode = "endless";
    this.health = 3;
    this.invulnerableT = 0;
    this._countdownT = 0;
    this._runId = 0;
    this._resultTimer = null;
    this._elapsed = 0;
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
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(detectPixelRatioCap());
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      700,
    );
    this._contextLost = false;
    this._setupEnvironment();

    this.input = new Input(window);
    this.input.setActionCallback((action) => {
      if (this.state !== "playing") return;
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
    this.obstacles.setTutorialGraceCallback((action) =>
      this._tutorialGrace(action),
    );
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
    this.ui.onMenu(() => this.menu());
    this.ui.onMode((mode) => {
      this.mode = mode;
    });
    this.input.enabled = false;
    this._bindSettings();
    this.ui.ready();
    this.ui.showStart();
    this.ui.update(this._stats());

    this._onResize = () => this._resize();
    this._onKey = (e) => this._onGlobalKey(e);
    this._onVisibility = () => {
      if (document.hidden) this.pause();
    };
    this._onBlur = () => this.pause();
    document.addEventListener("visibilitychange", this._onVisibility);
    window.addEventListener("blur", this._onBlur);
    window.addEventListener("resize", this._onResize);
    window.addEventListener("keydown", this._onKey);

    this.rig.snapTo(this.player.group.position);
    this._bindContextHandlers();
    this.clock.start();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  _bindContextHandlers() {
    const canvas = this.canvas;
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this._contextLost = true;
      this.pause();
      this.ui.announce(
        "Graphics paused. Waiting for the browser to restore the scene.",
        12000,
      );
      console.warn(
        "[Pepsiman] WebGL context lost — stage may appear black until restored.",
      );
    });
    canvas.addEventListener("webglcontextrestored", () => {
      console.warn(
        "[Pepsiman] WebGL context restored — reloading to rebuild GPU resources.",
      );
      this._contextLost = false;
      window.location.reload();
    });
  }

  /**
   * Procedural image-based lighting: renders a tiny dusk "studio" scene
   * (gradient sky + warm key card + cool fill + neon bounce cards) into a
   * PMREM env map so metals/gloss get realistic reflections. No assets.
   */
  _setupEnvironment() {
    const envScene = new THREE.Scene();

    // Gradient sky dome via vertex colors (dusk blue → deep night)
    const skyGeo = new THREE.SphereGeometry(50, 24, 16);
    const pos = skyGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const horizon = new THREE.Color(0xc5e3f2);
    const zenith = new THREE.Color(0x527aaa);
    const ground = new THREE.Color(0x18273a);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 50;
      if (y >= 0) {
        tmp.copy(horizon).lerp(zenith, Math.pow(y, 0.65));
      } else {
        tmp.copy(horizon).lerp(ground, Math.pow(-y, 0.5));
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    skyGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const skyMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      vertexColors: true,
    });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    // Emissive light cards — HDR colors feed the PMREM
    const card = (hex, intensity, w, h, x, y, z) => {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    // Warm key (matches sun direction), cool sky fill, neon street bounce
    card(0xfff8e9, 6, 22, 30, -14, 26, -18);
    card(0xffffff, 3, 12, 35, 15, 8, -15);
    card(0x0055bf, 3.2, 26, 5, -22, 2.5, 0);
    card(0xe32934, 2.6, 26, 5, 22, 2.5, 0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmrem.fromScene(envScene, 0.035);
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = RENDER.envIntensity ?? 0.55;
    this._environmentTarget = envRT;
    pmrem.dispose();
    envScene.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
  }

  _stats() {
    const speedNorm =
      (this.player.speed - PLAYER.runSpeedBase) /
      (PLAYER.runSpeedMax - PLAYER.runSpeedBase);
    return {
      distance: this.distance,
      mode: this.mode,
      health: this.health,
      timeLeft: Math.max(0, 90 - this._runTime),
      zone: this._zoneLevel,
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
    if (this.ui.help.open) return;
    if (e.repeat) return;
    if (e.code === "KeyM") {
      this._toggleSound();
      return;
    }
    if (
      ["BUTTON", "INPUT", "A"].includes(e.target.tagName) &&
      !["Escape", "KeyP"].includes(e.code)
    )
      return;
    if (e.code === "Escape" || e.code === "KeyP") {
      if (this.state === "playing" || this.state === "countdown") this.pause();
      else if (this.state === "paused") this.resume();
      e.preventDefault();
      return;
    }
    if (this.state === "menu" && (e.code === "Space" || e.code === "Enter")) {
      this.start();
      e.preventDefault();
    }
    if (
      this.state === "gameover" &&
      (e.code === "Space" || e.code === "Enter")
    ) {
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
    if (
      !this.ui.isTutorialHintVisible() ||
      !this.ui.matchesTutorialAction(action)
    )
      return;
    if (!this.obstacles.canDismissTutorialOnInput(action)) return;
    this.obstacles.markTutorialDismissed(action);
    this.ui.clearTutorialHint();
  }

  start() {
    if (this.state === "countdown" || this.state === "playing") return;
    clearTimeout(this._resultTimer);
    this._runId++;
    this.audio.ensure().catch(() => {});
    this.state = "countdown";
    this._countdownT = 2.4;
    this._lastCount = 0;
    this.health = 3;
    this.invulnerableT = 0;
    this._jumpBufferT = 0;
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
    this.input.enabled = false;
    this.rig.snapTo(this.player.group.position);
    this.ui.resetHudAnim();
    this.ui.hideOverlays();
    this.ui.update(this._stats());
    this.ui.setState("countdown");
    this.player.group.rotation.y = 0;
    this.player.update(0, false);
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    if (this.clock.running === false) this.clock.start();
  }

  _bindSettings() {
    let settings = {};
    try {
      settings =
        JSON.parse(localStorage.getItem("pepsiman-settings") || "{}") || {};
    } catch {}
    this.audio.enabled = settings.sound !== false;
    this.rig.reducedMotion =
      settings.reducedMotion ??
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("reduced-motion").checked = this.rig.reducedMotion;
    document
      .getElementById("reduced-motion")
      .addEventListener("change", (e) => {
        this.rig.reducedMotion = e.target.checked;
        this._saveSettings();
      });
    document
      .getElementById("btn-sound")
      .addEventListener("click", () => this._toggleSound());
    document.getElementById("pause-sound").checked = this.audio.enabled;
    document
      .getElementById("pause-sound")
      .addEventListener("change", () => this._toggleSound());
    document.querySelectorAll("[data-action]").forEach((button) =>
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.input.action(button.dataset.action);
      }),
    );
    this._updateSoundButton();
  }

  _saveSettings() {
    try {
      localStorage.setItem(
        "pepsiman-settings",
        JSON.stringify({
          sound: this.audio.enabled,
          reducedMotion: this.rig.reducedMotion,
        }),
      );
    } catch {}
  }

  _updateSoundButton() {
    document.getElementById("pause-sound").checked = this.audio.enabled;
    const b = document.getElementById("btn-sound");
    b.setAttribute("aria-pressed", String(!this.audio.enabled));
    b.setAttribute(
      "aria-label",
      this.audio.enabled ? "Mute sound" : "Enable sound",
    );
  }

  _toggleSound() {
    this.audio.setEnabled(!this.audio.enabled);
    this._updateSoundButton();
    this._saveSettings();
  }

  menu() {
    clearTimeout(this._resultTimer);
    this._runId++;
    this._endRush();
    this.fizz.reset();
    this.player.reset();
    this.world.reset();
    this.obstacles.reset();
    this.collectibles.reset();
    this.fx.reset();
    this.state = "menu";
    this.input.enabled = false;
    this.input.reset();
    this.ui.clearTutorialHint();
    this.ui.showStart();
    this.player.group.rotation.y = Math.PI - 0.45;
    this.rig.menu(this._elapsed);
    this.ui.btnStart.focus({ preventScroll: true });
  }

  pause() {
    if (!["playing", "countdown"].includes(this.state)) return;
    this.state = "paused";
    this.input.enabled = false;
    this.input.reset();
    this.ui.countdown(null);
    this.obstacles.clearAllTutorialHints();
    this.ui.clearTutorialHint();
    this.ui.showPause();
    this.audio.stopRushLoop();
  }

  resume() {
    if (this.state !== "paused") return;
    this.audio.ensure().catch(() => {});
    this.state = "countdown";
    this._countdownT = 1.5;
    this._lastCount = 0;
    this.input.enabled = false;
    this.input.reset();
    this.ui.hidePause();
    this.ui.setState("countdown");
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
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
    this.ui.announce("PEPSI RUSH!\nInvincible · Magnet · 2× points");
    this.collectibles.setRushActive(true);
    this.fx.setRushActive(true);
    this.world.setRushActive(true);
    this.player.setGhost(true);
    this.rig.punchFov(3);
  }

  _endRush() {
    this.audio.stopRushLoop();
    this.collectibles.setRushActive(false);
    this.fx.setRushActive(false);
    this.world.setRushActive(false);
    this.player.setGhost(false);
  }

  _collectPickup(c) {
    const now = this._runTime;
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
            this.combo >= SCORE.shoutPerfect
              ? 3
              : this.combo >= SCORE.shoutWow
                ? 2
                : 1,
          );
        }
      }
    }
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const pts = SCORE.canBase * this.combo;
    this._addScore(pts);
    this.coins += 1;

    this.fizz.onCanPickup();
    if (this.fizz.isRush && !this._rushVisuals) {
      this._rushVisuals = true;
      this._startRush();
    }

    this._applyMissionRewards(this.missions.bump("cans", 1));
    this._applyMissionRewards(this.missions.checkCombo(this.combo));

    this.audio.pickup(this.combo);
    this.fx.canPop(
      new THREE.Vector3(this.player.x, 0.12, this.player.z),
      this.combo,
    );
    this.ui.flashPickup(this.combo);
    this.ui.popCan();
    this.ui.pulseScore();
    this.ui.floatPoints(pts * this._scoreMult(), this.combo);
  }

  _gameOver(finished = false, tip = null) {
    if (this.state !== "playing") return;
    this.state = "gameover";
    this.obstacles.clearAllTutorialHints();
    this.ui.clearTutorialHint();
    this.hitStopT = DEATH.hitStopDuration;
    const diedDuringRush = this.fizz.isRush;
    this._rushEnding = diedDuringRush;
    this._endRush();
    this.fizz.endRush();
    if (!finished) this.player.kill();
    this.player.setGhost(false);
    if (!finished) this.audio.crash();
    if (!finished) {
      this.fx.crashBurst(this.player.group.position.clone(), true);
      this.ui.flashHit(this.fx.hitFlashIntensity());
      this.rig.deathShake(DEATH.shakeStrength, DEATH.shakeDuration);
      this.rig.punchFov(DEATH.fovPunch);
    }
    this.input.enabled = false;

    const floored = Math.floor(this.score);
    const distM = Math.floor(this.distance);
    const allTimeBestCombo = Math.max(
      this._persisted.bestCombo,
      this.bestCombo,
    );
    const priorBest =
      this.mode === "timed"
        ? this._persisted.timedHighScore
        : this._persisted.highScore;
    const highScore = Math.max(priorBest, floored);
    const topScores = [...(this._persisted.topScores || []), floored]
      .sort((a, b) => b - a)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 3);
    const soClose =
      this._persisted.highScore > 0 &&
      floored >= this._persisted.highScore * 0.9;
    savePersisted({
      ...this._persisted,
      highScore:
        this.mode === "endless" ? highScore : this._persisted.highScore,
      timedHighScore:
        this.mode === "timed" ? highScore : this._persisted.timedHighScore,
      bestCombo: allTimeBestCombo,
      totalCans: this._persisted.totalCans + this.coins,
      topScores,
    });
    this._persisted = loadPersisted();

    const runId = this._runId;
    this._resultTimer = setTimeout(() => {
      if (runId === this._runId && this.state === "gameover") {
        this.audio.gameOver();
        this.ui.showGameOver(floored, this.coins, this.bestCombo, {
          highScore,
          finished,
          tip,
          isNewBest: floored > priorBest,
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
    this._applyMissionRewards(this.missions.bump("nearmiss", 1));
    this.hitStopT = Math.max(this.hitStopT, NEAR_MISS.hitStop);
    this.audio.nearMissWhoosh();
    this.fx.nearMissSpark(this.player.group.position.clone());
    this.ui.floatNearMiss(bonus);
  }

  _tutorialGrace(action) {
    if (action === "slide") {
      if (this._graceSlideFired) return;
      this._graceSlideFired = true;
      this._applyMissionRewards(this.missions.bump("slides", 1));
    } else if (action === "jump") {
      if (this._graceJumpFired) return;
      this._graceJumpFired = true;
      this._applyMissionRewards(this.missions.bump("jumps", 1));
    }
    this.combo = 1;
    this.comboTimer = 0;
    this.ui.announce(
      action === "slide"
        ? "Slide under the striped gates. ↓ / S"
        : "Jump over low barriers. ↑ / SPACE",
    );
  }

  _loop() {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
    this.render();
  }

  update(dt) {
    this._elapsed += dt;
    if (this.state === "paused") return;
    if (this.state === "menu") {
      this.player.group.rotation.y = Math.PI - 0.45;
      this.player.update(dt, false);
      this.world.update(0, 0, dt);
      this.rig.menu(this._elapsed);
      return;
    }
    if (this.state === "countdown") {
      this._countdownT -= dt;
      const count = Math.ceil(this._countdownT / 0.8);
      if (count !== this._lastCount) {
        this._lastCount = count;
        this.ui.countdown(Math.max(1, count));
        this.audio.countdown(count);
      }
      if (this._countdownT <= 0) {
        this.state = "playing";
        this.input.enabled = true;
        this.input.reset();
        this.ui.countdown(null);
        this.ui.setState("playing");
        this.audio.startSting();
        if (this.fizz.isRush) this.audio.startRushLoop();
      }
      this.ui.update(this._stats(), dt);
      return;
    }
    const playing = this.state === "playing";
    const gameover = this.state === "gameover";
    const stats = this._stats();

    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      this.player.update(dt);
      this.fx.update(
        dt,
        this.player.group.position,
        stats.speedNorm,
        playing || gameover,
      );
      this.rig.update(
        dt,
        this.player.group.position,
        playing ? stats.speedNorm : 0,
        this.player.lean,
        this.player.jumping,
        this.player.y,
      );
      this.ui.update(this._stats(), dt);
      return;
    }

    if (playing) {
      this.invulnerableT = Math.max(0, this.invulnerableT - dt);
      this.player.root.visible =
        this.invulnerableT <= 0 ||
        Math.floor(this.invulnerableT * 12) % 2 === 0;
      this.audio.updateMusic(dt, this.fizz.isRush);
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

      const zone = Math.floor(this.distance / 600) % 3;
      if (zone !== this._zoneLevel) {
        this._zoneLevel = zone;
        this.world.setZoneLevel(zone);
        this.ui.announce(["PACIFIC COAST", "DOWNTOWN", "SUNSET STRIP"][zone]);
      }
      this._runTime += dt;
      if (this.mode === "timed" && this._runTime >= 90) {
        this._gameOver(true);
        return;
      }

      const inp = this.input.consume(this.player.canQueueLane());
      if (inp.laneDelta) {
        if (this.player.tryLane(inp.laneDelta)) {
          this.audio.whoosh(inp.laneDelta * 0.6);
          this.rig.notifyLaneSwitch(inp.laneDelta);
        }
      }
      if (inp.jump) this._jumpBufferT = 0.16;
      this._jumpBufferT = Math.max(0, (this._jumpBufferT || 0) - dt);
      if (this._jumpBufferT > 0) {
        this._dismissTutorialCueOnInput("jump");
        const jumped = this.player.tryJump();
        if (jumped) {
          this._jumpBufferT = 0;
          this.audio.jump();
          this._applyMissionRewards(this.missions.bump("jumps", 1));
        }
      }
      if (inp.slide) {
        this._jumpBufferT = 0;
        this._dismissTutorialCueOnInput("slide");
        const slid = this.player.trySlide();
        if (slid) {
          this.audio.slide();
          this._applyMissionRewards(this.missions.bump("slides", 1));
        }
      }

      this.player.speed = Math.min(
        PLAYER.runSpeedMax,
        this.player.speed + PLAYER.accelPerSec * dt,
      );
      if (this._runTime < PLAYER.earlySpeedCapSec) {
        this.player.speed = Math.min(this.player.speed, PLAYER.earlySpeedCap);
      }
      this._previousZ = this.player.z;
      this.player.z += this.player.speed * dt;
      this.distance += this.player.speed * dt;
      const comboMeter = 1 + (this.combo - 1) * 0.04;
      this._addScore(this.player.speed * dt * SCORE.perMeter * comboMeter);

      this.player.update(dt);

      const box = this.player.getHitBox();
      box.previousZ = this._previousZ;
      if (
        this.obstacles.checkRamp(box, this.player.lane) &&
        !this.player.jumping
      ) {
        this.player.tryJump();
        this.audio.jump();
      }

      if (this.fizz.isRush) {
        const smashHit = this.obstacles.collide(
          box,
          this.player.jumping,
          this.player.sliding,
        );
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
        this.player.speed,
      );
      if (poseDismiss) this._dismissTutorialCueOnInput(poseDismiss);
      if (this.player.justLanded) {
        this.audio.land();
        this.fx.landDust(this.player.group.position, stats.speedNorm);
      }

      this._applyMissionRewards(this.missions.update(dt, false));

      this.world.update(this.player.z, this.player.speed, dt);
      this.obstacles.update(dt, this.player.z, this.player.speed);

      this.collectibles.update(
        dt,
        this.player.z,
        this.player.x,
        this.player.y,
        this.player.speed,
        this.player.lane,
      );

      const hit =
        this.fizz.isRush || this.invulnerableT > 0
          ? null
          : this.obstacles.collide(
              box,
              this.player.jumping,
              this.player.sliding,
            );
      if (hit) {
        this.missions.update(0, true);
        this.health--;
        const tip =
          hit.hit.mode === "slide"
            ? "Slide under striped gates with ↓ or S. Start your slide just before the gate."
            : hit.hit.mode === "jump"
              ? "Jump over barriers with ↑, W, or Space. Aim to be in the air as you reach them."
              : "Trucks need a lane change. Use ← / → or A / D to find a clear path.";
        this.obstacles.destroyObstacle(hit);
        if (this.health <= 0) this._gameOver(false, tip);
        else {
          this.invulnerableT = 2.2;
          this.combo = 1;
          this.comboTimer = 0;
          this.audio.crash();
          this.ui.flashHit(0.45);
          this.rig.deathShake(0.12, 0.22);
          this.ui.announce(
            `${this.health} ${this.health === 1 ? "life" : "lives"} left. Keep going!`,
          );
          this.fx.crashBurst(this.player.group.position.clone());
        }
      } else {
        const nearBonus = this.obstacles.checkNearMiss(
          box,
          this.player.jumping,
          this.player.sliding,
          this.player.z,
          this.player.lane,
        );
        if (nearBonus > 0) this._nearMiss(nearBonus);
      }

      if (this.state !== "playing") return;
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
    } else if (this.state === "menu" || gameover) {
      this.player.update(dt);
      this.world.update(this.player.z, this.player.speed, dt);
    }

    const speedNorm = playing
      ? stats.speedNorm
      : this.state === "menu"
        ? 0.12
        : 0.08;
    this.fx.update(
      dt,
      this.player.group.position,
      speedNorm,
      playing || this.state === "menu",
    );
    this.rig.update(
      dt,
      this.player.group.position,
      playing ? stats.speedNorm : 0,
      this.player.lean,
      this.player.jumping,
      this.player.y,
    );

    this.ui.update(this._stats(), dt);
  }

  render() {
    if (this._contextLost) return;
    const gl = this.renderer.getContext();
    if (gl?.isContextLost?.()) {
      this._contextLost = true;
      console.warn("[Pepsiman] WebGL context is lost.");
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("keydown", this._onKey);
    window.removeEventListener("blur", this._onBlur);
    document.removeEventListener("visibilitychange", this._onVisibility);
    clearTimeout(this._resultTimer);
    this.audio.stopRushLoop();
    this.audio.ctx?.close().catch(() => {});
    this._environmentTarget?.dispose();
    this.input.detach();
    this.renderer.dispose();
  }
}
