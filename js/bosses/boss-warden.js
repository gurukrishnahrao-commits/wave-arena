// ============================================
// THE WARDEN — three-phase area-control boss (wave 15)
// ============================================

function spawnWarden(def) {
  const away = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), player.position);
  if (away.lengthSq() < 0.01) away.set(1, 0, 0);
  away.normalize().multiplyScalar(9);
  const parts = buildMilestoneBoss(def, away);
  bossMesh = parts.mesh;

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x1c314d, emissive: 0x0b2f4b, emissiveIntensity: 0.75,
    metalness: 0.82, roughness: 0.24, flatShading: true,
  });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x64e7ff, transparent: true, opacity: 0.85 });

  const shoulders = new THREE.Group();
  for (const side of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.62, 1.15), armorMat);
    plate.position.set(side * 1.45, 0.72, 0);
    plate.rotation.z = side * -0.16;
    shoulders.add(plate);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 1.2), edgeMat);
    edge.position.set(side * 1.45, 1.02, 0);
    edge.rotation.z = side * -0.16;
    shoulders.add(edge);
  }
  bossMesh.add(shoulders);

  const hammer = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.5, 7), armorMat);
  handle.position.y = -0.7;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.85, 0.9), armorMat);
  head.position.y = 1.05;
  const headCore = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.94), edgeMat);
  headCore.position.set(0, 1.05, 0);
  hammer.add(handle, head, headCore);
  hammer.position.set(2.25, -0.15, 0.25);
  hammer.rotation.z = -0.42;
  bossMesh.add(hammer);

  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(def.size * 0.92, 1),
    new THREE.MeshBasicMaterial({ color: 0x39d9ff, wireframe: true, transparent: true, opacity: 0 })
  );
  bossMesh.add(shieldMesh);
  setObjectShadows(shoulders, getGameSettings().quality !== 'low');
  setObjectShadows(hammer, getGameSettings().quality !== 'low');

  bossData = {
    ...def,
    currentHp: def.hp,
    core: parts.core,
    ring: parts.ring,
    shoulders,
    hammer,
    shieldMesh,
    shieldActive: false,
    damageMultiplier: 1,
    phase: 1,
    phaseLabel: 'HUNT',
    contactTimer: 0,
    burstTimer: 1.4,
    burstShots: 0,
    burstShotTimer: 0,
    slamTimer: 3.6,
    shockwaveTimer: 7.2,
    radialTimer: 3,
    reinforcementTimer: 7.5,
    hazardTimer: 5,
    vulnerableTimer: 0,
    lockdownCleared: false,
    nodes: [],
    beams: [],
    shockwaves: [],
    hazards: [],
    transients: [],
    activeAttack: null,
  };

  flashCenterMsg('WARDEN PROTOCOL · PHASE I: HUNT', '#64e7ff');
  triggerScreenShake(0.55);
  updateWardenArmorUI(bossData);
}

