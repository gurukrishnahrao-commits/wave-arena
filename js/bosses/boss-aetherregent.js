// ============================================
// THE AETHER REGENT — cyclic shields and telegraphed beams (wave 20)
// ============================================

function spawnAetherRegent(def) {
  const pos = new THREE.Vector3(-9, 0, 7);
  const parts = buildMilestoneBoss(def, pos);
  bossMesh = parts.mesh;

  const crown = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.9, 5),
      new THREE.MeshBasicMaterial({ color: def.coreColor })
    );
    const a = i / 6 * Math.PI * 2;
    shard.position.set(Math.cos(a) * 1.25, def.size * 0.58, Math.sin(a) * 1.25);
    shard.rotation.z = Math.PI;
    crown.add(shard);
  }
  bossMesh.add(crown);

  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(def.size * 0.88, 1),
    new THREE.MeshBasicMaterial({ color: 0x38f8ff, wireframe: true, transparent: true, opacity: 0 })
  );
  bossMesh.add(shieldMesh);

  bossData = {
    ...def, currentHp: def.hp, core: parts.core, ring: parts.ring, crown, shieldMesh,
    attackTimer: 1.4, shieldCooldown: 5.5, shieldActive: false,
    shieldHp: 0, maxShieldHp: 0, beam: null, orbitAngle: 2.4,
    contactTimer: 0, supportWave: 0, phase: 1, transients: [],
  };
  flashCenterMsg('AETHER THRONE ONLINE', '#38f8ff');
  triggerScreenShake(0.5);
}

function updateAetherRegent(delta) {
  const bd = bossData;
  const mesh = bossMesh;
  const hpRatio = bd.currentHp / bd.hp;
  bd.phase = hpRatio <= 0.33 ? 3 : hpRatio <= 0.68 ? 2 : 1;
  bd.contactTimer = Math.max(0, bd.contactTimer - delta);
  bd.ring.rotation.z += delta * (1.4 + bd.phase * 0.5);
  bd.crown.rotation.y -= delta * (0.7 + bd.phase * 0.2);
  bd.shieldMesh.rotation.y += delta * 0.8;

  bd.orbitAngle -= delta * (0.25 + bd.phase * 0.07);
  const desired = player.position.clone().add(new THREE.Vector3(
    Math.cos(bd.orbitAngle) * 8, bd.size * 0.65,
    Math.sin(bd.orbitAngle) * 8
  ));
  mesh.position.lerp(desired, frameLerp(0.018, delta));
  mesh.lookAt(player.position.x, mesh.position.y, player.position.z);

  if (bd.supportWave < 1 && hpRatio <= 0.68) {
    bd.supportWave = 1;
    summonRegentEscort(2);
    flashCenterMsg('REGENT CALLS THE AETHER GUARD', '#38f8ff');
  }
  if (bd.supportWave < 2 && hpRatio <= 0.33) {
    bd.supportWave = 2;
    summonRegentEscort(3);
    flashCenterMsg('THE THRONE WILL NOT FALL', '#ff3d6e');
  }

  if (bd.shieldActive) {
    if (bd.shieldHp <= 0) breakRegentShield();
  } else {
    bd.shieldCooldown -= delta;
    if (bd.shieldCooldown <= 0) activateRegentShield();
  }

  if (bd.beam) updateRegentBeam(delta);
  else {
    bd.attackTimer -= delta;
    if (bd.attackTimer <= 0) {
      if (Math.random() < (bd.phase >= 2 ? 0.48 : 0.3)) startRegentBeam();
      else fireRegentLattice();
      bd.attackTimer = Math.max(0.72, 1.4 - bd.phase * 0.16);
    }
  }

  if (flatDist(mesh.position, player.position) < bd.size * 0.66 && bd.contactTimer <= 0 && invincibleTimer <= 0) {
    stats.hp -= bd.damage;
    bd.contactTimer = 1;
    triggerHealthFlash();
  }

  checkBossProjectileHits(bd, bd.size * 0.63);
  updateBossHPBar(bd);
  if (bd.currentHp <= 0) killBoss();
}

