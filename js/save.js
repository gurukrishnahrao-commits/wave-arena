// ============================================
// SAVE / CHECKPOINT / META PROGRESSION
// ============================================

const META_KEY = 'waveArena_meta';

const metaProgress = {
  totalCoins: 0,
  gamesPlayed: 0,
  highestWave: 0,
  totalKills: 0,
  bestTime: 0,
};

function loadMeta() {
  try {
    const data = JSON.parse(localStorage.getItem(META_KEY));
    if (data) Object.assign(metaProgress, data);
  } catch (e) {}
}

function saveMeta() {
  metaProgress.highestWave = Math.max(metaProgress.highestWave, waveNumber);
  metaProgress.totalKills += killCount;
  metaProgress.bestTime = Math.max(metaProgress.bestTime, elapsedTime);
  try {
    localStorage.setItem(META_KEY, JSON.stringify(metaProgress));
  } catch (e) {}
}

function saveCheckpoint() {
  checkpoint = {
    waveNumber, coins, killCount,
    stats: { ...stats },
    bossSpawnedWave,
  };
}

function loadCheckpoint() {
  if (!checkpoint) return;
  waveNumber = checkpoint.waveNumber;
  coins = checkpoint.coins;
  killCount = checkpoint.killCount;
  Object.assign(stats, checkpoint.stats);
  bossSpawnedWave = checkpoint.bossSpawnedWave;
  document.getElementById('coins').textContent = coins;
  document.getElementById('kills').textContent = killCount;
}

// Clean up all weapon-related scene objects on death/continue/debug
function cleanupWeaponObjects() {
  burnPatches.forEach(bp => scene.remove(bp.mesh));
  burnPatches.length = 0;
  orbitalBlades.forEach(b => scene.remove(b));
  orbitalBlades.length = 0;
  rockets.forEach(r => scene.remove(r));
  rockets.length = 0;
  railBeams.forEach(r => scene.remove(r.mesh));
  railBeams.length = 0;
  if (plasmaBeamMesh) { scene.remove(plasmaBeamMesh); plasmaBeamMesh = null; }
}

// Clean up all entity arrays
function cleanupArena() {
  enemies.forEach(e => scene.remove(e));
  enemies.length = 0;
  spawnAnimations.forEach(a => { scene.remove(a.portal); scene.remove(a.glow); });
  spawnAnimations.length = 0;
  projectiles.forEach(p => scene.remove(p));
  projectiles.length = 0;
  enemyProjectiles.forEach(p => scene.remove(p));
  enemyProjectiles.length = 0;
  fireballs.forEach(f => scene.remove(f));
  fireballs.length = 0;
  coinPickups.forEach(c => scene.remove(c));
  coinPickups.length = 0;
  particles.forEach(p => scene.remove(p));
  particles.length = 0;
  playerTrail.forEach(t => scene.remove(t.mesh));
  playerTrail.length = 0;
  cleanupWeaponObjects();
}

// Clean up boss-specific scene objects
function cleanupBoss() {
  if (bossData) {
    (bossData.nests || []).forEach(n => n.mesh && scene.remove(n.mesh));
    (bossData.eggs || []).forEach(e => e.mesh && scene.remove(e.mesh));
    (bossData.puddles || []).forEach(p => p.mesh && removeAcidPuddle(p));
    (bossData.shockwaves || []).forEach(s => s.mesh && scene.remove(s.mesh));
    (bossData.acidProjectiles || []).forEach(ap => ap.mesh && scene.remove(ap.mesh));
  }
  if (bossMesh) { scene.remove(bossMesh); bossMesh = null; }
  bossData = null;
  bossActive = false;
  document.getElementById('boss-bar').style.display = 'none';
}