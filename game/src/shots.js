// Adegan screenshot di balik ?shot=start|play|climax|end.
// Setiap adegan memainkan ATURAN ASLI dari state segar, dikendalikan autopilot
// sederhana (A* dengan biaya cone + menunggu saat jalur berbahaya), sehingga
// frame yang tertangkap adalah permainan sungguhan — dan seed yang sama
// selalu memberi frame yang sama. End screen adalah kemenangan MURNI:
// autopilot menang dengan grade & statistik asli, tanpa override apa pun.
import { STEP } from './config.js';
import { findPath, gridWalkable, cellOf, cellCenter } from './level.js';
import { guardSees } from './guards.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN, SCREEN_LOSE } from './world.js';

const SAMPLE = STEP;

// Apakah sel grid (cx,cz) sedang berada di dalam cone penjaga mana pun
// (jarak + sudut + garis pandang).
function cellDanger(world, cx, cz) {
  const { x, z } = cellCenterOf(cx, cz);
  for (const g of world.guards) {
    if (guardSees(g, x, z, false)) return true;
    // Zona sangat dekat penjaga juga berbahaya meski di luar cone.
    if (Math.hypot(g.x - x, g.z - z) < 1.2) return true;
  }
  return false;
}

function cellCenterOf(cx, cz) {
  return cellCenter(cx, cz);
}

// Sel jalan terdekat yang aman (BFS radius terbatas).
function nearestSafeCell(world, px, pz) {
  const start = cellOf(px, pz);
  const seen = new Set([start.cz * 1000 + start.cx]);
  const queue = [{ cx: start.cx, cz: start.cz, d: 0 }];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cellDanger(world, cur.cx, cur.cz)) {
      return cellCenter(cur.cx, cur.cz);
    }
    if (cur.d >= 6) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.cx + dx;
      const nz = cur.cz + dz;
      const k = nz * 1000 + nx;
      if (seen.has(k) || !gridWalkable(nx, nz)) continue;
      seen.add(k);
      queue.push({ cx: nx, cz: nz, d: cur.d + 1 });
    }
  }
  return null;
}

// Input virtual yang dikendalikan autopilot (antarmuka sama seperti input.js).
function createVirtualInput() {
  const v = {
    mx: 0,
    mz: 0,
    _interact: false,
    _distract: false,
    _sneak: true,
    moveVector() {
      return { x: v.mx, z: v.mz };
    },
    sneak() {
      return v._sneak;
    },
    interactPressed() {
      return v._interact;
    },
    distractPressed() {
      return v._distract;
    },
    mutePressed() {
      return false;
    },
    restartPressed() {
      return false;
    },
    startPressed() {
      return false;
    },
    endFrame() {
      v._interact = false;
      v._distract = false;
    },
  };
  return v;
}

