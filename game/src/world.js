// Dunia permainan: state, aturan stealth, meter deteksi & kebisingan,
// kemenangan dan kekalahan. Semua aturan yang dimainkan autopilot di shots.js
// adalah aturan yang sama — tidak ada jalan pintas.
import {
  STEP, PLAYER, DETECTION, NOISE, CANDLE, DISTRACTION,
  CAUGHT_LIMIT, MANUSCRIPTS, CANDLES, EXIT, PLAYER_START, gradeFor,
} from './config.js';
import { createGuards, updateGuard, investigate, alertGuard, resetGuard } from './guards.js';
import { createPlayer, resetPlayer, updatePlayer, noiseRate, nearestInteractable, distractionTarget } from './player.js';
import { hasLineOfSight } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

export function createWorld(seed = 1) {
  const world = {
    seed,
    screen: SCREEN_TITLE,
    time: 0,
    caught: 0,
    detection: 0,
    noise: 0,
    books: DISTRACTION.count,
    manuscripts: MANUSCRIPTS.map((m) => ({ ...m, taken: false })),
    candles: CANDLES.map((c) => ({ ...c, lit: true })),
    exit: { ...EXIT },
    player: createPlayer(),
    guards: createGuards(),
    banner: '',
    bannerTime: 0,
    hint: '',
    grade: null,
    stats: null,
    // Posisi terakhir pemain terlihat (untuk status HUD).
    lastSeenAt: 0,
  };
  world.reset = () => resetWorld(world);
  world.step = (dt, input, audio) => stepWorld(world, dt, input, audio);
  world.inDarkZone = (x, z) => inDarkZone(world, x, z);
  world.allCollected = () => world.manuscripts.every((m) => m.taken);
  world.collectedCount = () => world.manuscripts.filter((m) => m.taken).length;
  world.onCaught = (g) => onCaught(world, g);
  world.interact = () => doInteract(world);
  world.throwDistraction = () => doThrow(world);
  world.startGame = () => {
    resetWorld(world);
    world.screen = SCREEN_PLAY;
  };
  return world;
}

function resetWorld(w) {
  w.screen = SCREEN_TITLE;
  w.time = 0;
  w.caught = 0;
  w.detection = 0;
  w.noise = 0;
  w.books = DISTRACTION.count;
  w.manuscripts = MANUSCRIPTS.map((m) => ({ ...m, taken: false }));
  w.candles = CANDLES.map((c) => ({ ...c, lit: true }));
  w.banner = '';
  w.bannerTime = 0;
  w.hint = '';
  w.grade = null;
  w.stats = null;
  resetPlayer(w.player);
  w.guards.forEach((g) => resetGuard(g));
}

export function inDarkZone(w, x, z) {
  for (const c of w.candles) {
    if (c.lit) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d <= CANDLE.darkRadius) return true;
  }
  return false;
}

function setBanner(w, text, seconds = 3) {
  w.banner = text;
  w.bannerTime = seconds;
}

function doInteract(w) {
  const p = w.player;
  const it = nearestInteractable(p, w);
  if (!it) return false;
  if (it.type === 'manuscript') {
    it.m.taken = true;
    w.noise = Math.min(100, w.noise + 12); // kertas tua berdesir
    setBanner(w, `${it.m.name} dicuri! (${w.collectedCount()}/3)`, 3);
    if (w.allCollected()) {
      setBanner(w, 'Semua manuskrip didapat — KABUR LEWAT PINTU TIMUR!', 4);
    }
    return 'pickup';
  }
  if (it.type === 'candle') {
    it.c.lit = false;
    setBanner(w, 'Lilin ditiup — zona gelap tercipta. Bersembunyilah di sini.', 3);
    return 'candle';
  }
  if (it.type === 'exit') {
    finishWin(w);
    return 'win';
  }
  return false;
}

function doThrow(w) {
  if (w.books <= 0 || w.screen !== SCREEN_PLAY) return false;
  w.books -= 1;
  const t = distractionTarget(w.player);
  for (const g of w.guards) {
    const d = Math.hypot(g.x - t.x, g.z - t.z);
    if (d <= DISTRACTION.investigateRadius) investigate(g, t.x, t.z);
  }
  setBanner(w, 'Buku dilempar — penjaga menyelidiki bunyinya!', 2.5);
  return 'throw';
}

function finishWin(w) {
  w.screen = SCREEN_WIN;
  w.grade = gradeFor(w.caught, w.time);
  w.stats = {
    time: w.time,
    caught: w.caught,
    items: 3,
    books: DISTRACTION.count - w.books,
    candles: w.candles.filter((c) => !c.lit).length,
  };
}

function onCaught(w, g) {
  w.caught += 1;
  w.detection = 0;
  w.noise = 0;
  if (w.caught >= CAUGHT_LIMIT) {
    w.screen = SCREEN_LOSE;
    w.grade = null;
    w.stats = { time: w.time, caught: w.caught, items: w.collectedCount() };
    return;
  }
  setBanner(w, `KETAHUAN oleh ${g.name}! (${w.caught}/${CAUGHT_LIMIT}) — kembali ke pintu masuk.`, 4);
  resetPlayer(w.player);
  w.guards.forEach((gg) => resetGuard(gg));
}

