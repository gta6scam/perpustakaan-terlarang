// Suara: semua disintesis WebAudio sendiri — tanpa file audio eksternal.
// Langkah kaki, derit rak saat berlari, denting ambil manuskrip, sting saat
// ketahuan, dengung ambient perpustakaan, dan fanfare kemenangan.
// AudioContext baru dibuat pada gestur pertama pengguna (aturan browser);
// di mode screenshot (?shot=) suara diam dan tidak pernah menggagalkan game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let ambientNodes = null;
  let stepTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      startAmbient();
      return true;
    } catch (err) {
      return false;
    }
  }

  function startAmbient() {
    try {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      const gain = ctx.createGain();
      gain.gain.value = 0.045;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 110.3;
      const gain2 = ctx.createGain();
      gain2.gain.value = 0.012;
      osc2.connect(gain2);
      gain2.connect(master);
      osc2.start();
      ambientNodes = { osc, osc2, lfo };
    } catch (err) {
      ambientNodes = null;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (err) {
      // Suara tidak boleh menggagalkan permainan.
    }
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 900;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.15;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
    } catch (err) {
      // Suara tidak boleh menggagalkan permainan.
    }
  }

  return {
    unlock() {
      if (ensure() && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    // Dipanggil tiap frame dengan kecepatan gerak; langkah berirama.
    step(dt, moving, sneaking, running) {
      if (!ctx || muted || !moving) {
        stepTimer = 0;
        return;
      }
      stepTimer -= dt;
      if (stepTimer <= 0) {
        stepTimer = running ? 0.26 : sneaking ? 0.55 : 0.38;
        if (running) noiseBurst(0.09, 0.22, 500); // derit rak saat berlari
        else noiseBurst(0.05, sneaking ? 0.04 : 0.09, 700);
      }
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.25);
      tone(1318, 0.18, 'sine', 0.2, 0.09);
    },
    candle() {
      noiseBurst(0.25, 0.18, 1200);
      tone(320, 0.2, 'sine', 0.12, 0, 180);
    },
    throwBook() {
      noiseBurst(0.12, 0.15, 1600);
    },
    alert() {
      tone(220, 0.16, 'square', 0.16);
      tone(311, 0.22, 'square', 0.16, 0.14);
    },
    caught() {
      tone(196, 0.3, 'sawtooth', 0.2, 0, 98);
      tone(147, 0.45, 'sawtooth', 0.2, 0.22, 73);
    },
    win() {
      const notes = [523, 659, 784, 1046, 1318];
      notes.forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, i * 0.13));
    },
    lose() {
      const notes = [392, 330, 262, 196];
      notes.forEach((f, i) => tone(f, 0.4, 'triangle', 0.2, i * 0.18));
    },
  };
}
