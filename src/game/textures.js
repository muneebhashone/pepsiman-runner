import * as THREE from 'three';

/** Shared procedural texture factory — real-life surfaces, zero assets. */

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTex(canvas, { srgb = true, repeat = null, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weathered concrete — jersey barriers, bases. */
export function concreteTexture(base = '#8f8f96', seed = 91) {
  const S = 128;
  const rand = mulberry32(seed);
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const v = 110 + rand() * 70;
    ctx.fillStyle = `rgba(${v},${v},${v + 6},${0.15 + rand() * 0.3})`;
    ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
  }
  // Weather streaks running down
  for (let i = 0; i < 10; i++) {
    const x = rand() * S;
    const g = ctx.createLinearGradient(x, 0, x + 4, 0);
    g.addColorStop(0, 'rgba(50,50,56,0)');
    g.addColorStop(0.5, `rgba(50,50,56,${0.1 + rand() * 0.16})`);
    g.addColorStop(1, 'rgba(50,50,56,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 5, S);
  }
  // Chips
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = 'rgba(60,60,66,0.5)';
    ctx.fillRect(rand() * S, rand() * S, 2 + rand() * 4, 1 + rand() * 3);
  }
  return toTex(c);
}

/** Diagonal hazard stripes — yellow/black chevron barricade wrap. */
export function hazardStripesTexture(stripeW = 22, a = '#f2b705', b = '#15151a') {
  const S = 128;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = a;
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(-Math.PI / 4);
  for (let x = -S * 2; x < S * 2; x += stripeW * 2) {
    ctx.fillRect(x, -S * 2, stripeW, S * 4);
  }
  ctx.restore();
  // Grime
  const rand = mulberry32(7);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(20,20,24,${0.08 + rand() * 0.2})`;
    ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 3, 1 + rand() * 3);
  }
  return toTex(c, { repeat: [2, 1] });
}

/** Orange reflective roadwork sign face — "ROAD WORK" with border. */
export function roadWorkSignTexture() {
  const c = makeCanvas(256, 160);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8641b';
  ctx.fillRect(0, 0, 256, 160);
  // Reflective sparkle
  const rand = mulberry32(31);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(255,220,180,${0.05 + rand() * 0.12})`;
    ctx.fillRect(rand() * 256, rand() * 160, 1.5, 1.5);
  }
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 240, 144);
  ctx.fillStyle = '#141414';
  ctx.font = '900 44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ROAD', 128, 56);
  ctx.fillText('WORK', 128, 108);
  return toTex(c);
}

/** "LOW CLEARANCE" hanging board for overhead gantries. */
export function lowClearanceTexture() {
  const c = makeCanvas(256, 96);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2b705';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 84);
  ctx.fillStyle = '#141414';
  ctx.font = '900 34px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LOW CLEARANCE', 128, 48);
  return toTex(c);
}

/** Traffic drum wrap — orange with two white reflective bands. */
export function trafficDrumTexture() {
  const c = makeCanvas(128, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e85d10';
  ctx.fillRect(0, 0, 128, 256);
  const rand = mulberry32(53);
  for (let i = 0; i < 350; i++) {
    ctx.fillStyle = `rgba(120,50,10,${0.06 + rand() * 0.14})`;
    ctx.fillRect(rand() * 128, rand() * 256, 2, 2);
  }
  // Reflective bands (horizontal in UV = rings around drum)
  for (const y of [72, 152]) {
    ctx.fillStyle = '#e8e8e2';
    ctx.fillRect(0, y, 128, 34);
    ctx.fillStyle = 'rgba(150,150,150,0.35)';
    for (let x = 0; x < 128; x += 6) ctx.fillRect(x, y, 2, 34);
  }
  return toTex(c);
}

/** White box-truck side panel — seams, rivets, road grime. */
export function boxTruckSideTexture() {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#dfe3e6';
  ctx.fillRect(0, 0, 256, 128);
  const rand = mulberry32(67);
  for (let i = 0; i < 400; i++) {
    const v = 190 + rand() * 50;
    ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
    ctx.fillRect(rand() * 256, rand() * 128, 2, 2);
  }
  // Panel seams
  ctx.strokeStyle = 'rgba(120,126,132,0.6)';
  ctx.lineWidth = 1;
  for (let x = 32; x < 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, 128);
    ctx.stroke();
  }
  // Grime along the bottom
  const g = ctx.createLinearGradient(0, 96, 0, 128);
  g.addColorStop(0, 'rgba(70,70,74,0)');
  g.addColorStop(1, 'rgba(70,70,74,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 96, 256, 32);
  return toTex(c);
}

/** Truck rear rollup door — horizontal slats + DOT reflective tape. */
export function truckRearTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9ced3';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(100,106,112,0.8)';
  ctx.lineWidth = 1;
  for (let y = 8; y < 128; y += 12) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(128, y + 0.5);
    ctx.stroke();
  }
  // DOT tape — alternating red/white along the bottom
  for (let x = 0, i = 0; x < 128; x += 16, i++) {
    ctx.fillStyle = i % 2 === 0 ? '#c0232b' : '#e8e8e2';
    ctx.fillRect(x, 112, 16, 12);
  }
  return toTex(c);
}

