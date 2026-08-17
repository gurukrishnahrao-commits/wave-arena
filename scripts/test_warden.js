#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const THREE = require('../js/vendor/three.min.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const scene = new THREE.Scene();
const elements = {};
const removed = [];

function removeAndDispose(object) {
  if (!object) return;
  removed.push(object);
  if (object.parent) object.parent.remove(object);
  const geometries = new Set();
  const materials = new Set();
  object.traverse?.(node => {
    if (node.geometry && !geometries.has(node.geometry)) {
      geometries.add(node.geometry);
      node.geometry.dispose?.();
    }
    for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
      if (material && !materials.has(material)) {
        materials.add(material);
        material.dispose?.();
      }
    }
  });
}

function buildLowPolyAlien({ size, color, emissive }) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, emissive });
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), material));
  group.material = material;
  return group;
}

const context = {
  console,
  THREE,
  scene,
  performance,
  Math,
  CONFIG: { ARENA_RADIUS: 18, TRAIL_LENGTH: 16 },
  player: new THREE.Object3D(),
  keys: { w: true },
  joystickInput: { x: 0, y: 0 },
  isTouchDevice: true,
  aimDir: new THREE.Vector3(0, 0, 1),
  playerTrail: [],
  bossMesh: null,
  bossData: null,
  bossActive: true,
  bossDeathInProgress: false,
  bossEffectId: 0,
  sentinelIntroId: 0,
  hiveIntroId: 0,
  centerMsgGen: 0,
  enemyProjectiles: [],
  projectiles: [],
  fireballs: [],
  enemies: [],
  stats: { hp: 240, maxHP: 240, critChance: 0.2, attackDamage: 8, speed: 0.1 },
  invincibleTimer: 0,
  elapsedTime: 0,
  buildLowPolyAlien,
  setObjectShadows() {},
  getGameSettings() { return { quality: 'high' }; },
  flashCenterMsg() {},
  triggerColorFlash() {},
  triggerScreenShake() {},
  triggerHealthFlash() {},
  spawnDeathParticles() {},
  spawnDamageNumber() {},
  AudioManager: { enemyShoot() {}, explosion() {}, setMusicMode() {}, bossWarning() {} },
  flatDist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); },
  frameScale(delta) { return delta * 60; },
  frameLerp(base, delta) { return 1 - Math.pow(1 - base, delta * 60); },
  clampToArena(position, margin = 0) {
    const limit = 18 - margin;
    const length = Math.hypot(position.x, position.z);
    if (length > limit) { position.x *= limit / length; position.z *= limit / length; }
  },
  removeAndDispose,
  releaseEnemyProjectile() {},
  releasePlayerProjectile() {},
  setTimeout() { return 1; },
  clearTimeout() {},
  document: {
    getElementById(id) {
      return elements[id] || (elements[id] = { style: {}, textContent: '', innerHTML: '', setAttribute() {} });
    },
  },
  ambientLight: null,
  ARENA_THEMES: [],
  currentArena: 0,
};
context.player.position.set(0, 0.75, 0);
vm.createContext(context);
vm.runInContext(read('js/player.js'), context);
vm.runInContext(`${read('js/bosses/boss-core.js')}\n;globalThis.wave15Def = BOSS_BY_WAVE[15];`, context);
vm.runInContext(read('js/bosses/boss-warden.js'), context);
const saveSource = read('js/save.js');
vm.runInContext(saveSource.slice(saveSource.indexOf('function cleanupBoss()')), context);

assert.strictEqual(context.wave15Def.type, 'warden');
assert.strictEqual(context.wave15Def.hp, 5000);
assert.strictEqual(context.wave15Def.coins, 1000);
context.spawnWarden(context.wave15Def);
context.bossActive = true;
assert(scene.children.includes(context.bossMesh));
assert.strictEqual(context.bossData.phase, 1);
assert.strictEqual(context.bossData.phaseLabel, 'PLASMA ASSAULT');
assert(context.player.children.includes(context.bossData.freezeShell), 'freeze visual was not attached to the player');

let hp = context.bossData.currentHp;
context.damageBossTarget(100, false, context.bossMesh.position.clone(), { silentNumber: true });
assert.strictEqual(context.bossData.currentHp, hp - 100, 'phase-one damage should be unrestricted');

context.bossData.beamTimer = 0;
context.updateWarden(0.016);
assert(context.bossData.activeAttack, 'phase one did not start its plasma beam');
assert.strictEqual(context.bossData.activeAttack.type, 'warden-plasma-beam');
assert.strictEqual(context.bossData.activeAttack.state, 'warning');
assert(context.bossData.activeAttack.timer > 0.5, 'plasma beam warning is not readable');
assert(context.bossData.beamTimer > 1.9 && context.bossData.beamTimer <= 2, 'plasma beam cadence is not two seconds');

