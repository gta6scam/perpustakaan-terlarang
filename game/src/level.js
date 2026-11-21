// Denah Perpustakaan Terlarang: semua penghalang sebagai AABB 2D.
// - tall: menghalangi gerak DAN garis pandang (rak buku, meja, dinding)
// - low:  menghalangi gerak saja (tumpukan buku) — penjaga bisa melihat lewat atasnya
// Jalur patroli penjaga hanya memakai ruang terbuka di antara penghalang ini,
// dan penjaga juga diberi tabrakan circle-vs-AABB, jadi penjaga tidak pernah
// menembus dinding/rak di screenshot mana pun.
import { LEVEL, MANUSCRIPTS, CANDLES, EXIT } from './config.js';

// Rak buku tinggi (x1,z1)-(x2,z2). Baris A z=-5, baris B z=2.
const SHELVES = [
  { x1: -13, z1: -5.6, x2: -9, z2: -4.4 },
  { x1: -5, z1: -5.6, x2: -1, z2: -4.4 },
  { x1: 3, z1: -5.6, x2: 7, z2: -4.4 },
  { x1: -11, z1: 1.4, x2: -7, z2: 2.6 },
  { x1: -3, z1: 1.4, x2: 1, z2: 2.6 },
  { x1: 5, z1: 1.4, x2: 9, z2: 2.6 },
];

// Meja baca (tinggi, menghalangi pandang saat pemain bersembunyi di baliknya).
const TABLES = [
  { x1: -13.3, z1: 4.3, x2: -10.7, z2: 5.7 },
  { x1: 10.7, z1: 4.3, x2: 13.3, z2: 5.7 },
  { x1: -13.3, z1: -4.2, x2: -10.7, z2: -2.8 },
  { x1: 10.7, z1: -4.2, x2: 13.3, z2: -2.8 },
];

// Tumpukan buku rendah: halangi gerak, tidak halangi pandang.
const PILES = [
  { x: -7, z: -9.5 },
  { x: 7, z: -9.5 },
  { x: -7, z: 8.5 },
  { x: 7, z: 8.5 },
  { x: 0, z: 5.5 },
  { x: -9, z: 0.5 },
];

export const TALL_BLOCKERS = [
  ...SHELVES,
  ...TABLES,
  // Dinding keliling (di luar area jalan).
  { x1: -LEVEL.halfW - 1, z1: -LEVEL.halfD - 1, x2: LEVEL.halfW + 1, z2: -LEVEL.halfD },
  { x1: -LEVEL.halfW - 1, z1: LEVEL.halfD, x2: LEVEL.halfW + 1, z2: LEVEL.halfD + 1 },
  { x1: -LEVEL.halfW - 1, z1: -LEVEL.halfD, x2: -LEVEL.halfW, z2: LEVEL.halfD },
  { x1: LEVEL.halfW, z1: -LEVEL.halfD, x2: LEVEL.halfW + 1, z2: LEVEL.halfD },
];

export const LOW_BLOCKERS = PILES.map((p) => ({
  x1: p.x - 0.55,
  z1: p.z - 0.55,
  x2: p.x + 0.55,
  z2: p.z + 0.55,
}));

export const ALL_BLOCKERS = [...TALL_BLOCKERS, ...LOW_BLOCKERS];

export function pointInBox(x, z, b, pad = 0) {
  return x >= b.x1 - pad && x <= b.x2 + pad && z >= b.z1 - pad && z <= b.z2 + pad;
}

// Apakah lingkaran (x,z,r) bertabrakan dengan AABB b.
export function circleHitsBox(x, z, r, b) {
  const cx = Math.max(b.x1, Math.min(x, b.x2));
  const cz = Math.max(b.z1, Math.min(z, b.z2));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

// Geser lingkaran keluar dari semua AABB; kembalikan posisi yang sudah aman.
export function resolveCircle(x, z, r, blockers) {
  let nx = x;
  let nz = z;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const b of blockers) {
      if (!circleHitsBox(nx, nz, r, b)) continue;
      const cx = Math.max(b.x1, Math.min(nx, b.x2));
      const cz = Math.max(b.z1, Math.min(nz, b.z2));
      let dx = nx - cx;
      let dz = nz - cz;
      let d = Math.hypot(dx, dz);
      if (d < 0.0001) {
        // Pusat tepat di dalam kotak: dorong ke sisi terdekat.
        const left = nx - b.x1;
        const right = b.x2 - nx;
        const top = nz - b.z1;
        const bottom = b.z2 - nz;
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = b.x1 - r;
        else if (m === right) nx = b.x2 + r;
        else if (m === top) nz = b.z1 - r;
        else nz = b.z2 + r;
        continue;
      }
      dx /= d;
      dz /= d;
      nx = cx + dx * r;
      nz = cz + dz * r;
    }
  }
  return { x: nx, z: nz };
}

