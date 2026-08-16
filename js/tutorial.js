// ============================================
// PLAYABLE FIRST-RUN TRAINING
// ============================================

function setTutorialPrompt(kicker, title, body) {
  const card = document.getElementById('tutorial-card');
  if (!card) return;
  card.querySelector('.tutorial-kicker').textContent = kicker;
  card.querySelector('.tutorial-title').textContent = title;
  card.querySelector('.tutorial-body').textContent = body;
  card.classList.add('visible');
}

function startPlayableTutorial() {
  tutorialActive = true;
  tutorialStep = 'move';
  tutorialStartPos = player.position.clone();
  tutorialStartKills = killCount;
  tutorialStartCoins = coins;
  tutorialEnemySpawned = false;
  document.getElementById('timer-label').textContent = 'TRAINING';
  document.getElementById('timer').textContent = 'MOVE';
  setTutorialPrompt(
    'LIVE TRAINING · 1 / 3',
    isTouchDevice ? 'MOVE WITH THE STICK' : 'MOVE WITH WASD',
    'Step in any direction. The simulation starts immediately—no menus, no setup.'
  );
  flashCenterMsg('TRAINING ONLINE', '#3dffd2');
}

function spawnTutorialTarget() {
  if (tutorialEnemySpawned) return;
  tutorialEnemySpawned = true;
  const dir = aimDir.lengthSq() > 0.1 ? aimDir.clone() : new THREE.Vector3(0, 0, 1);
  const pos = player.position.clone().addScaledVector(dir, 6);
  pos.y = 0;
  clampToArena(pos, 2);
  spawnEnemyAt('basic', pos, {
    hp: Math.max(2, Math.ceil(stats.attackDamage * 2)), damage: 0, coins: 2,
    tutorialTarget: true, spawnDuration: 0.25, portalColor: 0x3dffd2,
  });
}

function updateTutorial(delta) {
  if (!tutorialActive) return;

  if (tutorialStep === 'move') {
    const moved = flatDist(player.position, tutorialStartPos);
    if (moved > 0.75) {
      tutorialStep = 'attack';
      spawnTutorialTarget();
      setTutorialPrompt(
        'LIVE TRAINING · 2 / 3',
        isTouchDevice ? 'AUTO-FIRE IS ACTIVE' : 'AIM AND HOLD TO FIRE',
        isTouchDevice ? 'Face the target while moving. Your equipped weapon fires automatically.' : 'Point with the mouse and hold the left button to fire your Pulse Rifle.'
      );
    }
    return;
  }

  if (tutorialStep === 'attack' && killCount > tutorialStartKills) {
    tutorialStep = 'collect';
    setTutorialPrompt(
      'LIVE TRAINING · 3 / 3',
      'COLLECT THE SALVAGE',
      'Move over the gold pickup. Run coins buy upgrades between waves.'
    );
    return;
  }

  if (tutorialStep === 'collect' && coins > tutorialStartCoins) completePlayableTutorial();
}

function skipPlayableTutorial() {
  if (!tutorialActive) return;
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!enemies[i].userData.tutorialTarget) continue;
    removeAndDispose(enemies[i]);
    enemies.splice(i, 1);
  }
  completePlayableTutorial();
}

function completePlayableTutorial() {
  tutorialActive = false;
  tutorialStep = 'complete';
  metaProgress.tutorialComplete = true;
  checkAchievements(false);
  persistMeta();
  const card = document.getElementById('tutorial-card');
  if (card) card.classList.remove('visible');
  document.getElementById('timer-label').textContent = 'SURVIVED';
  document.getElementById('timer').textContent = '0:00';
  flashCenterMsg('TRAINING COMPLETE · WAVE 1', '#ffd23d');
  beginCampaignWaveOne();
}

function beginCampaignWaveOne() {
  tutorialActive = false;
  waveTimer = 0;
  spawnTimer = 0;
  recordWaveReached(1);
  saveCheckpoint();
  AudioManager.setMusicMode('combat');
  clock.getDelta();
}
