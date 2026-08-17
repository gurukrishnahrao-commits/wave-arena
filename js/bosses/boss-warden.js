// ============================================
// THE WARDEN — plasma, cryo-lock, and combat clones (wave 15)
// ============================================

function spawnWarden(def) {
  const spawnDirection = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), player.position);
  if (spawnDirection.lengthSq() < 0.01) spawnDirection.set(1, 0, 0);
  spawnDirection.normalize().multiplyScalar(9);
  const parts = buildMilestoneBoss(def, spawnDirection);
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

  const cannon = new THREE.Group();
  cannon.userData.wardenCannon = true;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 2.4, 8), armorMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.75;
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.09, 7, 18), edgeMat);
  muzzle.position.z = 1.95;
  cannon.add(barrel, muzzle);
  cannon.position.set(1.75, 0.15, 0);
  bossMesh.add(cannon);

  const phaseHalo = new THREE.Mesh(
    new THREE.TorusGeometry(def.size * 0.96, 0.055, 7, 32),
    new THREE.MeshBasicMaterial({ color: 0x64e7ff, transparent: true, opacity: 0.72 })
  );
  phaseHalo.rotation.x = Math.PI / 2;
  phaseHalo.position.y = 0.45;
  bossMesh.add(phaseHalo);

  setObjectShadows(shoulders, getGameSettings().quality !== 'low');
  setObjectShadows(cannon, getGameSettings().quality !== 'low');

  const freezeShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.92, 1),
    new THREE.MeshBasicMaterial({
      color: 0x9ef7ff, wireframe: true, transparent: true, opacity: 0.55,
      depthWrite: false,
    })
  );
  freezeShell.position.y = 0;
  freezeShell.visible = false;
  player.add(freezeShell);
  player.userData.freezeShell = freezeShell;
  player.userData.frozenUntil = 0;

  bossData = {
    ...def,
    currentHp: def.hp,
    core: parts.core,
    ring: parts.ring,
    shoulders,
    cannon,
    phaseHalo,
    freezeShell,
    phase: 1,
    phaseLabel: 'PLASMA ASSAULT',
    beamTimer: 2,
    orbTimer: 5,
    activeAttack: null,
    freezeOrbs: [],
    clones: [],
    transients: [freezeShell],
    contactTimer: 0,
    freezeGraceUntil: 0,
  };

  flashCenterMsg('WARDEN PHASE I · PLASMA BEAM EVERY 2 SECONDS', '#64e7ff');
  triggerScreenShake(0.55);
  updateWardenUI(bossData);
}

function updateWarden(delta) {
  const bd = bossData;
  const mesh = bossMesh;
  if (!bd || !mesh) return;

  if (bd.phase === 1 && bd.currentHp / bd.hp <= 0.5) enterWardenClonePhase();

  bd.contactTimer = Math.max(0, bd.contactTimer - delta);
  bd.ring.rotation.z += delta * (bd.phase === 2 ? 3.2 : 1.9);
  bd.phaseHalo.rotation.z -= delta * (bd.phase === 2 ? 2.7 : 1.4);
  bd.core.rotation.y += delta * 2.8;
  bd.cannon.rotation.z = Math.sin(elapsedTime * 2.5) * 0.045;

  moveWarden(delta);
  updateWardenClones(delta);
  updateWardenFreezeOrbs(delta);
  updateWardenFreezeVisual(delta);

  if (bd.phase === 1) {
    bd.beamTimer -= delta;
    if (!bd.activeAttack && bd.beamTimer <= 0) {
      startWardenPlasmaBeam();
      bd.beamTimer += 2;
    }
    if (bd.activeAttack) updateWardenPlasmaBeam(delta);
  } else {
    bd.orbTimer -= delta;
    if (bd.orbTimer <= 0) {
      fireWardenFreezeVolley();
      bd.orbTimer += 5;
    }
  }

  if (flatDist(mesh.position, player.position) < bd.size * 0.66 && bd.contactTimer <= 0) {
    if (invincibleTimer <= 0) {
      stats.hp -= bd.damage;
      triggerHealthFlash();
    }
    bd.contactTimer = 1;
  }

  checkBossProjectileHits(bd, bd.size * 0.68);
  updateWardenUI(bd);
  updateBossHPBar(bd);
  if (bd.currentHp <= 0) killBoss();
}

function moveWarden(delta) {
  const bd = bossData;
  const mesh = bossMesh;
  const step = frameScale(delta);
  const toPlayer = new THREE.Vector3().subVectors(player.position, mesh.position);
  toPlayer.y = 0;
  const distance = toPlayer.length();
  if (distance > 6.5) {
    toPlayer.normalize();
    mesh.position.addScaledVector(toPlayer, bd.speed * step * (bd.phase === 2 ? 1.18 : 1));
  } else if (distance < 4.2) {
    toPlayer.normalize();
    mesh.position.addScaledVector(toPlayer, -bd.speed * step * 0.7);
  }
  clampToArena(mesh.position, 3);
  mesh.lookAt(player.position.x, mesh.position.y, player.position.z);
}