function stepWorld(w, dt, input, audio) {
  if (w.screen !== SCREEN_PLAY) return;
  w.time += dt;
  if (w.bannerTime > 0) w.bannerTime -= dt;
  if (w.bannerTime <= 0) w.banner = '';

  const p = w.player;
  updatePlayer(p, input, dt);
  if (audio) audio.step(dt, p.moving, p.sneaking, p.running);

  // Kebisingan: berlari menaikkan meter; penjaga dekat menyelidiki.
  const nr = noiseRate(p);
  if (nr > 0) w.noise = Math.min(100, w.noise + nr * dt);
  else w.noise = Math.max(0, w.noise - NOISE.decay * dt);
  if (w.noise >= NOISE.investigateAt) {
    for (const g of w.guards) {
      if (g.state === 'patrol' && Math.hypot(g.x - p.x, g.z - p.z) <= NOISE.investigateRange) {
        investigate(g, p.x, p.z);
      }
    }
    w.noise = NOISE.investigateAt - 15; // beri jeda sebelum pemicu berikutnya
    setBanner(w, 'Berisik sekali! Penjaga mendengar derit rak…', 2.5);
  }

  // Deteksi: penjaga yang melihat pemain mengisi meter.
  const inDark = inDarkZone(w, p.x, p.z);
  let anyoneSees = false;
  let maxVis = 0;
  for (const g of w.guards) {
    const sees = g.seesPlayer; // dihitung di updateGuard frame ini
    if (!sees) continue;
    anyoneSees = true;
    const dist = Math.hypot(p.x - g.x, p.z - g.z);
    const range = inDark ? g.cfg.visionRange * DETECTION.darkRangeFactor : g.cfg.visionRange;
    const closeness = Math.max(0, 1 - dist / Math.max(0.01, range));
    let v = closeness;
    if (inDark) v *= DETECTION.darkFactor;
    if (p.sneaking) v *= DETECTION.sneakFactor;
    if (p.running) v *= DETECTION.runFactor;
    if (v > maxVis) maxVis = v;
  }
  if (anyoneSees) {
    w.detection = Math.min(100, w.detection + DETECTION.fillBase * maxVis * dt);
    w.lastSeenAt = w.time;
  } else {
    w.detection = Math.max(0, w.detection - DETECTION.decay * dt);
    if (w.detection < DETECTION.suspiciousAt) w._alerted = false;
  }

  // Ambang status global.
  if (w.detection >= DETECTION.alertAt) {
    if (!w._alerted) {
      w._alerted = true;
      if (audio) audio.alert();
      setBanner(w, 'TERLIHAT! Semua penjaga mengejarmu!', 2);
    }
    for (const g of w.guards) {
      if (g.state !== 'alert') alertGuard(g, p.x, p.z);
    }
  } else if (w.detection >= DETECTION.suspiciousAt) {
    // Penjaga terdekat yang melihat menyelidiki posisi pemain.
    let nearest = null;
    let nd = Infinity;
    for (const g of w.guards) {
      if (!g.seesPlayer) continue;
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (d < nd) {
        nd = d;
        nearest = g;
      }
    }
    if (nearest && nearest.state === 'patrol') investigate(nearest, p.x, p.z);
  }

  // Interaksi & pengalih dari input.
  if (input.interactPressed()) {
    const r = doInteract(w);
    if (audio) {
      if (r === 'pickup') audio.pickup();
      else if (r === 'candle') audio.candle();
      else if (r === 'win') audio.win();
    }
    if (w.screen !== SCREEN_PLAY) return; // menang lewat exit
  }
  if (input.distractPressed()) {
    const r = doThrow(w);
    if (r && audio) audio.throwBook();
  }
  if (input.mutePressed() && audio) {
    const m = audio.toggleMute();
    setBanner(w, m ? 'Suara dimatikan (M).' : 'Suara dinyalakan (M).', 1.5);
  }

  // Penjaga bergerak & bisa menangkap.
  const caughtBefore = w.caught;
  for (const g of w.guards) {
    updateGuard(g, dt, w);
    if (w.screen !== SCREEN_PLAY) break;
  }
  if (w.caught > caughtBefore && audio) {
    if (w.screen === SCREEN_LOSE) audio.lose();
    else audio.caught();
  }

  // Petunjuk kontekstual di bawah layar.
  const it = nearestInteractable(p, w);
  if (it && it.type === 'manuscript') w.hint = `Tekan E — ambil ${it.m.name}`;
  else if (it && it.type === 'candle') w.hint = 'Tekan E — tiup lilin (zona gelap)';
  else if (it && it.type === 'exit') w.hint = 'Tekan E — KABUR LEWAT EXIT!';
  else if (p.running) w.hint = 'BERLARI — rak berderit! Tahan Shift untuk menyelinap.';
  else if (inDark) w.hint = 'Zona gelap — penjaga sulit melihatmu.';
  else w.hint = '';
}
