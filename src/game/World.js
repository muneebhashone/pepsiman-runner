import * as THREE from "three";
import { WORLD } from "./constants.js";
import {
  seeded,
  canvasTexture,
  billboardMap,
  labelMap,
  box,
  decal,
  batchStatic,
} from "./Art.js";

const LENGTH = 48,
  COUNT = 10;
const palettes = [
  { sky: 0x96d6ec, fog: 0xb3dfeb, sun: 0xffedd2 },
  { sky: 0x9dc8e7, fog: 0xbcd6e7, sun: 0xffecd3 },
  { sky: 0xedb3a0, fog: 0xf1c7b0, sun: 0xffd3a0 },
];

/** Fully dressed, recycled city blocks; textures and materials are shared. */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.zone = 0;
    this.segments = [];
    this.materials = {};
    this.skyColor = new THREE.Color(palettes[0].sky);
    scene.background = this.skyColor;
    scene.fog = new THREE.Fog(palettes[0].fog, 80, 260);
    this._setupMaterials();
    this._setupLights();
    this._setupHorizon();
    for (let i = 0; i < COUNT; i++) {
      const g = this._block(i);
      scene.add(g);
      this.segments.push(g);
    }
    this.reset();
  }
  mat(color, roughness = 0.85, metalness = 0) {
    const key = `${color}-${roughness}-${metalness}`;
    return (this.materials[key] ??= new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
    }));
  }
  _setupMaterials() {
    const rand = seeded(1959);
    const asphalt = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#63747c";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 15000; i++) {
        const v = 65 + rand() * 80;
        ctx.fillStyle = `rgba(${v},${v + 10},${v + 14},.3)`;
        ctx.fillRect(rand() * w, rand() * h, 1, 1);
      }
      ctx.strokeStyle = "#55656b";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(12, 40);
      ctx.lineTo(54, 99);
      ctx.lineTo(42, 119);
      ctx.lineTo(60, 150);
      ctx.stroke();
    });
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
    asphalt.repeat.set(2, 10);
    this.roadMat = new THREE.MeshStandardMaterial({
      map: asphalt,
      roughness: 0.95,
    });
    this.billboards = [
      billboardMap(),
      billboardMap("LIVE FOR NOW.", "EVERY SIP. EVERY SECOND."),
      billboardMap("KEEP IT COOL.", "THE ORIGINAL REFRESHMENT."),
    ];
    this.shopMaps = [
      "PACIFIC MARKET",
      "SUNSET DINER",
      "RECORDS & TAPES",
      "BOARDWALK",
      "FRESH DAILY",
      "OCEAN VIEW",
    ].map((t, i) => labelMap(t, ["#085f67", "#bd4844", "#2553a1"][i % 3]));
    this.facades = [0, 1, 2, 3].map(
      (i) =>
        new THREE.MeshStandardMaterial({
          roughness: 0.8,
          map: canvasTexture(128, 256, (ctx, w, h) => {
            const base = ["#dfd7c7", "#b6d3d9", "#e4b6a1", "#9bb7c9"][i];
            ctx.fillStyle = base;
            ctx.fillRect(0, 0, w, h);
            for (let y = 12; y < h - 5; y += 36)
              for (let x = 12; x < w; x += 30) {
                ctx.fillStyle = "#6b8d9e";
                ctx.fillRect(x + 1, y + 2, 17, 25);
                ctx.fillStyle = rand() > 0.25 ? "#2e586a" : "#87b3bd";
                ctx.fillRect(x, y, 15, 22);
                ctx.fillStyle = "#b5d7db";
                ctx.fillRect(x + 1, y + 1, 13, 2);
                ctx.fillStyle = base;
                ctx.fillRect(x + 7, y, 1, 22);
              }
          }),
        }),
    );
  }
  _setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xc5eeff, 0x87846b, 2.2));
    this.sun = new THREE.DirectionalLight(palettes[0].sun, 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -28,
      right: 28,
      top: 38,
      bottom: -26,
      near: 1,
      far: 130,
    });
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xd6edff, 0.7);
    fill.position.set(12, 12, -25);
    this.scene.add(fill);
  }
  _setupHorizon() {
    this.horizon = new THREE.Group();
    this.scene.add(this.horizon);
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1300),
      this.mat(0x70c4d3, 0.32, 0.22),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(540, -1.15, 250);
    this.horizon.add(ocean);
    const rand = seeded(999);
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(1, 12, 8),
          this.mat(0xf5f7ed),
        );
        puff.scale.set(10 + rand() * 10, 2.2 + rand() * 2, 4 + rand() * 4);
        puff.position.x = j * 10;
        cloud.add(puff);
      }
      cloud.position.set(
        (rand() - 0.5) * 550,
        50 + rand() * 55,
        120 + rand() * 300,
      );
      this.horizon.add(cloud);
    }
    for (let i = 0; i < 26; i++) {
      const h = 10 + rand() * 50;
      box(
        this.horizon,
        this.mat(0x8caebe),
        -60 - rand() * 120,
        h / 2,
        30 + rand() * 340,
        8 + rand() * 10,
        h,
        10,
        false,
      );
    }
    for (let i = 0; i < 8; i++) {
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(35 + rand() * 30, 25 + rand() * 40, 5),
        this.mat(0x98b8bc),
      );
      hill.position.set(120 + i * 32, 2, 330 + rand() * 50);
      this.horizon.add(hill);
    }
  }
  _palm(parent, x, z, seed) {
    const rand = seeded(seed),
      h = 6.5 + rand() * 2.3;
    const palm = new THREE.Group();
    palm.position.set(x, 0.3, z);
    parent.add(palm);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.23, h, 9),
      this.mat(0x93846a),
    );
    trunk.position.set(0.18, h / 2, 0);
    trunk.rotation.z = -0.045;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let i = 0; i < 8; i++) {
      const leaf = new THREE.Group();
      leaf.position.set(0.36, h, 0);
      leaf.rotation.y = (i * Math.PI) / 4 + rand() * 0.25;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1.2, 0.65, 0),
        new THREE.Vector3(2.4, 0.28, 0),
        new THREE.Vector3(3.4, -0.9, 0),
      ]);
      const vertices = [],
        indices = [];
      for (let j = 0; j <= 10; j++) {
        const t = j / 10,
          p = curve.getPoint(t),
          width = Math.sin(t * Math.PI) * 0.45;
        vertices.push(p.x, p.y, -width, p.x, p.y + 0.09, 0, p.x, p.y, width);
        if (j < 10) {
          const a = j * 3;
          indices.push(
            a,
            a + 3,
            a + 1,
            a + 1,
            a + 3,
            a + 4,
            a + 1,
            a + 4,
            a + 2,
            a + 2,
            a + 4,
            a + 5,
          );
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mat = this.mat(i % 2 ? 0x3e8554 : 0x528f55);
      mat.side = THREE.DoubleSide;
      const frond = new THREE.Mesh(geo, mat);
      frond.castShadow = true;
      leaf.add(frond);
      palm.add(leaf);
    }
  }
  _building(parent, x, z, i, rand) {
    const side = Math.sign(x),
      width = 6 + rand() * 3,
      depth = 8 + rand() * 5,
      height = 9 + rand() * 16;
    const m = this.mat([0xe4d9c7, 0xb8d7dc, 0xebbcaa, 0xb4c7d6][i % 4]);
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    parent.add(b);
    const face = this.facades[i % 4];
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      face,
    );
    body.position.y = height / 2;
    body.castShadow = body.receiveShadow = true;
    b.add(body);
    box(
      b,
      this.mat(0xf1ece0),
      0,
      height + 0.13,
      0,
      width + 0.5,
      0.28,
      depth + 0.5,
    );
    box(b, this.mat(0x81999d), 0, height + 0.5, 1.2, 2.5, 0.75, 2);
    box(
      b,
      this.mat(0xe6e2d7),
      -side * (width / 2 + 0.08),
      3,
      0,
      0.35,
      0.25,
      depth + 0.25,
    );
    box(
      b,
      this.mat(0x244951, 0.3, 0.25),
      -side * (width / 2 + 0.04),
      1.55,
      0,
      0.1,
      2.5,
      depth - 0.7,
    );
    for (let k = 0; k < 5; k++)
      box(
        b,
        this.mat(0xe4dfd3),
        -side * (width / 2 + 0.12),
        1.5,
        -depth / 2 + 0.4 + (k * depth) / 5,
        0.15,
        3,
        0.14,
      );
    const awning = box(
      b,
      this.mat(i % 2 ? 0xb65049 : 0x216c71),
      -side * (width / 2 + 0.65),
      3.4,
      0,
      1.5,
      0.17,
      depth - 0.4,
    );
    awning.rotation.z = side * 0.16;
    for (let k = 0; k < 7; k++)
      box(
        b,
        this.mat(0xf0e9dc),
        -side * (width / 2 + 0.65),
        3.51,
        -depth / 2 + 0.7 + (k * (depth - 1)) / 7,
        1.5,
        0.035,
        0.22,
      );
    decal(
      b,
      this.shopMaps[i % 6],
      -side * (width / 2 + 0.15),
      4.15,
      0,
      depth - 0.5,
      0.95,
      (-side * Math.PI) / 2,
    );
    if (i % 2 === 0)
      for (let y = 6; y < height - 2; y += 4) {
        box(
          b,
          this.mat(0x455a60, 0.6, 0.4),
          -side * (width / 2 + 0.45),
          y,
          1,
          0.9,
          0.12,
          2.1,
        );
        box(
          b,
          this.mat(0x455a60),
          -side * (width / 2 + 0.9),
          y + 0.5,
          1,
          0.055,
          1,
          2.1,
        );
      }
  }
  _lamp(parent, x, z) {
    const m = this.mat(0x49656b, 0.6, 0.45),
      pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 5.6, 8), m);
    pole.position.set(x, 2.9, z);
    pole.castShadow = true;
    parent.add(pole);
    box(parent, m, x - Math.sign(x) * 0.45, 5.7, z, 1.1, 0.12, 0.12);
    box(
      parent,
      this.mat(0xe6eee0),
      x - Math.sign(x) * 0.85,
      5.62,
      z,
      0.65,
      0.16,
      0.32,
    );
  }
  _billboard(parent, x, z, i) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = x > 0 ? -0.22 : 0.22;
    parent.add(g);
    const steel = this.mat(0x596e75, 0.6, 0.4);
    box(g, steel, -2.2, 5.5, 0, 0.17, 11, 0.17);
    box(g, steel, 2.2, 5.5, 0, 0.17, 11, 0.17);
    box(g, steel, 0, 10.6, 0, 8.4, 4.5, 0.25);
    decal(g, this.billboards[i % 3], 0, 10.6, -0.14, 8.1, 4.1);
    box(g, this.mat(0xe7e7d8), 0, 12.92, -0.1, 8.7, 0.18, 0.6);
  }
  _block(i) {
    const g = new THREE.Group(),
      rand = seeded(i * 103 + 19),
      paint = this.mat(0xf0ecce);
    box(
      g,
      this.roadMat,
      0,
      -0.13,
      LENGTH / 2,
      WORLD.roadWidth,
      0.25,
      LENGTH,
      false,
    );
    for (const x of [-1.1, 1.1])
      for (let z = 2; z < LENGTH; z += 8)
        box(g, paint, x, 0.01, z, 0.08, 0.014, 3.5, false);
    for (const side of [-1, 1]) {
      const edge = (side * WORLD.roadWidth) / 2;
      box(
        g,
        paint,
        edge - side * 0.22,
        0.011,
        LENGTH / 2,
        0.1,
        0.015,
        LENGTH,
        false,
      );
      box(
        g,
        this.mat(0xd4d4c7),
        edge + side * 1.45,
        0.12,
        LENGTH / 2,
        2.9,
        0.26,
        LENGTH,
        false,
      );
      box(
        g,
        this.mat(0xf1e8d9),
        edge + side * 0.13,
        0.2,
        LENGTH / 2,
        0.27,
        0.38,
        LENGTH,
        false,
      );
      for (let z = 0; z < LENGTH; z += 4)
        box(
          g,
          this.mat(0xbac1b7),
          edge + side * 1.6,
          0.257,
          z,
          2.45,
          0.01,
          0.025,
          false,
        );
      this._lamp(g, side * 5.1, 8);
      this._palm(g, side * 6, 24, i * 77 + side + 30);
      if (side < 0 || i % 3 !== 0) {
        this._building(
          g,
          side * (11 + rand() * 1.5),
          10,
          i + (side > 0 ? 1 : 0),
          rand,
        );
        this._building(g, side * (12 + rand() * 2), 33, i + 2, rand);
      } else {
        box(g, this.mat(0xd8c7a7), 26, -0.1, 24, 37, 0.15, LENGTH, false);
        for (let z = 2; z < LENGTH; z += 6)
          box(g, this.mat(0xebead7), 8, 0.6, z, 0.16, 1.2, 0.16, false);
        box(g, this.mat(0xeae8d4), 8, 1.08, 24, 0.14, 0.12, LENGTH, false);
        this._palm(g, 14, 12, i + 505);
        this._palm(g, 22, 34, i + 919);
      }
      box(g, this.mat(0x346b68), side * 5.4, 0.5, 35, 0.55, 0.9, 0.55);
      box(g, this.mat(0xc59b69), side * 6, 0.62, 4, 0.7, 0.1, 1.9);
      box(g, this.mat(0x4b6062), side * 6, 0.3, 3.4, 0.6, 0.6, 0.12);
      box(g, this.mat(0x4b6062), side * 6, 0.3, 4.6, 0.6, 0.6, 0.12);
    }
    if (i % 2 === 0) this._billboard(g, i % 4 ? 9 : -9, 21, i);
    if (i % 2)
      for (let x = -3.6; x < 4; x += 1.2)
        box(g, paint, x, 0.019, 44, 0.6, 0.016, 2.9, false);
    return batchStatic(g);
  }
  update(playerZ, _speed, dt = 1 / 60) {
    this.time += dt;
    const start = Math.floor((playerZ - 65) / LENGTH);
    for (let i = 0; i < COUNT; i++) {
      const index = start + i,
        s = this.segments[((index % COUNT) + COUNT) % COUNT];
      s.position.z = index * LENGTH;
      s.visible = index * LENGTH < playerZ + 280;
    }
    this.sun.position.set(-24, 42, playerZ - 28);
    this.sun.target.position.set(0, 0, playerZ + 20);
    this.horizon.position.z = playerZ;
    const p = palettes[this.zone],
      blend = Math.min(1, dt * 0.4);
    this.skyColor.lerp(new THREE.Color(p.sky), blend);
    this.scene.fog.color.lerp(new THREE.Color(p.fog), blend);
    this.sun.color.lerp(new THREE.Color(p.sun), blend);
  }
  setZoneLevel(level) {
    this.zone = ((level % 3) + 3) % 3;
  }
  setRushActive(active) {
    this.rush = active;
  }
  reset() {
    this.zone = 0;
    this.skyColor.set(palettes[0].sky);
    this.scene.fog.color.set(palettes[0].fog);
    this.update(0);
  }
}
