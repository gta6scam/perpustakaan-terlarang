# PERPUSTAKAAN TERLARANG — Curi 3 Manuskrip di Tengah Malam Tanpa Terlihat

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/gta6scam/perpustakaan-terlarang/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/gta6scam/perpustakaan-terlarang/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Game stealth 3D (Three.js) untuk kompetisi
[Make the best stealth game](https://make.fun/bounty/best-stealth-game-20261121-1759)
di make.fun.

## Cerita

Tengah malam di perpustakaan tua. Tiga manuskrip terlarang — **Naskah Alkemis**,
**Peta Bintang**, dan **Surat Raja** — menunggu di rak-rak gelap. Curi
ketiganya, lalu kabur lewat pintu **EXIT** di timur… tanpa terlihat.

## Cara main

| Tombol | Aksi |
|---|---|
| WASD / Panah | Bergerak |
| Shift (tahan) | Menyelinap — pelan, sunyi, sulit terlihat |
| E / Spasi | Ambil manuskrip · tiup lilin · kabur lewat EXIT |
| Q | Lempar buku pengalih (3×) — penjaga menyelidiki bunyinya |
| M | Nyalakan/matikan suara |
| R / Enter | Mulai lagi |

**Menang:** kumpulkan 3 manuskrip lalu capai pintu EXIT.
**Kalah:** ketahuan 3 kali.

## Mekanik khas

- **Meter kebisingan** — rak buku berderit. Bergerak terus-menerus berubah jadi
  berlari: lebih cepat, tapi meter kebisingan naik dan penjaga dekat datang
  menyelidiki. Berjalan pelan (Shift) = sunyi.
- **Lilin yang bisa ditiup** — tekan E di dekat lilin untuk memadamkannya dan
  menciptakan zona gelap tempat bersembunyi: jangkauan visi penjaga menyusut
  dan meter deteksi naik jauh lebih lambat.

## Musuh

- **4 pustakawan penjaga** (Bram, Sari, Dewi, Rudi) berpatroli dengan kerucut
  visi bervolume: kuning saat patroli, oranye saat curiga (?), merah saat
  mengejar (!). Status mereka: patroli → curiga → kejar → cari → patroli.
- **Kucing hitam Mochi** — penjaga kedua yang lebih cepat dengan cone pendek,
  berpatroli di tengah perpustakaan.

Bersembunyilah di balik rak buku tinggi dan meja baca — semuanya menghalangi
garis pandang penjaga — atau di zona gelap lilin yang kau tiup.

## Fitur

- Level 3D sungguhan (Three.js, kamera oblique top-down) dengan pencahayaan
  kaya: cahaya lilin hangat, lampu gantung, bayangan, dan karpet lorong.
- HUD lengkap: manuskrip 0/3, waktu, meter deteksi, meter kebisingan, strip
  status penjaga bernama, dan minimap denah perpustakaan.
- Suara disintesis WebAudio sendiri (langkah, derit rak, denting manuskrip,
  sting alert, ambient) — tanpa file audio eksternal.
- Grade S/A/B/C + statistik (waktu, ketahuan, manuskrip, buku, lilin) di layar
  kemenangan.

## Cara jalan

Game berupa file statis di `game/` — tanpa build step, tanpa jaringan:

```sh
# dari folder repo ini
python3 -m http.server 8080
# buka http://localhost:8080/game/
```

Atau langsung dari hand-in:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts   # menulis out/dossier.json
```

## Screenshot

`?shot=start|play|climax|end` memainkan aturan asli dengan autopilot
deterministik (seed tetap) — `end` adalah kemenangan autopilot murni dengan
grade dan statistik asli.

## Struktur source

```
game/
  index.html            # halaman + HUD + overlay layar
  vendor/three.min.js   # Three.js 0.160.0 (vendored)
  src/
    config.js           # angka penyeimbang & palet
    random.js           # RNG ber-seed (deterministik)
    input.js            # keyboard
    audio.js            # synth WebAudio
    level.js            # denah, tabrakan, garis pandang, A*
    guards.js           # AI penjaga + kucing
    player.js           # gerak, kebisingan, interaksi
    world.js            # state & aturan permainan
    render.js           # scene Three.js + HUD + minimap
    shots.js            # adegan screenshot + autopilot
    main.js             # loop game & layar
main.ts                 # program hand-in (salin game/ + screenshots/, tulis dossier.json)
```

## Lisensi

MIT — lihat [LICENSE](LICENSE).
