import * as THREE from "three";
import { box, decal, logoMap, labelMap, batchStatic } from "./Art.js";

const materials = new Map(),
  templates = new Map(),
  signs = new Map();
function mat(color, metalness = 0.1, roughness = 0.58) {
  const key = `${color}-${metalness}-${roughness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, metalness, roughness }),
    );
  return materials.get(key);
}
function sign(text, bg, fg) {
  const key = text + bg;
  if (!signs.has(key)) signs.set(key, labelMap(text, bg, fg));
  return signs.get(key);
}
function wheel(g, x, z, r = 0.35) {
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.22, 16),
    mat(0x263137),
  );
  tire.rotation.z = Math.PI / 2;
  tire.position.set(x, r, z);
  tire.castShadow = true;
  g.add(tire);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.53, r * 0.53, 0.235, 12),
    mat(0xc4d5de, 0.85, 0.25),
  );
  hub.rotation.z = Math.PI / 2;
  hub.position.copy(tire.position);
  g.add(hub);
}
function striped(g, y, w, h) {
  box(g, mat(0xf6ab2c), 0, y, 0, w, h, 0.26);
  for (let i = 0; i < 7; i++) {
    const stripe = box(
      g,
      mat(0x33414a),
      -w / 2 + 0.17 + (i * w) / 7,
      y,
      -0.142,
      0.14,
      h * 0.9,
      0.02,
    );
    stripe.rotation.z = -0.32;
  }
}

export function buildObstacle(type) {
  if (templates.has(type)) return templates.get(type).clone(true);
  const g = new THREE.Group();
  let hit;
  const steel = mat(0xd3dfe0, 0.7, 0.33),
    blue = mat(0x0854bf, 0.48, 0.3),
    red = mat(0xed393c, 0.3, 0.4);
  if (type === "rail") {
    for (const x of [-1.01, 1.01]) {
      box(g, mat(0x495f65), x, 1.38, 0, 0.12, 2.76, 0.17);
      box(g, mat(0x46545b), x, 0.06, 0, 0.38, 0.12, 0.65);
    }
    striped(g, 2.03, 2.18, 0.73);
    decal(g, sign("SLIDE  ↓", "#253d4b"), 0, 2.02, -0.157, 0.85, 0.33);
    for (const x of [-0.95, 0.95]) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 10, 8),
        mat(0xff7c2a),
      );
      lamp.position.set(x, 2.56, 0);
      g.add(lamp);
    }
    hit = { w: 1.96, h: 0.73, d: 0.45, y: 2.03, mode: "slide" };
  } else if (type === "barrier" || type === "sign") {
    for (const x of [-0.76, 0.76]) {
      box(g, steel, x, 0.44, 0, 0.13, 0.88, 0.17);
      box(g, mat(0x454f51), x, 0.05, 0, 0.43, 0.1, 0.65);
    }
    striped(g, 0.81, 1.94, 0.62);
    decal(g, sign("JUMP  ↑", "#f6ab2c", "#263641"), 0, 0.8, -0.159, 0.77, 0.33);
    hit = { w: 1.78, h: 0.95, d: 0.43, y: 0.59, mode: "jump" };
  } else if (type === "barrel") {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.43, 0.43, 1.18, 20),
      red,
    );
    drum.rotation.z = Math.PI / 2;
    drum.position.y = 0.45;
    drum.castShadow = true;
    g.add(drum);
    for (const x of [-0.5, 0.5]) {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.434, 0.025, 6, 20),
        steel,
      );
      rim.rotation.y = Math.PI / 2;
      rim.position.set(x, 0.45, 0);
      g.add(rim);
    }
    decal(g, logoMap(), 0, 0.46, -0.437, 0.42, 0.42);
    hit = { w: 1.14, h: 0.86, d: 0.86, y: 0.45, mode: "jump" };
  } else if (type === "ramp") {
    const ramp = box(g, blue, 0, 0.29, 0, 2, 0.18, 2.6);
    ramp.rotation.x = -0.2;
    for (const x of [-0.93, 0.93]) {
      const edge = box(g, steel, x, 0.38, 0, 0.08, 0.08, 2.6);
      edge.rotation.x = -0.2;
    }
    const arrow = decal(g, sign("↑  ↑  ↑", "#0754bf"), 0, 0.42, 0, 1.6, 1.2, 0);
    arrow.rotation.x = -Math.PI / 2 - 0.2;
    hit = { w: 1.85, h: 0.4, d: 2.5, y: 0.25, mode: "ramp" };
  } else {
    const wide = type === "pepsiWide",
      w = wide ? 3 : 1.87,
      d = wide ? 1.3 : 3.8;
    box(g, mat(0x303d47, 0.55, 0.4), 0, 0.48, 0, w + 0.08, 0.25, d + 0.2);
    box(g, blue, 0, 1.51, -0.3, w, 1.82, d - 0.5);
    for (const x of [-w / 2 - 0.005, w / 2 + 0.005]) {
      decal(
        g,
        sign("pepsi", "#0754bf"),
        x,
        1.55,
        -0.25,
        d - 0.8,
        0.6,
        x > 0 ? Math.PI / 2 : -Math.PI / 2,
      );
      box(g, steel, x, 2.44, -0.3, 0.06, 0.08, d - 0.4);
    }
    box(g, steel, 0, 2.45, -0.3, w + 0.08, 0.09, d - 0.45);
    box(
      g,
      mat(0xe4ebe9, 0.6, 0.3),
      0,
      1.46,
      -d / 2 + 0.03,
      w - 0.1,
      1.58,
      0.07,
    );
    decal(g, logoMap(), 0, 1.68, -d / 2 - 0.015, 0.74, 0.74);
    decal(
      g,
      sign("pepsi", "#e4ebe9", "#0754bf"),
      0,
      1.08,
      -d / 2 - 0.02,
      1.15,
      0.28,
    );
    box(g, steel, 0, 0.69, -d / 2 - 0.04, w, 0.1, 0.17);
    for (const x of [-w * 0.39, w * 0.39])
      box(g, red, x, 0.82, -d / 2 - 0.02, 0.17, 0.13, 0.06);
    if (!wide) {
      box(g, blue, 0, 1.12, d / 2 - 0.03, 1.82, 1.35, 1.08);
      box(g, mat(0x214c62, 0.5, 0.15), 0, 1.69, d / 2 - 0.02, 1.65, 0.48, 0.92);
      box(g, blue, 0, 1.99, d / 2 - 0.03, 1.94, 0.14, 1.15);
      box(g, steel, 0, 0.5, d / 2 + 0.6, 1.95, 0.17, 0.13);
      for (const x of [-0.89, 0.89])
        box(g, mat(0x273e4b), x * 1.15, 1.7, d / 2 - 0.1, 0.16, 0.25, 0.23);
    }
    for (const x of [-w / 2, w / 2])
      for (const z of [-d * 0.32, d * 0.35]) wheel(g, x, z);
    hit = {
      w: wide ? 2.9 : 1.82,
      h: 2.33,
      d: wide ? 1.5 : 4.35,
      y: 1.25,
      mode: "block",
    };
  }
  g.userData.hit = hit;
  g.userData.type = type;
  batchStatic(g);
  templates.set(type, g);
  return g.clone(true);
}
