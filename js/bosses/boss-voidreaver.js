// ============================================
// THE NULL REAVER — rift assassin and arena controller (wave 15)
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

function buildNullReaverVisuals(def, mesh, core) {
  const coreCracks = new THREE.Group();
  const crackMaterial = new THREE.MeshBasicMaterial({ color: 0x120018 });
  const crackData = [
    [-0.14, 0.08, -0.42, 0.42],
    [0.13, -0.03, 0.56, 0.34],
    [-0.02, -0.18, -0.12, 0.28],
  ];
  for (const [x, y, rotation, height] of crackData) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.035, height, 0.025), crackMaterial);
    crack.position.set(x, y, def.size * 0.255);
    crack.rotation.z = rotation;
    coreCracks.add(crack);
  }
  core.add(coreCracks);

  const brokenHalo = new THREE.Group();
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: def.coreColor, transparent: true, opacity: 0.72,
  });
  for (let i = 0; i < 8; i++) {
    if (i === 2 || i === 6) continue;
    const segment = new THREE.Mesh(
      new THREE.TorusGeometry(def.size * 0.94, 0.055, 5, 8, Math.PI * 0.42),
      haloMaterial
    );
    segment.rotation.x = Math.PI / 2;
    segment.rotation.z = i / 8 * Math.PI * 2 + i * 0.035;
    segment.position.y = def.size * 0.12;
    brokenHalo.add(segment);
  }
  mesh.add(brokenHalo);

  const armorShards = new THREE.Group();
  const shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x12071f, emissive: 0x6d0b78, emissiveIntensity: 0.65,
    metalness: 0.72, roughness: 0.25, flatShading: true,
  });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.48, 0), shardMaterial);
    shard.position.set(Math.cos(a) * 1.72, Math.sin(a * 2) * 0.28, Math.sin(a) * 1.72);
    shard.rotation.set(a * 0.35, -a, a * 0.25);
    shard.userData.baseY = shard.position.y;
    shard.userData.phaseOffset = a;
    armorShards.add(shard);
  }
  mesh.add(armorShards);
  setObjectShadows(armorShards, getGameSettings().quality !== 'low');

  return { coreCracks, brokenHalo, armorShards };
}

function spawnVoidReaver(def) {
  const angle = Math.atan2(player.position.z, player.position.x) + Math.PI;
  const pos = new THREE.Vector3(Math.cos(angle) * 10, 0, Math.sin(angle) * 10);
  const parts = buildMilestoneBoss(def, pos);
  const visuals = buildNullReaverVisuals(def, parts.mesh, parts.core);
  bossMesh = parts.mesh;
  bossData = {
    ...def,
    currentHp: def.hp,
    core: parts.core,
    coreCracks: visuals.coreCracks,
    ring: parts.ring,
    brokenHalo: visuals.brokenHalo,
    armorShards: visuals.armorShards,
    phase: 1,
    phase2Triggered: false,
    phase3Triggered: false,
    eventHorizonTriggered: false,
    attackTimer: 1.45,
    attackIndex: 0,
    teleportTimer: 4.8,
    teleportState: null,
    teleporting: false,
    arrivalIndex: 0,
    orbitAngle: angle,
    contactTimer: 0,
    wells: [],
    severance: null,
    eventHorizon: null,
    glitchBursts: [],
    transients: [],
  };
  flashCenterMsg('HUNTER PROTOCOL ENGAGED', '#ff3df2');
  triggerColorFlash('rgba(255,61,242,0.2)', 80, 360);
  triggerScreenShake(0.45);
}

