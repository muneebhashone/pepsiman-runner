import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, WORLD, LANES } from './constants.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.billboards = [];
    this.nextSegZ = 0;
    this.roadMat = new THREE.MeshStandardMaterial({
      color: COLORS.asphalt,
      roughness: 0.92,
      metalness: 0.05,
    });
    this.lineMat = new THREE.MeshStandardMaterial({
      color: COLORS.asphaltLine,
      emissive: COLORS.asphaltLine,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    this.sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a38,
      roughness: 0.85,
    });
    this._buildingMats = [
      new THREE.MeshStandardMaterial({ color: COLORS.buildingA, roughness: 0.7, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: COLORS.buildingB, roughness: 0.65, metalness: 0.25 }),
      new THREE.MeshStandardMaterial({ color: COLORS.buildingC, roughness: 0.75, metalness: 0.15 }),
    ];
    this._neonMats = [
      new THREE.MeshStandardMaterial({
        color: COLORS.neonCyan,
        emissive: COLORS.neonCyan,
        emissiveIntensity: 0.9,
      }),
      new THREE.MeshStandardMaterial({
        color: COLORS.neonMagenta,
        emissive: COLORS.neonMagenta,
        emissiveIntensity: 0.85,
      }),
      new THREE.MeshStandardMaterial({
        color: COLORS.neonYellow,
        emissive: COLORS.neonYellow,
        emissiveIntensity: 0.7,
      }),
    ];
    this._initSky();
    this._seedSegments();
  }

  _initSky() {
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.fog, WORLD.fogNear, WORLD.fogFar);

    const hemi = new THREE.HemisphereLight(0x6688cc, 0x1a1020, 0.55);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(-8, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);
    this.sun = sun;

    const fill = new THREE.PointLight(COLORS.pepsiBlue, 0.6, 60);
    fill.position.set(0, 6, 5);
    this.scene.add(fill);
    this.fill = fill;

    const rim = new THREE.PointLight(COLORS.pepsiRed, 0.35, 40);
    rim.position.set(4, 4, -2);
    this.scene.add(rim);
  }

  _makeSegment(z) {
    const g = new THREE.Group();
    g.position.z = z;

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD.roadWidth, 0.15, WORLD.segmentLength),
      this.roadMat
    );
    road.position.y = -0.075;
    road.receiveShadow = true;
    g.add(road);

    // Lane lines
    for (let i = 0; i < 2; i++) {
      const x = (LANES[i] + LANES[i + 1]) / 2;
      for (let s = 0; s < 5; s++) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 3.2), this.lineMat);
        dash.position.set(x, 0.01, -WORLD.segmentLength / 2 + 4 + s * 8);
        g.add(dash);
      }
    }

    // Sidewalks / neon rails
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.25, WORLD.segmentLength),
        this.sidewalkMat
      );
      curb.position.set(side * (WORLD.roadWidth / 2 + 0.5), 0.05, 0);
      curb.receiveShadow = true;
      g.add(curb);

      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.4, WORLD.segmentLength),
        this._neonMats[side > 0 ? 0 : 1]
      );
      rail.position.set(side * (WORLD.roadWidth / 2 + 0.1), 0.35, 0);
      g.add(rail);
    }

    // Buildings both sides
    for (const side of [-1, 1]) {
      let xOff = side * (WORLD.roadWidth / 2 + 3.5);
      for (let row = 0; row < 2; row++) {
        let zz = -WORLD.segmentLength / 2 + 2;
        while (zz < WORLD.segmentLength / 2 - 2) {
          const w = 2.2 + Math.random() * 2.5;
          const d = 2 + Math.random() * 3;
          const h = 6 + Math.random() * 18;
          const mat = this._buildingMats[(Math.random() * 3) | 0];
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(xOff + side * row * 4.5 + (Math.random() - 0.5), h / 2, zz + d / 2);
          b.castShadow = true;
          b.receiveShadow = true;
          g.add(b);

          // Window strip glow
          if (Math.random() > 0.35) {
            const neon = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.9, 0.15, 0.1),
              this._neonMats[(Math.random() * 3) | 0]
            );
            neon.position.set(b.position.x, 2 + Math.random() * (h - 3), b.position.z + side * d * 0.5);
            g.add(neon);
          }
          zz += d + 1.5 + Math.random() * 2;
        }
      }
    }

    // Pepsi billboard chance
    if (Math.random() > 0.45) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const board = this._makeBillboard();
      board.position.set(side * (WORLD.roadWidth / 2 + 2.2), 4.5, (Math.random() - 0.5) * 10);
      board.rotation.y = side > 0 ? -0.4 : 0.4;
      g.add(board);
      this.billboards.push(board);
    }

    return g;
  }

  _makeBillboard() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.6, roughness: 0.4 })
    );
    pole.position.y = 2.5;
    g.add(pole);
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.8, 0.12),
      new THREE.MeshStandardMaterial({
        color: COLORS.pepsiBlue,
        emissive: COLORS.pepsiBlue,
        emissiveIntensity: 0.35,
        metalness: 0.3,
        roughness: 0.4,
      })
    );
    panel.position.y = 5.2;
    g.add(panel);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.45, 0.13),
      new THREE.MeshStandardMaterial({
        color: COLORS.pepsiRed,
        emissive: COLORS.pepsiRed,
        emissiveIntensity: 0.5,
      })
    );
    stripe.position.y = 5.2;
    g.add(stripe);
    const circle = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.4,
      })
    );
    circle.position.set(0, 5.2, 0.08);
    g.add(circle);
    return g;
  }

  _seedSegments() {
    this.nextSegZ = -WORLD.segmentLength;
    for (let i = 0; i < WORLD.segmentsAhead + WORLD.segmentsBehind; i++) {
      this._spawnSegment();
    }
  }

  _spawnSegment() {
    const seg = this._makeSegment(this.nextSegZ);
    this.scene.add(seg);
    this.segments.push(seg);
    this.nextSegZ += WORLD.segmentLength;
  }

  update(playerZ) {
    // Recycle segments behind player
    while (this.segments.length && this.segments[0].position.z < playerZ - WORLD.segmentLength * WORLD.segmentsBehind) {
      const old = this.segments.shift();
      this.scene.remove(old);
      old.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      this._spawnSegment();
    }
    if (this.fill) this.fill.position.z = playerZ + 8;
    if (this.sun) this.sun.position.z = playerZ + 10;
    if (this.scene.fog) {
      // keep fog relative feel
    }
  }

  reset() {
    for (const seg of this.segments) {
      this.scene.remove(seg);
      seg.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    this.segments = [];
    this.billboards = [];
    this.nextSegZ = 0;
    this._seedSegments();
  }
}
