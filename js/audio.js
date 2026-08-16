// ============================================
// AUDIO — procedural SFX and adaptive music
// ============================================

const AudioManager = (() => {
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let musicMode = 'menu';
  let musicStep = 0;
  let nextMusicBeat = 0;
  let scheduler = null;

  const MUSIC = {
    menu: { tempo: 0.55, root: 110, notes: [0, 7, 12, 7, 3, 10, 12, 7], wave: 'sine' },
    combat: { tempo: 0.30, root: 82.41, notes: [0, 0, 7, 3, 0, 10, 7, 3], wave: 'triangle' },
    boss: { tempo: 0.22, root: 65.41, notes: [0, 1, 0, 6, 0, 1, 10, 6], wave: 'sawtooth' },
    victory: { tempo: 0.38, root: 130.81, notes: [0, 4, 7, 12, 7, 11, 14, 19], wave: 'sine' },
  };

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      sfxGain = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain.connect(masterGain);
      musicGain.connect(masterGain);
      masterGain.connect(ctx.destination);
      masterGain.gain.value = 0.5;
      applySettings();
      scheduler = setInterval(scheduleMusic, 80);
    } catch (e) {
      console.warn('Web Audio not supported');
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (ctx) nextMusicBeat = Math.max(nextMusicBeat, ctx.currentTime + 0.05);
  }

  function applySettings() {
    if (!ctx) return;
    const settings = typeof getGameSettings === 'function' ? getGameSettings() : { music: 0.45, sfx: 0.7 };
    musicGain.gain.setTargetAtTime(Math.max(0, settings.music) * 0.22, ctx.currentTime, 0.03);
    sfxGain.gain.setTargetAtTime(Math.max(0, settings.sfx), ctx.currentTime, 0.03);
  }

  function playTone(freq, duration, type = 'square', volume = 0.3) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(Math.max(0.001, volume), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playNoise(duration, volume = 0.1) {
    if (!ctx || muted) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.001, volume), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(sfxGain);
    source.start();
  }

  function musicNote(freq, duration, volume, when) {
    if (!ctx || muted || !musicGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const cfg = MUSIC[musicMode] || MUSIC.menu;
    osc.type = cfg.wave;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(when);
    osc.stop(when + duration + 0.03);
  }

  function scheduleMusic() {
    if (!ctx || ctx.state !== 'running' || muted) return;
    const cfg = MUSIC[musicMode] || MUSIC.menu;
    if (!nextMusicBeat || nextMusicBeat < ctx.currentTime - 0.5) nextMusicBeat = ctx.currentTime + 0.05;
    while (nextMusicBeat < ctx.currentTime + 0.18) {
      const semitone = cfg.notes[musicStep % cfg.notes.length];
      const intensity = musicMode === 'boss' ? 0.18 : musicMode === 'combat' ? 0.13 : 0.1;
      const freq = cfg.root * Math.pow(2, semitone / 12);
      musicNote(freq, cfg.tempo * 0.8, intensity, nextMusicBeat);
      if ((musicStep % 4) === 0) musicNote(cfg.root / 2, cfg.tempo * 1.8, intensity * 0.8, nextMusicBeat);
      if (musicMode === 'boss' && musicStep % 2 === 0) musicNote(freq * 2, cfg.tempo * 0.35, 0.06, nextMusicBeat);
      musicStep++;
      nextMusicBeat += cfg.tempo;
    }
  }

  function setMusicMode(mode) {
    if (!MUSIC[mode] || musicMode === mode) return;
    musicMode = mode;
    musicStep = 0;
    if (ctx) nextMusicBeat = ctx.currentTime + 0.08;
  }

  function shoot() { playTone(880, 0.08, 'square', 0.15); playNoise(0.05, 0.08); }
  function hit() { playTone(220, 0.1, 'sawtooth', 0.12); }
  function critHit() { playTone(1200, 0.12, 'square', 0.2); playTone(1600, 0.08, 'sine', 0.15); }
  function enemyDeath() { playNoise(0.15, 0.15); playTone(150, 0.2, 'sawtooth', 0.1); }
  function enemyShoot() { playTone(310, 0.09, 'sawtooth', 0.08); }
  function coinPickup() { playTone(1047, 0.06, 'sine', 0.2); playTone(1319, 0.06, 'sine', 0.15); }
  function playerHit() { playTone(100, 0.2, 'sawtooth', 0.25); playNoise(0.1, 0.2); }
  function waveComplete() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.2), i * 100));
  }
  function bossWarning() {
    playTone(80, 0.5, 'sawtooth', 0.3);
    setTimeout(() => playTone(60, 0.5, 'sawtooth', 0.3), 500);
  }
  function bossDefeat() {
    [261, 329, 392, 523, 659, 784].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.25), i * 80));
  }
  function explosion() { playNoise(0.3, 0.25); playTone(80, 0.3, 'sawtooth', 0.2); }
  function shopOpen() { playTone(523, 0.1, 'sine', 0.15); playTone(784, 0.15, 'sine', 0.12); }
  function purchase() { playTone(1047, 0.08, 'sine', 0.2); playTone(1319, 0.1, 'sine', 0.15); }

  function toggleMute() {
    muted = !muted;
    if (ctx && masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
    return muted;
  }

  function isMuted() { return muted; }

  return {
    init, resume, applySettings, setMusicMode, toggleMute, isMuted,
    shoot, hit, critHit, enemyDeath, enemyShoot, coinPickup, playerHit,
    waveComplete, bossWarning, bossDefeat, explosion, shopOpen, purchase,
  };
})();
