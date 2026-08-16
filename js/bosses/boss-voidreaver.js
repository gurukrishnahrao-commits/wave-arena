// ============================================
// THE VOID REAVER — teleport ambushes and radial barrages (wave 15)
// ============================================

function buildMilestoneBoss(def, position) {
  showBossWarning(def);
  const mesh = buildLowPolyAlien({
    size: def.size, color: def.color, emissive: def.emissive,
    shape: 'sphere', shootInterval: def.shootInterval,
  });
  mesh.position.copy(position);
  mesh.position.y = def.size * 0.65;
  scene.add(mesh);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(def.size * 0.27, 1),
    new THREE.MeshStandardMaterial({
      color: def.coreColor, emissive: def.coreColor,
      emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.35,
    })
  );
  core.position.y = def.size * 0.1;
  mesh.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(def.size * 0.72, 0.07, 8, 28),
    new THREE.MeshBasicMaterial({ color: def.coreColor, transparent: true, opacity: 0.72 })
  );
  ring.rotation.x = Math.PI / 2;
  mesh.add(ring);

  return { mesh, core, ring };
}

function spawnVoidReaver(def) {
  const angle = Math.atan2(player.position.z, player.position.x) + Math.PI;
  const pos = new THREE.Vector3(Math.cos(angle) * 10, 0, Math.sin(angle) * 10);
  const parts = buildMilestoneBoss(def, pos);
  bossMesh = parts.mesh;
  bossData = {
    ...def, currentHp: def.hp, core: parts.core, ring: parts.ring,
    attackTimer: 1.5, teleportTimer: 4.5, teleportState: null,
    orbitAngle: angle, contactTimer: 0, enraged: false, transients: [],
  };
  flashCenterMsg('REALITY BREACH DETECTED', '#ff3df2');
  triggerScreenShake(0.45);
}

function updateVoidReaver(delta) {
  const bd = bossData;
  const mesh = bossMesh;
  bd.contactTimer = Math.max(0, bd.contactTimer - delta);
  bd.ring.rotation.z += delta * (bd.enraged ? 2.8 : 1.7);
  bd.core.rotation.y -= delta * 2.2;

  if (!bd.enraged && bd.currentHp <= bd.hp * 0.45) {
    bd.enraged = true;
    bd.teleportTimer = 0.8;
    flashCenterMsg('VOID REAVER UNBOUND', '#ff3df2');
    triggerScreenShake(0.45);
  }

  if (bd.teleportState) {
    updateReaverTeleport(delta);
  } else {
    bd.orbitAngle += delta * (bd.enraged ? 0.75 : 0.48);
    const radius = bd.enraged ? 5.2 : 7;
    const target = player.position.clone().add(new THREE.Vector3(
      Math.cos(bd.orbitAngle) * radius, mesh.position.y,
      Math.sin(bd.orbitAngle) * radius
    ));
    mesh.position.lerp(target, frameLerp(0.02, delta));

    bd.teleportTimer -= delta;
    if (bd.teleportTimer <= 0) startReaverTeleport();

    bd.attackTimer -= delta;
    if (bd.attackTimer <= 0) {
      fireReaverFan();
      bd.attackTimer = bd.enraged ? 0.72 : 1.18;
    }
  }

  mesh.lookAt(player.position.x, mesh.position.y, player.position.z);
  if (flatDist(mesh.position, player.position) < bd.size * 0.68 && bd.contactTimer <= 0 && invincibleTimer <= 0) {
    stats.hp -= bd.damage;
    bd.contactTimer = 0.9;
    triggerHealthFlash();
  }

  checkBossProjectileHits(bd, bd.size * 0.62);
  updateBossHPBar(bd);
  if (bd.currentHp <= 0) killBoss();
}

function startReaverTeleport() {
  const bd = bossData;
  const a = Math.random() * Math.PI * 2;
  const r = 4.5 + Math.random() * 3.5;
  const destination = player.position.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  const len = Math.hypot(destination.x, destination.z);
  if (len > CONFIG.ARENA_RADIUS - 3) destination.multiplyScalar((CONFIG.ARENA_RADIUS - 3) / len);

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 1.55, 28),
    new THREE.MeshBasicMaterial({ color: 0xff3df2, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.copy(destination);
  marker.position.y = 0.05;
  scene.add(marker);
  bd.transients.push(marker);
  bd.teleportState = { timer: 0.75, destination, marker };
  setBossOpacity(bossMesh, 0.28);
}

function updateReaverTeleport(delta) {
  const bd = bossData;
  const state = bd.teleportState;
  state.timer -= delta;
  state.marker.rotation.z += delta * 4;
  state.marker.material.opacity = 0.28 + Math.sin(performance.now() * 0.02) * 0.18;
  state.marker.scale.multiplyScalar(1 + delta * 0.42);

  if (state.timer <= 0) {
    spawnDeathParticles(bossMesh.position.clone(), 0xff3df2);
    bossMesh.position.set(state.destination.x, bd.size * 0.65, state.destination.z);
    spawnDeathParticles(bossMesh.position.clone(), 0xff3df2);
    setBossOpacity(bossMesh, 1);
    removeAndDispose(state.marker);
    bd.transients = bd.transients.filter(t => t !== state.marker);
    bd.teleportState = null;
    bd.teleportTimer = bd.enraged ? 2.7 : 4.2;
    fireReaverRadial();
    triggerScreenShake(0.28);
  }
}

function setBossOpacity(mesh, opacity) {
  mesh.traverse(child => {
    if (!child.material) return;
    child.material.transparent = opacity < 1;
    child.material.opacity = opacity;
  });
}

function fireReaverFan() {
  const count = bossData.enraged ? 7 : 5;
  const base = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  base.y = 0;
  if (base.lengthSq() < 0.01) base.set(1, 0, 0);
  base.normalize();
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * 0.14;
    const dir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
    spawnEnemyProjectile(bossMesh.position.clone(), dir, {
      speed: bossData.projectileSpeed, damage: bossData.projectileDamage, color: 0xff3df2,
    });
  }
  AudioManager.enemyShoot();
}

function fireReaverRadial() {
  const count = bossData.enraged ? 16 : 12;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawnEnemyProjectile(bossMesh.position.clone(), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), {
      speed: bossData.projectileSpeed * 0.9, damage: bossData.projectileDamage, color: 0x9c3dff,
    });
  }
  AudioManager.explosion();
}
