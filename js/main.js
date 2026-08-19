// ============================================
// MAIN — entry point, game loop, game over
// ============================================

let loadingHideTimer = null;

function init() {
  loadMeta();
  AudioManager.init();
  initScene();
  initPlayer();
  setupInput();
  setupMobileControls();
  setupQuickControls();
  setupProgressionUI();
  setupBossTestControls();
  renderSettingsControls();
  AudioManager.setMusicMode('menu');

  updateLoadingBar(100);
  loadingHideTimer = setTimeout(hideLoadingScreen, 500);
}

function setupQuickControls() {
  const pauseBtn = document.getElementById('pause-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const muteBtn = document.getElementById('mute-btn');

  pauseBtn.onclick = () => pauseGame();
  resumeBtn.onclick = () => resumeGame();
  muteBtn.onclick = () => {
    const muted = AudioManager.toggleMute();
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    muteBtn.title = muted ? 'Unmute sound' : 'Mute sound';
  };
}

function setupProgressionUI() {
  const metaScreen = document.getElementById('meta-screen');
  const settingsScreen = document.getElementById('settings-screen');
  const openSettings = () => {
    renderSettingsControls();
    settingsScreen.style.display = 'flex';
  };

  document.getElementById('command-btn').onclick = openMetaScreen;
  document.getElementById('meta-close').onclick = closeMetaScreen;
  document.getElementById('settings-btn').onclick = openSettings;
  document.getElementById('settings-close').onclick = () => { settingsScreen.style.display = 'none'; };
  document.getElementById('tutorial-skip').onclick = skipPlayableTutorial;

  metaScreen.onclick = e => { if (e.target === metaScreen) closeMetaScreen(); };
  settingsScreen.onclick = e => { if (e.target === settingsScreen) settingsScreen.style.display = 'none'; };

  const sfx = document.getElementById('sfx-volume');
  const music = document.getElementById('music-volume');
  const quality = document.getElementById('quality-select');
  const shake = document.getElementById('shake-toggle');
  sfx.oninput = () => updateGameSetting('sfx', Number(sfx.value) / 100);
  music.oninput = () => updateGameSetting('music', Number(music.value) / 100);
  quality.onchange = () => updateGameSetting('quality', quality.value);
  shake.onchange = () => updateGameSetting('shake', shake.checked);

  document.getElementById('reset-progress-btn').onclick = () => {
    if (!window.confirm('Reset all Wave Arena progression and settings?')) return;
    try { localStorage.removeItem(META_KEY); localStorage.removeItem(LEGACY_META_KEY); } catch (e) { /* blocked storage */ }
    window.location.reload();
  };

  document.getElementById('new-run-btn').onclick = () => window.location.reload();
  document.getElementById('victory-command-btn').onclick = () => {
    document.getElementById('victory-screen').style.display = 'none';
    openMetaScreen();
  };
}

// TEMP QA: boss-only test phase. Remove this block and its marked UI before release.
function setupBossTestControls() {
  const enabled = !!CONFIG.BOSS_TEST_ENABLED;
  const panel = document.getElementById('boss-test-panel');
  const dock = document.getElementById('boss-test-dock');
  if (!enabled) {
    if (panel) panel.style.display = 'none';
    if (dock) dock.style.display = 'none';
    return;
  }

  document.querySelectorAll('[data-boss-test-wave]').forEach(button => {
    button.onclick = () => {
      const wave = Number(button.dataset.bossTestWave);
      if (!CONFIG.BOSS_WAVES.includes(wave)) return;
      if (!bossTestMode) startBossTest(wave);
      else jumpToBossTestWave(wave);
    };
  });
}

function clearBossTestSession() {
  bossTestMode = false;
  bossTestWave = null;
  bossTestEncounterId++;
  document.body.classList.remove('boss-test-active');
  document.querySelectorAll('[data-boss-test-wave]').forEach(button => button.classList.remove('active'));
  document.getElementById('wave-label').textContent = 'WAVE';
  document.getElementById('timer-label').textContent = 'TIME';
}

function configureBossTestLoadout() {
  loadout.primary = 'pulse';
  loadout.secondary = 'sniper';
  loadout.passive = 'regen';
  passiveRegen = true;
  regenTimer = 0;

  stats.speed = 0.105;
  stats.attackRange = 7;
  stats.attackDamage = 8;
  stats.attackSpeed = 0.35;
  stats.maxHP = 240;
  stats.hp = stats.maxHP;
  stats.critChance = 0.2;
  stats.coinMult = 1;
  stats.coinMagnet = false;
  stats.thorns = false;
  for (const weapon of WEAPONS) {
    weapon.timer = 0;
    if (weapon.upgrade) weapon.upgrade.applied = false;
  }
}

function startBossTest(wave) {
  if (!CONFIG.BOSS_TEST_ENABLED || !CONFIG.BOSS_WAVES.includes(wave)) return;
  bossTestMode = true;
  document.body.classList.add('boss-test-active');
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('quick-controls').style.display = 'flex';
  AudioManager.resume();
  configureBossTestLoadout();
  jumpToBossTestWave(wave);
}

function jumpToBossTestWave(wave) {
  if (!bossTestMode || !CONFIG.BOSS_WAVES.includes(wave)) return;
  bossTestWave = wave;
  bossTestEncounterId++;
  centerMsgGen++;
  clearActiveInput();
  cleanupArena();
  cleanupBoss();

  waveNumber = wave;
  waveTimer = 0;
  spawnTimer = 0;
  elapsedTime = 0;
  waveClearPending = false;
  waveCompleteMagnet = false;
  bossDeathPending = false;
  finalVictoryPending = false;
  bossSpawnedWave = -1;
  timeScale = 1;
  tutorialActive = false;
  tutorialStep = 'idle';
  configureBossTestLoadout();
  killCount = 0;
  coins = 0;

  player.position.set(0, 0.75, 0);
  player.visible = true;
  invincibleTimer = 1.5;
  blinkTimer = 0;

  let themeIndex = 0;
  for (let i = ARENA_THEMES.length - 1; i >= 0; i--) {
    if (wave >= ARENA_THEMES[i].wave) { themeIndex = i; break; }
  }
  currentArena = themeIndex;
  applyArenaTheme(ARENA_THEMES[themeIndex]);

  document.querySelectorAll('[data-boss-test-wave]').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.bossTestWave) === wave);
  });
  document.getElementById('wave-label').textContent = 'BOSS TEST';
  document.getElementById('wave-num').textContent = wave;
  document.getElementById('timer-label').textContent = 'QA TIME';
  document.getElementById('timer').textContent = '0:00';
  document.getElementById('kills').textContent = killCount;
  document.getElementById('coins').textContent = Math.floor(coins);
  document.getElementById('hp-bar').style.width = '100%';
  document.getElementById('tutorial-card').classList.remove('visible');
  document.getElementById('pause-screen').style.display = 'none';

  const center = document.getElementById('center-msg');
  center.style.pointerEvents = 'none';
  center.style.transition = '';
  center.style.opacity = 0;
  center.innerHTML = '';

  gameState = 'playing';
  AudioManager.setMusicMode('boss');
  clock.getDelta();
}

