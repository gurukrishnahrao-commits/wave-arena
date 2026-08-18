#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const THREE = require('../js/vendor/three.min.js');

const ROOT = path.resolve(__dirname, '..');
const hunterSource = fs.readFileSync(path.join(ROOT, 'js/bosses/boss-hunter.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(ROOT, 'js/bosses/boss-core.js'), 'utf8');

class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

const elements = {};
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030916);
scene.fog = new THREE.Fog(0x030916, 15, 35);
const ambientLight = new THREE.AmbientLight(0x193366, 0.75);
const dirLight = new THREE.DirectionalLight(0x55bbff, 0.9);
scene.add(ambientLight, dirLight);

let killed = 0;
let playerWeaponVisible = true;
let nextTimerId = 1;
const scheduledTimers = new Map();
function flushTimers() {
  const timers = Array.from(scheduledTimers.values());
  scheduledTimers.clear();
  for (const timer of timers) timer();
}
const player = new THREE.Group();
player.position.set(0, 0.75, 0);
player.userData = {};
const playerGun = new THREE.Object3D();
playerGun.name = 'player-weapon';
player.add(playerGun);
scene.add(player);

const context = {
  console,
  THREE,
  Math,
  performance: { now: () => 1000 },
  setTimeout(fn) { const id = nextTimerId++; scheduledTimers.set(id, fn); return id; },
  clearTimeout(id) { scheduledTimers.delete(id); },
  scene,
  ambientLight,
  dirLight,
  player,
  bossMesh: null,
  bossData: null,
  bossActive: true,
  bossDeathInProgress: false,
  projectiles: [],
  fireballs: [],
  rockets: [],
  burnPatches: [],
  orbitalBlades: [],
  railBeams: [],
  plasmaBeamMesh: null,
  aimDir: new THREE.Vector3(1, 0, 0),
  elapsedTime: 10,
  stats: { hp: 240 },
  invincibleTimer: 0,
  isTouchDevice: false,
  CONFIG: { ARENA_RADIUS: 18 },
  document: {
    body: { classList: new ClassList() },
    getElementById(id) {
      if (!elements[id]) elements[id] = { style: {}, textContent: '', innerHTML: '' };
      return elements[id];
    },
  },
  frameScale: delta => delta * 60,
  frameLerp: (perFrame, delta) => 1 - Math.pow(1 - perFrame, delta * 60),
  flatDist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); },
  removeAndDispose(object) { if (object?.parent) object.parent.remove(object); },
  releasePlayerProjectile() {},
  spawnDeathParticles() {},
  flashCenterMsg() {},
  triggerScreenShake() {},
  triggerColorFlash() {},
  triggerHealthFlash() {},
  showBossWarning() {},
  checkBossProjectileHits() {},
  updateBossHPBar() {},
  killBoss() { killed++; },
  setPlayerWeaponVisible(visible) { playerWeaponVisible = visible; playerGun.visible = visible; },
  AudioManager: {
    bossWarning() {}, enemyShoot() {}, playerHit() {}, explosion() {}, critHit() {},
  },
};

vm.createContext(context);
vm.runInContext(`${hunterSource}\n;globalThis.hunterTest = {
  spawnHunter, enterHunterPhase, updateHunterFlashlight, placeHunterTrap,
  updateHunterTraps, startHunterLastHit, updateHunterLastHit,
  tryHunterFinalShot, cleanupHunterEncounter,
  finalPattern: HUNTER_FINAL_PATTERN
};`, context);
const test = context.hunterTest;

const def = {
  name: 'THE HUNTER', type: 'hunter', color: 0x14161c, emissive: 0x05070a,
  coreColor: 0xff3d3d, hp: 6000, size: 2.25, speed: 0.16, damage: 38, coins: 1500,
};
test.spawnHunter(def);
assert.strictEqual(context.bossData.phase, 1);
assert.strictEqual(context.bossData.mode, 'hidden');
assert.strictEqual(context.bossData.damageMultiplier, 0, 'hidden Hunter must not take blind weapon damage');
assert.deepStrictEqual(Array.from(test.finalPattern), ['charge', 'disappear', 'flank', 'charge', 'trap', 'charge']);
assert(hunterSource.includes('startHunterCharge(bd, 0.7, false)'), 'phase-one charge telegraph is not 0.7 seconds');

// Phase 2 must apply darkness and couple vulnerability to the aimed flashlight cone.
test.enterHunterPhase(context.bossData, 2);
assert(context.document.body.classList.contains('hunter-darkness'));
assert(context.bossData.flashlight && context.bossData.visionLight, 'darkness did not create player vision lights');
context.bossMesh.position.set(5, 0, 0);
context.aimDir.set(1, 0, 0);
test.updateHunterFlashlight(0.016);
assert.strictEqual(context.bossData.flashlightContact, true);
assert.strictEqual(context.bossData.damageMultiplier, 1, 'flashlight contact did not make Hunter vulnerable');
context.aimDir.set(-1, 0, 0);
test.updateHunterFlashlight(0.3);
assert.strictEqual(context.bossData.flashlightContact, false);
assert.strictEqual(context.bossData.damageMultiplier, 0, 'Hunter stayed vulnerable outside the flashlight');

