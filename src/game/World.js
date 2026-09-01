import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, WORLD, LANES, PLAYER } from './constants.js';

const POOL = WORLD.poolSize ?? WORLD.segmentsAhead + WORLD.segmentsBehind;

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this.nextSegZ = 0;
    this.scrollT = 0;
    this.speedNorm = 0;

    this.roadMat = new THREE.MeshStandardMaterial({
      color: COLORS.asphalt,
      roughness: 0.88,
      metalness: 0.12,
    });
    this.lineMat = new THREE.MeshStandardMaterial({
      color: COLORS.asphaltLine,
      emissive: COLORS.asphaltLine,
      emissiveIntensity: 0.22,
      roughness: 0.45,
    });
    this.sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e2a,
      roughness: 0.82,
      metalness: 0.08,
    });
    this.curbNeonBlue = new THREE.MeshStandardMaterial({
      color: COLORS.pepsiBlue,
      emissive: COLORS.pepsiBlue,
      emissiveIntensity: 0.75,
      roughness: 0.3,
      metalness: 0.4,
    });
    this.curbNeonRed = new THREE.MeshStandardMaterial({
      color: COLORS.pepsiRed,
      emissive: COLORS.pepsiRed,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.35,
    });
    this._buildingMats = [
      new THREE.MeshStandardMaterial({ color: COLORS.buildingA, roughness: 0.68, metalness: 0.28 }),
      new THREE.MeshStandardMaterial({ color: COLORS.buildingB, roughness: 0.62, metalness: 0.32 }),
      new THREE.MeshStandardMaterial({ color: COLORS.buildingC, roughness: 0.72, metalness: 0.18 }),
    ];
    this._neonMats = [
      new THREE.MeshStandardMaterial({
        color: COLORS.neonCyan,
        emissive: COLORS.neonCyan,
        emissiveIntensity: 1.0,
      }),
      new THREE.MeshStandardMaterial({
        color: COLORS.neonMagenta,
        emissive: COLORS.neonMagenta,
        emissiveIntensity: 0.95,
      }),
      new THREE.MeshStandardMaterial({
        color: COLORS.pepsiRed,
        emissive: COLORS.pepsiRed,
        emissiveIntensity: 0.85,
      }),
      new THREE.MeshStandardMaterial({
        color: COLORS.pepsiBlue,
        emissive: COLORS.pepsiBlue,
        emissiveIntensity: 0.9,
      }),
    ];
    this._propMats = {
      cone: new THREE.MeshStandardMaterial({ color: COLORS.pepsiRed, emissive: COLORS.pepsiRed, emissiveIntensity: 0.2 }),
      barrel: new THREE.MeshStandardMaterial({ color: COLORS.pepsiBlue, metalness: 0.5, roughness: 0.35 }),
      light: new THREE.MeshStandardMaterial({ color: 0xffeedd, emissive: 0xffcc88, emissiveIntensity: 0.6 }),
    };
    this._sharedGeo = {
      road: new THREE.BoxGeometry(WORLD.roadWidth, 0.15, WORLD.segmentLength),
      dash: new THREE.BoxGeometry(0.12, 0.02, 3.2),
      curb: new THREE.BoxGeometry(1.2, 0.25, WORLD.segmentLength),
      rail: new THREE.BoxGeometry(0.08, 0.45, WORLD.segmentLength),
      cone: new THREE.ConeGeometry(0.22, 0.55, 8),
      barrel: new THREE.CylinderGeometry(0.28, 0.28, 0.7, 10),
      lightPole: new THREE.CylinderGeometry(0.05, 0.07, 3.2, 8),
      lightBulb: new THREE.SphereGeometry(0.18, 8, 8),
    };

    this._initSky();
    this._buildPool();
    this._seedSegments();
  }

  _initSky() {
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.fog, WORLD.fogNear, WORLD.fogFar);

    const skyGeo = new THREE.SphereGeometry(180, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x02040c) },
        uHorizon: { value: new THREE.Color(0x0a1840) },
        uGlow: { value: new THREE.Color(COLORS.pepsiBlue) },
        uScroll: { value: 0 },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop, uHorizon, uGlow;
        uniform float uScroll;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          vec3 col = mix(uHorizon, uTop, pow(h, 1.4));
          float streak = sin(vPos.z * 0.05 + uScroll) * 0.5 + 0.5;
          col += uGlow * streak * 0.015 * smoothstep(0.55, 0.0, h);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    const hemi = new THREE.HemisphereLight(0x5577bb, 0x1a0a20, 0.5);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0e8, 1.2);
    sun.position.set(-8, 24, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 85;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.bias = -0.00025;
    this.scene.add(sun);
    this.sun = sun;

    const fill = new THREE.PointLight(COLORS.pepsiBlue, 0.75, 70);
    fill.position.set(0, 7, 6);
    this.scene.add(fill);
    this.fill = fill;

    const rim = new THREE.PointLight(COLORS.pepsiRed, 0.45, 50);
    rim.position.set(5, 5, -3);
    this.scene.add(rim);
    this.rim = rim;
  }

  _makeBillboard() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 4.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.65, roughness: 0.35 })
    );
    pole.position.y = 2.1;
    g.add(pole);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.55, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.8, roughness: 0.2 })
    );
    frame.position.y = 4.35;
    g.add(frame);

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 1.4, 0.06),
      new THREE.MeshStandardMaterial({
        color: COLORS.pepsiBlue,
        emissive: COLORS.pepsiBlue,
        emissiveIntensity: 0.35,
        metalness: 0.35,
        roughness: 0.35,
      })
    );
    panel.position.set(0, 4.35, 0.04);
    g.add(panel);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.32, 0.07),
      new THREE.MeshStandardMaterial({
        color: COLORS.pepsiRed,
        emissive: COLORS.pepsiRed,
        emissiveIntensity: 0.45,
      })
    );
    stripe.position.set(0, 4.15, 0.05);
    g.add(stripe);

    const circle = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 20),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide,
      })
    );
    circle.position.set(0, 4.45, 0.08);
    g.add(circle);

    return g;
  }

  _decorateSegment(g, seed) {
    const rand = mulberry32(seed);
    g.clear();
    g.userData.seed = seed;

    const road = new THREE.Mesh(this._sharedGeo.road, this.roadMat);
    road.position.y = -0.075;
    road.receiveShadow = true;
    g.add(road);

    for (let i = 0; i < 2; i++) {
      const x = (LANES[i] + LANES[i + 1]) / 2;
      for (let s = 0; s < 5; s++) {
        const dash = new THREE.Mesh(this._sharedGeo.dash, this.lineMat);
        dash.position.set(x, 0.01, -WORLD.segmentLength / 2 + 4 + s * 8);
        g.add(dash);
      }
    }

    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(this._sharedGeo.curb, this.sidewalkMat);
      curb.position.set(side * (WORLD.roadWidth / 2 + 0.5), 0.05, 0);
      curb.receiveShadow = true;
      g.add(curb);

      const rail = new THREE.Mesh(
        this._sharedGeo.rail,
        side > 0 ? this.curbNeonBlue : this.curbNeonRed
      );
      rail.position.set(side * (WORLD.roadWidth / 2 + 0.1), 0.38, 0);
      g.add(rail);
    }

    for (const side of [-1, 1]) {
      let xOff = side * (WORLD.roadWidth / 2 + 3.8);
      for (let row = 0; row < 2; row++) {
        let zz = -WORLD.segmentLength / 2 + 2;
        while (zz < WORLD.segmentLength / 2 - 2) {
          const w = 2.4 + rand() * 2.8;
          const d = 2.2 + rand() * 3.2;
          const h = 8 + rand() * 20;
          const mat = this._buildingMats[(rand() * 3) | 0];
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(xOff + side * row * 4.8 + (rand() - 0.5) * 0.8, h / 2, zz + d / 2);
          b.castShadow = true;
          b.receiveShadow = true;
          g.add(b);

          const stripCount = 1 + ((rand() * 2) | 0);
          for (let si = 0; si < stripCount; si++) {
            const stripY = Math.min(9.5, 2.5 + rand() * Math.min(6, h - 3));
            const neon = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.7, 0.08, 0.08),
              this._neonMats[(rand() * 4) | 0]
            );
            neon.position.set(b.position.x, stripY, b.position.z + side * d * 0.51);
            g.add(neon);
          }
          zz += d + 1.2 + rand() * 2.5;
        }
      }
    }

    if (rand() > 0.4) {
      const side = rand() > 0.5 ? 1 : -1;
      const board = this._makeBillboard();
      board.position.set(side * (WORLD.roadWidth / 2 + 2.6), 0, (rand() - 0.5) * 12);
      board.rotation.y = side > 0 ? -0.55 : 0.55;
      g.add(board);
    }

    const propCount = 2 + ((rand() * 4) | 0);
    for (let p = 0; p < propCount; p++) {
      const side = rand() > 0.5 ? 1 : -1;
      const px = side * (WORLD.roadWidth / 2 + 0.9 + rand() * 0.6);
      const pz = (rand() - 0.5) * (WORLD.segmentLength - 8);
      if (rand() > 0.55) {
        const cone = new THREE.Mesh(this._sharedGeo.cone, this._propMats.cone);
        cone.position.set(px, 0.28, pz);
        cone.castShadow = true;
        g.add(cone);
      } else if (rand() > 0.5) {
        const barrel = new THREE.Mesh(this._sharedGeo.barrel, this._propMats.barrel);
        barrel.position.set(px, 0.35, pz);
        barrel.castShadow = true;
        g.add(barrel);
      } else {
        const pole = new THREE.Mesh(this._sharedGeo.lightPole, this.sidewalkMat);
        pole.position.set(px, 1.6, pz);
        g.add(pole);
        const bulb = new THREE.Mesh(this._sharedGeo.lightBulb, this._propMats.light);
        bulb.position.set(px, 3.25, pz);
        g.add(bulb);
      }
    }
  }

  _buildPool() {
    for (let i = 0; i < POOL; i++) {
      const g = new THREE.Group();
      g.visible = false;
      this._decorateSegment(g, 1000 + i * 97);
      this.scene.add(g);
      this.pool.push(g);
    }
  }

  _acquireSegment(z) {
    const seg = this.pool.pop() ?? new THREE.Group();
    this._decorateSegment(seg, (z * 0.017 + this.active.length * 31) | 0);
    seg.position.z = z;
    seg.visible = true;
    this.scene.add(seg);
    this.active.push(seg);
    return seg;
  }

  _recycleSegment() {
    const old = this.active.shift();
    if (!old) return;
    old.visible = false;
    this.scene.remove(old);
    this.pool.push(old);
  }

  _seedSegments() {
    this.nextSegZ = -WORLD.segmentLength;
    for (let i = 0; i < POOL; i++) this._spawnSegment();
  }

  _spawnSegment() {
    this._acquireSegment(this.nextSegZ);
    this.nextSegZ += WORLD.segmentLength;
  }

  update(playerZ, speed = PLAYER.runSpeedBase) {
    this.speedNorm = Math.min(
      1,
      (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase)
    );
    this.scrollT += speed * 0.012;

    const recycleZ = playerZ - WORLD.segmentLength * WORLD.segmentsBehind;
    while (this.active.length && this.active[0].position.z < recycleZ) {
      this._recycleSegment();
      this._spawnSegment();
    }

    if (this.fill) {
      this.fill.position.z = playerZ + 8;
      this.fill.intensity = 0.65 + this.speedNorm * 0.35;
    }
    if (this.rim) {
      this.rim.position.z = playerZ - 4;
      this.rim.intensity = 0.35 + this.speedNorm * 0.25;
    }
    if (this.sun) this.sun.position.z = playerZ + 12;

    if (this.scene.fog) {
      const fog = this.scene.fog;
      fog.near = WORLD.fogNear - this.speedNorm * 4;
      fog.far = WORLD.fogFar - this.speedNorm * 18;
    }
    if (this.sky?.material?.uniforms) {
      this.sky.material.uniforms.uScroll.value = this.scrollT;
    }
  }

  reset() {
    for (const seg of this.active) {
      seg.visible = false;
      this.scene.remove(seg);
      this.pool.push(seg);
    }
    this.active = [];
    this.nextSegZ = 0;
    this.scrollT = 0;
    this.speedNorm = 0;
    this._seedSegments();
  }
}