function showBossTestResult(wave, cleared) {
  if (!bossTestMode) return;
  bossDeathPending = false;
  finalVictoryPending = false;
  waveClearPending = false;
  timeScale = 1;
  clearActiveInput();
  cleanupArena();
  cleanupBoss();
  gameState = 'bosstestcomplete';
  AudioManager.setMusicMode('menu');

  const currentIndex = CONFIG.BOSS_WAVES.indexOf(wave);
  const nextWave = CONFIG.BOSS_WAVES[(currentIndex + 1) % CONFIG.BOSS_WAVES.length];
  const center = document.getElementById('center-msg');
  const gen = ++centerMsgGen;
  center.style.transition = '';
  center.style.opacity = 1;
  center.style.pointerEvents = 'auto';
  center.innerHTML = `
    <div style="color:#ffb14a;font-size:11px;letter-spacing:3px;">TEMP QA · PROGRESSION DISABLED</div>
    <h1 style="color:${cleared ? '#3dffd2' : '#ff3d6e'};font-size:38px;margin-top:10px;">${cleared ? 'BOSS TEST CLEARED' : 'BOSS TEST FAILED'}</h1>
    <p>Wave ${wave} · Use the QA dock or continue below.</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:18px;">
      <button id="boss-test-retry" class="inline-action" type="button">RETRY WAVE ${wave}</button>
      <button id="boss-test-next" class="inline-action" type="button">NEXT · WAVE ${nextWave}</button>
    </div>`;
  document.getElementById('boss-test-retry').onclick = () => {
    if (gen === centerMsgGen) jumpToBossTestWave(wave);
  };
  document.getElementById('boss-test-next').onclick = () => {
    if (gen === centerMsgGen) jumpToBossTestWave(nextWave);
  };
}

