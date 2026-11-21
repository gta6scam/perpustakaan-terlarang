// Input keyboard: WASD/panah bergerak, Shift menyelinap, E interaksi,
// Q lempar buku pengalih, M mute, R/Enter mulai & ulang, Spasi juga interaksi.
export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // tombol yang baru ditekan sejak frame lalu
  let onFirstGesture = null;

  function codeOf(e) {
    return e.code;
  }

  function down(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (onFirstGesture) {
      const fn = onFirstGesture;
      onFirstGesture = null;
      fn();
    }
  }

  function up(e) {
    keys.delete(e.code);
  }

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('pointerdown', () => {
    if (onFirstGesture) {
      const fn = onFirstGesture;
      onFirstGesture = null;
      fn();
    }
  });

  return {
    // Vektor gerak ternormalisasi dari tombol yang ditahan.
    moveVector() {
      let x = 0;
      let z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (x !== 0 && z !== 0) {
        const inv = 1 / Math.hypot(x, z);
        x *= inv;
        z *= inv;
      }
      return { x, z };
    },
    sneak() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    interactPressed() {
      return pressed.has('KeyE') || pressed.has('Space');
    },
    distractPressed() {
      return pressed.has('KeyQ');
    },
    mutePressed() {
      return pressed.has('KeyM');
    },
    restartPressed() {
      return pressed.has('KeyR') || pressed.has('Enter');
    },
    startPressed() {
      return pressed.has('Enter') || pressed.has('Space');
    },
    setFirstGesture(fn) {
      onFirstGesture = fn;
    },
    endFrame() {
      pressed.clear();
    },
  };
}