/** Pepsi semi-trailer side — white with globe + wordmark band. */
export function pepsiTrailerTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f5f8';
  ctx.fillRect(0, 0, 512, 256);
  // Blue skirt band
  ctx.fillStyle = '#0055bf';
  ctx.fillRect(0, 200, 512, 56);
  ctx.fillStyle = '#e32934';
  ctx.fillRect(0, 192, 512, 8);
  // Globe
  const cx = 128;
  const cy = 100;
  const r = 62;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#e32934';
  ctx.fillRect(cx - r, cy - r, r * 2, r);
  ctx.fillStyle = '#0055bf';
  ctx.fillRect(cx - r, cy, r * 2, r);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - 8);
  ctx.bezierCurveTo(cx - r * 0.3, cy - 34, cx + r * 0.3, cy + 22, cx + r, cy - 2);
  ctx.lineTo(cx + r, cy + 22);
  ctx.bezierCurveTo(cx + r * 0.3, cy + 44, cx - r * 0.3, cy - 12, cx - r, cy + 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#0055bf';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Wordmark
  ctx.fillStyle = '#0055bf';
  ctx.font = '900 84px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('PEPSI', 220, 104);
  return toTex(c);
}

/** City bus side — window band, skirt, route livery. */
export function busSideTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  // Livery: white top, teal skirt
  ctx.fillStyle = '#e9edf0';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#0f7d8c';
  ctx.fillRect(0, 170, 512, 86);
  ctx.fillStyle = '#f2b705';
  ctx.fillRect(0, 162, 512, 8);
  // Window band
  ctx.fillStyle = '#141c26';
  ctx.fillRect(12, 40, 488, 78);
  // Window dividers + glass sheen
  for (let x = 12; x < 500; x += 62) {
    ctx.fillStyle = '#e9edf0';
    ctx.fillRect(x, 40, 6, 78);
    const g = ctx.createLinearGradient(x + 6, 40, x + 62, 118);
    g.addColorStop(0, 'rgba(160,200,230,0.28)');
    g.addColorStop(0.5, 'rgba(160,200,230,0.05)');
    g.addColorStop(1, 'rgba(160,200,230,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(x + 6, 40, 56, 78);
  }
  // Door outline near front
  ctx.strokeStyle = '#9aa4ac';
  ctx.lineWidth = 3;
  ctx.strokeRect(430, 40, 62, 170);
  ctx.beginPath();
  ctx.moveTo(461, 40);
  ctx.lineTo(461, 210);
  ctx.stroke();
  return toTex(c);
}

/** Bus rear — dark window, lights, grille. */
export function busRearTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f7d8c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#141c26';
  ctx.fillRect(14, 12, 100, 44);
  ctx.fillStyle = '#2a3138';
  ctx.fillRect(20, 66, 88, 30);
  ctx.fillStyle = '#c0232b';
  ctx.fillRect(10, 100, 22, 14);
  ctx.fillRect(96, 100, 22, 14);
  return toTex(c);
}

/** Diamond-plate steel — ramp deck. */
export function diamondPlateTexture() {
  const S = 128;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8b9096';
  ctx.fillRect(0, 0, S, S);
  const rand = mulberry32(23);
  for (let i = 0; i < 500; i++) {
    const v = 120 + rand() * 50;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.25)`;
    ctx.fillRect(rand() * S, rand() * S, 2, 2);
  }
  // Raised diamonds
  for (let y = 8; y < S; y += 24) {
    for (let x = y % 48 === 8 ? 8 : 20; x < S; x += 24) {
      ctx.fillStyle = 'rgba(210,214,220,0.85)';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -2, 10, 4);
      ctx.fillStyle = 'rgba(60,64,70,0.5)';
      ctx.fillRect(-5, 1, 10, 2);
      ctx.restore();
    }
  }
  return toTex(c, { repeat: [2, 2] });
}

/** Galvanized steel — posts, poles, scaffolding. */
export function galvanizedTexture() {
  const S = 64;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7e8890';
  ctx.fillRect(0, 0, S, S);
  const rand = mulberry32(41);
  for (let i = 0; i < 350; i++) {
    const v = 110 + rand() * 60;
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},0.3)`;
    ctx.fillRect(rand() * S, rand() * S, 2, 1);
  }
  return toTex(c);
}