function updateVoidReaver(delta) {
  const bd = bossData;
  const mesh = bossMesh;
  const hpRatio = Math.max(0, bd.currentHp / bd.hp);

  updateReaverPhase(hpRatio);
  if (!bd.eventHorizonTriggered && hpRatio <= 0.2) startReaverEventHorizon();

  bd.contactTimer = Math.max(0, bd.contactTimer - delta);
  bd.ring.rotation.z += delta * (1.25 + bd.phase * 0.72);
  bd.brokenHalo.rotation.y -= delta * (0.65 + bd.phase * 0.3);
  bd.armorShards.rotation.y += delta * (0.45 + bd.phase * 0.22);
  bd.core.rotation.y -= delta * (1.7 + bd.phase * 0.55);
  bd.core.rotation.x += delta * 0.65;
  const corePulse = 1 + Math.sin(elapsedTime * (4 + bd.phase)) * (0.07 + bd.phase * 0.02);
  bd.core.scale.setScalar(corePulse);
  for (const shard of bd.armorShards.children) {
    shard.position.y = shard.userData.baseY + Math.sin(elapsedTime * 2.4 + shard.userData.phaseOffset) * 0.18;
    shard.rotation.x += delta * 0.55;
  }

  updateReaverWells(delta);
  updateReaverSeverance(delta);
  updateReaverEventHorizon(delta);
  updateReaverGlitchBursts(delta);

  if (bd.teleportState) {
    updateReaverTeleport(delta);
  } else {
    bd.orbitAngle += delta * (0.32 + bd.phase * 0.18);
    const radius = bd.phase === 1 ? 7 : bd.phase === 2 ? 6 : 5.2;
    const target = player.position.clone().add(new THREE.Vector3(
      Math.cos(bd.orbitAngle) * radius, 0,
      Math.sin(bd.orbitAngle) * radius
    ));
    target.y = bd.size * 0.65;
    clampReaverPosition(target, bd.eventHorizon ? bd.eventHorizon.radius - 1.4 : CONFIG.ARENA_RADIUS - 2);
    mesh.position.lerp(target, frameLerp(0.017 + bd.phase * 0.004, delta));

    bd.teleportTimer -= delta;
    if (bd.teleportTimer <= 0) {
      startReaverTeleport();
    } else {
      bd.attackTimer -= delta;
      if (bd.attackTimer <= 0) performReaverAttack();
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

function updateReaverPhase(hpRatio) {
  const bd = bossData;
  const nextPhase = hpRatio <= 0.35 ? 3 : hpRatio <= 0.7 ? 2 : 1;
  if (nextPhase <= bd.phase) return;

  bd.phase = nextPhase;
  clearReaverProjectiles();
  clearReaverWells();
  clearReaverSeverance();
  bd.attackTimer = 0.85;
  bd.teleportTimer = Math.min(bd.teleportTimer, nextPhase === 3 ? 1.05 : 1.5);
  bd.core.material.emissiveIntensity = nextPhase === 3 ? 2.8 : 2.1;
  bd.core.userData._baseEmissive = bd.core.material.emissiveIntensity;

  if (nextPhase === 2) {
    bd.phase2Triggered = true;
    flashCenterMsg('BREACH NETWORK UNSEALED', '#ff3df2');
    triggerColorFlash('rgba(156,61,255,0.28)', 90, 420);
  } else {
    bd.phase2Triggered = true;
    bd.phase3Triggered = true;
    flashCenterMsg('REALITY HAS NO EXIT', '#ff3d6e');
    triggerColorFlash('rgba(255,30,120,0.4)', 100, 500);
  }
  spawnDeathParticles(bossMesh.position.clone(), 0xff3df2);
  triggerScreenShake(nextPhase === 3 ? 0.65 : 0.48);
}

function countReaverMajorHazards() {
  if (!bossData) return 0;
  return bossData.wells.length + (bossData.severance ? 1 : 0) + (bossData.eventHorizon ? 1 : 0);
}

function performReaverAttack() {
  const bd = bossData;
  bd.attackIndex++;
  const majorHazards = countReaverMajorHazards();

  if (bd.phase === 1) {
    fireReaverFan();
  } else if (bd.phase === 2) {
    const pattern = bd.attackIndex % 3;
    if (pattern === 1 || majorHazards >= 2) fireReaverFan();
    else if (pattern === 2) spawnReaverWell();
    else startReaverSeverance();
  } else {
    const pattern = bd.attackIndex % 4;
    if (majorHazards >= 2 || pattern === 1 || pattern === 3) fireReaverFan();
    else if (pattern === 2) spawnReaverWell();
    else startReaverSeverance();
  }

  bd.attackTimer = bd.phase === 1 ? 1.18 : bd.phase === 2 ? 0.96 : 0.78;
}

function clearReaverProjectiles() {
  while (enemyProjectiles.length) releaseEnemyProjectile(enemyProjectiles.pop());
}

function removeReaverTransient(entry) {
  if (!entry || !bossData) return;
  const mesh = entry.mesh || entry;
  removeAndDispose(mesh);
  bossData.transients = bossData.transients.filter(item => item !== entry && item !== mesh);
}

function clearReaverWells() {
  const bd = bossData;
  for (const well of bd.wells) removeReaverTransient(well);
  bd.wells.length = 0;
}

function clearReaverSeverance() {
  const bd = bossData;
  if (!bd.severance) return;
  removeReaverTransient(bd.severance);
  bd.severance = null;
}

function spawnReaverGlitchBurst(position) {
  const bd = bossData;
  if (!bd) return;
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(0.12, 0.055, 0.42);
  const magenta = new THREE.MeshBasicMaterial({ color: 0xff3df2, transparent: true, opacity: 0.85 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 });
  const count = getGameSettings().quality === 'low' ? 6 : 10;
  const fragments = [];
  for (let i = 0; i < count; i++) {
    const fragment = new THREE.Mesh(geometry, i % 4 === 0 ? white : magenta);
    const a = i / count * Math.PI * 2 + Math.random() * 0.35;
    fragment.position.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.4);
    fragment.rotation.set(Math.random() * Math.PI, a, Math.random() * Math.PI);
    fragments.push({
      mesh: fragment,
      velocity: new THREE.Vector3(Math.cos(a) * (2.4 + Math.random()), (Math.random() - 0.25) * 2.2, Math.sin(a) * (2.4 + Math.random())),
    });
    group.add(fragment);
  }
  group.position.copy(position);
  scene.add(group);
  const burst = { mesh: group, fragments, timer: 0.42, duration: 0.42 };
  bd.glitchBursts.push(burst);
  bd.transients.push(burst);
}

function updateReaverGlitchBursts(delta) {
  const bd = bossData;
  for (let i = bd.glitchBursts.length - 1; i >= 0; i--) {
    const burst = bd.glitchBursts[i];
    burst.timer -= delta;
    const opacity = Math.max(0, burst.timer / burst.duration);
    for (const fragment of burst.fragments) {
      fragment.mesh.position.addScaledVector(fragment.velocity, delta);
      fragment.mesh.rotation.x += delta * 7;
      fragment.mesh.rotation.z -= delta * 5;
      fragment.mesh.material.opacity = opacity * (fragment.mesh.material.color.getHex() === 0xffffff ? 0.72 : 0.85);
    }
    if (burst.timer <= 0) {
      removeReaverTransient(burst);
      bd.glitchBursts.splice(i, 1);
    }
  }
}

function startReaverTeleport() {
  const bd = bossData;
  const destination = findReaverTeleportDestination();
  const marker = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.55, getGameSettings().quality === 'low' ? 18 : 32),
    new THREE.MeshBasicMaterial({ color: 0xff3df2, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  outer.rotation.x = -Math.PI / 2;
  const crossA = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.025, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.48 })
  );
  crossA.position.y = 0.03;
  const crossB = crossA.clone();
  crossB.rotation.y = Math.PI / 2;
  marker.add(outer, crossA, crossB);
  marker.position.copy(destination);
  marker.position.y = 0.055;
  scene.add(marker);

  const duration = bd.phase === 1 ? 0.92 : 0.8;
  const state = { mesh: marker, outer, timer: duration, duration, destination, vanished: false };
  bd.transients.push(state);
  bd.teleportState = state;
}

