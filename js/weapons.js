// ============================================
// WEAPONS — definitions and fire functions
// ============================================

const WEAPONS = [
  {
    id: 'pulse', name: 'PULSE RIFLE', icon: '🔵', slot: 'primary',
    desc: 'Reliable rapid-fire single shot. Consistent damage at range.',
    stats: { dmg: 5, aoe: 1, range: 3, speed: 5 },
    upgrade: { name: 'PIERCING ROUNDS', desc: 'Projectiles pierce through enemies', applied: false },
    timer: 0, interval: () => stats.attackSpeed,
    fire: fireWeaponPulse,
  },
  {
    id: 'shotgun', name: 'SHOTGUN', icon: '💢', slot: 'primary',
    desc: 'Fires a 5-pellet spread at close range. Devastating up close, weak at distance.',
    stats: { dmg: 4, aoe: 2, range: 2, speed: 3 },
    upgrade: { name: 'WIDE CHOKE', desc: '+2 pellets, wider spread', applied: false },
    timer: 0, interval: () => stats.attackSpeed * 1.6,
    fire: fireWeaponShotgun,
  },
  {
    id: 'sniper', name: 'SNIPER RAIL', icon: '🎯', slot: 'secondary',
    desc: 'Instant precision shot for massive damage at long range. Slow to recharge.',
    stats: { dmg: 5, aoe: 1, range: 5, speed: 1 },
    upgrade: { name: 'OVERCHARGED CELL', desc: '+50% damage', applied: false },
    timer: 0, interval: () => stats.attackSpeed * 3.2,
    fire: fireWeaponSniper,
  },
  {
    id: 'fireball', name: 'FIREBALL', icon: '🔴', slot: 'primary',
    desc: 'Slow heavy projectile. Explodes on impact, damages nearby enemies.',
    stats: { dmg: 4, aoe: 4, range: 2, speed: 1 },
    upgrade: { name: 'BURNING GROUND', desc: 'Leaves fire on impact for 2 seconds', applied: false },
    timer: 0, interval: () => stats.attackSpeed * 2,
    fire: fireWeaponFireball,
  },
  {
    id: 'rocket', name: 'ROCKET LAUNCHER', icon: '🚀', slot: 'primary',
    desc: 'Slow homing-free rocket, huge explosion radius and damage on impact.',
    stats: { dmg: 5, aoe: 5, range: 2, speed: 1 },
    upgrade: { name: 'CLUSTER WARHEAD', desc: '+60% explosion radius', applied: false },
    timer: 0, interval: () => stats.attackSpeed * 3,
    fire: fireWeaponRocket,
  },
  {
    id: 'plasma', name: 'PLASMA BEAM', icon: '🟦', slot: 'primary',
    desc: 'Locks onto the nearest enemy with a continuous beam. Steady, reliable DPS.',
    stats: { dmg: 2, aoe: 1, range: 4, speed: 5 },
    upgrade: { name: 'FOCUSED LENS', desc: '+50% beam damage', applied: false },
    timer: 0, interval: () => 99999,
    fire: fireWeaponPlasma,
  },
  {
    id: 'orbital', name: 'ORBITAL BLADES', icon: '🌀', slot: 'secondary',
    desc: 'Blades orbit you constantly dealing contact damage. Weak vs ranged enemies.',
    stats: { dmg: 2, aoe: 3, range: 1, speed: 5 },
    upgrade: { name: 'OVERCHARGE', desc: '2× rotation speed, +50% orbit radius', applied: false },
    timer: 0, interval: () => 99999,
    fire: fireWeaponOrbital,
  },
];

function getWeapon(id) { return WEAPONS.find(w => w.id === id); }

function equippedWeapons() {
  return [loadout.primary, loadout.secondary]
    .filter(Boolean)
    .map(id => getWeapon(id))
    .filter(Boolean);
}

// ---- PULSE RIFLE ----
function fireWeaponPulse() {
  const target = { position: player.position.clone().addScaledVector(aimDir, 1) };
  fireProjectile(target, getWeapon('pulse')?.upgrade.applied);
}