function updateWarden(delta) {
  const bd = bossData;
  const mesh = bossMesh;
  if (!bd || !mesh) return;

  const hpRatio = bd.currentHp / bd.hp;
  if (bd.phase === 1 && hpRatio <= 0.6) enterWardenLockdown();
  if (bd.phase === 2 && hpRatio <= 0.25) enterWardenOverdrive();

  bd.contactTimer = Math.max(0, bd.contactTimer - delta);
  bd.ring.rotation.z += delta * (bd.phase === 3 ? 3.8 : 1.8);
  bd.core.rotation.y -= delta * (bd.phase === 3 ? 4.2 : 2.1);
  bd.shieldMesh.rotation.y += delta * 1.4;
  bd.shoulders.rotation.y = Math.sin(elapsedTime * 1.8) * 0.035;
  bd.hammer.rotation.x = Math.sin(elapsedTime * 2.2) * 0.04;

  if (bd.phase === 3) updateWardenVulnerability(delta);
  updateWardenNodes(delta);
  updateWardenBeams(delta);
  updateWardenShockwaves(delta);
  updateWardenHazards(delta);

  if (bd.activeAttack) {
    updateWardenSlam(delta);
  } else {
    bd.hammer.rotation.z += (-0.42 - bd.hammer.rotation.z) * Math.min(1, delta * 8);
    moveWarden(delta);
    bd.slamTimer -= delta;
    if (bd.slamTimer <= 0) startWardenSlam();
  }

  updateWardenBurst(delta);

  bd.shockwaveTimer -= delta;
  if (bd.shockwaveTimer <= 0) {
    spawnWardenShockwave();
    bd.shockwaveTimer = bd.phase === 3 ? 6.2 : (bd.phase === 2 ? 8.2 : 9.4);
  }

  if (bd.phase >= 2) updateWardenReinforcements(delta);
  if (bd.phase === 3) {
    bd.radialTimer -= delta;
    if (bd.radialTimer <= 0) {
      fireWardenRadial();
      bd.radialTimer = 3.25;
    }
    bd.hazardTimer -= delta;
    if (bd.hazardTimer <= 0) {
      spawnWardenLockZone();
      bd.hazardTimer = 5.4;
    }
  }

  if (flatDist(mesh.position, player.position) < bd.size * 0.66 && bd.contactTimer <= 0) {
    hurtPlayer(bd.phase === 3 ? bd.damage + 5 : bd.damage);
    bd.contactTimer = 1;
  }

  checkBossProjectileHits(bd, bd.size * 0.68);
  updateWardenArmorUI(bd);
  updateBossHPBar(bd);
  if (bd.currentHp <= 0) killBoss();
}

function moveWarden(delta) {
  const bd = bossData;
  const mesh = bossMesh;
  const step = frameScale(delta);
  let target;
  let speed = bd.speed;

  if (bd.phase === 2 && !bd.lockdownCleared) {
    target = new THREE.Vector3(0, mesh.position.y, 0);
    speed *= 0.72;
  } else {
    target = player.position.clone();
    target.y = mesh.position.y;
    if (bd.phase === 3) speed *= 2.35;
  }

  const dir = new THREE.Vector3().subVectors(target, mesh.position);
  dir.y = 0;
  const distance = dir.length();
  if (distance > (bd.phase === 2 && !bd.lockdownCleared ? 1.2 : 3.1)) {
    dir.normalize();
    mesh.position.addScaledVector(dir, speed * step);
  }
  clampToArena(mesh.position, 2.8);
  mesh.lookAt(player.position.x, mesh.position.y, player.position.z);
}

function updateWardenBurst(delta) {
  const bd = bossData;
  if (bd.activeAttack) return;
  if (bd.burstShots > 0) {
    bd.burstShotTimer -= delta;
    if (bd.burstShotTimer <= 0) {
      fireWardenBurstRound();
      bd.burstShots--;
      bd.burstShotTimer = 0.19;
    }
    return;
  }

  bd.burstTimer -= delta;
  if (bd.burstTimer <= 0) {
    bd.burstShots = 3;
    bd.burstShotTimer = 0;
    bd.burstTimer = bd.phase === 3 ? 2.45 : (bd.phase === 2 ? 3.4 : bd.shootInterval);
  }
}

function fireWardenBurstRound() {
  const bd = bossData;
  const dir = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
  dir.normalize();
  const fired = 3 - bd.burstShots;
  const spread = (fired - 1) * 0.035;
  const c = Math.cos(spread), s = Math.sin(spread);
  dir.set(dir.x * c - dir.z * s, 0, dir.x * s + dir.z * c).normalize();
  spawnEnemyProjectile(bossMesh.position.clone(), dir, {
    speed: bd.projectileSpeed * (bd.phase === 3 ? 1.18 : 1),
    damage: bd.projectileDamage + (bd.phase === 3 ? 4 : 0),
    color: 0x64e7ff,
    size: 0.16,
  });
  AudioManager.enemyShoot();
}

