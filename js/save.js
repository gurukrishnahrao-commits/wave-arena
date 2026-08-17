// ============================================
// SAVE / CHECKPOINT / PERMANENT PROGRESSION
// ============================================

const META_KEY = 'waveArena_meta_v2';
const LEGACY_META_KEY = 'waveArena_meta';

const DEFAULT_SETTINGS = {
  music: 0.45,
  sfx: 0.7,
  shake: true,
  quality: 'auto',
};

const metaProgress = {
  version: 2,
  cores: 0,
  totalCoins: 0,
  gamesPlayed: 0,
  highestWave: 0,
  totalKills: 0,
  bossesDefeated: 0,
  bossMilestones: {},
  victories: 0,
  bestTime: 0,
  tutorialComplete: false,
  achievements: {},
  operations: {},
  permanent: { vitality: 0, power: 0, mobility: 0, fortune: 0 },
  settings: { ...DEFAULT_SETTINGS },
};

const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'FIRST BLOOD', desc: 'Defeat your first enemy.', reward: 5, test: m => m.totalKills >= 1 },
  { id: 'wave_five', name: 'GATECRASHER', desc: 'Reach wave 5.', reward: 15, test: m => m.highestWave >= 5 },
  { id: 'boss_breaker', name: 'BOSS BREAKER', desc: 'Defeat an arena boss.', reward: 20, test: m => m.bossesDefeated >= 1 },
  // Keep the original id so wave-15 achievement state from existing saves remains valid.
  { id: 'cut_the_thread', name: 'BREAK THE LOCK', desc: 'Defeat the Warden on wave 15.', reward: 40, test: m => !!m.bossMilestones?.wave_15 },
  { id: 'hunter', name: 'HUNDRED DOWN', desc: 'Defeat 100 enemies across all runs.', reward: 25, test: m => m.totalKills >= 100 },
  { id: 'wave_ten', name: 'DEEP RUN', desc: 'Reach wave 10.', reward: 30, test: m => m.highestWave >= 10 },
  { id: 'wave_twenty', name: 'LAST SECTOR', desc: 'Reach wave 20.', reward: 50, test: m => m.highestWave >= 20 },
  { id: 'champion', name: 'ARENA CHAMPION', desc: 'Defeat the final boss on wave 25.', reward: 100, test: m => m.victories >= 1 },
];

const OPERATIONS = [
  { id: 'salvage_1000', name: 'SALVAGE PROTOCOL', desc: 'Collect 1,000 lifetime coins.', reward: 40, value: m => m.totalCoins, target: 1000 },
  { id: 'kills_500', name: 'EXTERMINATION ORDER', desc: 'Defeat 500 enemies across all runs.', reward: 60, value: m => m.totalKills, target: 500 },
  { id: 'bosses_5', name: 'DECAPITATION STRIKE', desc: 'Defeat 5 arena bosses.', reward: 75, value: m => m.bossesDefeated, target: 5 },
  { id: 'runs_10', name: 'ARENA VETERAN', desc: 'Launch 10 arena runs.', reward: 50, value: m => m.gamesPlayed, target: 10 },
];

const PERMANENT_UPGRADES = [
  { id: 'vitality', icon: '♥', name: 'REINFORCED SUIT', desc: '+8 maximum HP per rank', max: 5 },
  { id: 'power', icon: '◆', name: 'CORE AMPLIFIER', desc: '+0.5 base damage per rank', max: 5 },
  { id: 'mobility', icon: '»', name: 'VECTOR BOOTS', desc: '+4% move speed per rank', max: 5 },
  { id: 'fortune', icon: '●', name: 'SALVAGE CACHE', desc: '+6 starting coins per rank', max: 5 },
];

const WEAPON_UNLOCKS = {
  pulse: { desc: 'Starter equipment', test: () => true },
  shotgun: { desc: 'Starter equipment', test: () => true },
  sniper: { desc: 'Clear the training simulation', test: m => m.tutorialComplete || m.gamesPlayed > 1 },
  fireball: { desc: 'Reach wave 3', test: m => m.highestWave >= 3 },
  orbital: { desc: 'Reach wave 5', test: m => m.highestWave >= 5 },
  plasma: { desc: 'Defeat 75 enemies', test: m => m.totalKills >= 75 },
  rocket: { desc: 'Defeat 2 bosses', test: m => m.bossesDefeated >= 2 },
};

