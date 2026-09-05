import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTexture(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function globe(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.fillStyle = "#ec2337";
  ctx.beginPath();
  ctx.moveTo(-r, -r);
  ctx.lineTo(r, -r);
  ctx.lineTo(r, -r * 0.3);
  ctx.bezierCurveTo(r * 0.15, r * 0.3, -r * 0.25, -r * 0.15, -r, r * 0.1);
  ctx.fill();
  ctx.fillStyle = "#0054d6";
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.42);
  ctx.bezierCurveTo(-r * 0.1, r * 0.06, r * 0.24, r * 0.58, r, r * 0.02);
  ctx.lineTo(r, r);
  ctx.lineTo(-r, r);
  ctx.fill();
  ctx.restore();
}

let logoTexture;
export function logoMap() {
  return (logoTexture ??= canvasTexture(256, 256, (ctx) =>
    globe(ctx, 128, 128, 125),
  ));
}

export function billboardMap(headline = "THIRSTY FOR MORE?", sub = "pepsi") {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = "#004bcb";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0039a1";
    ctx.beginPath();
    ctx.moveTo(w * 0.67, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(w * 0.45, h);
    ctx.fill();
    globe(ctx, 790, 252, 148);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.font = "italic 900 77px Arial";
    const words = headline.split(" ");
    let line = "";
    let y = 150;
    for (const word of words) {
      if (ctx.measureText(line + word).width > 520 && line) {
        ctx.fillText(line.trim(), 60, y);
        y += 80;
        line = "";
      }
      line += word + " ";
    }
    ctx.fillText(line.trim(), 60, y);
    ctx.font = "bold 29px Arial";
    ctx.fillText(sub, 62, 422);
  });
}

export function labelMap(text, bg = "#0a56d9", fg = "#ffffff") {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 48px Arial";
    ctx.fillText(text, w / 2, h / 2, w - 30);
  });
}

export function box(parent, material, x, y, z, w, h, d, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function decal(parent, map, x, y, z, w, h, rotation = Math.PI) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotation;
  parent.add(mesh);
  return mesh;
}

let canTemplate;
export function makeCan() {
  if (canTemplate) return canTemplate.clone(true);
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.25, 0.7, 24),
    new THREE.MeshStandardMaterial({
      color: 0x0054d6,
      metalness: 0.58,
      roughness: 0.25,
    }),
  );
  body.castShadow = true;
  g.add(body);
  const silver = new THREE.MeshStandardMaterial({
    color: 0xe3eef5,
    metalness: 0.85,
    roughness: 0.24,
  });
  for (const y of [-0.35, 0.35]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.245, 0.245, 0.035, 24),
      silver,
    );
    cap.position.y = y;
    g.add(cap);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.239, 0.014, 6, 24),
      silver,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y + 0.019;
    g.add(rim);
  }
  const tab = new THREE.Mesh(
    new THREE.TorusGeometry(0.065, 0.018, 6, 12),
    silver,
  );
  tab.rotation.x = Math.PI / 2;
  tab.scale.z = 1.5;
  tab.position.y = 0.38;
  g.add(tab);
  decal(g, logoMap(), 0, 0.03, -0.258, 0.32, 0.32);
  decal(g, logoMap(), 0, 0.03, 0.258, 0.32, 0.32, 0);
  canTemplate = batchStatic(g);
  return canTemplate.clone(true);
}

/** Batch static props by material while preserving their shadow behavior. */
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const batches = new Map(),
    sources = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const key = mesh.material.uuid + mesh.castShadow;
    if (!batches.has(key))
      batches.set(key, {
        material: mesh.material,
        shadow: mesh.castShadow,
        geometries: [],
      });
    const geo = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    if (!geo.attributes.uv)
      geo.setAttribute(
        "uv",
        new THREE.BufferAttribute(
          new Float32Array(geo.attributes.position.count * 2),
          2,
        ),
      );
    batches.get(key).geometries.push(geo);
    sources.push(mesh);
  });
  for (const mesh of sources) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  for (const { material, shadow, geometries } of batches.values()) {
    const geometry = mergeGeometries(geometries);
    if (!geometry) throw new Error("Unable to batch city geometry");
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    root.add(mesh);
    geometries.forEach((g) => g.dispose());
  }
  return root;
}