function startWardenSlam() {
  const bd = bossData;
  const radius = bd.phase === 3 ? 6.6 : (bd.phase === 2 ? 5.2 : 4.6);
  const warning = new THREE.Group();
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(radius, getGameSettings().quality === 'low' ? 24 : 48),
    new THREE.MeshBasicMaterial({ color: 0xff243d, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
  );
  fill.rotation.x = -Math.PI / 2;
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.16, radius, getGameSettings().quality === 'low' ? 24 : 48),
    new THREE.MeshBasicMaterial({ color: 0xff1838, transparent: true, opacity: 0.94, side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI / 2;
  warning.add(fill, rim);
  warning.position.set(bossMesh.position.x, 0.055, bossMesh.position.z);
  scene.add(warning);

  const duration = bd.phase === 3 ? 0.9 : 1.05;
  bd.activeAttack = { type: 'warden-slam', mesh: warning, timer: duration, duration, radius };
  bd.burstShots = 0;
  flashCenterMsg('⚠ GROUND SLAM · CLEAR THE RED ZONE ⚠', '#ff3d55');
}

function updateWardenSlam(delta) {
  const bd = bossData;
  const slam = bd.activeAttack;
  if (!slam) return;
  slam.timer -= delta;
  const progress = 1 - Math.max(0, slam.timer) / slam.duration;
  const pulse = 1 + Math.sin(progress * Math.PI * 8) * 0.035;
  slam.mesh.scale.set(pulse, 1, pulse);
  slam.mesh.traverse(child => {
    if (child.material) child.material.opacity = child.geometry?.type === 'RingGeometry'
      ? 0.72 + progress * 0.28
      : 0.1 + progress * 0.24;
  });
  bd.hammer.rotation.z = -0.42 - progress * 1.12;

  if (slam.timer > 0) return;
  const center = bossMesh.position.clone();
  if (flatDist(center, player.position) <= slam.radius) hurtPlayer(bd.damage + (bd.phase === 3 ? 10 : 0));
  removeAndDispose(slam.mesh);
  bd.activeAttack = null;
  bd.hammer.rotation.z = 0.28;
  triggerScreenShake(bd.phase === 3 ? 0.8 : 0.58);
  AudioManager.explosion();
  spawnDeathParticles(center.clone().setY(0.2), 0xff334f);
  spawnWardenSlamHazard(center, slam.radius);

  if (bd.phase === 3) openWardenArmor();
  bd.slamTimer = bd.phase === 3 ? 4.6 : (bd.phase === 2 ? 6 : 6.7);
}

function spawnWardenSlamHazard(center, slamRadius) {
  const bd = bossData;
  const radius = slamRadius * (bd.phase === 3 ? 0.68 : 0.55);
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, getGameSettings().quality === 'low' ? 20 : 40),
    new THREE.MeshBasicMaterial({ color: 0xb90f2d, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center.x, 0.035, center.z);
  scene.add(mesh);
  const hazard = { mesh, radius, timer: bd.phase === 3 ? 3.2 : 2.2, maxTimer: bd.phase === 3 ? 3.2 : 2.2, hitCooldown: 0, state: 'active' };
  bd.hazards.push(hazard);
  bd.transients.push(mesh);
}

function enterWardenLockdown() {
  const bd = bossData;
  bd.phase = 2;
  bd.phaseLabel = 'LOCKDOWN';
  bd.damageMultiplier = 0.15;
  bd.shieldActive = true;
  bd.burstShots = 0;
  bd.slamTimer = 3.2;
  bd.reinforcementTimer = 2.2;
  spawnWardenNodes();
  flashCenterMsg('PHASE II: LOCKDOWN · DESTROY ALL FOUR NODES', '#64e7ff');
  triggerColorFlash('rgba(57,217,255,0.32)', 120, 480);
  triggerScreenShake(0.72);
}

function spawnWardenNodes() {
  const bd = bossData;
  const positions = [
    new THREE.Vector3(10.8, 0, 0),
    new THREE.Vector3(0, 0, 10.8),
    new THREE.Vector3(-10.8, 0, 0),
    new THREE.Vector3(0, 0, -10.8),
  ];
  for (let i = 0; i < positions.length; i++) {
    const node = buildWardenNode(positions[i], i);
    bd.nodes.push(node);
    enemies.push(node.mesh); // Nodes participate in every weapon's standard targeting/damage path.
    scene.add(node.mesh);
  }
}

function buildWardenNode(position, index) {
  const group = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x133552, emissive: 0x126a88, emissiveIntensity: 0.8,
    metalness: 0.75, roughness: 0.25, flatShading: true,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x83f2ff, emissive: 0x39d9ff, emissiveIntensity: 2.2,
    metalness: 0.25, roughness: 0.2,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 0.42, 8), shellMat);
  base.position.y = 0.22;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), glowMat);
  core.position.y = 1.2;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.07, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x64e7ff, transparent: true, opacity: 0.86 })
  );
  ring.position.y = 1.2;
  ring.rotation.x = Math.PI / 2;
  group.add(base, core, ring);
  group.position.copy(position);
  group.material = glowMat;
  group.userData = {
    type: 'warden-node', hp: 220, maxHp: 220, speed: 0, damage: 0, coins: 0,
    spawning: false, shieldedUntil: 0, wardenNode: true,
  };
  setObjectShadows(group, getGameSettings().quality !== 'low');
  return { mesh: group, core, ring, index, beamTimer: 1.8 + index * 0.82, destroyed: false };
}

