// ============================================
// WAVE LOGIC — 25-wave campaign and transitions
// ============================================

const ARENA_THEMES = [
  {
    name: 'PURPLE TEMPLE', wave: 1, bg: 0x0a0612, fog: 0x0a0612, ground: 0x180a2e,
    ambient: { color: 0x4a3070, intensity: 0.8 }, dir: { color: 0xff7ac9, intensity: 0.6 },
    wall: 0xff3d6e, rings: 0x6b3fa0,
  },
  {
    name: 'FROZEN CAVERN', wave: 5, bg: 0x020d1a, fog: 0x020d1a, ground: 0x061828,
    ambient: { color: 0x204060, intensity: 0.9 }, dir: { color: 0x88ccff, intensity: 0.8 },
    wall: 0x44aaff, rings: 0x224466,
  },
  {
    name: 'VOLCANO', wave: 10, bg: 0x140400, fog: 0x140400, ground: 0x1a0800,
    ambient: { color: 0x602010, intensity: 0.8 }, dir: { color: 0xff6622, intensity: 1.0 },
    wall: 0xff4400, rings: 0x661100,
  },
  {
    name: 'CYBER FACTORY', wave: 15, bg: 0x000a06, fog: 0x000a06, ground: 0x001a0e,
    ambient: { color: 0x104030, intensity: 0.8 }, dir: { color: 0x00ffaa, intensity: 0.7 },
    wall: 0x00ff88, rings: 0x005533,
  },
  {
    name: 'CHRONO VAULT', wave: 20, bg: 0x030916, fog: 0x030916, ground: 0x06132a,
    ambient: { color: 0x193366, intensity: 0.75 }, dir: { color: 0x55bbff, intensity: 0.9 },
    wall: 0x55bbff, rings: 0x173d77,
  },
  {
    name: 'SOVEREIGN CORE', wave: 25, bg: 0x110108, fog: 0x110108, ground: 0x21030f,
    ambient: { color: 0x661833, intensity: 0.9 }, dir: { color: 0xff3355, intensity: 1.1 },
    wall: 0xffd23d, rings: 0x771d35,
  },
];

function applyArenaTheme(theme) {
  scene.background.setHex(theme.bg);
  scene.fog.color.setHex(theme.fog);
  if (groundMesh?.material.uniforms) {
    groundMesh.material.uniforms.uColor.value.setHex(theme.ground);
    groundMesh.material.uniforms.uGridColor.value.setHex(theme.rings);
    groundMesh.material.uniforms.uPulseColor.value.setHex(theme.wall);
  }
  if (ambientLight) { ambientLight.color.setHex(theme.ambient.color); ambientLight.intensity = theme.ambient.intensity; }
  if (dirLight) { dirLight.color.setHex(theme.dir.color); dirLight.intensity = theme.dir.intensity; }
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
  return CONFIG.BOSS_WAVES.includes(wave);
}

