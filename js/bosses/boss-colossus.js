// ============================================
// THE VOID COLOSSUS
// ============================================

function spawnColossus(def) {
  showBossWarning(def);

  if (ambientLight) ambientLight.intensity = 0.3;

  bossMesh = buildLowPolyAlien({
    size: def.size, color: def.color, emissive: def.emissive,
    shape: 'box', fuseRange: 1,
  });
  bossMesh.position.set(0, def.size, 0);
  scene.add(bossMesh);

  const ringGeo = new THREE.TorusGeometry(def.size * 1.4, 0.15, 5, 8);
  const ringMat = new THREE.MeshBasicMaterial({ color: def.color });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  bossMesh.add(ring);

  bossData = {
    ...def,
    currentHp: def.hp,
    ring,
    slamTimer: def.slamCooldown,
    phase: 1,
    enraged: false,
  };

  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    spawnDeathParticles(new THREE.Vector3(Math.cos(a) * 3, 0.5, Math.sin(a) * 3), def.color);
  }
  triggerScreenShake(0.5);
}

function updateColossusBoss(delta) {
  const bd = bossData;
  const toPlayer = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  toPlayer.y = 0;
  const dist = toPlayer.length();
  const dir = toPlayer.clone().normalize();

  // Enrage at 50%
  if (!bd.enraged && bd.currentHp <= bd.hp * 0.5) {
    bd.enraged = true;
    bd.speed *= 1.6;
    bd.slamCooldown *= 0.6;
    bossMesh.material.emissiveIntensity = 1.2;
    flashCenterMsg('ENRAGED!', '#ff3d6e');
    triggerScreenShake(0.4);
  }

  // Move
  bossMesh.position.x += dir.x * bd.speed;
  bossMesh.position.z += dir.z * bd.speed;
  bossMesh.rotation.y += delta * (bd.enraged ? 1.5 : 0.8);
  bd.ring.rotation.x += delta * 2;

  // Melee
  if (dist < bd.size + 0.8 && invincibleTimer <= 0) {
    stats.hp -= bd.damage * delta;
    triggerHealthFlash();
    triggerScreenShake(0.4);
  }

  // Slam
  bd.slamTimer -= delta;
  if (bd.slamTimer <= 0) {
    bd.slamTimer = bd.slamCooldown;
    const sGeo = new THREE.RingGeometry(0.3, bd.slamRange, 32);
    const sMat = new THREE.MeshBasicMaterial({ color: bd.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const slam = new THREE.Mesh(sGeo, sMat);
    slam.rotation.x = -Math.PI / 2;
    slam.position.copy(bossMesh.position);
    slam.position.y = 0.1;
    slam.userData = { life: 0.5, maxLife: 0.5, expand: true };
    scene.add(slam);
    particles.push(slam);
    triggerScreenShake(0.3);
    AudioManager.explosion();
    if (dist < bd.slamRange && invincibleTimer <= 0) {
      stats.hp -= bd.damage * 0.5;
      triggerHealthFlash();
    }
  }

  updateBossHPBar(bd);

  // Projectile hits
  checkBossProjectileHits(bd, bd.size + 0.3);

  if (bd.currentHp <= 0) killBoss();
}