function updateWardenNodes(delta) {
  const bd = bossData;
  if (!bd.nodes.length || bd.lockdownCleared) return;
  let remaining = 0;
  for (const node of bd.nodes) {
    if (node.destroyed) continue;
    if (!node.mesh.parent || node.mesh.userData.hp <= 0) {
      destroyWardenNode(node);
      continue;
    }
    remaining++;
    node.core.rotation.y += delta * 3.4;
    node.ring.rotation.z += delta * (node.index % 2 ? -2.2 : 2.2);
    const hpRatio = Math.max(0, node.mesh.userData.hp / node.mesh.userData.maxHp);
    node.core.scale.setScalar(0.72 + hpRatio * 0.28 + Math.sin(elapsedTime * 7 + node.index) * 0.035);
    node.beamTimer -= delta;
    if (node.beamTimer <= 0 && bd.beams.length < 2) {
      startWardenNodeBeam(node);
      node.beamTimer = 5.2 + node.index * 0.18;
    }
  }

  // Recount after destruction so the armor opens on the exact killing frame.
  remaining = bd.nodes.filter(node => !node.destroyed).length;
  if (remaining === 0) clearWardenLockdown();
}

function destroyWardenNode(node, silent = false) {
  if (!node || node.destroyed) return;
  node.destroyed = true;
  const pos = node.mesh.position.clone();
  const enemyIndex = enemies.indexOf(node.mesh);
  if (enemyIndex >= 0) enemies.splice(enemyIndex, 1);
  for (let i = bossData.beams.length - 1; i >= 0; i--) {
    if (bossData.beams[i].node !== node) continue;
    removeWardenTransient(bossData.beams[i].mesh);
    bossData.beams.splice(i, 1);
  }
  removeAndDispose(node.mesh);
  if (!silent) {
    spawnDeathParticles(pos, 0x64e7ff);
    triggerScreenShake(0.32);
    AudioManager.explosion();
  }
}