const PASSIVE_UNLOCKS = {
  regen: { desc: 'Starter equipment', test: () => true },
  crit: { desc: 'Starter equipment', test: () => true },
  coinrush: { desc: 'Reach wave 3', test: m => m.highestWave >= 3 },
  magnet: { desc: 'Defeat 50 enemies', test: m => m.totalKills >= 50 },
  thorns: { desc: 'Defeat a boss', test: m => m.bossesDefeated >= 1 },
};

function normalizeMeta(raw) {
  if (!raw || typeof raw !== 'object') return;
  const safe = { ...raw };
  Object.assign(metaProgress, safe);
  metaProgress.version = 2;
  metaProgress.cores = Number(metaProgress.cores) || 0;
  metaProgress.totalCoins = Number(metaProgress.totalCoins) || 0;
  metaProgress.gamesPlayed = Number(metaProgress.gamesPlayed) || 0;
  metaProgress.highestWave = Number(metaProgress.highestWave) || 0;
  metaProgress.totalKills = Number(metaProgress.totalKills) || 0;
  metaProgress.bossesDefeated = Number(metaProgress.bossesDefeated) || 0;
  metaProgress.bossMilestones = { ...(safe.bossMilestones || {}) };
  metaProgress.victories = Number(metaProgress.victories) || 0;
  metaProgress.bestTime = Number(metaProgress.bestTime) || 0;
  metaProgress.achievements = { ...(safe.achievements || {}) };
  metaProgress.operations = { ...(safe.operations || {}) };
  metaProgress.permanent = { vitality: 0, power: 0, mobility: 0, fortune: 0, ...(safe.permanent || {}) };
  metaProgress.settings = { ...DEFAULT_SETTINGS, ...(safe.settings || {}) };
}

function loadMeta() {
  try {
    const current = localStorage.getItem(META_KEY);
    const legacy = localStorage.getItem(LEGACY_META_KEY);
    normalizeMeta(JSON.parse(current || legacy || 'null'));
  } catch (e) {
    console.warn('Progress storage is unavailable; this run will still work.');
  }
  checkAchievements(true);
  persistMeta();
  updateStartProgress();
}

function persistMeta() {
  if (bossTestMode) return;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(metaProgress));
  } catch (e) {
    // Storage may be blocked in embedded or private browser contexts.
  }
}

function saveMeta() {
  if (bossTestMode) return;
  metaProgress.highestWave = Math.max(metaProgress.highestWave, Math.min(waveNumber, CONFIG.FINAL_WAVE));
  metaProgress.bestTime = Math.max(metaProgress.bestTime, elapsedTime);
  checkAchievements(true);
  persistMeta();
  updateStartProgress();
}

function beginRunMeta() {
  if (bossTestMode || runMetaStarted) return;
  runMetaStarted = true;
  metaProgress.gamesPlayed++;
  checkAchievements(false);
  persistMeta();
}

function recordEnemyDefeat() {
  if (bossTestMode) return;
  metaProgress.totalKills++;
  checkAchievements(false);
  if (metaProgress.totalKills % 10 === 0) persistMeta();
}

function recordCoinCollected(value) {
  if (bossTestMode) return;
  metaProgress.totalCoins += Math.max(0, Number(value) || 0);
  checkAchievements(false);
}

function recordWaveReached(wave) {
  if (bossTestMode) return;
  metaProgress.highestWave = Math.max(metaProgress.highestWave, Math.min(wave, CONFIG.FINAL_WAVE));
  checkAchievements(false);
  persistMeta();
}

function recordBossDefeat() {
  if (bossTestMode) return;
  const milestoneKey = `wave_${waveNumber}`;
  const firstClear = !metaProgress.bossMilestones[milestoneKey];
  metaProgress.bossesDefeated++;
  metaProgress.bossMilestones[milestoneKey] = true;
  const reward = 12 + Math.floor(waveNumber * 1.4);
  metaProgress.cores += reward;
  checkAchievements(false);
  persistMeta();
  setTimeout(() => flashProgressToast(`+${reward} META CORES · BOSS REWARD`), 700);
  if (waveNumber === 15 && firstClear) {
    setTimeout(() => flashProgressToast('WARDEN CORE UNLOCKED · +10% BASE WEAPON DAMAGE'), 1450);
  }
}