function findReaverTeleportDestination() {
  const bd = bossData;
  const maxRadius = bd.eventHorizon ? Math.max(6, bd.eventHorizon.radius - 2) : CONFIG.ARENA_RADIUS - 3;
  let best = null;
  let bestDistance = -1;
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 4.8 + Math.random() * 3.2;
    const candidate = player.position.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    candidate.y = 0;
    clampReaverPosition(candidate, maxRadius);
    const distance = flatDist(candidate, player.position);
    if (distance > bestDistance) { best = candidate; bestDistance = distance; }
    if (distance >= 4.2) break;
  }
  if (!best || bestDistance < 3.2) {
    const away = player.position.clone().multiplyScalar(-1);
    away.y = 0;
    if (away.lengthSq() < 0.01) away.set(maxRadius * 0.6, 0, 0);
    clampReaverPosition(away, maxRadius);
    return away;
  }
  return best;
}

function updateReaverTeleport(delta) {
  const bd = bossData;
  const state = bd.teleportState;
  state.timer -= delta;
  state.mesh.rotation.y += delta * 2.8;
  state.outer.material.opacity = 0.25 + Math.sin(performance.now() * 0.025) * 0.17;
  const progress = 1 - Math.max(0, state.timer) / state.duration;
  state.outer.scale.setScalar(0.82 + progress * 0.32);

  if (!state.vanished && state.timer <= 0.18) {
    state.vanished = true;
    bd.teleporting = true;
    setBossOpacity(bossMesh, 0.1);
    spawnReaverGlitchBurst(bossMesh.position.clone());
    spawnDeathParticles(bossMesh.position.clone(), 0xff3df2);
  }

  if (state.timer > 0) return;

  bossMesh.position.set(state.destination.x, bd.size * 0.65, state.destination.z);
  spawnReaverGlitchBurst(bossMesh.position.clone());
  spawnDeathParticles(bossMesh.position.clone(), 0xff3df2);
  setBossOpacity(bossMesh, 1);
  bd.teleporting = false;
  removeReaverTransient(state);
  bd.teleportState = null;
  bd.teleportTimer = bd.phase === 1 ? 4.8 : bd.phase === 2 ? 3.6 : 2.75;
  bd.arrivalIndex++;

  if (bd.phase === 3 && bd.arrivalIndex % 2 === 0 && !bd.severance && countReaverMajorHazards() < 2) {
    startReaverSeverance();
  } else {
    fireReaverRadial();
  }
  triggerScreenShake(0.3);
}

