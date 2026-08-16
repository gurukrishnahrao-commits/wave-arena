// ============================================
// THE SOVEREIGN CORE — phase-shifting final boss (wave 25)
// ============================================

function spawnSovereignCore(def) {
  const parts = buildMilestoneBoss(def, new THREE.Vector3(0, 0, -10));
  bossMesh = parts.mesh;

  const corona = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const ray = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 1.35, 4),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd03d : 0xff3d6e })
    );
    const a = i / 10 * Math.PI * 2;
    ray.position.set(Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75);
    ray.rotation.z = Math.PI / 2;
    ray.rotation.y = -a;
    corona.add(ray);
  }
  bossMesh.add(corona);

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(def.size * 0.9, 0.11, 8, 36),
    new THREE.MeshBasicMaterial({ color: 0xff3d6e, transparent: true, opacity: 0.78 })
  );
  outerRing.rotation.z = Math.PI / 2;
  bossMesh.add(outerRing);

  bossData = {
    ...def, currentHp: def.hp, core: parts.core, ring: parts.ring,
    corona, outerRing, phase: 1, orbitAngle: -Math.PI / 2,
    attackTimer: 1.15, attackIndex: 0, contactTimer: 0,
    phase2Triggered: false, phase3Triggered: false,
    hazards: [], transients: [],
  };
  flashCenterMsg('THE SOVEREIGN CORE AWAKENS', '#ffd03d');
  triggerColorFlash('rgba(255,40,70,0.35)', 120, 450);
  triggerScreenShake(0.7);
}

function updateSovereignCore(delta) {
  const bd = bossData;
  const mesh = bossMesh;
  const hpRatio = bd.currentHp / bd.hp;
  bd.phase = hpRatio <= 0.32 ? 3 : hpRatio <= 0.67 ? 2 : 1;
  bd.contactTimer = Math.max(0, bd.contactTimer - delta);
  bd.corona.rotation.y += delta * (0.7 + bd.phase * 0.35);
  bd.outerRing.rotation.x += delta * 0.8;
  bd.ring.rotation.z -= delta * (1.6 + bd.phase * 0.45);
  bd.core.scale.setScalar(1 + Math.sin(elapsedTime * (3 + bd.phase)) * 0.11);

  if (!bd.phase2Triggered && bd.phase >= 2) {
    bd.phase2Triggered = true;
    bd.attackTimer = 0.25;
    summonSovereignGuard(3);
    flashCenterMsg('SOVEREIGN PHASE II — REALITY COLLAPSES', '#ff7a3d');
    triggerScreenShake(0.6);
  }
  if (!bd.phase3Triggered && bd.phase >= 3) {
    bd.phase3Triggered = true;
    bd.attackTimer = 0.15;
    summonSovereignGuard(4);
    for (let i = 0; i < 3; i++) spawnSovereignHazard(i * Math.PI * 2 / 3);
    flashCenterMsg('FINAL PROTOCOL — ANNIHILATION', '#ff3d6e');
    triggerColorFlash('rgba(255,30,55,0.45)', 100, 500);
    triggerScreenShake(0.8);
  }

  bd.orbitAngle += delta * (0.2 + bd.phase * 0.08);
  const radius = 7.5 - bd.phase * 0.6;
  const desired = new THREE.Vector3(
    Math.cos(bd.orbitAngle) * radius,
    bd.size * 0.7 + Math.sin(elapsedTime * 0.7) * 0.45,
    Math.sin(bd.orbitAngle) * radius
  );
  mesh.position.lerp(desired, frameLerp(0.016 + bd.phase * 0.003, delta));
  mesh.lookAt(player.position.x, mesh.position.y, player.position.z);

  bd.attackTimer -= delta;
  if (bd.attackTimer <= 0) {
    bd.attackIndex++;
    if (bd.attackIndex % 3 === 0) {
      const hazards = bd.phase === 3 ? 3 : bd.phase;
      for (let i = 0; i < hazards; i++) spawnSovereignHazard(i * 0.8);
    } else if (bd.attackIndex % 3 === 1) {
      fireSovereignSpiral();
    } else {
      fireSovereignVolley();
    }
    bd.attackTimer = Math.max(0.58, 1.35 - bd.phase * 0.2);
  }

  updateSovereignHazards(delta);

  if (flatDist(mesh.position, player.position) < bd.size * 0.68 && bd.contactTimer <= 0 && invincibleTimer <= 0) {
    stats.hp -= bd.damage;
    bd.contactTimer = 0.85;
    triggerHealthFlash();
  }

  checkBossProjectileHits(bd, bd.size * 0.64);
  updateBossHPBar(bd);
  if (bd.currentHp <= 0) killBoss();
}

