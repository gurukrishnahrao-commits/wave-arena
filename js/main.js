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
  gameState = 'dead';
  waveClearPending = false;
  waveCompleteMagnet = false;
  bossDeathPending = false;
  timeScale = 1;
  sentinelIntroId++;
  hiveIntroId++;
  centerMsgGen++;
  saveMeta();
  document.getElementById('pause-screen').style.display = 'none';
  document.getElementById('pause-btn').setAttribute('aria-pressed', 'false');

  if (bossActive) cleanupBoss();
  if (ambientLight) ambientLight.intensity = 0.8;

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
  AudioManager.resume();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('quick-controls').style.display = 'flex';

  showWeaponSelectScreen('primary', (primaryId) => {
    loadout.primary = primaryId;
    if (primaryId === 'orbital') fireWeaponOrbital();

    showWeaponSelectScreen('secondary', (secondaryId) => {
      if (secondaryId) {
        loadout.secondary = secondaryId;
        if (secondaryId === 'orbital') fireWeaponOrbital();
      }
      gameState = 'playing';
      waveTimer = 0; // start wave 1 timer fresh
      saveCheckpoint();
      clock.getDelta();
    });
  });
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