function setBossOpacity(mesh, opacity) {
  const visited = new Set();
  mesh.traverse(child => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (visited.has(material)) continue;
      visited.add(material);
      if (opacity < 1 && !material.userData._reaverOpacity) {
        material.userData._reaverOpacity = { transparent: material.transparent, opacity: material.opacity };
      }
      const original = material.userData._reaverOpacity;
      if (opacity >= 1 && original) {
        material.transparent = original.transparent;
        material.opacity = original.opacity;
        delete material.userData._reaverOpacity;
      } else {
        material.transparent = true;
        material.opacity = opacity;
      }
    }
  });
}

function fireReaverFan() {
  const bd = bossData;
  const count = bd.phase === 1 ? 5 : 7;
  const base = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  base.y = 0;
  if (base.lengthSq() < 0.01) base.set(1, 0, 0);
  base.normalize();
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * (bd.phase === 3 ? 0.12 : 0.14);
    const dir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
    spawnEnemyProjectile(bossMesh.position.clone(), dir, {
      speed: bd.projectileSpeed * (bd.phase === 3 ? 1.08 : 1),
      damage: bd.projectileDamage,
      color: 0xff3df2,
      size: 0.14,
    });
  }
  AudioManager.enemyShoot();
}

function fireReaverRadial() {
  const bd = bossData;
  const slots = bd.phase === 3 ? 24 : 20;
  const towardPlayer = Math.atan2(player.position.z - bossMesh.position.z, player.position.x - bossMesh.position.x);
  const opposite = towardPlayer + Math.PI;
  const gapHalfWidth = bd.phase === 3 ? 0.3 : 0.36;

  for (let i = 0; i < slots; i++) {
    const a = i / slots * Math.PI * 2;
    const towardGap = Math.abs(Math.atan2(Math.sin(a - towardPlayer), Math.cos(a - towardPlayer)));
    const oppositeGap = Math.abs(Math.atan2(Math.sin(a - opposite), Math.cos(a - opposite)));
    if (towardGap < gapHalfWidth || oppositeGap < gapHalfWidth) continue;
    spawnEnemyProjectile(bossMesh.position.clone(), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), {
      speed: bd.projectileSpeed * 0.88,
      damage: Math.max(12, bd.projectileDamage - 2),
      color: 0x9c3dff,
      size: 0.13,
    });
  }
  AudioManager.explosion();
}