// Uji segmen (x1,z1)-(x2,z2) melawan satu AABB (algoritma slab).
export function segmentHitsBox(x1, z1, x2, z2, b) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < b.x1 || x1 > b.x2) return false;
  } else {
    let t1 = (b.x1 - x1) / dx;
    let t2 = (b.x2 - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (z1 < b.z1 || z1 > b.z2) return false;
  } else {
    let t1 = (b.z1 - z1) / dz;
    let t2 = (b.z2 - z1) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// Garis pandang: true bila tidak ada penghalang tinggi di antaranya.
export function hasLineOfSight(x1, z1, x2, z2) {
  for (const b of TALL_BLOCKERS) {
    if (segmentHitsBox(x1, z1, x2, z2, b)) return false;
  }
  return true;
}

export function isWalkable(x, z, radius) {
  if (Math.abs(x) > LEVEL.halfW - radius || Math.abs(z) > LEVEL.halfD - radius) return false;
  for (const b of ALL_BLOCKERS) {
    if (circleHitsBox(x, z, radius, b)) return false;
  }
  return true;
}

// Grid A* untuk autopilot: sel 1 unit, pusat sel (cx, cz).
export const GRID = { cell: 1, cols: LEVEL.halfW * 2, rows: LEVEL.halfD * 2 };

export function gridWalkable(cx, cz) {
  const x = cx - LEVEL.halfW + 0.5;
  const z = cz - LEVEL.halfD + 0.5;
  return isWalkable(x, z, 0.45);
}

export function cellOf(x, z) {
  return {
    cx: Math.max(0, Math.min(GRID.cols - 1, Math.floor(x + LEVEL.halfW))),
    cz: Math.max(0, Math.min(GRID.rows - 1, Math.floor(z + LEVEL.halfD))),
  };
}

export function cellCenter(cx, cz) {
  return { x: cx - LEVEL.halfW + 0.5, z: cz - LEVEL.halfD + 0.5 };
}

// A* sederhana; costFn(cx,cz) menambah biaya sel berbahaya (di dalam cone).
export function findPath(sx, sz, tx, tz, costFn) {
  const start = cellOf(sx, sz);
  const goal = cellOf(tx, tz);
  const key = (cx, cz) => cz * GRID.cols + cx;
  const open = [{ cx: start.cx, cz: start.cz, g: 0, f: 0, parent: null }];
  const best = new Map();
  best.set(key(start.cx, start.cz), 0);
  const closed = new Set();
  const h = (cx, cz) => Math.abs(cx - goal.cx) + Math.abs(cz - goal.cz);
  let guard = 0;
  while (open.length > 0 && guard < 4000) {
    guard += 1;
    let bi = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].f < open[bi].f) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.cx, cur.cz);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.cx === goal.cx && cur.cz === goal.cz) {
      const path = [];
      let node = cur;
      while (node) {
        path.unshift(cellCenter(node.cx, node.cz));
        node = node.parent;
      }
      return path;
    }
    const dirs = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, 1.41],
      [1, -1, 1.41],
      [-1, 1, 1.41],
      [-1, -1, 1.41],
    ];
    for (const [dx, dz, w] of dirs) {
      const nx = cur.cx + dx;
      const nz = cur.cz + dz;
      if (nx < 0 || nz < 0 || nx >= GRID.cols || nz >= GRID.rows) continue;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      if (!gridWalkable(nx, nz)) continue;
      // Potong sudut menembus dinding: diagonal butuh kedua tetangga lurus bebas.
      if (dx !== 0 && dz !== 0) {
        if (!gridWalkable(cur.cx + dx, cur.cz) || !gridWalkable(cur.cx, cur.cz + dz)) continue;
      }
      const extra = costFn ? costFn(nx, nz) : 0;
      const g = cur.g + w + extra;
      if (best.has(nk) && best.get(nk) <= g) continue;
      best.set(nk, g);
      open.push({ cx: nx, cz: nz, g, f: g + h(nx, nz), parent: cur });
    }
  }
  return null;
}

export function levelData() {
  return {
    shelves: SHELVES,
    tables: TABLES,
    piles: PILES,
    manuscripts: MANUSCRIPTS,
    candles: CANDLES,
    exit: EXIT,
  };
}
