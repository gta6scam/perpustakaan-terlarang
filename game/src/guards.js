// Penjaga: pustakawan patroli + kucing hitam penjaga.
// Mesin status: patrol -> suspicious (?) -> alert (!) -> search -> patrol.
// Penjaga hanya bergerak di jalur terbuka dan memakai tabrakan circle-vs-AABB,
// jadi tidak pernah menembus rak/dinding.
import { GUARD, CAT, DETECTION, NOISE } from './config.js';
import { resolveCircle, ALL_BLOCKERS, hasLineOfSight } from './level.js';

export const GUARD_DEFS = [
  {
    name: 'Pustakawan Bram', kind: 'librarian', speed: GUARD,
    waypoints: [
      { x: -14, z: -8 },
      { x: 14, z: -8 },
    ],
  },
  {
    name: 'Pustakawan Sari', kind: 'librarian', speed: GUARD,
    waypoints: [
      { x: -14, z: 7 },
      { x: 14, z: 7 },
    ],
  },
  {
    name: 'Pustakawan Dewi', kind: 'librarian', speed: GUARD,
    waypoints: [
      { x: 2.5, z: -9.5 },
      { x: 2.5, z: 9.5 },
    ],
  },
  {
    name: 'Pustakawan Rudi', kind: 'librarian', speed: GUARD,
    waypoints: [
      { x: -14, z: -1.5 },
      { x: 14, z: -1.5 },
    ],
  },
  {
    name: 'Kucing Mochi', kind: 'cat', speed: CAT,
    waypoints: [
      { x: -2, z: -3.8 },
      { x: 4, z: -3.8 },
      { x: 4, z: 0 },
      { x: -2, z: 0 },
    ],
  },
];

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export function createGuards() {
  return GUARD_DEFS.map((def, i) => ({
    id: i,
    name: def.name,
    kind: def.kind,
    cfg: def.speed,
    waypoints: def.waypoints,
    wpIndex: def.kind === 'cat' ? 0 : i % 2,
    x: def.waypoints[def.kind === 'cat' ? 0 : i % 2].x,
    z: def.waypoints[def.kind === 'cat' ? 0 : i % 2].z,
    angle: def.kind === 'cat' ? Math.PI / 2 : (i % 2 === 0 ? 0 : Math.PI),
    state: 'patrol', // patrol | suspicious | alert | search
    stateTime: 0,
    targetX: 0,
    targetZ: 0,
    lastSeenX: 0,
    lastSeenZ: 0,
    seesPlayer: false,
    pauseTime: 0,
    scanAngle: 0,
  }));
}

// Apakah penjaga g bisa melihat pemain di (px,pz)? Menghormati jarak,
// sudut cone, garis pandang, dan zona gelap (lilin ditiup).
export function guardSees(g, px, pz, inDark) {
  const dx = px - g.x;
  const dz = pz - g.z;
  const dist = Math.hypot(dx, dz);
  let range = g.cfg.visionRange;
  if (inDark) range *= DETECTION.darkRangeFactor;
  if (dist > range) return false;
  const toPlayer = Math.atan2(dz, dx);
  let diff = toPlayer - g.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > g.cfg.visionHalfAngle) return false;
  return hasLineOfSight(g.x, g.z, px, pz);
}

export function moveWithCollision(g, nx, nz) {
  const p = resolveCircle(nx, nz, g.cfg.radius, ALL_BLOCKERS);
  g.x = p.x;
  g.z = p.z;
}

function moveToward(g, tx, tz, speed, dt) {
  const dx = tx - g.x;
  const dz = tz - g.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return true;
  const step = Math.min(d, speed * dt);
  const nx = g.x + (dx / d) * step;
  const nz = g.z + (dz / d) * step;
  moveWithCollision(g, nx, nz);
  g.angle = angleLerp(g.angle, Math.atan2(dz, dx), Math.min(1, dt * 8));
  return d <= step + 0.05;
}

export function updateGuard(g, dt, world) {
  const p = world.player;
  const inDark = world.inDarkZone(p.x, p.z);
  const sees = guardSees(g, p.x, p.z, inDark);
  g.seesPlayer = sees;
  g.stateTime += dt;

  if (g.state === 'alert') {
    // Mengejar: bila masih melihat, perbarui posisi terakhir pemain.
    if (sees) {
      g.lastSeenX = p.x;
      g.lastSeenZ = p.z;
      g.stateTime = 0;
    }
    const arrived = moveToward(g, g.lastSeenX, g.lastSeenZ, g.cfg.chase, dt);
    const dist = Math.hypot(p.x - g.x, p.z - g.z);
    if (dist <= g.cfg.catchRange) {
      world.onCaught(g);
      return;
    }
    if (g.stateTime > 2.5 && !sees) {
      g.state = 'search';
      g.stateTime = 0;
      g.scanAngle = g.angle;
    }
    return;
  }

  if (g.state === 'suspicious') {
    const arrived = moveToward(g, g.targetX, g.targetZ, g.cfg.suspicious, dt);
    if (sees) {
      g.lastSeenX = p.x;
      g.lastSeenZ = p.z;
    }
    if (arrived || g.stateTime > 6) {
      g.state = 'search';
      g.stateTime = 0;
      g.scanAngle = g.angle;
    }
    return;
  }

  if (g.state === 'search') {
    // Memindai sekeliling titik terakhir terlihat, lalu kembali patroli.
    g.angle += dt * 1.6;
    if (g.stateTime > 4) {
      g.state = 'patrol';
      g.stateTime = 0;
      g.pauseTime = 0.4;
    }
    return;
  }

  // patrol
  if (g.pauseTime > 0) {
    g.pauseTime -= dt;
    return;
  }
  const wp = g.waypoints[g.wpIndex];
  const arrived = moveToward(g, wp.x, wp.z, g.cfg.patrol, dt);
  if (arrived) {
    g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
    g.pauseTime = 0.8; // berhenti sejenak di ujung jalur, menoleh
  }
}

// Perintah dari world: selidiki titik (x,z) — dipakai saat curiga karena
// kebisingan atau pengalih.
export function investigate(g, x, z) {
  if (g.state === 'alert') return;
  g.state = 'suspicious';
  g.stateTime = 0;
  g.targetX = x;
  g.targetZ = z;
}

export function alertGuard(g, x, z) {
  g.state = 'alert';
  g.stateTime = 0;
  g.lastSeenX = x;
  g.lastSeenZ = z;
}

export function resetGuard(g) {
  const def = GUARD_DEFS[g.id];
  g.wpIndex = def.kind === 'cat' ? 0 : g.id % 2;
  g.x = def.waypoints[g.wpIndex].x;
  g.z = def.waypoints[g.wpIndex].z;
  g.angle = def.kind === 'cat' ? Math.PI / 2 : (g.id % 2 === 0 ? 0 : Math.PI);
  g.state = 'patrol';
  g.stateTime = 0;
  g.seesPlayer = false;
  g.pauseTime = 0;
}

// Warna cone menurut status (dipakai render + minimap).
export function coneColor(g) {
  if (g.state === 'alert') return 0xef4444;
  if (g.state === 'suspicious' || g.state === 'search') return 0xfb923c;
  return 0xfacc15;
}
