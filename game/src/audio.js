// audio.js — semua suara disintesis WebAudio: efek (pukul, tembak, klakson,
// tabrakan, uang) + mesin, sirene, dan musik latar loop akor sederhana.
// Aman dipanggil sebelum user gesture: context dibuat malas & digantung.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null;
  let musicTimer = 0, musicStep = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  // Musik: progresi akor tropis pelan (Am - F - C - G), satu nada per 0.42 dtk.
  const CHORDS = [
    [220.0, 261.63, 329.63], [174.61, 220.0, 261.63],
    [130.81, 196.0, 261.63], [196.0, 246.94, 293.66],
  ];
  function musicTick(dt) {
    if (!ctx) return;
    musicTimer -= dt;
    if (musicTimer > 0) return;
    musicTimer = 0.42;
    const chord = CHORDS[Math.floor(musicStep / 4) % CHORDS.length];
    const note = chord[musicStep % chord.length];
    tone(note, 0.5, 'triangle', 0.05);
    if (musicStep % 4 === 0) tone(chord[0] / 2, 1.4, 'sine', 0.06);
    musicStep++;
  }

  function setEngine(on, speedRatio) {
    if (!on) {
      if (engineGain) engineGain.gain.value = 0;
      return;
    }
    if (!ensure()) return;
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    engineOsc.frequency.value = 55 + Math.abs(speedRatio) * 130;
    engineGain.gain.value = 0.045;
  }

  function setSiren(on, time) {
    if (!on) {
      if (sirenGain) sirenGain.gain.value = 0;
      return;
    }
    if (!ensure()) return;
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
    }
    sirenOsc.frequency.value = 660 + Math.sin(time * 7) * 180;
    sirenGain.gain.value = 0.028;
  }

  return {
    unlock() { ensure(); },
    punch() { noise(0.09, 0.25, 500); tone(120, 0.08, 'square', 0.1, 60); },
    thud() { noise(0.14, 0.3, 380); },
    shot() { noise(0.16, 0.5, 2600); tone(190, 0.1, 'square', 0.16, 40); },
    honk() { tone(392, 0.22, 'square', 0.07); tone(494, 0.22, 'square', 0.05); },
    crash() { noise(0.3, 0.45, 700); tone(80, 0.25, 'square', 0.14, 34); },
    cash() { tone(880, 0.09, 'sine', 0.16); setTimeout(() => tone(1318, 0.14, 'sine', 0.16), 70); },
    door() { tone(210, 0.07, 'square', 0.1, 140); },
    alarm() { tone(1180, 0.16, 'square', 0.1, 900); },
    tick() { tone(1560, 0.05, 'sine', 0.08); },
    update(dt, driving, speedRatio, sirenOn, time) {
      musicTick(dt);
      setEngine(driving, speedRatio);
      setSiren(sirenOn, time);
    },
  };
}
