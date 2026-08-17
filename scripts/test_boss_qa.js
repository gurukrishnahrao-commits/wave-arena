#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, enabled) { enabled ? this.values.add(value) : this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

function element(dataset = {}) {
  return { dataset, style: {}, classList: new ClassList(), textContent: '', innerHTML: '', onclick: null, setAttribute() {} };
}

function testWardenAssetRouting() {
  const index = read('index.html');
  const core = read('js/bosses/boss-core.js');
  assert(index.includes('js/bosses/boss-warden.js'), 'Wave 15 Warden script is not loaded');
  assert(!index.includes('boss-voidreaver.js'), 'retired Null Reaver script is still loaded');
  assert(index.includes('W15 · WARDEN'), 'Wave 15 QA control is not labeled for the Warden');
  assert(core.includes("type: 'warden'"), 'Wave 15 boss definition is not routed to the Warden');
  assert(core.includes('hp: 5000') && core.includes('coins: 1000'), 'Warden health or coin reward regressed');
}

function testBossJumpFlow() {
  const ids = Object.fromEntries([
    'boss-test-panel', 'boss-test-dock', 'start-screen', 'hud', 'quick-controls',
    'wave-label', 'wave-num', 'timer-label', 'timer', 'kills', 'coins', 'hp-bar',
    'tutorial-card', 'pause-screen', 'center-msg', 'boss-test-retry', 'boss-test-next',
  ].map(id => [id, element()]));
  const waves = [5, 10, 15, 20, 25];
  const buttons = waves.flatMap(wave => [element({ bossTestWave: String(wave) }), element({ bossTestWave: String(wave) })]);
  let arenaCleanups = 0;
  let bossCleanups = 0;
  let themeApplied = -1;
  let released = 0;

  const context = {
    console,
    CONFIG: { BOSS_TEST_ENABLED: true, BOSS_WAVES: waves },
    bossTestMode: false,
    bossTestWave: null,
    bossTestEncounterId: 0,
    document: {
      body: { classList: new ClassList() },
      getElementById: id => ids[id] || (ids[id] = element()),
      querySelectorAll: selector => selector === '[data-boss-test-wave]' ? buttons : [],
    },
    loadout: { primary: null, secondary: null, passive: null },
    passiveRegen: false,
    regenTimer: 0,
    stats: {},
    WEAPONS: [{ timer: 2, upgrade: { applied: true } }, { timer: 3, upgrade: { applied: true } }],
    AudioManager: { resume() {}, setMusicMode(mode) { context.musicMode = mode; } },
    centerMsgGen: 0,
    waveNumber: 1,
    waveTimer: 3,
    spawnTimer: 2,
    elapsedTime: 9,
    waveClearPending: true,
    waveCompleteMagnet: true,
    bossDeathPending: true,
    finalVictoryPending: true,
    bossSpawnedWave: 5,
    timeScale: 0.2,
    tutorialActive: true,
    tutorialStep: 'move',
    player: { position: { x: 4, y: 0.75, z: 2, set(x, y, z) { Object.assign(this, { x, y, z }); } }, visible: false },
    invincibleTimer: 0,
    blinkTimer: 1,
    ARENA_THEMES: waves.map((wave, id) => ({ wave, id })),
    currentArena: -1,
    applyArenaTheme: theme => { themeApplied = theme.id; },
    killCount: 12,
    coins: 99,
    gameState: 'menu',
    clearActiveInput() {},
    cleanupArena() {
      arenaCleanups++;
      while (context.enemyProjectiles.length) context.releaseEnemyProjectile(context.enemyProjectiles.pop());
    },
    cleanupBoss() { bossCleanups++; },
    clock: { getDelta() {} },
    enemyProjectiles: [1, 2],
    releaseEnemyProjectile() { released++; },
  };

  vm.createContext(context);
  const main = read('js/main.js');
  const begin = main.indexOf('// TEMP QA: boss-only test phase.');
  const end = main.indexOf('function pauseGame()', begin);
  assert(begin >= 0 && end > begin, 'temporary QA function block was not found');
  vm.runInContext(main.slice(begin, end), context);

  context.setupBossTestControls();
  buttons.find(button => button.dataset.bossTestWave === '15').onclick();
  assert.strictEqual(context.bossTestMode, true);
  assert.strictEqual(context.bossTestWave, 15);
  assert.strictEqual(context.waveNumber, 15);
  assert.strictEqual(context.gameState, 'playing');
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(context.loadout)),
    { primary: 'pulse', secondary: 'sniper', passive: 'regen' },
  );
  assert.strictEqual(context.stats.maxHP, 240);
  assert.strictEqual(context.stats.attackDamage, 8);
  assert(context.WEAPONS.every(weapon => weapon.timer === 0 && !weapon.upgrade.applied));
  assert.strictEqual(context.killCount, 0);
  assert.strictEqual(context.coins, 0);
  assert.strictEqual(context.bossSpawnedWave, -1);
  assert.strictEqual(themeApplied, 2);
  assert(context.document.body.classList.contains('boss-test-active'));
  assert(buttons.filter(button => button.dataset.bossTestWave === '15').every(button => button.classList.contains('active')));

  context.jumpToBossTestWave(25);
  assert.strictEqual(context.waveNumber, 25);
  assert.strictEqual(themeApplied, 4);
  assert.strictEqual(context.stats.hp, 240);
  assert(arenaCleanups >= 2 && bossCleanups >= 2);

  context.showBossTestResult(25, true);
  assert.strictEqual(context.gameState, 'bosstestcomplete');
  assert.strictEqual(ids['center-msg'].style.pointerEvents, 'auto');
  assert(ids['center-msg'].innerHTML.includes('BOSS TEST CLEARED'));
  assert.strictEqual(context.enemyProjectiles.length, 0);
  assert.strictEqual(released, 2);
  ids['boss-test-next'].onclick();
  assert.strictEqual(context.waveNumber, 5, 'next wraps from the final boss to wave 5');
  assert.strictEqual(context.gameState, 'playing');

  context.clearBossTestSession();
  assert.strictEqual(context.bossTestMode, false);
  assert.strictEqual(context.bossTestWave, null);
  assert(!context.document.body.classList.contains('boss-test-active'));
  assert.strictEqual(ids['wave-label'].textContent, 'WAVE');
}

