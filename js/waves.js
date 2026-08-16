// ============================================
// WAVE LOGIC — timing, arena themes, transitions
// ============================================

const ARENA_THEMES = [
  {
    name: 'PURPLE TEMPLE', wave: 1,
    bg: 0x0a0612, fog: 0x0a0612, ground: 0x180a2e,
    ambient: { color: 0x4a3070, intensity: 0.8 },
    dir: { color: 0xff7ac9, intensity: 0.6 },
    wall: 0xff3d6e, rings: 0x6b3fa0,
  },
  {
    name: 'FROZEN CAVERN', wave: 5,
    bg: 0x020d1a, fog: 0x020d1a, ground: 0x061828,
    ambient: { color: 0x204060, intensity: 0.9 },
    dir: { color: 0x88ccff, intensity: 0.8 },
    wall: 0x44aaff, rings: 0x224466,
  },
  {
    name: 'VOLCANO', wave: 10,
    bg: 0x140400, fog: 0x140400, ground: 0x1a0800,
    ambient: { color: 0x602010, intensity: 0.8 },
    dir: { color: 0xff6622, intensity: 1.0 },
    wall: 0xff4400, rings: 0x661100,
  },
  {
    name: 'CYBER FACTORY', wave: 15,
    bg: 0x000a06, fog: 0x000a06, ground: 0x001a0e,
    ambient: { color: 0x104030, intensity: 0.8 },
    dir: { color: 0x00ffaa, intensity: 0.7 },
    wall: 0x00ff88, rings: 0x005533,
  },
];

// Wave-level timing state — tracks how far into the current wave we are,
// independent of the accumulated elapsedTime clock

function applyArenaTheme(theme) {
  scene.background.setHex(theme.bg);
  scene.fog.color.setHex(theme.fog);
  if (groundMesh && groundMesh.material.uniforms) {
    groundMesh.material.uniforms.uColor.value.setHex(theme.ground);
    groundMesh.material.uniforms.uGridColor.value.setHex(theme.rings);
    groundMesh.material.uniforms.uPulseColor.value.setHex(theme.wall);
  }
  if (ambientLight) {
    ambientLight.color.setHex(theme.ambient.color);
    ambientLight.intensity = theme.ambient.intensity;
  }
  if (dirLight) {
    dirLight.color.setHex(theme.dir.color);
    dirLight.intensity = theme.dir.intensity;
  }
  if (wallMesh) wallMesh.material.color.setHex(theme.wall);
  arenaRingMeshes.forEach(r => r.material.color.setHex(theme.rings));
}

function checkArenaTheme() {
  let themeIdx = 0;
  for (let i = ARENA_THEMES.length - 1; i >= 0; i--) {
    if (waveNumber >= ARENA_THEMES[i].wave) { themeIdx = i; break; }
  }
  if (themeIdx === currentArena) return;
  currentArena = themeIdx;
  const theme = ARENA_THEMES[themeIdx];

  flashCenterMsg(theme.name, '#ffd23d');

  const flash = document.getElementById('damage-flash');
  flash.style.transition = 'background 0.1s';
  flash.style.background = 'rgba(255,255,255,0.18)';
  setTimeout(() => {
    applyArenaTheme(theme);
    flash.style.background = 'rgba(255,255,255,0)';
    setTimeout(() => { flash.style.transition = ''; }, 300);
  }, 100);
}

function isBossWave(wave) {
  return wave > 0 && wave % CONFIG.BOSS_EVERY === 0;
}