function clearWardenLockdown() {
  const bd = bossData;
  if (bd.lockdownCleared) return;
  bd.lockdownCleared = true;
  bd.damageMultiplier = 1;
  bd.shieldActive = false;
  bd.shieldMesh.material.opacity = 0;
  document.getElementById('boss-shield-bar').style.display = 'none';
  flashCenterMsg('LOCKDOWN BROKEN · WARDEN EXPOSED', '#ffd23d');
  triggerColorFlash('rgba(255,210,61,0.25)', 90, 360);
}

function startWardenNodeBeam(node) {
  const bd = bossData;
  const dir = node.mesh.position.clone().multiplyScalar(-1);
  dir.y = 0;
  dir.normalize();
  const length = CONFIG.ARENA_RADIUS * 1.85;
  const geometry = new THREE.BoxGeometry(length, 0.04, 0.22);
  geometry.translate(length / 2, 0, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0x3fe5ff, transparent: true, opacity: 0.2,
  }));
  mesh.position.copy(node.mesh.position);
  mesh.position.y = 0.1;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  scene.add(mesh);
  const beam = { mesh, node, dir, timer: 0.95, fired: false };
  bd.beams.push(beam);
  bd.transients.push(mesh);
}

function updateWardenBeams(delta) {
  const bd = bossData;
  for (let i = bd.beams.length - 1; i >= 0; i--) {
    const beam = bd.beams[i];
    beam.timer -= delta;
    beam.mesh.material.opacity = beam.fired ? 0.96 : 0.18 + Math.sin(elapsedTime * 28) * 0.1;
    beam.mesh.scale.z = beam.fired ? 7.4 : 0.85 + Math.max(0, 0.95 - beam.timer) * 1.5;
    if (!beam.fired && beam.timer <= 0) {
      beam.fired = true;
      beam.timer = 0.24;
      triggerScreenShake(0.44);
      AudioManager.explosion();
      const toPlayer = new THREE.Vector3().subVectors(player.position, beam.node.mesh.position);
      toPlayer.y = 0;
      const along = toPlayer.dot(beam.dir);
      const perp = toPlayer.clone().sub(beam.dir.clone().multiplyScalar(along)).length();
      if (along >= 0 && along <= CONFIG.ARENA_RADIUS * 1.85 && perp < 1.05) hurtPlayer(34);
    } else if (beam.fired && beam.timer <= 0) {
      removeWardenTransient(beam.mesh);
      bd.beams.splice(i, 1);
    }
  }
}

function enterWardenOverdrive() {
  const bd = bossData;
  bd.phase = 3;
  bd.phaseLabel = 'OVERDRIVE';
  bd.vulnerableTimer = 0;
  bd.damageMultiplier = 0.15;
  bd.shieldActive = true;
  bd.slamTimer = 1.5;
  bd.shockwaveTimer = 3.6;
  bd.radialTimer = 1.4;
  bd.reinforcementTimer = 2.8;
  bd.hazardTimer = 2.7;
  for (const node of bd.nodes) destroyWardenNode(node, true);
  bd.lockdownCleared = true;
  flashCenterMsg('PHASE III: OVERDRIVE · DODGE SLAM → PUNISH', '#ff3d55');
  triggerColorFlash('rgba(255,35,70,0.34)', 140, 520);
  triggerScreenShake(0.9);
}

function updateWardenVulnerability(delta) {
  const bd = bossData;
  if (bd.vulnerableTimer <= 0) return;
  bd.vulnerableTimer = Math.max(0, bd.vulnerableTimer - delta);
  if (bd.vulnerableTimer > 0) {
    bd.damageMultiplier = 1.35;
    bd.shieldActive = false;
    bd.shieldMesh.material.opacity = 0.04;
  } else {
    bd.damageMultiplier = 0.15;
    bd.shieldActive = true;
    bd.shieldMesh.material.opacity = 0.38;
    flashCenterMsg('WARDEN ARMOR RESTORED', '#64e7ff');
  }
}