function testSaveIsolation() {
  let writes = 0;
  const context = {
    console,
    Date,
    Math,
    JSON,
    bossTestMode: true,
    waveNumber: 25,
    elapsedTime: 999,
    runMetaStarted: false,
    CONFIG: { FINAL_WAVE: 25 },
    checkpoint: { waveNumber: 7 },
    localStorage: { getItem() { return null; }, setItem() { writes++; } },
    setTimeout() { throw new Error('test mode must not schedule progression toasts'); },
    document: { getElementById() { return null; } },
    updateStartProgress() {},
    gameState: 'playing',
    stats: { hp: 5 },
    coins: 2,
    killCount: 3,
    bossSpawnedWave: 9,
    AudioManager: { purchase() {} },
    renderMetaScreen() {},
  };

  vm.createContext(context);
  vm.runInContext(`${read('js/save.js')}\n;globalThis.qaSaveTest = {
    metaProgress, persistMeta, saveMeta, beginRunMeta, recordEnemyDefeat,
    recordCoinCollected, recordWaveReached, recordBossDefeat, recordCampaignVictory,
    checkAchievements, buyPermanentUpgrade, saveCheckpoint
  };`, context);
  const test = context.qaSaveTest;
  test.metaProgress.cores = 500;
  const before = JSON.stringify(test.metaProgress);
  const checkpointBefore = JSON.stringify(context.checkpoint);

  test.persistMeta();
  test.saveMeta();
  test.beginRunMeta();
  test.recordEnemyDefeat();
  test.recordCoinCollected(1000);
  test.recordWaveReached(25);
  test.recordBossDefeat();
  test.recordCampaignVictory();
  test.checkAchievements(false);
  test.buyPermanentUpgrade('vitality');
  test.saveCheckpoint();

  assert.strictEqual(JSON.stringify(test.metaProgress), before, 'boss test mutated progression in memory');
  assert.strictEqual(JSON.stringify(context.checkpoint), checkpointBefore, 'boss test replaced the campaign checkpoint');
  assert.strictEqual(context.runMetaStarted, false);
  assert.strictEqual(writes, 0, 'boss test wrote localStorage');
}