// Satu langkah autopilot: isi arah gerak + tombol pada input virtual.
function autopilotStep(world, input, state) {
  const p = world.player;
  input.mx = 0;
  input.mz = 0;

  // Target: manuskrip terdekat yang belum diambil, lalu EXIT.
  let target = null;
  if (!world.allCollected()) {
    let bestD = Infinity;
    for (const m of world.manuscripts) {
      if (m.taken) continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      if (d < bestD) {
        bestD = d;
        target = { x: m.x, z: m.z };
      }
    }
  } else {
    target = { x: world.exit.x - 1.2, z: world.exit.z };
  }

  // Interaksi: ambil manuskrip / tiup lilin saat dalam jangkauan.
  let near = null;
  let nearD = 1.6;
  for (const m of world.manuscripts) {
    if (m.taken) continue;
    const d = Math.hypot(m.x - p.x, m.z - p.z);
    if (d <= nearD) {
      nearD = d;
      near = 'manuscript';
    }
  }
  if (!near) {
    for (const c of world.candles) {
      if (!c.lit) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d <= 1.9) {
        near = 'candle';
        break;
      }
    }
  }
  if (near) input._interact = true;
  if (world.allCollected()) {
    const d = Math.hypot(world.exit.x - p.x, world.exit.z - p.z);
    if (d <= 2.0) input._interact = true;
  }

  // Penjaga mengejar & dekat: lari menjauhinya (bukan menyelinap).
  let chaser = null;
  let chaserD = Infinity;
  for (const g of world.guards) {
    if (g.state !== 'alert') continue;
    const d = Math.hypot(g.x - p.x, g.z - p.z);
    if (d < chaserD) {
      chaserD = d;
      chaser = g;
    }
  }
  if (chaser && chaserD < 7) {
    // Lari menjauh (tidak menyelinap): kecepatan penuh mengalahkan kejaran.
    input._sneak = false;
    const dx = p.x - chaser.x;
    const dz = p.z - chaser.z;
    const d = Math.hypot(dx, dz) || 1;
    input.mx = dx / d;
    input.mz = dz / d;
    return;
  }
  input._sneak = true;

  // Rencana ulang jalur tiap 0,5 detik (atau bila target berubah).
  state.replan -= 1;
  const targetKey = target ? `${target.x},${target.z}` : '';
  if (state.replan <= 0 || state.targetKey !== targetKey || !state.path) {
    state.replan = 30;
    state.targetKey = targetKey;
    state.path = findPath(p.x, p.z, target.x, target.z, (cx, cz) =>
      cellDanger(world, cx, cz) ? 60 : 0,
    );
    state.pathIndex = 0;
  }
  const path = state.path;
  if (!path || path.length === 0) return;

  // Lewati titik jalur yang sudah dilewati.
  while (state.pathIndex < path.length) {
    const wp = path[state.pathIndex];
    if (Math.hypot(wp.x - p.x, wp.z - p.z) < 0.35) state.pathIndex += 1;
    else break;
  }
  if (state.pathIndex >= path.length) return;
  const wp = path[state.pathIndex];

  // Pemain sedang terlihat / berada di cone: cari sel aman terdekat.
  const myCell = cellOf(p.x, p.z);
  const iAmSeen = world.guards.some((g) => g.seesPlayer);
  if (iAmSeen || cellDanger(world, myCell.cx, myCell.cz)) {
    const safe = nearestSafeCell(world, p.x, p.z);
    if (safe && Math.hypot(safe.x - p.x, safe.z - p.z) > 0.4) {
      const dx = safe.x - p.x;
      const dz = safe.z - p.z;
      const d = Math.hypot(dx, dz);
      input.mx = dx / d;
      input.mz = dz / d;
      return;
    }
  }

  // Titik jalur berikutnya berbahaya: tunggu sampai cone bergeser.
  const wpCell = cellOf(wp.x, wp.z);
  if (cellDanger(world, wpCell.cx, wpCell.cz)) return;

  const dx = wp.x - p.x;
  const dz = wp.z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  input.mx = dx / d;
  input.mz = dz / d;
}

const PLAY_SECONDS = 26;
const CLIMAX_SECONDS = 75;
const END_LIMIT_SECONDS = 600;

/**
 * Atur `world` ke adegan bernama (start, play, climax, end) dan kembalikan
 * layar yang harus digambar. Semua adegan memainkan aturan asli.
 */
export function stageShot(name, world) {
  world.reset();
  const input = createVirtualInput();
  const state = { replan: 0, targetKey: '', path: null, pathIndex: 0 };

  if (name !== 'play' && name !== 'climax' && name !== 'end') {
    // start: penjaga patroli beberapa detik, layar TITLE.
    for (let i = 0; i < 5 / STEP; i += 1) {
      world.screen = SCREEN_PLAY;
      world.step(STEP, input, null);
      input.endFrame();
      world.screen = SCREEN_TITLE;
    }
    world.screen = SCREEN_TITLE;
    return { screen: SCREEN_TITLE };
  }

  world.screen = SCREEN_PLAY;
  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'climax' ? CLIMAX_SECONDS : PLAY_SECONDS;
  let steps = 0;
  for (; steps < limit / STEP; steps += 1) {
    autopilotStep(world, input, state);
    world.step(STEP, input, null);
    input.endFrame();
    if (world.screen !== SCREEN_PLAY) break;
    if (name === 'climax' && world.collectedCount() >= 2) break;
  }
  const over = world.screen === SCREEN_WIN || world.screen === SCREEN_LOSE;
  if (name === 'end') {
    return {
      screen: over ? world.screen : SCREEN_PLAY,
      won: world.screen === SCREEN_WIN,
      time: world.time,
      caught: world.caught,
      steps,
    };
  }
  return {
    screen: over ? world.screen : SCREEN_PLAY,
    time: world.time,
    caught: world.caught,
    collected: world.collectedCount(),
    steps,
  };
}