function spawnReaverWell() {
  const bd = bossData;
  const limit = bd.phase === 3 && !bd.eventHorizon ? 2 : 1;
  while (bd.wells.length >= limit) {
    const old = bd.wells.shift();
    removeReaverTransient(old);
  }

  const a = Math.random() * Math.PI * 2;
  const distance = 1.8 + Math.random() * 3.8;
  const pos = player.position.clone().add(new THREE.Vector3(Math.cos(a) * distance, 0, Math.sin(a) * distance));
  pos.y = 0;
  const maxRadius = bd.eventHorizon ? bd.eventHorizon.radius - 1.2 : CONFIG.ARENA_RADIUS - 2;
  clampReaverPosition(pos, maxRadius);

  const group = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(1.55, 2.05, getGameSettings().quality === 'low' ? 20 : 36),
    new THREE.MeshBasicMaterial({ color: 0xff3df2, transparent: true, opacity: 0.34, side: THREE.DoubleSide })
  );
  outer.rotation.x = -Math.PI / 2;
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, getGameSettings().quality === 'low' ? 16 : 30),
    new THREE.MeshBasicMaterial({ color: 0x190023, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.012;
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.84, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.02;
  group.add(outer, core, inner);
  group.position.copy(pos);
  group.position.y = 0.055;
  scene.add(group);

  const warning = bd.phase === 3 ? 0.8 : 0.9;
  const well = {
    mesh: group, outer, core, inner,
    stage: 'warning', timer: warning, warning,
    activeDuration: bd.phase === 3 ? 4.2 : 3.6,
    radius: 4.25, innerRadius: 0.9,
    damageTimer: 0,
  };
  bd.wells.push(well);
  bd.transients.push(well);
}

function updateReaverWells(delta) {
  const bd = bossData;
  for (let i = bd.wells.length - 1; i >= 0; i--) {
    const well = bd.wells[i];
    well.timer -= delta;
    well.outer.rotation.z += delta * (well.stage === 'active' ? 2.8 : 1.5);
    well.inner.rotation.z -= delta * 3.6;

    if (well.stage === 'warning') {
      const progress = 1 - Math.max(0, well.timer) / well.warning;
      well.outer.material.opacity = 0.22 + Math.sin(performance.now() * 0.024) * 0.13;
      well.mesh.scale.setScalar(0.78 + progress * 0.22);
      if (well.timer <= 0) {
        well.stage = 'active';
        well.timer = well.activeDuration;
        well.outer.material.opacity = 0.68;
        well.inner.material.opacity = 0.82;
        well.core.material.opacity = 0.82;
        AudioManager.explosion();
        triggerScreenShake(0.22);
      }
      continue;
    }

    if (well.stage === 'active') {
      const distance = flatDist(well.mesh.position, player.position);
      if (distance < well.radius && distance > 0.05) {
        const pull = new THREE.Vector3(
          well.mesh.position.x - player.position.x,
          0,
          well.mesh.position.z - player.position.z
        ).normalize();
        player.position.x += pull.x * (bd.phase === 3 ? 1.65 : 1.3) * delta;
        player.position.z += pull.z * (bd.phase === 3 ? 1.65 : 1.3) * delta;
      }
      well.damageTimer = Math.max(0, well.damageTimer - delta);
      if (distance < well.innerRadius && well.damageTimer <= 0 && invincibleTimer <= 0) {
        stats.hp -= 8;
        well.damageTimer = 1;
        triggerHealthFlash();
      }
      well.outer.material.opacity = 0.5 + Math.sin(performance.now() * 0.02) * 0.16;
      well.core.material.opacity = 0.67 + Math.sin(performance.now() * 0.028) * 0.13;
      if (well.timer <= 0) {
        well.stage = 'fade';
        well.timer = 0.45;
      }
      continue;
    }

    const fade = Math.max(0, well.timer / 0.45);
    well.outer.material.opacity = 0.5 * fade;
    well.core.material.opacity = 0.65 * fade;
    well.inner.material.opacity = 0.55 * fade;
    if (well.timer <= 0) {
      removeReaverTransient(well);
      bd.wells.splice(i, 1);
    }
  }
}

function startReaverSeverance() {
  const bd = bossData;
  if (bd.severance) return;
  const length = CONFIG.ARENA_RADIUS * 2.7;
  const group = new THREE.Group();
  const lines = [];
  const baseAngle = Math.random() < 0.5 ? Math.PI / 4 : 0;
  for (const offset of [0, Math.PI / 2]) {
    const angle = baseAngle + offset;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.035, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xff3df2, transparent: true, opacity: 0.2 })
    );
    mesh.rotation.y = -angle;
    mesh.position.y = 0.06;
    group.add(mesh);
    lines.push({ mesh, dir: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)) });
  }
  const center = player.position.clone();
  center.y = 0.055;
  group.position.copy(center);
  scene.add(group);

  const warning = bd.phase === 3 ? 0.8 : 0.95;
  const severance = { mesh: group, lines, length, warning, timer: warning, fired: false };
  bd.severance = severance;
  bd.transients.push(severance);
  AudioManager.enemyShoot();
}