function testWardenCoreProgression() {
  const timers = [];
  const coinElement = element();
  const context = {
    console, Date, Math, JSON,
    bossTestMode: false,
    waveNumber: 15,
    elapsedTime: 0,
    permanentStatsApplied: false,
    stats: { maxHP: 100, hp: 100, attackDamage: 8, speed: 0.1 },
    coins: 0,
    localStorage: { setItem() {}, getItem() { return null; } },
    setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; },
    document: { getElementById(id) { return id === 'coins' ? coinElement : null; } },
  };
  vm.createContext(context);
  vm.runInContext(`${read('js/save.js')}\n;globalThis.wardenCoreTest = { metaProgress, applyPermanentProgression, recordBossDefeat };`, context);
  const test = context.wardenCoreTest;
  test.metaProgress.bossMilestones.wave_15 = true; // Existing wave-15 saves must migrate automatically.
  test.metaProgress.permanent.power = 2;
  test.applyPermanentProgression();
  assert.strictEqual(context.stats.attackDamage, 9.9, 'Warden Core did not grant +10% base weapon damage');

  test.metaProgress.bossMilestones.wave_15 = false;
  for (const achievement of ['first_blood', 'wave_five', 'boss_breaker', 'cut_the_thread', 'hunter', 'wave_ten', 'wave_twenty', 'champion']) {
    test.metaProgress.achievements[achievement] = 1;
  }
  for (const operation of ['salvage_1000', 'kills_500', 'bosses_5', 'runs_10']) test.metaProgress.operations[operation] = 1;
  timers.length = 0;
  test.recordBossDefeat();
  assert.strictEqual(test.metaProgress.bossMilestones.wave_15, true);
  assert.strictEqual(timers.filter(timer => timer.delay === 1450).length, 1, 'first clear did not announce Warden Core');
  test.recordBossDefeat();
  assert.strictEqual(timers.filter(timer => timer.delay === 1450).length, 1, 'repeat clear announced Warden Core twice');
}

function testDefeatLifecycle() {
  const timers = [];
  const elements = {};
  let resultCalls = 0;
  let bossRecords = 0;
  let waveAdvances = 0;
  let campaignRecords = 0;
  const context = {
    console,
    Math,
    CONFIG: { BOSS_WAVES: [5, 10, 15, 20, 25], FINAL_WAVE: 25 },
    bossDeathPending: false,
    finalVictoryPending: false,
    bossTestMode: true,
    bossTestEncounterId: 11,
    waveNumber: 25,
    enemies: [{}, {}],
    enemyProjectiles: [{}, {}],
    gameState: 'playing',
    setTimeout(fn, delay) { timers.push({ fn, delay }); },
    recordBossDefeat() { bossRecords++; },
    removeAndDispose() {},
    releaseEnemyProjectile() {},
    showBossTestResult(wave, cleared) {
      resultCalls++;
      assert.strictEqual(wave, 25);
      assert.strictEqual(cleared, true);
    },
    triggerWaveComplete() { waveAdvances++; },
    collectAllCoinPickups() {},
    recordCampaignVictory() { campaignRecords++; },
    AudioManager: { setMusicMode() {} },
    document: { getElementById(id) { return elements[id] || (elements[id] = element()); } },
    elapsedTime: 60,
    killCount: 4,
    coins: 20,
    metaProgress: { victories: 1 },
    timeScale: 1,
    saveMeta() {},
  };

  vm.createContext(context);
  vm.runInContext(read('js/waves.js'), context);
  context.onBossDefeated();
  assert.strictEqual(context.finalVictoryPending, false, 'test final boss entered campaign-victory state');
  assert.strictEqual(timers.length, 1);
  assert.strictEqual(timers[0].delay, 2500);
  assert.strictEqual(context.enemies.length, 0);
  assert.strictEqual(context.enemyProjectiles.length, 0);

  context.bossTestEncounterId = 12;
  context.bossDeathPending = true;
  timers[0].fn();
  assert.strictEqual(resultCalls, 0, 'stale same-wave timer completed the new encounter');
  context.onBossDefeated();
  timers[1].fn();
  assert.strictEqual(resultCalls, 1);
  assert.strictEqual(waveAdvances, 0);
  assert.strictEqual(campaignRecords, 0);
  assert.strictEqual(bossRecords, 2); // save.js makes both calls no-ops in test mode

  context.bossTestMode = false;
  context.bossDeathPending = false;
  context.finalVictoryPending = false;
  context.waveNumber = 25;
  context.onBossDefeated();
  assert.strictEqual(context.finalVictoryPending, true);
  timers[2].fn();
  assert.strictEqual(context.gameState, 'victory');
  assert.strictEqual(campaignRecords, 1);
  assert.strictEqual(waveAdvances, 0);
}

testWardenAssetRouting();
testBossJumpFlow();
testSaveIsolation();
testWardenCoreProgression();
testDefeatLifecycle();
console.log('Boss-only QA routing, lifecycle, and persistence tests passed.');