function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  clearActiveInput();
  document.getElementById('pause-screen').style.display = 'flex';
  document.getElementById('pause-btn').setAttribute('aria-pressed', 'true');
  document.getElementById('resume-btn').focus();
}

function resumeGame() {
  if (gameState !== 'paused') return;
  document.getElementById('pause-screen').style.display = 'none';
  document.getElementById('pause-btn').setAttribute('aria-pressed', 'false');
  gameState = 'playing';
  AudioManager.resume();
  clock.getDelta();
}

function togglePause() {
  if (gameState === 'paused') resumeGame();
  else pauseGame();
}

function gameOver() {
  if (bossTestMode) {
    showBossTestResult(waveNumber, false);
    return;
  }
  gameState = 'dead';
  waveClearPending = false;
  waveCompleteMagnet = false;
  bossDeathPending = false;
  finalVictoryPending = false;
  timeScale = 1;
  centerMsgGen++;
  saveMeta();
  AudioManager.setMusicMode('menu');
  document.getElementById('tutorial-card').classList.remove('visible');
  document.getElementById('pause-screen').style.display = 'none';
  document.getElementById('pause-btn').setAttribute('aria-pressed', 'false');

  cleanupBoss();
  const arenaTheme = ARENA_THEMES[currentArena] || ARENA_THEMES[0];
  if (arenaTheme) applyArenaTheme(arenaTheme);
  if (scene.fog) { scene.fog.near = 15; scene.fog.far = 35; }

  const el = document.getElementById('center-msg');
  el.style.transition = '';
  el.style.opacity = 1;
  const mins = Math.floor(elapsedTime / 60);
  const secs = Math.floor(elapsedTime % 60);
  el.innerHTML = `
    <h1>YOU FELL</h1>
    <p>Survived ${mins}:${secs.toString().padStart(2,'0')} &nbsp;|&nbsp; ${killCount} kills &nbsp;|&nbsp; Wave ${waveNumber}</p>
    <p style="color:#ffd23d; font-size:22px; margin-top:10px;">+${coins} coins earned</p>
    <p style="color:#6b5a8a; font-size:12px; margin-top:6px;">Best: Wave ${metaProgress.highestWave}</p>
    <div style="display:flex; gap:16px; justify-content:center; margin-top:24px;">
      <button id="continue-btn" style="background:linear-gradient(135deg,#3dffd2,#3d8aff); color:#04221c; border:none; padding:14px 32px; font-size:16px; font-family:inherit; letter-spacing:2px; cursor:pointer; border-radius:4px; pointer-events:all; font-weight:bold;">CONTINUE</button>
      <button id="restart-btn" style="background:linear-gradient(135deg,#ff3d6e,#a23dff); color:#fff; border:none; padding:14px 32px; font-size:16px; font-family:inherit; letter-spacing:2px; cursor:pointer; border-radius:4px; pointer-events:all;">NEW RUN</button>
    </div>
    <p style="font-size:11px; color:#888; margin-top:14px; letter-spacing:1px;">Continue rewinds to wave ${checkpoint ? checkpoint.waveNumber : waveNumber}.</p>
  `;
  document.getElementById('continue-btn').onclick = () => continueRun();
  document.getElementById('restart-btn').onclick = () => window.location.reload();
}

