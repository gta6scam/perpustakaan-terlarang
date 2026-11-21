// Perpustakaan Terlarang — program hand-in (Node 22, standard library only).
// Menyalin game/ dan screenshots/ dari samping file ini ke folder output dan
// menulis dossier.json dengan library make.fun yang divendor.
// Folder output dibaca dari MAKEFUN_OUTPUT_DIR (default /output); hanya
// subfolder game/ dan screenshots/ di dalam output yang dibersihkan dulu —
// tidak ada file lain di luar output yang disentuh.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
// Bersihkan hanya subfolder output (game/ + screenshots/) agar hasil lama
// tidak tertinggal; jangan pernah menghapus folder output itu sendiri.
for (const sub of ['game', 'screenshots']) {
  const target = join(out, sub);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps dari gate.json kompetisi (hanya text_max_bytes membentuk bytes;
// sisanya menolak entry yang scorer juga tolak).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
