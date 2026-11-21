// Titik masuk: loop game, layar TITLE/PLAY/WIN/LOSE, mode screenshot ?shot=.
// Di mode normal, pemain mengendalikan dengan keyboard; di mode ?shot=,
// autopilot memainkan aturan asli dan satu frame digambar untuk screenshot.
import { STEP } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN, SCREEN_LOSE } from './world.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;

const world = createWorld(seed);
const input = createInput();
const audio = createAudio();
input.setFirstGesture(() => audio.unlock());

const { render } = createRenderer(world, seed);

// Elemen overlay layar.
const overlays = {
  title: document.getElementById('overlay-title'),
  win: document.getElementById('overlay-win'),
  lose: document.getElementById('overlay-lose'),
};
const winStats = document.getElementById('win-stats');
const winGrade = document.getElementById('win-grade');
const loseStats = document.getElementById('lose-stats');

function showScreen(screen) {
  for (const [key, el] of Object.entries(overlays)) {
    if (!el) continue;
    el.classList.toggle('hidden', key !== screen);
  }
  if (screen === 'win' && world.stats) {
    if (winGrade) winGrade.textContent = world.grade || 'S';
    if (winStats) {
      winStats.textContent =
        `Waktu: ${fmt(world.stats.time)} · Ketahuan: ${world.stats.caught}x · ` +
        `Manuskrip: ${world.stats.items}/3 · Buku dilempar: ${world.stats.books} · Lilin ditiup: ${world.stats.candles}`;
    }
  }
  if (screen === 'lose' && world.stats) {
    if (loseStats) {
      loseStats.textContent =
        `Waktu: ${fmt(world.stats.time)} · Ketahuan: ${world.stats.caught}x · ` +
        `Manuskrip: ${world.stats.items}/3 — para pustakawan menangkapmu untuk ketiga kalinya.`;
    }
  }
}

function fmt(seconds) {
  const t = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

let lastScreen = null;
function syncOverlay() {
  const screen = world.screen;
  if (screen !== lastScreen) {
    lastScreen = screen;
    showScreen(screen);
  }
}

// --- Mode screenshot: jalankan adegan, lalu gambar terus-menerus (rAF) supaya
// frame WebGL selalu segar saat screenshot headless diambil — satu render
// saja bisa hilang karena drawing buffer dibersihkan setelah compositing.
if (shot) {
  const result = stageShot(shot, world);
  syncOverlay();
  document.title = `shot:${shot} screen:${result.screen} t:${(result.time || 0).toFixed(1)}`;
  window.__shotResult = result;
  const loop = (now) => {
    requestAnimationFrame(loop);
    render(now);
  };
  requestAnimationFrame(loop);
} else {
  // --- Mode main biasa.
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (world.screen === SCREEN_TITLE) {
      // Penjaga tetap patroli di balik layar judul (dunia hidup).
      world.screen = SCREEN_PLAY;
      world.step(STEP, input, null);
      world.screen = SCREEN_TITLE;
      if (input.startPressed()) {
        audio.unlock();
        world.startGame();
      }
    } else if (world.screen === SCREEN_PLAY) {
      acc += dt;
      while (acc >= STEP) {
        world.step(STEP, input, audio);
        acc -= STEP;
        if (world.screen !== SCREEN_PLAY) break;
      }
      input.endFrame();
    } else if (world.screen === SCREEN_WIN || world.screen === SCREEN_LOSE) {
      if (input.restartPressed()) {
        audio.unlock();
        world.startGame();
      }
    }
    syncOverlay();
    render(now);
  }
  requestAnimationFrame(frame);
}

// Tombol mulai / main lagi (klik mouse).
for (const btn of document.querySelectorAll('[data-start]')) {
  btn.addEventListener('click', () => {
    audio.unlock();
    world.startGame();
  });
}