function continueRun() {
  waveClearPending = false;
  waveCompleteMagnet = false;
  bossDeathPending = false;
  finalVictoryPending = false;
  waveTimer = 0;
  timeScale = 1;
  centerMsgGen++;

  cleanupArena();
  cleanupBoss();
  loadCheckpoint();

  // Reset boss tracking for this wave
  if (isBossWave(waveNumber)) {
    bossSpawnedWave = -1; // allow boss to spawn fresh
  }

  player.position.set(0, 0.75, 0);
  stats.hp = stats.maxHP;
  invincibleTimer = CONFIG.CONTINUE_INVINCIBLE;
  document.getElementById('hp-bar').style.width = '100%';

  elapsedTime = (waveNumber - 1) * CONFIG.WAVE_DURATION;
  document.getElementById('wave-num').textContent = waveNumber;
  clock.getDelta();

  spawnTimer = 0;
  if (!isBossWave(waveNumber)) {
    const freshCount = Math.min(5, 4 + Math.floor(waveNumber / 3));
    for (let i = 0; i < freshCount; i++) {
      setTimeout(() => { if (gameState === 'playing') spawnEnemy(); }, i * 150);
    }
  }

  // Respawn orbital blades if equipped
  if (loadout.primary === 'orbital' || loadout.secondary === 'orbital') {
    fireWeaponOrbital();
  }

  if (ambientLight) {
    const theme = ARENA_THEMES[currentArena] || ARENA_THEMES[0];
    ambientLight.intensity = theme.ambient.intensity;
    ambientLight.color.setHex(theme.ambient.color);
  }

  const el = document.getElementById('center-msg');
  el.style.transition = '';
  el.style.opacity = 0;
  el.innerHTML = '';

  gameState = 'playing';
  AudioManager.setMusicMode(isBossWave(waveNumber) ? 'boss' : 'combat');
  flashCenterMsg(`WAVE ${waveNumber} — CHECKPOINT`, '#3dffd2');
}

// ---- MAIN LOOP ----
function animate() {
  requestAnimationFrame(animate);
  const rawDelta = Math.min(clock.getDelta(), 0.1);
  const delta = rawDelta * timeScale;

  // Keep rendering the modal while freezing every gameplay and visual timer.
  if (gameState === 'paused') {
    renderer.render(scene, camera);
    return;
  }

  // Muzzle flash fade
  if (muzzleTimer > 0) {
    muzzleTimer -= delta;
    muzzleLight.intensity = Math.max(0, (muzzleTimer / 0.06) * 3);
  }

  // Shake decay
  shakeAmount *= Math.pow(0.82, frameScale(delta));
  if (shakeAmount < 0.001) shakeAmount = 0;

  // Red flash decay
  if (redFlashTimer > 0) {
    redFlashTimer -= delta;
    if (redFlashTimer <= 0) {
      redFlashTimer = 0;
      document.getElementById('damage-flash').style.background = 'rgba(255,30,30,0)';
    }
  }

  // Invincibility blink
  if (invincibleTimer > 0) {
    invincibleTimer -= delta;
    blinkTimer += delta;
    player.visible = Math.sin(blinkTimer * 20) > 0;
    if (invincibleTimer <= 0) player.visible = true;
  }

  if (gameState === 'playing') {
    updatePlayer(delta);
    updateEnemies(delta);
    updateSpawnAnimations(delta);
    updateProjectiles(delta);
    updateEnemyProjectiles(delta);
    updateCoinPickups(delta);
    updateWaveLogic(delta);
  } else if (gameState === 'wavecomplete') {
    updateCoinPickups(delta);
  }

  updateParticles(delta);
  updateGraphics(delta);
  updateCamera(delta);
  renderer.render(scene, camera);
}

// ---- START BUTTON ----
document.getElementById('start-btn').onclick = () => {
  clearBossTestSession();
  AudioManager.resume();
  beginRunMeta();
  applyPermanentProgression();
  loadout.primary = 'pulse';
  loadout.secondary = null;
  loadout.passive = null;

  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('quick-controls').style.display = 'flex';
  document.getElementById('wave-num').textContent = '1';

  gameState = 'playing';
  waveTimer = 0;
  spawnTimer = 0;
  saveCheckpoint();
  clock.getDelta();

  if (metaProgress.tutorialComplete) {
    beginCampaignWaveOne();
    flashCenterMsg('PULSE RIFLE ONLINE · WAVE 1', '#3dffd2');
  } else {
    AudioManager.setMusicMode('combat');
    startPlayableTutorial();
  }
};

// ---- BOOT ----
try {
  init();
  animate();
} catch (error) {
  clearTimeout(loadingHideTimer);
  console.error('Wave Arena failed to start:', error);
  const loading = document.getElementById('loading-screen');
  loading.classList.remove('hidden');
  loading.style.display = 'flex';
  loading.querySelector('.loading-content').innerHTML = `
    <h1>WAVE ARENA</h1>
    <p style="max-width:420px;color:#ff9ab0;line-height:1.6;">
      The arena could not start. Please enable WebGL, refresh the page, or try a current browser.
    </p>
  `;
}