const beam = context.bossData.activeAttack;
context.player.position.copy(context.bossMesh.position).addScaledVector(beam.direction, 5);
context.player.position.y = 0.75;
hp = context.stats.hp;
context.updateWardenPlasmaBeam(0.6);
assert.strictEqual(beam.state, 'firing');
assert.strictEqual(context.stats.hp, hp - 32, 'plasma beam failed to damage a player in its firing lane');
context.updateWardenPlasmaBeam(0.2);
assert.strictEqual(context.bossData.activeAttack, null, 'plasma beam was not cleaned up after firing');

context.bossData.currentHp = 2500;
context.updateWarden(0.016);
assert.strictEqual(context.bossData.phase, 2, 'phase two should begin at exactly 50% health');
assert.strictEqual(context.bossData.phaseLabel, 'CRYO MIRROR');
assert.strictEqual(context.bossData.clones.length, 2, 'phase transition did not create exactly two clones');
assert.strictEqual(context.enemies.length, 0, 'Warden clones must not enter the normal enemy/damage list');
for (const clone of context.bossData.clones) {
  assert(scene.children.includes(clone.mesh), 'clone projection was not added to the scene');
  assert(clone.cannon, 'clone projection is missing its attack cannon');
}

context.bossData.orbTimer = 0;
context.updateWarden(0.01);
assert.strictEqual(context.bossData.freezeOrbs.length, 3, 'Warden and both clones must fire a glowing ball');
assert(context.bossData.orbTimer > 4.9 && context.bossData.orbTimer <= 5, 'glowing-ball cadence is not five seconds');
for (const orb of context.bossData.freezeOrbs) {
  assert(scene.children.includes(orb.mesh), 'glowing ball was not added to the scene');
  assert(orb.mesh.children.length >= 3, 'glowing ball is missing its core, glow, or cage visual');
}

for (const orb of [...context.bossData.freezeOrbs]) context.removeWardenTransient(orb.mesh);
context.bossData.freezeOrbs.length = 0;
context.spawnWardenFreezeOrb(context.bossMesh);
const freezeOrb = context.bossData.freezeOrbs[0];
freezeOrb.mesh.position.copy(context.player.position);
freezeOrb.mesh.position.y = 0.78;
hp = context.stats.hp;
context.updateWardenFreezeOrbs(0.001);
assert.strictEqual(context.stats.hp, hp - 12, 'glowing ball did not damage the player');
assert(context.player.userData.frozenUntil > context.elapsedTime, 'glowing ball did not freeze the player');
assert(context.bossData.freezeShell.visible, 'freeze impact did not show the cryo shell');
assert.strictEqual(context.bossData.freezeOrbs.length, 0, 'glowing ball survived its player impact');
const frozenPosition = context.player.position.clone();
context.updatePlayer(0.016);
assert.strictEqual(context.player.position.x, frozenPosition.x, 'keyboard input moved the frozen player');
assert.strictEqual(context.player.position.z, frozenPosition.z, 'keyboard input moved the frozen player');

context.elapsedTime = context.player.userData.frozenUntil + 0.01;
context.updateWardenFreezeVisual(0.016);
assert.strictEqual(context.bossData.freezeShell.visible, false, 'freeze visual remained after the freeze expired');
context.updatePlayer(0.016);
assert(context.player.position.z < frozenPosition.z, 'player movement did not resume after the freeze expired');

const playerSource = read('js/player.js');
const weaponsSource = read('js/weapons-update.js');
assert(playerSource.includes('if (!isPlayerFrozen())'), 'movement does not respect the Warden freeze state');
assert(weaponsSource.includes('!isPlayerFrozen() && (isTouchDevice || mouseDown)'), 'active weapons do not respect the Warden freeze state');
assert(weaponsSource.includes('if (frozen) continue;'), 'orbital blades remain active while frozen');

const boss = context.bossMesh;
const shell = context.bossData.freezeShell;
const tracked = [
  ...context.bossData.transients.map(entry => entry.mesh || entry),
  ...context.bossData.clones.map(clone => clone.mesh),
];
context.player.userData.frozenUntil = context.elapsedTime + 10;
context.cleanupBoss();
assert.strictEqual(context.bossMesh, null);
assert.strictEqual(context.bossData, null);
assert.strictEqual(context.bossActive, false);
assert.strictEqual(context.player.userData.frozenUntil, 0, 'cleanup left the player frozen');
assert(!context.player.userData.freezeShell, 'cleanup retained the player freeze-shell reference');
assert(!shell.parent, 'cleanup left the freeze shell attached to the player');
assert(!scene.children.includes(boss));
for (const mesh of tracked) assert(!mesh.parent, 'cleanup leaked a Warden clone or transient');

console.log('Warden phase gate, two-second plasma, clone volley, five-second freeze, and cleanup tests passed.');
