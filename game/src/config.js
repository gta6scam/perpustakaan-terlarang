// Perpustakaan Terlarang — konfigurasi pusat: ukuran level, kecepatan,
// jangkauan visi, ambang deteksi & kebisingan, dan semua nama di dalam game.
// Satu-satunya tempat angka penyeimbang hidup, supaya penalaan tidak
// menyebar ke file lain.
export const STEP = 1 / 60;

export const LEVEL = {
  halfW: 17, // x: -17..17
  halfD: 11, // z: -11..11
  wallH: 3.2,
  wallT: 1,
};

// Kecepatan (unit per detik)
export const PLAYER = {
  radius: 0.42,
  walk: 3.4,
  sneak: 2.2,
  run: 4.6,
  // Jarak interaksi (ambil manuskrip, tiup lilin, keluar)
  interact: 1.5,
};

export const GUARD = {
  radius: 0.45,
  patrol: 1.7,
  suspicious: 2.3,
  chase: 3.0,
  search: 1.4,
  visionRange: 7.5,
  visionHalfAngle: (35 * Math.PI) / 180,
  // Jarak tangkap: penjaga menyentuh pemain
  catchRange: 0.95,
};

export const CAT = {
  radius: 0.35,
  patrol: 2.6,
  suspicious: 3.0,
  chase: 3.7,
  visionRange: 4.5,
  visionHalfAngle: (40 * Math.PI) / 180,
  catchRange: 0.85,
};

// Deteksi: meter 0..100. Terisi saat pemain terlihat, menguap saat tersembunyi.
export const DETECTION = {
  fillBase: 55, // per detik pada jarak nol, cahaya penuh, jalan biasa
  decay: 70, // per detik saat tidak terlihat
  sneakFactor: 0.7,
  runFactor: 1.4,
  darkFactor: 0.25, // pemain di zona gelap jauh lebih sulit terlihat
  darkRangeFactor: 0.5, // di zona gelap, jangkauan visi penjaga menyusut
  suspiciousAt: 45, // meter >= ini: penjaga terdekat menyelidiki
  alertAt: 100, // meter penuh: semua penjaga mengejar
};

// Kebisingan: meter 0..100. Berlari menaikkannya; penjaga dekat menyelidiki.
export const NOISE = {
  runRate: 55,
  walkRate: 8,
  sneakRate: 0,
  decay: 45,
  investigateAt: 65,
  investigateRange: 9,
};

// Lilin: zona gelap yang tercipta saat lilin ditiup.
export const CANDLE = { darkRadius: 3.2 };

// Pengalih: buku yang dilempar (Q). Penjaga dalam radius menyelidiki titik jatuh.
export const DISTRACTION = { count: 3, throwRange: 6, investigateRadius: 10 };

export const CAUGHT_LIMIT = 3; // ketahuan 3 kali = GAME OVER

export const MANUSCRIPTS = [
  { id: 0, name: 'Naskah Alkemis', x: -15, z: -9.5, color: 0x7dd3fc },
  { id: 1, name: 'Peta Bintang', x: 15, z: 9.5, color: 0xfbbf24 },
  { id: 2, name: 'Surat Raja', x: 15, z: -9.5, color: 0xf472b6 },
];

export const EXIT = { x: 16.6, z: 0, half: 1.3 }; // pintu di dinding timur
export const PLAYER_START = { x: -15, z: 9 };

export const CANDLES = [
  { id: 0, x: -14.5, z: -5 },
  { id: 1, x: -8, z: -7.5 },
  { id: 2, x: 0, z: -3 },
  { id: 3, x: 8, z: -7.5 },
  { id: 4, x: 14.5, z: -5 },
  { id: 5, x: 0, z: 8 },
];

// Palet: lilin emas + hijau zamrud + kayu gelap.
export const PALETTE = {
  floor: 0x6b4a2f,
  floorDark: 0x54371f,
  carpet: 0x7f1d1d,
  wall: 0x3d2a18,
  wallTop: 0x5a3d24,
  shelf: 0x2e1d0e,
  shelfTop: 0x4a2f16,
  bookSpine: [0x991b1b, 0x1e40af, 0x166534, 0xb45309, 0x6b21a8, 0x0e7490],
  table: 0x4a2f16,
  pile: 0x8a6a42,
  gold: 0xfbbf24,
  emerald: 0x10b981,
  emeraldDark: 0x065f46,
  playerCloak: 0x10b981,
  playerTrim: 0xfbbf24,
  guardRobe: 0x1e293b,
  guardSkin: 0xe7c39a,
  cat: 0x111827,
  candleFlame: 0xffb020,
  exitGlow: 0x34d399,
  conePatrol: 0xfacc15,
  coneSuspicious: 0xfb923c,
  coneAlert: 0xef4444,
};

export function gradeFor(caught, seconds) {
  if (caught === 0 && seconds <= 150) return 'S';
  if (caught === 0) return 'A';
  if (caught === 1) return 'B';
  return 'C';
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}