function updateWaveLogic(delta) {
  document.getElementById('hp-bar').style.width = Math.max(0, (stats.hp / stats.maxHP) * 100) + '%';
  updateWeapons(delta);

  if (stats.hp <= 0) { gameOver(); return; }

  if (tutorialActive) {
    updateTutorial(delta);
    return;
  }

  elapsedTime += delta;
  waveTimer += delta;
  const mins = Math.floor(elapsedTime / 60);
  const secs = Math.floor(elapsedTime % 60);
  document.getElementById('timer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  if (isBossWave(waveNumber)) {
    if (bossActive) { updateBoss(delta); return; }
    if (bossDeathPending || finalVictoryPending) return;
    if (bossSpawnedWave !== waveNumber) {
      if (enemies.length === 0) spawnBoss();
      return;
    }
    return;
  }

  if (waveTimer >= CONFIG.WAVE_DURATION) waveClearPending = true;
  if (waveClearPending && enemies.length === 0) {
    waveClearPending = false;
    triggerWaveComplete(waveNumber + 1);
    return;
  }

  if (!waveClearPending) {
    spawnTimer -= delta;
    const spawnInterval = Math.max(CONFIG.SPAWN.MIN_INTERVAL, CONFIG.SPAWN.BASE_INTERVAL - waveNumber * CONFIG.SPAWN.INTERVAL_REDUCTION);
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
  AudioManager.setMusicMode('menu');

  setTimeout(() => {
    timeScale = 1;
    if (gameState !== 'wavecomplete') return;

    waveNumber = nextWave;
    waveTimer = 0;
    document.getElementById('wave-num').textContent = waveNumber;
    recordWaveReached(waveNumber);
    checkArenaTheme();
    waveCompleteMagnet = true;

    const gen = ++centerMsgGen;
    const el = document.getElementById('center-msg');
    el.style.transition = '';
    el.style.opacity = 1;
    // Normal center messages ignore pointer input. Wave completion is interactive,
    // so enable it directly instead of relying on a freshly cached stylesheet.
    el.style.pointerEvents = 'auto';
    const nextIsBoss = isBossWave(waveNumber);
    const bossWarning = nextIsBoss
      ? `<p style="color:#ff3d6e;font-size:14px;margin-top:8px;letter-spacing:2px;">⚠ BOSS WAVE ${waveNumber} INCOMING ⚠</p>`
      : '';

    el.innerHTML = `
      <h1 style="font-size:44px;color:#3dffd2;text-shadow:0 0 20px #3dffd280;">WAVE COMPLETE</h1>
      <p>Wave ${waveNumber - 1} cleared</p>${bossWarning}
      <div style="margin-top:20px;"><button id="wave-complete-continue-btn" class="inline-action" type="button" style="pointer-events:auto;">CONTINUE</button></div>`;
    document.getElementById('wave-complete-continue-btn').onclick = () => {
      if (gen !== centerMsgGen) return;
      centerMsgGen++;
      waveCompleteMagnet = false;
      collectAllCoinPickups();
      el.style.pointerEvents = 'none';
      el.style.opacity = 0;
      el.innerHTML = '';

      if (waveNumber === 2 && !loadout.secondary) {
        showWeaponSelectScreen('secondary', secondaryId => {
          loadout.secondary = secondaryId || 'sniper';
          if (loadout.secondary === 'orbital') fireWeaponOrbital();
          openShop();
        }, false);
      } else {
        openShop();
      }
    };
  }, 300);
}

function onBossDefeated() {
  bossDeathPending = true;
  const defeatedWave = waveNumber;
  const defeatedTestEncounter = bossTestEncounterId;
  recordBossDefeat();
  for (const enemy of enemies) removeAndDispose(enemy);
  enemies.length = 0;
  while (enemyProjectiles.length) releaseEnemyProjectile(enemyProjectiles.pop());

  // TEMP QA: boss tests stop after the selected encounter instead of entering
  // the normal campaign wave, and never trigger final campaign victory.
  if (bossTestMode) {
    setTimeout(() => {
      if (!bossDeathPending || waveNumber !== defeatedWave || bossTestEncounterId !== defeatedTestEncounter) return;
      showBossTestResult(defeatedWave, true);
    }, 2500);
    return;
  }

  if (waveNumber === CONFIG.FINAL_WAVE) finalVictoryPending = true;
  setTimeout(() => {
    if (!bossDeathPending || waveNumber !== defeatedWave) return;
    bossDeathPending = false;
    if (defeatedWave === CONFIG.FINAL_WAVE) {
      completeCampaignVictory();
    } else if (gameState === 'playing') {
      triggerWaveComplete(defeatedWave + 1);
    }
  }, 2500);
}

function completeCampaignVictory() {
  if (gameState === 'victory') return;
  finalVictoryPending = false;
  gameState = 'victory';
  timeScale = 1;
  collectAllCoinPickups();
  recordCampaignVictory();
  AudioManager.setMusicMode('victory');
  document.getElementById('boss-bar').style.display = 'none';
  document.getElementById('pause-btn').setAttribute('aria-pressed', 'false');

  const mins = Math.floor(elapsedTime / 60);
  const secs = Math.floor(elapsedTime % 60).toString().padStart(2, '0');
  document.getElementById('victory-stats').innerHTML = `
    <div><strong>${mins}:${secs}</strong><span>CLEAR TIME</span></div>
    <div><strong>${killCount}</strong><span>RUN KILLS</span></div>
    <div><strong>${Math.floor(coins)}</strong><span>RUN COINS</span></div>
    <div><strong>${metaProgress.victories}</strong><span>VICTORIES</span></div>`;
  document.getElementById('victory-screen').style.display = 'flex';
  saveMeta();
}