function activateRegentShield() {
  const bd = bossData;
  bd.shieldActive = true;
  bd.maxShieldHp = Math.round(bd.hp * (0.11 + bd.phase * 0.025));
  bd.shieldHp = bd.maxShieldHp;
  bd.shieldMesh.material.opacity = 0.4;
  document.getElementById('boss-shield-bar').style.display = 'block';
  document.getElementById('boss-shield-fill').style.width = '100%';
  flashCenterMsg('AETHER WARD — BREAK THE SHIELD', '#38f8ff');
}

function breakRegentShield() {
  const bd = bossData;
  if (!bd.shieldActive) return;
  bd.shieldActive = false;
  bd.shieldMesh.material.opacity = 0;
  document.getElementById('boss-shield-bar').style.display = 'none';
  bd.shieldCooldown = Math.max(4, 7.5 - bd.phase);
  bd.attackTimer += 0.7;
  triggerScreenShake(0.35);
  spawnDeathParticles(bossMesh.position.clone(), 0x38f8ff);
  flashCenterMsg('AETHER WARD SHATTERED', '#ffd23d');
}

function fireRegentLattice() {
  const bd = bossData;
  const count = 5 + bd.phase * 2;
  const offset = performance.now() * 0.001;
  for (let i = 0; i < count; i++) {
    const a = offset + i / count * Math.PI * 2;
    spawnEnemyProjectile(bossMesh.position.clone(), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), {
      speed: bd.projectileSpeed, damage: bd.projectileDamage, color: 0x38f8ff,
    });
  }
  const aimed = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  aimed.y = 0;
  if (aimed.lengthSq() > 0.01) {
    aimed.normalize();
    spawnEnemyProjectile(bossMesh.position.clone(), aimed, {
      speed: bd.projectileSpeed * 1.15, damage: bd.projectileDamage + 3, color: 0xffffff,
    });
  }
  AudioManager.enemyShoot();
}

function startRegentBeam() {
  const bd = bossData;
  const dir = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(1, 0, 0); else dir.normalize();
  const length = CONFIG.ARENA_RADIUS * 2;
  const geo = new THREE.BoxGeometry(length, 0.035, 0.18);
  geo.translate(length / 2, 0, 0);
  const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x38f8ff, transparent: true, opacity: 0.18,
  }));
  scene.add(beam);
  bd.transients.push(beam);
  bd.beam = { mesh: beam, dir, timer: bd.phase === 3 ? 0.65 : 0.9, fired: false };
  orientRegentBeam(bd.beam);
  flashCenterMsg('⚠ AETHER BEAM LOCK ⚠', '#38f8ff');
}

function orientRegentBeam(beam) {
  beam.mesh.position.copy(bossMesh.position);
  beam.mesh.position.y = 0.12;
  beam.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), beam.dir);
}

function updateRegentBeam(delta) {
  const bd = bossData;
  const beam = bd.beam;
  beam.timer -= delta;
  orientRegentBeam(beam);
  beam.mesh.material.opacity = beam.fired ? 0.95 : 0.2 + Math.sin(performance.now() * 0.025) * 0.12;
  beam.mesh.scale.z = beam.fired ? 5.2 : 0.8 + Math.max(0, 0.9 - beam.timer);

  if (!beam.fired && beam.timer <= 0) {
    beam.fired = true;
    beam.timer = 0.22;
    triggerScreenShake(0.48);
    AudioManager.explosion();
    const toPlayer = new THREE.Vector3().subVectors(player.position, bossMesh.position);
    toPlayer.y = 0;
    const along = toPlayer.dot(beam.dir);
    const perp = toPlayer.clone().sub(beam.dir.clone().multiplyScalar(along)).length();
    if (along > 0 && perp < 1.15 && invincibleTimer <= 0) {
      stats.hp -= bd.damage + 10;
      triggerHealthFlash();
    }
  } else if (beam.fired && beam.timer <= 0) {
    removeAndDispose(beam.mesh);
    bd.transients = bd.transients.filter(t => t !== beam.mesh);
    bd.beam = null;
  }
}

function summonRegentEscort(count) {
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2 + Math.random();
    const pos = bossMesh.position.clone().add(new THREE.Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3));
    pos.y = 0;
    spawnEnemyAt(i === 0 ? 'healer' : 'shooter', pos, { scale: 1.05, hpMult: 1.3 });
  }
}