function startWardenPlasmaBeam() {
  const bd = bossData;
  const direction = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  direction.y = 0;
  if (direction.lengthSq() < 0.01) direction.set(1, 0, 0);
  direction.normalize();

  const length = CONFIG.ARENA_RADIUS * 2;
  const geometry = new THREE.BoxGeometry(length, 0.12, 0.17);
  geometry.translate(length / 2, 0, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0x56efff, transparent: true, opacity: 0.22,
  }));
  scene.add(mesh);
  bd.activeAttack = {
    type: 'warden-plasma-beam', mesh, direction,
    state: 'warning', timer: 0.55, hit: false,
  };
  orientWardenPlasmaBeam(bd.activeAttack);
}

function orientWardenPlasmaBeam(beam) {
  beam.mesh.position.copy(bossMesh.position);
  beam.mesh.position.y = 0.78;
  beam.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), beam.direction);
}

function updateWardenPlasmaBeam(delta) {
  const bd = bossData;
  const beam = bd.activeAttack;
  if (!beam) return;
  beam.timer -= delta;
  orientWardenPlasmaBeam(beam);

  if (beam.state === 'warning') {
    beam.mesh.material.opacity = 0.16 + Math.sin(elapsedTime * 32) * 0.1;
    beam.mesh.scale.z = 0.75 + Math.max(0, 0.55 - beam.timer) * 1.8;
    if (beam.timer <= 0) {
      beam.state = 'firing';
      beam.timer = 0.14;
      beam.mesh.material.opacity = 1;
      beam.mesh.scale.z = 7.5;
      triggerScreenShake(0.45);
      AudioManager.explosion();

      const toPlayer = new THREE.Vector3().subVectors(player.position, bossMesh.position);
      toPlayer.y = 0;
      const along = toPlayer.dot(beam.direction);
      const perpendicular = toPlayer.clone().sub(beam.direction.clone().multiplyScalar(along)).length();
      if (along >= 0 && along <= CONFIG.ARENA_RADIUS * 2 && perpendicular < 0.9 && invincibleTimer <= 0) {
        stats.hp -= 32;
        triggerHealthFlash();
      }
    }
    return;
  }

  beam.mesh.material.opacity = Math.max(0, beam.timer / 0.14);
  if (beam.timer <= 0) {
    removeAndDispose(beam.mesh);
    bd.activeAttack = null;
  }
}

function enterWardenClonePhase() {
  const bd = bossData;
  bd.phase = 2;
  bd.phaseLabel = 'CRYO MIRROR';
  bd.orbTimer = 5;
  if (bd.activeAttack?.mesh) removeAndDispose(bd.activeAttack.mesh);
  bd.activeAttack = null;
  spawnWardenClones();
  flashCenterMsg('WARDEN PHASE II · TWO CLONES ONLINE · CRYO ORBS', '#9ef7ff');
  triggerColorFlash('rgba(100,231,255,0.32)', 120, 480);
  triggerScreenShake(0.75);
}

function spawnWardenClones() {
  const bd = bossData;
  for (let i = 0; i < 2; i++) {
    const mesh = cloneWardenProjection(bossMesh);
    const angle = i * Math.PI;
    mesh.position.copy(bossMesh.position).add(new THREE.Vector3(Math.cos(angle) * 4.5, 0, Math.sin(angle) * 4.5));
    scene.add(mesh);
    const clone = {
      mesh,
      angleOffset: angle,
      cannon: findWardenCloneCannon(mesh),
    };
    bd.clones.push(clone);
    bd.transients.push(mesh);
  }
}

function cloneWardenProjection(source) {
  const clone = source.clone(true);
  clone.traverse(child => {
    if (!child.isMesh) return;
    if (child.geometry) child.geometry = child.geometry.clone();
    if (Array.isArray(child.material)) {
      child.material = child.material.map(material => makeWardenCloneMaterial(material));
    } else if (child.material) {
      child.material = makeWardenCloneMaterial(child.material);
    }
    child.castShadow = false;
    child.receiveShadow = false;
  });
  clone.scale.multiplyScalar(0.9);
  return clone;
}

function makeWardenCloneMaterial(source) {
  const material = source.clone();
  material.transparent = true;
  material.opacity = source.opacity === 0 ? 0 : Math.min(0.52, source.opacity ?? 1);
  material.depthWrite = false;
  if (material.color) material.color.lerp(new THREE.Color(0x7feaff), 0.38);
  if (material.emissive) {
    material.emissive.lerp(new THREE.Color(0x39d9ff), 0.55);
    material.emissiveIntensity = Math.max(1.15, material.emissiveIntensity || 0);
  }
  return material;
}

function findWardenCloneCannon(mesh) {
  let cannon = null;
  mesh.traverse(child => {
    if (child.userData?.wardenCannon) cannon = child;
  });
  return cannon;
}