function recordCampaignVictory() {
  if (bossTestMode) return;
  metaProgress.victories++;
  metaProgress.highestWave = CONFIG.FINAL_WAVE;
  metaProgress.bestTime = Math.max(metaProgress.bestTime, elapsedTime);
  checkAchievements(false);
  persistMeta();
}

function checkAchievements(silent = false) {
  if (bossTestMode) return;
  for (const achievement of ACHIEVEMENTS) {
    if (metaProgress.achievements[achievement.id] || !achievement.test(metaProgress)) continue;
    metaProgress.achievements[achievement.id] = Date.now();
    metaProgress.cores += achievement.reward;
    if (!silent) setTimeout(() => flashProgressToast(`ACHIEVEMENT · ${achievement.name} · +${achievement.reward} CORES`), 50);
  }
  for (const operation of OPERATIONS) {
    if (metaProgress.operations[operation.id] || operation.value(metaProgress) < operation.target) continue;
    metaProgress.operations[operation.id] = Date.now();
    metaProgress.cores += operation.reward;
    if (!silent) setTimeout(() => flashProgressToast(`OPERATION COMPLETE · ${operation.name} · +${operation.reward} CORES`), 120);
  }
}

function flashProgressToast(text) {
  const toast = document.getElementById('progress-toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
}

function getGameSettings() {
  return metaProgress.settings || DEFAULT_SETTINGS;
}

function updateGameSetting(key, value) {
  metaProgress.settings[key] = value;
  persistMeta();
  if (key === 'music' || key === 'sfx') AudioManager.applySettings?.();
  if (key === 'quality') applyGraphicsSettings?.();
  renderSettingsControls();
}

function isWeaponUnlocked(id) {
  const rule = WEAPON_UNLOCKS[id];
  return !rule || rule.test(metaProgress);
}

function weaponUnlockText(id) {
  return WEAPON_UNLOCKS[id]?.desc || 'Unlocked';
}

function isPassiveUnlocked(id) {
  const rule = PASSIVE_UNLOCKS[id];
  return !rule || rule.test(metaProgress);
}

function passiveUnlockText(id) {
  return PASSIVE_UNLOCKS[id]?.desc || 'Unlocked';
}

function applyPermanentProgression() {
  if (permanentStatsApplied) return;
  permanentStatsApplied = true;
  const p = metaProgress.permanent;
  stats.maxHP += p.vitality * 8;
  stats.hp = stats.maxHP;
  stats.attackDamage += p.power * 0.5;
  if (metaProgress.bossMilestones.wave_15) stats.attackDamage *= 1.1;
  stats.speed *= 1 + p.mobility * 0.04;
  coins += p.fortune * 6;
  document.getElementById('coins').textContent = coins;
}

function permanentUpgradeCost(id) {
  const level = metaProgress.permanent[id] || 0;
  return 20 + level * 20;
}

function buyPermanentUpgrade(id) {
  if (bossTestMode) return;
  const def = PERMANENT_UPGRADES.find(p => p.id === id);
  if (!def) return;
  const level = metaProgress.permanent[id] || 0;
  const cost = permanentUpgradeCost(id);
  if (level >= def.max || metaProgress.cores < cost) return;
  metaProgress.cores -= cost;
  metaProgress.permanent[id] = level + 1;
  persistMeta();
  AudioManager.purchase();
  renderMetaScreen();
  updateStartProgress();
}

function updateStartProgress() {
  const el = document.getElementById('start-progress');
  if (!el) return;
  el.textContent = `BEST WAVE ${metaProgress.highestWave || '—'}  ·  ${Math.floor(metaProgress.cores)} META CORES  ·  ${metaProgress.totalKills} LIFETIME KILLS`;
}

function openMetaScreen() {
  renderMetaScreen();
  document.getElementById('meta-screen').style.display = 'flex';
}

function closeMetaScreen() {
  document.getElementById('meta-screen').style.display = 'none';
}

function renderMetaScreen() {
  const root = document.getElementById('meta-content');
  if (!root) return;
  const upgrades = PERMANENT_UPGRADES.map(def => {
    const level = metaProgress.permanent[def.id] || 0;
    const maxed = level >= def.max;
    const cost = permanentUpgradeCost(def.id);
    const disabled = maxed || metaProgress.cores < cost;
    return `<article class="meta-card">
      <div class="meta-icon">${def.icon}</div>
      <h3>${def.name}</h3><p>${def.desc}</p>
      <div class="rank-pips">${Array.from({ length: def.max }, (_, i) => `<i class="${i < level ? 'filled' : ''}"></i>`).join('')}</div>
      <button ${disabled ? 'disabled' : ''} onclick="buyPermanentUpgrade('${def.id}')">${maxed ? 'MAX RANK' : `UPGRADE · ${cost} CORES`}</button>
    </article>`;
  }).join('');
  const wardenCoreUnlocked = !!metaProgress.bossMilestones.wave_15;
  const wardenCoreCard = `<article class="meta-card warden-core ${wardenCoreUnlocked ? 'unlocked' : 'locked'}">
    <div class="meta-icon">⬡</div>
    <h3>WARDEN CORE</h3><p>Permanent +10% base weapon damage</p>
    <div class="rank-pips"><i class="${wardenCoreUnlocked ? 'filled' : ''}"></i></div>
    <div class="core-status">${wardenCoreUnlocked ? 'CORE ONLINE' : 'DEFEAT WAVE 15 WARDEN'}</div>
  </article>`;

  const unlocks = WEAPONS.map(w => {
    const unlocked = isWeaponUnlocked(w.id);
    return `<div class="unlock-row ${unlocked ? 'unlocked' : 'locked'}"><span>${w.icon} ${w.name}</span><b>${unlocked ? 'UNLOCKED' : weaponUnlockText(w.id)}</b></div>`;
  }).join('') + PASSIVES.map(p => {
    const unlocked = isPassiveUnlocked(p.id);
    return `<div class="unlock-row ${unlocked ? 'unlocked' : 'locked'}"><span>${p.icon} ${p.name}</span><b>${unlocked ? 'UNLOCKED' : passiveUnlockText(p.id)}</b></div>`;
  }).join('');

  const operations = OPERATIONS.map(op => {
    const value = Math.min(op.target, Math.floor(op.value(metaProgress)));
    const complete = !!metaProgress.operations[op.id];
    const percent = Math.min(100, value / op.target * 100);
    return `<div class="operation-card ${complete ? 'complete' : ''}">
      <div><b>${complete ? '✓ ' : ''}${op.name}</b><em>+${op.reward} CORES</em></div>
      <small>${op.desc}</small>
      <div class="operation-track"><i style="width:${percent}%"></i></div>
      <span>${value.toLocaleString()} / ${op.target.toLocaleString()}</span>
    </div>`;
  }).join('');

  const achievements = ACHIEVEMENTS.map(a => {
    const earned = !!metaProgress.achievements[a.id];
    return `<div class="achievement-row ${earned ? 'earned' : ''}"><span>${earned ? '✓' : '◇'}</span><div><b>${a.name}</b><small>${a.desc}</small></div><em>+${a.reward}</em></div>`;
  }).join('');

  const bestMins = Math.floor(metaProgress.bestTime / 60);
  const bestSecs = Math.floor(metaProgress.bestTime % 60).toString().padStart(2, '0');
  root.innerHTML = `
    <section class="meta-summary">
      <div><strong>${Math.floor(metaProgress.cores)}</strong><span>META CORES</span></div>
      <div><strong>${metaProgress.highestWave}</strong><span>BEST WAVE</span></div>
      <div><strong>${metaProgress.totalKills}</strong><span>KILLS</span></div>
      <div><strong>${metaProgress.bossesDefeated}</strong><span>BOSSES</span></div>
      <div><strong>${Math.floor(metaProgress.totalCoins)}</strong><span>SALVAGE</span></div>
      <div><strong>${metaProgress.gamesPlayed}</strong><span>RUNS</span></div>
      <div><strong>${bestMins}:${bestSecs}</strong><span>BEST TIME</span></div>
      <div><strong>${metaProgress.victories}</strong><span>VICTORIES</span></div>
    </section>
    <h2>ACTIVE OPERATIONS</h2><div class="operation-grid">${operations}</div>
    <h2>PERMANENT AUGMENTS</h2><div class="meta-grid">${upgrades}${wardenCoreCard}</div>
    <div class="meta-columns"><section><h2>ARSENAL UNLOCKS</h2>${unlocks}</section><section><h2>ACHIEVEMENTS</h2>${achievements}</section></div>
  `;
}

function renderSettingsControls() {
  const s = getGameSettings();
  const music = document.getElementById('music-volume');
  const sfx = document.getElementById('sfx-volume');
  const shake = document.getElementById('shake-toggle');
  const quality = document.getElementById('quality-select');
  if (music) music.value = Math.round(s.music * 100);
  if (sfx) sfx.value = Math.round(s.sfx * 100);
  if (shake) shake.checked = !!s.shake;
  if (quality) quality.value = s.quality;
  const musicValue = document.getElementById('music-value');
  const sfxValue = document.getElementById('sfx-value');
  if (musicValue) musicValue.textContent = `${Math.round(s.music * 100)}%`;
  if (sfxValue) sfxValue.textContent = `${Math.round(s.sfx * 100)}%`;
}

function cycleQuality() {
  const values = ['auto', 'high', 'low'];
  const current = getGameSettings().quality;
  updateGameSetting('quality', values[(values.indexOf(current) + 1) % values.length]);
}

function saveCheckpoint() {
  if (bossTestMode) return;
  checkpoint = {
    waveNumber, coins, killCount,
    stats: { ...stats },
    bossSpawnedWave,
  };
  saveMeta();
}

function loadCheckpoint() {
  if (!checkpoint) return;
  waveNumber = checkpoint.waveNumber;
  coins = checkpoint.coins;
  killCount = checkpoint.killCount;
  Object.assign(stats, checkpoint.stats);
  bossSpawnedWave = checkpoint.bossSpawnedWave;
  document.getElementById('coins').textContent = Math.floor(coins);
  document.getElementById('kills').textContent = killCount;
}

function cleanupWeaponObjects() {
  burnPatches.forEach(bp => removeAndDispose(bp.mesh));
  burnPatches.length = 0;
  orbitalBlades.forEach(removeAndDispose);
  orbitalBlades.length = 0;
  rockets.forEach(removeAndDispose);
  rockets.length = 0;
  railBeams.forEach(r => removeAndDispose(r.mesh));
  railBeams.length = 0;
  if (plasmaBeamMesh) { removeAndDispose(plasmaBeamMesh); plasmaBeamMesh = null; }
}

function cleanupArena() {
  enemies.forEach(removeAndDispose);
  enemies.length = 0;
  spawnAnimations.forEach(a => { removeAndDispose(a.portal); removeAndDispose(a.glow); });
  spawnAnimations.length = 0;
  while (projectiles.length) releasePlayerProjectile(projectiles.pop());
  while (enemyProjectiles.length) releaseEnemyProjectile(enemyProjectiles.pop());
  fireballs.forEach(removeAndDispose);
  fireballs.length = 0;
  while (coinPickups.length) releaseCoin(coinPickups.pop());
  particles.forEach(removeAndDispose);
  particles.length = 0;
  playerTrail.forEach(t => removeAndDispose(t.mesh));
  playerTrail.length = 0;
  cleanupWeaponObjects();
}

function cleanupBoss() {
  bossEffectId++;
  sentinelIntroId++;
  hiveIntroId++;
  bossDeathInProgress = false;
  clearBossPlayerEffects();
  if (bossData) {
    const disposed = new Set();
    const arrayKeys = ['nests', 'eggs', 'puddles', 'shockwaves', 'acidProjectiles', 'hazards', 'transients', 'mines', 'beams', 'warnings'];
    for (const key of arrayKeys) {
      for (const entry of (bossData[key] || [])) {
        if (entry.bubbles) {
          for (const bubble of entry.bubbles) {
            if (!bubble.mesh || disposed.has(bubble.mesh)) continue;
            disposed.add(bubble.mesh);
            removeAndDispose(bubble.mesh);
          }
        }
        const mesh = entry.mesh || entry;
        if (!mesh || disposed.has(mesh)) continue;
        disposed.add(mesh);
        removeAndDispose(mesh);
      }
    }
    if (bossData.activeAttack?.mesh) removeAndDispose(bossData.activeAttack.mesh);
  }
  if (bossMesh) { removeAndDispose(bossMesh); bossMesh = null; }
  bossData = null;
  bossActive = false;
  document.getElementById('boss-bar').style.display = 'none';
}