function fireSovereignSpiral() {
  const bd = bossData;
  const count = 9 + bd.phase * 3;
  const base = performance.now() * 0.0017;
  for (let i = 0; i < count; i++) {
    const a = base + i / count * Math.PI * 2;
    spawnEnemyProjectile(bossMesh.position.clone(), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), {
      speed: bd.projectileSpeed * (0.86 + (i % 2) * 0.16),
      damage: bd.projectileDamage, color: i % 2 ? 0xffd03d : 0xff3d6e,
    });
  }
  AudioManager.enemyShoot();
}

function fireSovereignVolley() {
  const bd = bossData;
  const base = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  base.y = 0;
  if (base.lengthSq() < 0.01) base.set(1, 0, 0); else base.normalize();
  const count = 3 + bd.phase * 2;
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * 0.12;
    spawnEnemyProjectile(bossMesh.position.clone(), base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread), {
      speed: bd.projectileSpeed * 1.15, damage: bd.projectileDamage + bd.phase * 2,
      color: 0xffffff,
    });
  }
  AudioManager.enemyShoot();
}

function spawnSovereignHazard(angleOffset = 0) {
  const bd = bossData;
  const aroundPlayer = 1.5 + Math.random() * 3.8;
  const a = Math.random() * Math.PI * 2 + angleOffset;
  const pos = player.position.clone().add(new THREE.Vector3(Math.cos(a) * aroundPlayer, 0, Math.sin(a) * aroundPlayer));
  clampToArena(pos, 2);
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 1.35, 28),
    new THREE.MeshBasicMaterial({ color: 0xff3d3d, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.copy(pos);
  marker.position.y = 0.06;
  scene.add(marker);
  const hazard = { mesh: marker, timer: bd.phase === 3 ? 0.72 : 0.95, radius: 1.45, damage: 24 + bd.phase * 6 };
  bd.hazards.push(hazard);
  bd.transients.push(hazard);
}

function updateSovereignHazards(delta) {
  const bd = bossData;
  for (let i = bd.hazards.length - 1; i >= 0; i--) {
    const hazard = bd.hazards[i];
    hazard.timer -= delta;
    hazard.mesh.rotation.z += delta * 3.5;
    hazard.mesh.material.opacity = 0.28 + Math.sin(performance.now() * 0.028) * 0.18;
    const scale = 1 + delta * 0.34;
    hazard.mesh.scale.multiplyScalar(scale);
    if (hazard.timer <= 0) {
      const pos = hazard.mesh.position.clone();
      if (flatDist(pos, player.position) < hazard.radius && invincibleTimer <= 0) {
        stats.hp -= hazard.damage;
        triggerHealthFlash();
      }
      spawnDeathParticles(pos, 0xff3d3d);
      spawnDeathParticles(pos, 0xffd03d);
      AudioManager.explosion();
      triggerScreenShake(0.35);
      removeAndDispose(hazard.mesh);
      bd.hazards.splice(i, 1);
      bd.transients = bd.transients.filter(t => t !== hazard);
    }
  }
}

function summonSovereignGuard(count) {
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const pos = bossMesh.position.clone().add(new THREE.Vector3(Math.cos(a) * 4, 0, Math.sin(a) * 4));
    pos.y = 0;
    const type = i % 3 === 0 ? 'healer' : i % 2 === 0 ? 'dasher' : 'splitter';
    spawnEnemyAt(type, pos, { hpMult: 1.45, speedMult: 1.05 });
  }
}
