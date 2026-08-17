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
const enemyShots = [];
const reinforcements = [];

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
  CONFIG: { ARENA_RADIUS: 18 },
  player: new THREE.Object3D(),
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
  stats: { hp: 240, maxHP: 240, critChance: 0.2, attackDamage: 8 },
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
  spawnEnemyProjectile(position, direction, options) { enemyShots.push({ position, direction, options }); },
  spawnEnemyAt(type, position, options) { reinforcements.push({ type, position, options }); },
  AudioManager: { enemyShoot() {}, explosion() {}, setMusicMode() {}, bossWarning() {} },
  flatDist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); },
  frameScale(delta) { return delta * 60; },
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

let hp = context.bossData.currentHp;
context.damageBossTarget(100, false, context.bossMesh.position.clone(), { silentNumber: true });
assert.strictEqual(context.bossData.currentHp, hp - 100, 'phase-one damage should be unrestricted');

context.bossData.currentHp = 2999;
context.updateWarden(0.016);
assert.strictEqual(context.bossData.phase, 2);
assert.strictEqual(context.bossData.nodes.length, 4);
assert.strictEqual(context.enemies.filter(enemy => enemy.userData.wardenNode).length, 4);
hp = context.bossData.currentHp;
context.damageBossTarget(100, false, context.bossMesh.position.clone(), { silentNumber: true });
assert.strictEqual(context.bossData.currentHp, hp - 15, 'live nodes should reduce Warden damage by 85%');

for (const node of context.bossData.nodes) node.mesh.userData.hp = 0;
context.updateWarden(0.016);
assert.strictEqual(context.bossData.lockdownCleared, true);
assert.strictEqual(context.bossData.damageMultiplier, 1);
assert.strictEqual(context.enemies.filter(enemy => enemy.userData.wardenNode).length, 0);

context.bossData.currentHp = 1249;
context.updateWarden(0.016);
assert.strictEqual(context.bossData.phase, 3);
assert.strictEqual(context.bossData.damageMultiplier, 0.15);
context.player.position.set(14, 0.75, 0);
context.startWardenSlam();
assert(context.bossData.activeAttack && context.bossData.activeAttack.timer >= 0.9, 'slam needs a readable warning');
context.updateWardenSlam(1.1);
assert.strictEqual(context.bossData.activeAttack, null);
assert.strictEqual(context.bossData.damageMultiplier, 1.35, 'slam should open the overdrive damage window');
hp = context.bossData.currentHp;
context.damageBossTarget(100, false, context.bossMesh.position.clone(), { silentNumber: true });
assert.strictEqual(context.bossData.currentHp, hp - 135);
context.updateWardenVulnerability(3.2);
assert.strictEqual(context.bossData.damageMultiplier, 0.15, 'armor should close after the punish window');

const shotCount = enemyShots.length;
context.fireWardenRadial();
assert.strictEqual(enemyShots.length - shotCount, 12, 'overdrive radial attack should cover the arena');
context.summonWardenReinforcements(3);
assert.strictEqual(reinforcements.length, 3);
context.spawnWardenShockwave();
assert.strictEqual(context.bossData.shockwaves.length, 1);
let shockwave = context.bossData.shockwaves[0];
assert.strictEqual(shockwave.charge, 0.5, 'shockwave should telegraph before expansion');
let playerDistance = context.flatDist(shockwave.origin, context.player.position);
shockwave.charge = 0;
shockwave.radius = playerDistance - 0.5;
shockwave.lastPlayerDistance = playerDistance + 0.2;
hp = context.stats.hp;
context.updateWardenShockwaves(0.01);
assert.strictEqual(context.stats.hp, hp, 'timed inward cut did not evade the shockwave');
context.spawnWardenShockwave();
shockwave = context.bossData.shockwaves[1];
playerDistance = context.flatDist(shockwave.origin, context.player.position);
shockwave.charge = 0;
shockwave.radius = playerDistance - 0.5;
shockwave.lastPlayerDistance = playerDistance;
context.updateWardenShockwaves(0.01);
assert(context.stats.hp < hp, 'shockwave did not punish a mistimed crossing');

const boss = context.bossMesh;
const tracked = [
  ...context.bossData.transients.map(entry => entry.mesh || entry),
  ...context.bossData.nodes.map(node => node.mesh),
];
context.cleanupBoss();
assert.strictEqual(context.bossMesh, null);
assert.strictEqual(context.bossData, null);
assert.strictEqual(context.bossActive, false);
assert(!scene.children.includes(boss));
for (const mesh of tracked) assert(!mesh.parent, 'cleanup leaked a Warden node or transient');

console.log('Warden routing, phase gates, nodes, armor windows, pressure attacks, and cleanup tests passed.');