function updateWaveLogic(delta) {
  elapsedTime += delta;
  waveTimer += delta;

  // Update timer display
  const mins = Math.floor(elapsedTime / 60);
  const secs = Math.floor(elapsedTime % 60);
  document.getElementById('timer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Update HP bar
  document.getElementById('hp-bar').style.width = Math.max(0, (stats.hp / stats.maxHP) * 100) + '%';

  // Always update weapons
  updateWeapons(delta);

  // Check death
  if (stats.hp <= 0) {
    gameOver();
    return;
  }

  // ==========================================
  // BOSS WAVE HANDLING
  // ==========================================
  if (isBossWave(waveNumber)) {
    // Boss is currently active — just update it
    if (bossActive) {
      updateBoss(delta);
      return;
    }

    // Boss was just killed — wait for death animation, then advance wave
    if (bossDeathPending) {
      return; // waiting for the setTimeout in killBoss to fire
    }

    // Boss hasn't spawned yet for this wave — clear the arena first, then spawn
    if (bossSpawnedWave !== waveNumber) {
      // Kill any remaining regular enemies quickly (they got pushed into this wave from before)
      // Actually — just wait for them to be cleared naturally by the player OR force-clear them
      if (enemies.length === 0) {
        // Arena clear — spawn the boss!
        spawnBoss();
        return;
      }
      // Still enemies alive — don't spawn more, let player clear them
      return;
    }

    return;
  }

  // ==========================================
  // NORMAL WAVE HANDLING
  // ==========================================

  // Wave duration expired?
  if (waveTimer >= CONFIG.WAVE_DURATION) {
    waveClearPending = true;
  }

  // Wave clear complete → advance to next wave
  if (waveClearPending && enemies.length === 0) {
    waveClearPending = false;
    triggerWaveComplete(waveNumber + 1);
    return;
  }

  // Spawn enemies (unless waiting for wave clear)
  if (!waveClearPending) {
    spawnTimer -= delta;
    const spawnInterval = Math.max(
      CONFIG.SPAWN.MIN_INTERVAL,
      CONFIG.SPAWN.BASE_INTERVAL - waveNumber * CONFIG.SPAWN.INTERVAL_REDUCTION
    );
    const maxEnemies = CONFIG.MAX_ENEMIES_BASE + waveNumber * CONFIG.MAX_ENEMIES_PER_WAVE;

    if (spawnTimer <= 0 && enemies.length < maxEnemies) {
      spawnEnemy();
      spawnTimer = spawnInterval;
    }
  }
}

function triggerWaveComplete(nextWave) {
  gameState = 'wavecomplete';
  timeScale = 0.25;
  centerMsgGen++;
  AudioManager.waveComplete();

  setTimeout(() => {
    timeScale = 1;
    if (gameState !== 'wavecomplete') return;

    waveNumber = nextWave;
    waveTimer = 0; // reset wave timer for new wave
    document.getElementById('wave-num').textContent = waveNumber;
    checkArenaTheme();
    waveCompleteMagnet = true;

    const gen = ++centerMsgGen;
    const el = document.getElementById('center-msg');
    el.style.transition = '';
    el.style.opacity = 1;

    const nextIsBoss = isBossWave(waveNumber);
    const bossWarning = nextIsBoss
      ? `<p style="color:#ff3d6e; font-size:14px; margin-top:8px; letter-spacing:2px;">⚠ BOSS WAVE INCOMING ⚠</p>`
      : '';

    el.innerHTML = `
      <h1 style="font-size:44px;color:#3dffd2;text-shadow:0 0 20px #3dffd280;">WAVE COMPLETE</h1>
      <p>Wave ${waveNumber - 1} cleared</p>
      ${bossWarning}
      <div style="margin-top:20px;">
        <button id="wave-complete-continue-btn" style="background:linear-gradient(135deg,#3dffd2,#3d8aff); color:#04221c; border:none; padding:12px 40px; font-size:15px; font-family:inherit; letter-spacing:2px; cursor:pointer; border-radius:4px; pointer-events:all; font-weight:bold;">CONTINUE</button>
      </div>
    `;
    document.getElementById('wave-complete-continue-btn').onclick = () => {
      if (gen !== centerMsgGen) return;
      centerMsgGen++;
      waveCompleteMagnet = false;
      collectAllCoinPickups();
      el.style.transition = '';
      el.style.opacity = 0;
      el.innerHTML = '';
      openShop();
    };
  }, 300);
}

// Called by killBoss when the boss dies — schedules wave advance after death animation
function onBossDefeated() {
  bossDeathPending = true;
  setTimeout(() => {
    bossDeathPending = false;
    // Collect any remaining coins from boss drops
    // Then advance to next wave
    if (gameState === 'playing') {
      triggerWaveComplete(waveNumber + 1);
    }
  }, 2500); // enough time for death explosion + coin shower
}