function openWardenArmor() {
  const bd = bossData;
  bd.vulnerableTimer = 3.15;
  bd.damageMultiplier = 1.35;
  bd.shieldActive = false;
  bd.shieldMesh.material.opacity = 0.04;
  flashCenterMsg('ARMOR BREACH · DAMAGE WINDOW OPEN', '#ffd23d');
  triggerColorFlash('rgba(255,210,61,0.2)', 70, 280);
}

function fireWardenRadial() {
  const bd = bossData;
  const count = 12;
  const offset = elapsedTime * 0.55;
  for (let i = 0; i < count; i++) {
    const angle = offset + i / count * Math.PI * 2;
    spawnEnemyProjectile(bossMesh.position.clone(), new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)), {
      speed: bd.projectileSpeed * 1.08,
      damage: bd.projectileDamage + 3,
      color: i % 3 === 0 ? 0xff5269 : 0x64e7ff,
      size: 0.15,
    });
  }
  AudioManager.enemyShoot();
}

function spawnWardenShockwave() {
  const bd = bossData;
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1, getGameSettings().quality === 'low' ? 28 : 56),
    new THREE.MeshBasicMaterial({ color: 0xff5368, transparent: true, opacity: 0.88, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(bossMesh.position.x, 0.09, bossMesh.position.z);
  scene.add(mesh);
  const origin = bossMesh.position.clone();
  const shockwave = {
    mesh, origin, radius: 1, maxRadius: bd.phase === 3 ? 16 : 15,
    speed: bd.phase === 3 ? 11.8 : 10.2, charge: 0.5,
    resolved: false, lastPlayerDistance: flatDist(origin, player.position),
  };
  bd.shockwaves.push(shockwave);
  bd.transients.push(mesh);
  flashCenterMsg('EXPANDING SHOCKWAVE · MOVE OUT OR CUT IN', '#ff6b7f');
}

function updateWardenShockwaves(delta) {
  const bd = bossData;
  for (let i = bd.shockwaves.length - 1; i >= 0; i--) {
    const wave = bd.shockwaves[i];
    if (wave.charge > 0) {
      wave.charge -= delta;
      wave.mesh.scale.setScalar(1 + Math.sin(elapsedTime * 24) * 0.15);
      wave.lastPlayerDistance = flatDist(wave.origin, player.position);
      continue;
    }
    wave.radius += wave.speed * delta;
    wave.mesh.scale.setScalar(wave.radius);
    wave.mesh.material.opacity = Math.max(0, 0.92 * (1 - wave.radius / wave.maxRadius * 0.55));
    const playerDistance = flatDist(wave.origin, player.position);
    if (!wave.resolved && Math.abs(playerDistance - wave.radius) < 0.72) {
      const movingInward = playerDistance < wave.lastPlayerDistance - Math.max(0.012, delta * 1.4);
      wave.resolved = true;
      if (movingInward) {
        spawnDeathParticles(player.position.clone(), 0x64e7ff);
      } else {
        hurtPlayer(bd.phase === 3 ? 34 : 27);
      }
    }
    wave.lastPlayerDistance = playerDistance;
    if (wave.radius >= wave.maxRadius) {
      removeWardenTransient(wave.mesh);
      bd.shockwaves.splice(i, 1);
    }
  }
}

function spawnWardenLockZone() {
  const bd = bossData;
  const radius = 2.7;
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, getGameSettings().quality === 'low' ? 20 : 36),
    new THREE.MeshBasicMaterial({ color: 0xff1838, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(player.position.x, 0.045, player.position.z);
  scene.add(mesh);
  const hazard = { mesh, radius, timer: 1, maxTimer: 3.6, hitCooldown: 0, state: 'warning' };
  bd.hazards.push(hazard);
  bd.transients.push(mesh);
}

function updateWardenHazards(delta) {
  const bd = bossData;
  for (let i = bd.hazards.length - 1; i >= 0; i--) {
    const hazard = bd.hazards[i];
    hazard.timer -= delta;
    hazard.hitCooldown = Math.max(0, hazard.hitCooldown - delta);
    if (hazard.state === 'warning') {
      hazard.mesh.material.opacity = 0.1 + Math.sin(elapsedTime * 24) * 0.07;
      if (hazard.timer <= 0) {
        hazard.state = 'active';
        hazard.timer = hazard.maxTimer;
        hazard.mesh.material.opacity = 0.38;
        triggerScreenShake(0.25);
      }
      continue;
    }

    hazard.mesh.material.opacity = Math.max(0.05, 0.34 * hazard.timer / hazard.maxTimer);
    if (flatDist(hazard.mesh.position, player.position) < hazard.radius && hazard.hitCooldown <= 0) {
      hurtPlayer(bd.phase === 3 ? 18 : 12);
      hazard.hitCooldown = 0.7;
    }
    if (hazard.timer <= 0) {
      removeWardenTransient(hazard.mesh);
      bd.hazards.splice(i, 1);
    }
  }
}

function updateWardenReinforcements(delta) {
  const bd = bossData;
  bd.reinforcementTimer -= delta;
  if (bd.reinforcementTimer > 0) return;
  const activeEnemies = enemies.filter(enemy => !enemy.userData.wardenNode).length;
  const limit = bd.phase === 3 ? 10 : 7;
  if (activeEnemies < limit) summonWardenReinforcements(bd.phase === 3 ? 3 : 2);
  bd.reinforcementTimer = bd.phase === 3 ? 6.7 : 9.2;
}

function summonWardenReinforcements(count) {
  const pool = bossData.phase === 3
    ? ['dasher', 'shooter', 'splitter', 'fast']
    : ['basic', 'shooter', 'dasher', 'fast'];
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2 + elapsedTime * 0.2;
    const pos = new THREE.Vector3(Math.cos(angle) * 13, 0, Math.sin(angle) * 13);
    spawnEnemyAt(pool[(i + Math.floor(elapsedTime)) % pool.length], pos, {
      hpMult: bossData.phase === 3 ? 1.2 : 1.05,
      spawnDuration: 0.55,
    });
  }
  flashCenterMsg('WARDEN REINFORCEMENTS INBOUND', '#ffb14a');
}

function updateWardenArmorUI(bd) {
  const shieldBar = document.getElementById('boss-shield-bar');
  const shieldFill = document.getElementById('boss-shield-fill');
  const name = document.getElementById('boss-name');
  if (!shieldBar || !shieldFill || !name) return;

  if (bd.phase === 1 || (bd.phase === 2 && bd.lockdownCleared)) {
    shieldBar.style.display = 'none';
    name.textContent = `THE WARDEN · ${bd.phaseLabel}`;
    return;
  }

  if (bd.phase === 2) {
    const remaining = bd.nodes.filter(node => !node.destroyed).length;
    shieldBar.style.display = 'block';
    shieldFill.style.width = `${remaining / 4 * 100}%`;
    name.textContent = `THE WARDEN · LOCKDOWN · ${remaining} NODE${remaining === 1 ? '' : 'S'}`;
    return;
  }

  if (bd.vulnerableTimer > 0) {
    shieldBar.style.display = 'none';
    name.textContent = `THE WARDEN · ARMOR OPEN · ${bd.vulnerableTimer.toFixed(1)}s`;
  } else {
    shieldBar.style.display = 'block';
    shieldFill.style.width = '100%';
    name.textContent = 'THE WARDEN · OVERDRIVE · ARMOR INTACT';
  }
}

function hurtPlayer(amount) {
  if (invincibleTimer > 0) return false;
  stats.hp -= amount;
  triggerHealthFlash();
  return true;
}

function removeWardenTransient(mesh) {
  if (!mesh) return;
  removeAndDispose(mesh);
  if (bossData?.transients) bossData.transients = bossData.transients.filter(entry => (entry.mesh || entry) !== mesh);
}
