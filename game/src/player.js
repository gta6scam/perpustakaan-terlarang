// Pemain: pencuri manuskrip berjubah zamrud.
// - Shift = menyelinap (pelan, sunyi, sulit terlihat).
// - Jalan biasa = tenang. Bergerak terus >0,8 detik tanpa henti berubah jadi
//   BERLARI: lebih cepat tapi rak berderit — meter kebisingan naik dan
//   penjaga dekat datang menyelidiki.
// - E: ambil manuskrip / tiup lilin terdekat / kabur lewat EXIT.
// - Q: lempar buku pengalih (3x) ke arah hadap.
import { PLAYER, NOISE, DETECTION, CANDLE, DISTRACTION } from './config.js';
import { resolveCircle, ALL_BLOCKERS, cellOf, cellCenter } from './level.js';

export function createPlayer() {
  return {
    x: -15,
    z: 9,
    angle: -Math.PI / 2, // menghadap ke atas (utara)
    moving: false,
    sneaking: false,
    running: false,
    runTime: 0, // durasi gerak terus-menerus
    moveX: 0,
    moveZ: 0,
    // Arah hadap terakhir untuk lemparan buku.
    faceX: 0,
    faceZ: -1,
  };
}

export function resetPlayer(p) {
  p.x = -15;
  p.z = 9;
  p.angle = -Math.PI / 2;
  p.moving = false;
  p.sneaking = false;
  p.running = false;
  p.runTime = 0;
  p.faceX = 0;
  p.faceZ = -1;
}

export function updatePlayer(p, input, dt) {
  const v = input.moveVector();
  p.sneaking = input.sneak();
  p.moving = v.x !== 0 || v.z !== 0;
  if (p.moving) {
    p.runTime += dt;
    p.faceX = v.x;
    p.faceZ = v.z;
  } else {
    p.runTime = 0;
  }
  // Berlari: gerak terus >0,8 detik tanpa menyelinap.
  p.running = p.moving && !p.sneaking && p.runTime > 0.8;
  const speed = p.sneaking ? PLAYER.sneak : p.running ? PLAYER.run : PLAYER.walk;
  if (p.moving) {
    const nx = p.x + v.x * speed * dt;
    const nz = p.z + v.z * speed * dt;
    const r = resolveCircle(nx, nz, PLAYER.radius, ALL_BLOCKERS);
    p.x = r.x;
    p.z = r.z;
    p.angle = Math.atan2(v.z, v.x);
  }
  p.moveX = v.x;
  p.moveZ = v.z;
  return speed;
}

// Laju kebisingan dari cara bergerak saat ini.
export function noiseRate(p) {
  if (!p.moving) return 0;
  if (p.sneaking) return NOISE.sneakRate;
  if (p.running) return NOISE.runRate;
  return NOISE.walkRate;
}

// Interaksi terdekat dalam jangkauan: manuskrip > lilin > exit.
// Mengembalikan {type:'manuscript'|'candle'|'exit', ...} atau null.
export function nearestInteractable(p, world) {
  let best = null;
  let bestD = PLAYER.interact;
  for (const m of world.manuscripts) {
    if (m.taken) continue;
    const d = Math.hypot(m.x - p.x, m.z - p.z);
    if (d <= bestD) {
      bestD = d;
      best = { type: 'manuscript', m };
    }
  }
  for (const c of world.candles) {
    if (!c.lit) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d <= bestD + 0.4) {
      bestD = d;
      best = { type: 'candle', c };
    }
  }
  if (world.allCollected()) {
    const d = Math.hypot(world.exit.x - p.x, world.exit.z - p.z);
    if (d <= 2.2) best = { type: 'exit' };
  }
  return best;
}

// Titik jatuh buku pengalih: 6 unit ke arah hadap, dijepit ke area jalan.
export function distractionTarget(p) {
  const tx = p.x + p.faceX * DISTRACTION.throwRange;
  const tz = p.z + p.faceZ * DISTRACTION.throwRange;
  const clamped = {
    x: Math.max(-16, Math.min(16, tx)),
    z: Math.max(-10, Math.min(10, tz)),
  };
  // Bila titik jatuh menabrak rak, geser ke sel jalan terdekat.
  const c = cellOf(clamped.x, clamped.z);
  const cc = cellCenter(c.cx, c.cz);
  return { x: cc.x, z: cc.z };
}
