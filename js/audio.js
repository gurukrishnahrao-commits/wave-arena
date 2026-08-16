// ============================================
// AUDIO SYSTEM — Web Audio API
// ============================================

const AudioManager = (() => {
  let ctx = null;
  let masterGain = null;
  let muted = false;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.value = 0.3;
    } catch (e) {
      console.warn('Web Audio not supported');
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, duration, type = 'square', volume = 0.3) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playNoise(duration, volume = 0.1) {
    if (!ctx || muted) return;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
  }

  // Game-specific sounds
  function shoot() { playTone(880, 0.08, 'square', 0.15); playNoise(0.05, 0.08); }
  function hit() { playTone(220, 0.1, 'sawtooth', 0.12); }
  function critHit() { playTone(1200, 0.12, 'square', 0.2); playTone(1600, 0.08, 'sine', 0.15); }
  function enemyDeath() { playNoise(0.15, 0.15); playTone(150, 0.2, 'sawtooth', 0.1); }
  function coinPickup() { playTone(1047, 0.06, 'sine', 0.2); playTone(1319, 0.06, 'sine', 0.15); }
  function playerHit() { playTone(100, 0.2, 'sawtooth', 0.25); playNoise(0.1, 0.2); }
  function waveComplete() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.2, 'sine', 0.2), i * 100);
    });
  }
  function bossWarning() {
    playTone(80, 0.5, 'sawtooth', 0.3);
    setTimeout(() => playTone(60, 0.5, 'sawtooth', 0.3), 500);
  }
  function bossDefeat() {
    [261, 329, 392, 523, 659, 784].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.3, 'sine', 0.25), i * 80);
    });
  }
  function explosion() { playNoise(0.3, 0.25); playTone(80, 0.3, 'sawtooth', 0.2); }
  function shopOpen() { playTone(523, 0.1, 'sine', 0.15); playTone(784, 0.15, 'sine', 0.12); }
  function purchase() { playTone(1047, 0.08, 'sine', 0.2); playTone(1319, 0.1, 'sine', 0.15); }

  function toggleMute() { muted = !muted; return muted; }

  return {
    init, resume, toggleMute,
    shoot, hit, critHit, enemyDeath, coinPickup, playerHit,
    waveComplete, bossWarning, bossDefeat, explosion, shopOpen, purchase,
  };
})();