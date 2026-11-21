// Render: scene Three.js (kamera oblique top-down, pencahayaan kaya,
// bayangan), HUD DOM, dan minimap 2D. Semua mesh statis dibangun sekali;
// yang dinamis (pemain, penjaga, cone visi, api lilin, penanda) diperbarui
// tiap frame dari state world.
import * as THREE from 'three';
import { LEVEL, PALETTE, MANUSCRIPTS, CANDLE } from './config.js';
import { levelData, TALL_BLOCKERS } from './level.js';
import { coneColor } from './guards.js';
import { formatTime } from './config.js';
import { mulberry32, pick } from './random.js';

function sectorGeometry(range, halfAngle) {
  // Kipas segitiga di bidang XZ, menghadap +Z, sudut disebar ±halfAngle.
  const segments = 18;
  const positions = [0, 0, 0];
  for (let i = 0; i <= segments; i += 1) {
    const a = -halfAngle + (2 * halfAngle * i) / segments;
    positions.push(Math.sin(a) * range, 0, Math.cos(a) * range);
  }
  const indices = [];
  for (let i = 1; i <= segments; i += 1) indices.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function woodTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6b4a2f';
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row += 1) {
    const y = row * 32;
    const shade = 0.9 + rng() * 0.25;
    g.fillStyle = `rgb(${Math.floor(107 * shade)},${Math.floor(74 * shade)},${Math.floor(47 * shade)})`;
    g.fillRect(0, y, 256, 30);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, y + 30, 256, 2);
    const joint = Math.floor(rng() * 256);
    g.fillRect(joint, y, 2, 30);
    g.fillStyle = 'rgba(255,220,160,0.06)';
    for (let i = 0; i < 12; i += 1) {
      g.fillRect(Math.floor(rng() * 256), y + 4 + Math.floor(rng() * 22), 20 + Math.floor(rng() * 40), 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = fg;
  g.lineWidth = 10;
  g.strokeRect(14, 14, 996, 228);
  g.fillStyle = fg;
  g.font = 'bold 92px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Kecilkan font sampai teks muat di dalam papan.
  let size = 92;
  while (g.measureText(text).width > 940 && size > 24) {
    size -= 4;
    g.font = `bold ${size}px Georgia, serif`;
  }
  g.fillText(text, 512, 132);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRenderer(world, seed = 1) {
  const rng = mulberry32(seed);
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0714);
  scene.fog = new THREE.Fog(0x0b0714, 55, 90);

  const camera = new THREE.PerspectiveCamera(55, 1280 / 800, 0.1, 200);
  camera.position.set(0, 20, 10);
  camera.lookAt(0, 0, 0.5);

  // --- Pencahayaan: ambient + directional (bayangan) + 3 lilin + lampu gantung.
  scene.add(new THREE.AmbientLight(0xffe6b8, 0.55));
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.position.set(-12, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.camera.far = 60;
  scene.add(sun);
  const chandelier = new THREE.PointLight(0xffc46b, 60, 30, 1.6);
  chandelier.position.set(0, 7, 0);
  scene.add(chandelier);
  const candleLights = [];
  for (const [lx, lz] of [[-14.5, -5], [0, -3], [14.5, -5]]) {
    const pl = new THREE.PointLight(0xff9a2a, 14, 11, 1.8);
    pl.position.set(lx, 1.6, lz);
    scene.add(pl);
    candleLights.push(pl);
  }

  // --- Lantai kayu + karpet tengah.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL.halfW * 2 + 2, LEVEL.halfD * 2 + 2),
    new THREE.MeshStandardMaterial({ map: woodTexture(rng), roughness: 0.85, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, LEVEL.halfD * 2 - 2),
    new THREE.MeshStandardMaterial({ color: PALETTE.carpet, roughness: 0.95 }),
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.02, 0);
  carpet.receiveShadow = true;
  scene.add(carpet);
  // Karpet lorong atas & bawah (membantu membaca arah).
  for (const cz of [-8, 7]) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(LEVEL.halfW * 2 - 4, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x5b21b6, roughness: 0.95 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.02, cz);
    strip.receiveShadow = true;
    scene.add(strip);
  }

  const data = levelData();
  const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.shelf, roughness: 0.8 });
  const woodTopMat = new THREE.MeshStandardMaterial({ color: PALETTE.shelfTop, roughness: 0.7 });
  const tableMat = new THREE.MeshStandardMaterial({ color: PALETTE.table, roughness: 0.75 });

  function addBox(x1, z1, x2, z2, h, mat, y0 = 0, castShadow = true) {
    const w = x2 - x1;
    const d = z2 - z1;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // --- Dinding keliling + papan nama.
  addBox(-LEVEL.halfW - 1, -LEVEL.halfD - 1, LEVEL.halfW + 1, -LEVEL.halfD, LEVEL.wallH, new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.85 }));
  addBox(-LEVEL.halfW - 1, LEVEL.halfD, LEVEL.halfW + 1, LEVEL.halfD + 1, LEVEL.wallH, new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.85 }));
  addBox(-LEVEL.halfW - 1, -LEVEL.halfD, -LEVEL.halfW, LEVEL.halfD, LEVEL.wallH, new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.85 }));
  addBox(LEVEL.halfW, -LEVEL.halfD, LEVEL.halfW + 1, LEVEL.halfD, LEVEL.wallH, new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.85 }));
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 2.75),
    new THREE.MeshStandardMaterial({ map: signTexture('PERPUSTAKAAN TERLARANG', '#1a1208', '#fbbf24'), roughness: 0.6 }),
  );
  sign.position.set(0, 1.9, -LEVEL.halfD + 0.06);
  scene.add(sign);

  // --- Rak buku + punggung buku warna-warni.
  for (const s of data.shelves) {
    addBox(s.x1, s.z1, s.x2, s.z2, 2.6, woodMat);
    addBox(s.x1, s.z1, s.x2, s.z2, 0.18, woodTopMat, 2.6);
    const n = Math.floor((s.x2 - s.x1) / 0.5);
    for (let i = 0; i < n; i += 1) {
      const bx = s.x1 + 0.3 + i * 0.5;
      const color = pick(rng, PALETTE.bookSpine);
      for (const side of [-1, 1]) {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.9 + rng() * 0.4, 0.16),
          new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
        );
        book.position.set(bx, 1.6 + rng() * 0.5, (s.z1 + s.z2) / 2 + side * ((s.z2 - s.z1) / 2 + 0.02));
        book.castShadow = false;
        scene.add(book);
      }
    }
  }

  // --- Meja baca + buku terbuka di atasnya.
  for (const t of data.tables) {
    addBox(t.x1, t.z1, t.x2, t.z2, 1.1, tableMat);
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.12, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.9 }),
    );
    book.position.set((t.x1 + t.x2) / 2, 1.18, (t.z1 + t.z2) / 2);
    book.rotation.y = rng() * 1.2;
    book.castShadow = true;
    scene.add(book);
  }

  // --- Tumpukan buku rendah.
  for (const p of data.piles) {
    for (let i = 0; i < 3; i += 1) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.9 - i * 0.12, 0.22, 0.7 - i * 0.08),
        new THREE.MeshStandardMaterial({ color: pick(rng, PALETTE.bookSpine), roughness: 0.8 }),
      );
      b.position.set(p.x, 0.11 + i * 0.22, p.z);
      b.rotation.y = rng() * 0.8;
      b.castShadow = true;
      scene.add(b);
    }
  }

  // --- Manuskrip: gulungan bercahaya + tiang cahaya emas.
  const manuscriptMeshes = data.manuscripts.map((m) => {
    const group = new THREE.Group();
    const scroll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.9, 12),
      new THREE.MeshStandardMaterial({ color: 0xf5e6c8, emissive: m.color, emissiveIntensity: 0.55, roughness: 0.6 }),
    );
    scroll.rotation.z = Math.PI / 2;
    scroll.position.y = 0.35;
    scroll.castShadow = true;
    group.add(scroll);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 3.4, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 1.7;
    group.add(beam);
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshStandardMaterial({ color: m.color, emissive: m.color, emissiveIntensity: 1.2, roughness: 0.2 }),
    );
    gem.position.y = 1.5;
    group.add(gem);
    group.position.set(m.x, 0, m.z);
    scene.add(group);
    return { group, gem, scroll };
  });

  // --- Lilin: alas + api + zona gelap (lingkaran gelap saat ditiup).
  const candleMeshes = data.candles.map((c) => {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.2, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5 }),
    );
    base.position.y = 0.25;
    base.castShadow = true;
    group.add(base);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.42, 10),
      new THREE.MeshStandardMaterial({ color: PALETTE.candleFlame, emissive: 0xff8c00, emissiveIntensity: 2.2 }),
    );
    flame.position.y = 0.72;
    group.add(flame);
    const darkRing = new THREE.Mesh(
      new THREE.CircleGeometry(CANDLE.darkRadius, 28),
      new THREE.MeshBasicMaterial({ color: 0x0b1026, transparent: true, opacity: 0.34, depthWrite: false }),
    );
    darkRing.rotation.x = -Math.PI / 2;
    darkRing.position.y = 0.05;
    darkRing.visible = false;
    group.add(darkRing);
    group.position.set(c.x, 0, c.z);
    scene.add(group);
    return { group, flame, darkRing };
  });

  // --- Pintu EXIT di dinding timur + papan EXIT bercahaya.
  const exitGroup = new THREE.Group();
  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 3.4, 3),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 }),
  );
  doorFrame.position.set(LEVEL.halfW + 0.1, 1.7, 0);
  doorFrame.castShadow = true;
  exitGroup.add(doorFrame);
  const portal = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 3),
    new THREE.MeshStandardMaterial({ color: 0x065f46, emissive: PALETTE.exitGlow, emissiveIntensity: 1.4 }),
  );
  portal.rotation.y = -Math.PI / 2;
  portal.position.set(LEVEL.halfW - 0.18, 1.5, 0);
  exitGroup.add(portal);
  const exitSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.65),
    new THREE.MeshStandardMaterial({ map: signTexture('EXIT', '#052e16', '#34d399'), emissive: 0xffffff, emissiveIntensity: 0.4 }),
  );
  exitSign.rotation.y = -Math.PI / 2;
  exitSign.position.set(LEVEL.halfW - 0.2, 3.6, 0);
  exitGroup.add(exitSign);
  const exitGlow = new THREE.PointLight(0x34d399, 10, 8, 1.8);
  exitGlow.position.set(LEVEL.halfW - 1, 2, 0);
  exitGroup.add(exitGlow);
  scene.add(exitGroup);

  // --- Pemain: jubah zamrud terang + cincin hijau + panah emas di atas kepala.
  const playerGroup = new THREE.Group();
  const cloak = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.5, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.playerCloak, emissive: 0x065f46, emissiveIntensity: 0.35, roughness: 0.6 }),
  );
  cloak.position.y = 0.75;
  cloak.castShadow = true;
  playerGroup.add(cloak);
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x047857, emissive: 0x065f46, emissiveIntensity: 0.4, roughness: 0.6 }),
  );
  hood.position.y = 1.62;
  hood.castShadow = true;
  playerGroup.add(hood);
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xf5d0a9, roughness: 0.7 }),
  );
  face.position.set(0, 1.58, 0.18);
  playerGroup.add(face);
  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.05, 8, 20),
    new THREE.MeshStandardMaterial({ color: PALETTE.playerTrim, emissive: 0xb45309, emissiveIntensity: 0.8 }),
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.08;
  playerGroup.add(trim);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.85, 28),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  playerGroup.add(ring);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.5, 4),
    new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: 0xb45309, emissiveIntensity: 1.0 }),
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 2.35;
  playerGroup.add(arrow);
  const playerLight = new THREE.PointLight(0x34d399, 5, 5, 1.8);
  playerLight.position.y = 1.5;
  playerGroup.add(playerLight);
  scene.add(playerGroup);

  // --- Penjaga: jubah gelap + kepala + cone visi bervolume.
  const guardMeshes = world.guards.map((g) => {
    const group = new THREE.Group();
    const isCat = g.kind === 'cat';
    const bodyH = isCat ? 0.5 : 1.5;
    const body = new THREE.Mesh(
      isCat
        ? new THREE.SphereGeometry(0.4, 12, 10)
        : new THREE.CylinderGeometry(0.34, 0.52, bodyH, 12),
      new THREE.MeshStandardMaterial({
        color: isCat ? PALETTE.cat : PALETTE.guardRobe,
        roughness: 0.7,
        emissive: isCat ? 0x000000 : 0x0f172a,
        emissiveIntensity: 0.3,
      }),
    );
    body.scale.y = isCat ? 0.7 : 1;
    body.position.y = isCat ? 0.32 : bodyH / 2;
    body.castShadow = true;
    group.add(body);
    if (isCat) {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(
          new THREE.ConeGeometry(0.1, 0.26, 4),
          new THREE.MeshStandardMaterial({ color: PALETTE.cat, roughness: 0.7 }),
        );
        ear.position.set(s * 0.2, 0.68, 0);
        group.add(ear);
      }
      const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.08, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.cat, roughness: 0.7 }),
      );
      tail.rotation.z = 0.9;
      tail.position.set(-0.42, 0.4, 0);
      group.add(tail);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 2 }),
      );
      eye.position.set(0.32, 0.4, 0.12);
      group.add(eye);
    } else {
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 10),
        new THREE.MeshStandardMaterial({ color: PALETTE.guardSkin, roughness: 0.7 }),
      );
      head.position.y = 1.75;
      head.castShadow = true;
      group.add(head);
      const hat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.36, 0.22, 12),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 }),
      );
      hat.position.y = 2.0;
      group.add(hat);
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.1, 0.26),
        new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 }),
      );
      book.position.set(0.3, 1.0, 0.3);
      book.rotation.y = 0.5;
      group.add(book);
    }
    // Cone visi: mesh kipas transparan di lantai.
    const coneGeo = sectorGeometry(g.cfg.visionRange, g.cfg.visionHalfAngle);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 0.07;
    group.add(cone);
    // Tanda ? / ! melayang di atas kepala penjaga.
    const markCanvas = document.createElement('canvas');
    markCanvas.width = 64;
    markCanvas.height = 64;
    const markTex = new THREE.CanvasTexture(markCanvas);
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false }),
    );
    mark.position.y = isCat ? 1.1 : 2.5;
    mark.visible = false;
    group.add(mark);
    scene.add(group);
    return { group, cone, coneMat, mark, markCanvas, markTex, isCat };
  });

  function drawMark(gm, text, color) {
    const g2 = gm.markCanvas.getContext('2d');
    g2.clearRect(0, 0, 64, 64);
    g2.font = 'bold 52px Georgia, serif';
    g2.textAlign = 'center';
    g2.textBaseline = 'middle';
    g2.lineWidth = 8;
    g2.strokeStyle = 'rgba(0,0,0,0.85)';
    g2.strokeText(text, 32, 34);
    g2.fillStyle = color;
    g2.fillText(text, 32, 34);
    gm.markTex.needsUpdate = true;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Minimap 2D.
  const minimap = document.getElementById('minimap');
  const mm = minimap ? minimap.getContext('2d') : null;

  const els = {
    items: document.getElementById('hud-items'),
    time: document.getElementById('hud-time'),
    noise: document.getElementById('hud-noise'),
    noiseBar: document.getElementById('hud-noise-bar'),
    detection: document.getElementById('hud-detection'),
    detectionBar: document.getElementById('hud-detection-bar'),
    guards: document.getElementById('hud-guards'),
    banner: document.getElementById('hud-banner'),
    hint: document.getElementById('hud-hint'),
    books: document.getElementById('hud-books'),
    candles: document.getElementById('hud-candles'),
  };

  let lastGuardMark = world.guards.map(() => '');

  function drawMinimap() {
    if (!mm) return;
    const W = minimap.width;
    const H = minimap.height;
    const sx = W / (LEVEL.halfW * 2 + 2);
    const sz = H / (LEVEL.halfD * 2 + 2);
    const X = (x) => (x + LEVEL.halfW + 1) * sx;
    const Z = (z) => (z + LEVEL.halfD + 1) * sz;
    mm.fillStyle = 'rgba(8,10,24,0.92)';
    mm.fillRect(0, 0, W, H);
    // Rak & meja.
    mm.fillStyle = '#8a6a42';
    for (const b of TALL_BLOCKERS) {
      if (b.x1 < -LEVEL.halfW || b.x2 > LEVEL.halfW) continue;
      mm.fillRect(X(b.x1), Z(b.z1), (b.x2 - b.x1) * sx, (b.z2 - b.z1) * sz);
    }
    // Zona gelap.
    for (const c of world.candles) {
      if (c.lit) continue;
      mm.fillStyle = 'rgba(96,165,250,0.35)';
      mm.beginPath();
      mm.arc(X(c.x), Z(c.z), CANDLE.darkRadius * sx, 0, Math.PI * 2);
      mm.fill();
    }
    // Manuskrip belum diambil.
    for (const m of world.manuscripts) {
      if (m.taken) continue;
      mm.fillStyle = '#fbbf24';
      mm.beginPath();
      mm.arc(X(m.x), Z(m.z), 4, 0, Math.PI * 2);
      mm.fill();
    }
    // Exit.
    mm.fillStyle = '#34d399';
    mm.fillRect(X(world.exit.x - 0.4), Z(world.exit.z - 1.2), 0.8 * sx, 2.4 * sz);
    // Cone penjaga.
    for (const g of world.guards) {
      mm.fillStyle = g.state === 'alert' ? 'rgba(239,68,68,0.5)' : g.state === 'patrol' ? 'rgba(250,204,21,0.4)' : 'rgba(251,146,60,0.5)';
      mm.beginPath();
      mm.moveTo(X(g.x), Z(g.z));
      mm.arc(X(g.x), Z(g.z), g.cfg.visionRange * sx, g.angle - g.cfg.visionHalfAngle, g.angle + g.cfg.visionHalfAngle);
      mm.closePath();
      mm.fill();
    }
    // Penjaga.
    for (const g of world.guards) {
      mm.fillStyle = g.kind === 'cat' ? '#e5e7eb' : '#f87171';
      mm.beginPath();
      mm.arc(X(g.x), Z(g.z), 3.5, 0, Math.PI * 2);
      mm.fill();
    }
    // Pemain.
    mm.fillStyle = '#34d399';
    mm.beginPath();
    mm.arc(X(world.player.x), Z(world.player.z), 4.5, 0, Math.PI * 2);
    mm.fill();
    mm.strokeStyle = '#ffffff';
    mm.lineWidth = 1.5;
    mm.beginPath();
    mm.arc(X(world.player.x), Z(world.player.z), 4.5, 0, Math.PI * 2);
    mm.stroke();
  }

  function updateHUD() {
    const collected = world.collectedCount();
    if (els.items) els.items.textContent = `◆ ${collected}/3 Manuskrip`;
    if (els.time) els.time.textContent = formatTime(world.time);
    if (els.books) els.books.textContent = `▣ Buku pengalih: ${world.books}`;
    if (els.candles) {
      const out = world.candles.filter((c) => !c.lit).length;
      els.candles.textContent = `🕯 Lilin ditiup: ${out}/${world.candles.length}`;
    }
    if (els.noiseBar) {
      els.noiseBar.style.width = `${world.noise.toFixed(0)}%`;
      els.noiseBar.style.background = world.noise >= 65 ? '#ef4444' : world.noise >= 35 ? '#f59e0b' : '#34d399';
    }
    if (els.noise) els.noise.textContent = world.player.running ? 'BERLARI — BERISIK!' : world.player.sneaking ? 'Menyelinap — sunyi' : 'Kebisingan';
    if (els.detectionBar) {
      els.detectionBar.style.width = `${world.detection.toFixed(0)}%`;
      const d = world.detection;
      els.detectionBar.style.background = d >= 100 ? '#ef4444' : d >= 45 ? '#fb923c' : '#facc15';
    }
    if (els.detection) {
      els.detection.textContent = world.detection >= 100 ? 'TERLIHAT!' : world.detection >= 45 ? 'CURIGA…' : world.detection > 2 ? 'Terdeteksi…' : 'TERSEMBUNYI';
    }
    if (els.guards) {
      els.guards.innerHTML = world.guards
        .map((g) => {
          const mark = g.state === 'alert' ? '!' : g.state === 'suspicious' || g.state === 'search' ? '?' : '○';
          const cls = g.state === 'alert' ? 'alert' : g.state === 'patrol' ? '' : 'sus';
          return `<span class="${cls}">${g.name} ${mark}</span>`;
        })
        .join(' · ');
    }
    if (els.banner) {
      els.banner.textContent = world.banner;
      els.banner.style.opacity = world.banner ? '1' : '0';
    }
    if (els.hint) els.hint.textContent = world.hint || 'WASD gerak · Shift menyelinap · E interaksi · Q lempar buku · M suara';
  }

  function render(t) {
    // Pemain.
    const p = world.player;
    playerGroup.position.set(p.x, 0, p.z);
    playerGroup.rotation.y = -p.angle + Math.PI / 2;
    arrow.position.y = 2.35 + Math.sin(t * 0.004) * 0.12;
    ring.material.opacity = 0.65 + Math.sin(t * 0.005) * 0.25;

    // Manuskrip: permata berputar, gulungan hilang bila diambil.
    world.manuscripts.forEach((m, i) => {
      const mmsh = manuscriptMeshes[i];
      mmsh.group.visible = !m.taken;
      if (!m.taken) {
        mmsh.gem.rotation.y = t * 0.002;
        mmsh.gem.position.y = 1.5 + Math.sin(t * 0.003 + i) * 0.15;
      }
    });

    // Lilin: api menyala / padam + zona gelap.
    world.candles.forEach((c, i) => {
      const cm = candleMeshes[i];
      cm.flame.visible = c.lit;
      cm.darkRing.visible = !c.lit;
      if (c.lit) cm.flame.scale.y = 1 + Math.sin(t * 0.01 + i * 2) * 0.15;
    });
    candleLights.forEach((pl, i) => {
      const c = world.candles[i * 2];
      pl.visible = c.lit;
    });

    // Penjaga + cone.
    world.guards.forEach((g, i) => {
      const gm = guardMeshes[i];
      gm.group.position.set(g.x, 0, g.z);
      gm.group.rotation.y = -g.angle + Math.PI / 2;
      // Cone: putar kipas agar menghadap arah penjaga (kipas menghadap +Z lokal).
      gm.cone.rotation.y = 0;
      gm.cone.rotation.y = 0; // kipas ikut rotasi grup
      gm.coneMat.color.setHex(coneColor(g));
      gm.coneMat.opacity = g.state === 'alert' ? 0.42 : 0.3;
      const mark = g.state === 'alert' ? '!' : g.state === 'suspicious' || g.state === 'search' ? '?' : '';
      if (mark !== lastGuardMark[i]) {
        lastGuardMark[i] = mark;
        if (mark) drawMark(gm, mark, mark === '!' ? '#ef4444' : '#fbbf24');
        gm.mark.visible = !!mark;
      }
      gm.mark.lookAt(camera.position);
    });

    updateHUD();
    drawMinimap();
    renderer.render(scene, camera);
  }

  return { render, resize, scene, camera };
}