// Phase 3 guarantees all three trap behaviors.
test.enterHunterPhase(context.bossData, 3);
for (const type of ['red', 'blue', 'purple']) test.placeHunterTrap(context.bossData, type);
assert.deepStrictEqual(Array.from(context.bossData.traps, trap => trap.type), ['red', 'blue', 'purple']);
for (const trap of context.bossData.traps) {
  trap.mesh.position.copy(player.position).setY(0.08);
  trap.age = 1;
  trap.armed = true;
}
test.updateHunterTraps(0);
assert(context.stats.hp < 240, 'red trap did not explode for damage');
assert(player.userData.slowedUntil > context.elapsedTime, 'blue trap did not slow the player');
assert(player.userData.weaponsDisabledUntil > context.elapsedTime, 'purple trap did not disable weapons');

// The 5% script removes weapons, forces the wall crash, and allows one final shot.
context.bossData.currentHp = 300;
test.startHunterLastHit();
assert.strictEqual(context.bossData.lastHitState, 'prepare');
assert.strictEqual(player.userData.weaponLockedByHunter, true);
assert.strictEqual(playerWeaponVisible, false);
context.bossData.lastHitState = 'charging';
context.bossData.chargeDir.set(1, 0, 0);
context.bossMesh.position.set(17.1, 0, 0);
player.position.set(0, 0.75, 0);
test.updateHunterLastHit(0.02);
assert.strictEqual(context.bossData.lastHitState, 'stunned', 'wall impact did not stun The Hunter');
assert.strictEqual(playerWeaponVisible, true, 'final-shot weapon was not returned after the wall crash');
assert.strictEqual(test.tryHunterFinalShot(true), true);
assert.strictEqual(killed, 0, 'the final shot did not remain visible for its brief impact frame');
flushTimers();
assert.strictEqual(killed, 1, 'the single final shot did not defeat The Hunter');
assert.strictEqual(context.bossData.currentHp, 0);

// A retry/jump cleanup during the impact frame must cancel the delayed defeat.
context.bossData.lastHitState = 'stunned';
context.bossData.lastShotUsed = false;
context.bossData.currentHp = 300;
assert.strictEqual(test.tryHunterFinalShot(true), true);
test.cleanupHunterEncounter(context.bossData);
flushTimers();
assert.strictEqual(killed, 1, 'a delayed final-shot callback survived encounter cleanup');

// Cleanup must restore lighting and temporary player statuses on every exit path.
test.cleanupHunterEncounter(context.bossData);
assert(!context.document.body.classList.contains('hunter-darkness'));
assert.strictEqual(player.userData.weaponLockedByHunter, false);
assert.strictEqual(player.userData.slowedUntil, 0);
assert.strictEqual(player.userData.weaponsDisabledUntil, 0);
assert.strictEqual(ambientLight.intensity, 0.75);
assert.strictEqual(dirLight.intensity, 0.9);

assert(coreSource.includes("const lastHitFloor = Math.max(1, Math.ceil(bossData.hp * 0.05))"));
assert(coreSource.includes('startHunterLastHit();'), 'boss damage does not hand off to the last-hit duel');
console.log('Hunter phase gates, flashlight vulnerability, colored traps, wall crash, final shot, and cleanup tests passed.');

// Exercise the shared damage interception itself: normal damage must stop at
// exactly 5% and hand control to the scripted duel instead of killing the boss.
let lastHitStarts = 0;
const damageContext = {
  console, THREE, Math,
  bossActive: true,
  bossDeathInProgress: false,
  bossMesh: { position: new THREE.Vector3(2, 0, 0) },
  bossData: {
    type: 'hunter', hp: 6000, currentHp: 420, size: 2.25,
    damageMultiplier: 1, phase: 4, lastHitState: null, shieldActive: false,
  },
  document: { getElementById() { return { style: {}, textContent: '' }; } },
  startHunterLastHit() { lastHitStarts++; damageContext.bossData.lastHitState = 'prepare'; },
  flashBossHit() {},
  spawnDamageNumber() {},
  spawnDeathParticles() {},
  triggerScreenShake() {},
};
vm.createContext(damageContext);
vm.runInContext(`${coreSource}\n;globalThis.damageHunter = damageBossTarget;`, damageContext);
damageContext.bossData.phase = 1;
damageContext.bossData.currentHp = 5000;
assert.strictEqual(damageContext.damageHunter(2000, false, new THREE.Vector3()), true);
assert.strictEqual(damageContext.bossData.currentHp, 4200, 'phase-one damage skipped the 70% gate');
assert.strictEqual(damageContext.damageHunter(50, false, new THREE.Vector3()), false, 'damage crossed a phase gate before the phase transition ran');
damageContext.bossData.phase = 4;
damageContext.bossData.currentHp = 420;
assert.strictEqual(damageContext.damageHunter(200, false, new THREE.Vector3()), true);
assert.strictEqual(damageContext.bossData.currentHp, 300, 'shared damage did not clamp Hunter HP to 5%');
assert.strictEqual(lastHitStarts, 1, 'shared damage did not start the last-hit duel exactly once');
assert.strictEqual(damageContext.damageHunter(200, false, new THREE.Vector3()), false);
assert.strictEqual(damageContext.bossData.currentHp, 300, 'normal damage bypassed last-hit invulnerability');
console.log('Hunter shared-damage 5% interception test passed.');