function updateReaverSeverance(delta) {
  const bd = bossData;
  const attack = bd.severance;
  if (!attack) return;
  attack.timer -= delta;

  for (const line of attack.lines) {
    line.mesh.material.opacity = attack.fired
      ? Math.max(0, attack.timer / 0.24)
      : 0.16 + Math.sin(performance.now() * 0.035) * 0.11;
    line.mesh.scale.z = attack.fired ? 7 : 1 + (1 - Math.max(0, attack.timer) / attack.warning) * 1.4;
  }

  if (!attack.fired && attack.timer <= 0) {
    attack.fired = true;
    attack.timer = 0.24;
    let hit = false;
    const rel = new THREE.Vector3(
      player.position.x - attack.mesh.position.x,
      0,
      player.position.z - attack.mesh.position.z
    );
    for (const line of attack.lines) {
      const along = Math.abs(rel.dot(line.dir));
      const perpendicular = Math.abs(rel.x * -line.dir.z + rel.z * line.dir.x);
      if (along <= attack.length * 0.5 && perpendicular < 0.92) { hit = true; break; }
    }
    if (hit && invincibleTimer <= 0) {
      stats.hp -= 24;
      triggerHealthFlash();
    }
    triggerScreenShake(0.48);
    triggerColorFlash('rgba(255,61,242,0.32)', 55, 260);
    AudioManager.explosion();
  } else if (attack.fired && attack.timer <= 0) {
    removeReaverTransient(attack);
    bd.severance = null;
  }
}

function startReaverEventHorizon() {
  const bd = bossData;
  if (bd.eventHorizonTriggered) return;
  bd.eventHorizonTriggered = true;
  clearReaverProjectiles();
  clearReaverWells();
  clearReaverSeverance();

  const group = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.018, 6, getGameSettings().quality === 'low' ? 40 : 72),
    new THREE.MeshBasicMaterial({ color: 0xff3df2, transparent: true, opacity: 0.85 })
  );
  outer.rotation.x = Math.PI / 2;
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.01, 5, getGameSettings().quality === 'low' ? 32 : 64),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.52 })
  );
  inner.rotation.x = Math.PI / 2;
  group.add(outer, inner);
  group.position.y = 0.11;
  scene.add(group);

  const horizon = {
    mesh: group, outer, inner,
    stage: 'contract', timer: 2.2, duration: 2.2,
    startRadius: CONFIG.ARENA_RADIUS - 0.8,
    targetRadius: 12.5,
    radius: CONFIG.ARENA_RADIUS - 0.8,
  };
  bd.eventHorizon = horizon;
  bd.transients.push(horizon);
  flashCenterMsg('EVENT HORIZON — ARENA CONTRACTING', '#ff3d6e');
  triggerColorFlash('rgba(110,0,90,0.38)', 120, 520);
  triggerScreenShake(0.62);
}

function updateReaverEventHorizon(delta) {
  const bd = bossData;
  const horizon = bd.eventHorizon;
  if (!horizon) return;
  horizon.timer -= delta;

  if (horizon.stage === 'contract') {
    const t = 1 - Math.max(0, horizon.timer) / horizon.duration;
    const eased = t * t * (3 - 2 * t);
    horizon.radius = THREE.MathUtils.lerp(horizon.startRadius, horizon.targetRadius, eased);
    if (horizon.timer <= 0) {
      horizon.stage = 'hold';
      horizon.timer = 6.5;
      horizon.radius = horizon.targetRadius;
    }
  } else if (horizon.stage === 'hold') {
    horizon.radius = horizon.targetRadius;
    if (horizon.timer <= 0) {
      horizon.stage = 'expand';
      horizon.timer = 2;
      horizon.duration = 2;
    }
  } else {
    const t = 1 - Math.max(0, horizon.timer) / horizon.duration;
    horizon.radius = THREE.MathUtils.lerp(horizon.targetRadius, horizon.startRadius, t);
    if (horizon.timer <= 0) {
      removeReaverTransient(horizon);
      bd.eventHorizon = null;
      return;
    }
  }

  horizon.mesh.scale.set(horizon.radius, horizon.radius, horizon.radius);
  horizon.mesh.rotation.y += delta * 0.22;
  horizon.outer.material.opacity = 0.66 + Math.sin(performance.now() * 0.018) * 0.2;
  horizon.inner.material.opacity = 0.35 + Math.sin(performance.now() * 0.026) * 0.17;
  clampReaverPosition(player.position, horizon.radius - 0.45);
  clampReaverPosition(bossMesh.position, horizon.radius - 1.35);
}

function clampReaverPosition(position, radius) {
  const safeRadius = Math.max(1, radius);
  const distance = Math.hypot(position.x, position.z);
  if (distance <= safeRadius || distance < 0.001) return;
  const scale = safeRadius / distance;
  position.x *= scale;
  position.z *= scale;
}
