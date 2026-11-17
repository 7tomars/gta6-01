// All sound is synthesised live with the WebAudio API — no audio files.
// Short effects (horn, siren blip, punch, shot, cash) are one-shot oscillator
// or noise bursts; the engine is a low sawtooth whose pitch follows speed;
// the music is a small step sequencer playing an original sunny bassline.

/** Create the sound engine. Call unlock() from a user gesture before playing. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }

  function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.25, freq = 1200, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t0);
  }

  // An original 8-bar sunny loop: a bouncy bass line under soft marimba-ish notes.
  const BASS = [110, 0, 110, 131, 0, 98, 110, 0, 87, 0, 87, 98, 0, 110, 131, 147];
  const LEAD = [440, 0, 523, 0, 659, 0, 523, 0, 349, 0, 440, 0, 392, 0, 330, 0];

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicStep = 0;
    musicTimer = window.setInterval(() => {
      if (!ctx) return;
      const i = musicStep % 16;
      if (BASS[i]) tone(BASS[i], 0.22, 'triangle', 0.16);
      if (LEAD[i]) tone(LEAD[i], 0.18, 'sine', 0.07);
      if (musicStep % 4 === 2) noise(0.03, 0.03, 6000);
      musicStep += 1;
    }, 240);
  }

  function stopMusic() {
    if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420;
    engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }

  function setEngine(speedRatio, running) {
    if (!ctx || !engineOsc) return;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(50 + Math.abs(speedRatio) * 130, t, 0.08);
    engineGain.gain.setTargetAtTime(running ? 0.05 + Math.abs(speedRatio) * 0.05 : 0.0, t, 0.1);
  }

  function stopEngine() {
    if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; engineGain = null; }
  }

  return {
    unlock,
    startMusic,
    stopMusic,
    startEngine,
    setEngine,
    stopEngine,
    horn() { tone(370, 0.18, 'square', 0.12); tone(466, 0.18, 'square', 0.08); },
    siren() { tone(660, 0.16, 'square', 0.06); tone(880, 0.16, 'square', 0.06, null, 0.16); },
    punch() { noise(0.08, 0.3, 700); },
    shot() { noise(0.14, 0.4, 2600); tone(160, 0.1, 'square', 0.15, 60); },
    hit() { noise(0.1, 0.25, 900); },
    crash() { noise(0.3, 0.4, 500); tone(90, 0.25, 'square', 0.2, 40); },
    cash() { tone(880, 0.09, 'sine', 0.18); tone(1318, 0.14, 'sine', 0.18, null, 0.09); },
    door() { tone(220, 0.07, 'square', 0.12); tone(180, 0.09, 'square', 0.12, null, 0.08); },
    splash() { noise(0.35, 0.2, 800); },
    alarm() { tone(1046, 0.12, 'square', 0.1); tone(1046, 0.12, 'square', 0.1, null, 0.18); },
  };
}