// ---- SHOTGUN ----
function fireWeaponShotgun() {
  const w = getWeapon('shotgun');
  const boosted = w?.upgrade.applied;
  const baseAngle = Math.atan2(aimDir.z, aimDir.x);
  const pelletCount = boosted ? 7 : 5;
  const spread = boosted ? 0.75 : 0.5;
  for (let i = 0; i < pelletCount; i++) {
    const a = baseAngle - spread / 2 + (spread / (pelletCount - 1)) * i;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    fireProjectileInDir(dir, { speed: 0.4, life: 0.6, dmgMult: 0.5, color: 0xffaa55 });
  }
  triggerMuzzleFlash();
  AudioManager.shoot();
}

// ---- SNIPER RAIL ----
function fireWeaponSniper() {
  const { enemy, dist } = findEnemyInCone(stats.attackRange * 3, 0.12);
  if (!enemy) return;
  const w = getWeapon('sniper');
  const boosted = w?.upgrade.applied;
  const isCrit = Math.random() < stats.critChance;
  const dmg = Math.round(stats.attackDamage * (isCrit ? 6 : 4) * (boosted ? 1.5 : 1));
  enemy.userData.hp -= dmg;
  flashEnemy(enemy);
  spawnDamageNumber(enemy.position.clone().add(new THREE.Vector3(0, 1.2, 0)), dmg, isCrit);
  if (isCrit) { triggerScreenShake(0.15); AudioManager.critHit(); }
  else { AudioManager.hit(); }

  const points = [player.position.clone().setY(0.7), enemy.position.clone().setY(0.7)];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 1 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  railBeams.push({ mesh: line, life: 0.15 });
  triggerMuzzleFlash();
}

// ---- FIREBALL ----
function fireWeaponFireball() {
  const geo = new THREE.SphereGeometry(0.35, 6, 5);
  const mat = new THREE.MeshStandardMaterial({
    flatShading: true, color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1.5
  });
  const ball = new THREE.Mesh(geo, mat);
  ball.position.copy(player.position);
  ball.position.y = 0.8;
  const dir = aimDir.clone();
  ball.userData = { dir, speed: 0.12, life: 5 };
  scene.add(ball);
  fireballs.push(ball);
  triggerMuzzleFlash();
  AudioManager.shoot();
}

// ---- ROCKET LAUNCHER ----
function fireWeaponRocket() {
  const geo = new THREE.CylinderGeometry(0.12, 0.16, 0.5, 6);
  const mat = new THREE.MeshStandardMaterial({
    flatShading: true, color: 0xffa500, emissive: 0xaa4400, emissiveIntensity: 1.2
  });
  const rocket = new THREE.Mesh(geo, mat);
  rocket.position.copy(player.position);
  rocket.position.y = 0.8;
  const dir = aimDir.clone();
  rocket.userData = { dir, speed: 0.16, life: 5 };
  rocket.rotation.x = Math.PI / 2;
  rocket.rotation.z = Math.atan2(dir.x, dir.z);
  scene.add(rocket);
  rockets.push(rocket);
  triggerMuzzleFlash();
  AudioManager.shoot();
}

// ---- PLASMA BEAM ----
function fireWeaponPlasma() {
  // Self-managed in updatePlasmaBeam
}

// ---- ORBITAL BLADES ----
function fireWeaponOrbital() {
  // Remove existing blades first to prevent duplicates
  orbitalBlades.forEach(b => scene.remove(b));
  orbitalBlades.length = 0;

  for (let i = 0; i < 3; i++) {
    const geo = new THREE.BoxGeometry(0.6, 0.08, 0.15);
    const mat = new THREE.MeshStandardMaterial({
      flatShading: true, color: 0xcc44ff, emissive: 0x6600cc, emissiveIntensity: 0.8
    });
    const blade = new THREE.Mesh(geo, mat);
    blade.userData = { angleOffset: (i / 3) * Math.PI * 2, hitCooldowns: new Map() };
    scene.add(blade);
    orbitalBlades.push(blade);
  }
}