function updateWardenClones(delta) {
  const bd = bossData;
  if (bd.phase !== 2) return;
  for (let i = 0; i < bd.clones.length; i++) {
    const clone = bd.clones[i];
    const angle = elapsedTime * (i ? -0.38 : 0.38) + clone.angleOffset;
    const desired = bossMesh.position.clone().add(new THREE.Vector3(Math.cos(angle) * 5.1, 0, Math.sin(angle) * 5.1));
    clone.mesh.position.lerp(desired, frameLerp(0.055, delta));
    clampToArena(clone.mesh.position, 2.5);
    clone.mesh.lookAt(player.position.x, clone.mesh.position.y, player.position.z);
    clone.mesh.rotation.z = Math.sin(elapsedTime * 3 + i) * 0.025;
    if (clone.cannon) clone.cannon.rotation.z = Math.sin(elapsedTime * 3.4 + i) * 0.06;
  }
}

function fireWardenFreezeVolley() {
  const sources = [bossMesh, ...bossData.clones.map(clone => clone.mesh)];
  for (const source of sources) spawnWardenFreezeOrb(source);
  flashCenterMsg('CRYO ORBS · KEEP MOVING', '#9ef7ff');
  AudioManager.enemyShoot();
}

function spawnWardenFreezeOrb(source) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xc9fbff })
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0x56eaff, transparent: true, opacity: 0.22,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  const cage = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4, 0),
    new THREE.MeshBasicMaterial({ color: 0x72efff, wireframe: true, transparent: true, opacity: 0.8 })
  );
  group.add(core, glow, cage);
  group.position.copy(source.position);
  group.position.y = 0.78;

  const direction = new THREE.Vector3().subVectors(player.position, group.position);
  direction.y = 0;
  if (direction.lengthSq() < 0.01) direction.set(1, 0, 0);
  direction.normalize();
  scene.add(group);

  const orb = { mesh: group, glow, cage, direction, speed: 0.115, life: 5.2 };
  bossData.freezeOrbs.push(orb);
  bossData.transients.push(group);
}

function updateWardenFreezeOrbs(delta) {
  const bd = bossData;
  const step = frameScale(delta);
  for (let i = bd.freezeOrbs.length - 1; i >= 0; i--) {
    const orb = bd.freezeOrbs[i];
    orb.mesh.position.addScaledVector(orb.direction, orb.speed * step);
    orb.mesh.position.y = 0.78;
    orb.mesh.rotation.y += delta * 4;
    orb.cage.rotation.x += delta * 3.2;
    orb.cage.rotation.z -= delta * 2.4;
    orb.glow.scale.setScalar(0.88 + Math.sin(elapsedTime * 12 + i) * 0.16);
    orb.life -= delta;

    if (flatDist(orb.mesh.position, player.position) < 0.72) {
      if (elapsedTime >= bd.freezeGraceUntil && invincibleTimer <= 0) {
        stats.hp -= 12;
        bd.freezeGraceUntil = elapsedTime + 0.65;
        freezeWardenPlayer(1.35);
        triggerHealthFlash();
        triggerScreenShake(0.25);
      }
      removeWardenTransient(orb.mesh);
      bd.freezeOrbs.splice(i, 1);
      continue;
    }

    if (orb.life <= 0) {
      removeWardenTransient(orb.mesh);
      bd.freezeOrbs.splice(i, 1);
    }
  }
}

function freezeWardenPlayer(duration) {
  player.userData.frozenUntil = Math.max(player.userData.frozenUntil || 0, elapsedTime + duration);
  if (bossData.freezeShell) bossData.freezeShell.visible = true;
  triggerColorFlash('rgba(110,238,255,0.28)', 80, 300);
  flashCenterMsg('CRYO LOCK · FROZEN', '#9ef7ff');
}

function updateWardenFreezeVisual(delta) {
  const shell = bossData.freezeShell;
  if (!shell) return;
  const frozen = isPlayerFrozen();
  shell.visible = frozen;
  if (frozen) {
    shell.rotation.y += delta * 2.8;
    shell.rotation.x -= delta * 1.5;
    shell.material.opacity = 0.42 + Math.sin(elapsedTime * 16) * 0.12;
  }
}

function updateWardenUI(bd) {
  const shieldBar = document.getElementById('boss-shield-bar');
  const name = document.getElementById('boss-name');
  if (shieldBar) shieldBar.style.display = 'none';
  if (name) {
    name.textContent = bd.phase === 1
      ? 'THE WARDEN · PLASMA ASSAULT'
      : 'THE WARDEN · CRYO MIRROR · 2 CLONES';
  }
}

function removeWardenTransient(mesh) {
  if (!mesh) return;
  removeAndDispose(mesh);
  if (bossData?.transients) bossData.transients = bossData.transients.filter(entry => (entry.mesh || entry) !== mesh);
}
