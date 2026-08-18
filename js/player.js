// ============================================
// PLAYER — mesh, movement, aim
// ============================================

function buildLowPolyHuman() {
  const group = new THREE.Group();

  const armorMat = new THREE.MeshStandardMaterial({
    flatShading: true, color: 0x1c2340, emissive: 0x0a1020, emissiveIntensity: 0.3,
    metalness: 0.5, roughness: 0.4,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    flatShading: true, color: 0x3dffd2, emissive: 0x1a8070, emissiveIntensity: 0.8,
    metalness: 0.3, roughness: 0.2,
  });
  const gunMat = new THREE.MeshStandardMaterial({
    flatShading: true, color: 0x0d0d14, emissive: 0xff3d6e, emissiveIntensity: 0.4,
    metalness: 0.7, roughness: 0.3,
  });

  // Legs
  const legGeo = new THREE.BoxGeometry(0.16, 0.55, 0.18);
  const legL = new THREE.Mesh(legGeo, armorMat); legL.position.set(-0.13, -0.45, 0);
  const legR = new THREE.Mesh(legGeo, armorMat); legR.position.set(0.13, -0.45, 0);
  group.add(legL, legR);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.24), armorMat);
  torso.position.y = 0.02;
  group.add(torso);

  // Chest core
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), visorMat);
  core.position.set(0, 0.05, 0.13);
  group.add(core);

  // Shoulders
  const shoulderGeo = new THREE.BoxGeometry(0.16, 0.14, 0.2);
  const shL = new THREE.Mesh(shoulderGeo, armorMat); shL.position.set(-0.29, 0.24, 0);
  const shR = new THREE.Mesh(shoulderGeo, armorMat); shR.position.set(0.29, 0.24, 0);
  group.add(shL, shR);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.13, 0.42, 0.15);
  const armL = new THREE.Mesh(armGeo, armorMat); armL.position.set(-0.29, -0.06, 0);
  const armR = new THREE.Mesh(armGeo, armorMat); armR.position.set(0.29, -0.06, 0);
  group.add(armL, armR);

  // Head + visor
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.26), armorMat);
  head.position.y = 0.44;
  group.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.03), visorMat);
  visor.position.set(0, 0.44, 0.135);
  group.add(visor);

  // Gun
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.32), gunMat);
  gun.name = 'player-weapon';
  gun.position.set(0.29, -0.22, 0.2);
  group.add(gun);

  group.traverse(c => { if (c.isMesh) c.castShadow = true; });
  group.material = visorMat;
  return group;
}

function initPlayer() {
  player = buildLowPolyHuman();
  player.position.set(0, 0.75, 0);
  scene.add(player);

  // Base glow disc
  const pBaseGeo = new THREE.CircleGeometry(0.8, 24);
  const pBaseMat = new THREE.MeshBasicMaterial({ color: 0x3dffd2, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
  const pBase = new THREE.Mesh(pBaseGeo, pBaseMat);
  pBase.rotation.x = -Math.PI / 2;
  pBase.position.y = 0.02;
  scene.add(pBase);
  player.userData.baseDisc = pBase;

  // Outer glow
  const glowGeo = new THREE.SphereGeometry(0.75, 6, 5);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x3dffd2, transparent: true, opacity: 0.08 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  player.add(glow);
}

function isPlayerFrozen() {
  return !!player && (player.userData?.frozenUntil || 0) > elapsedTime;
}

function isPlayerWeaponsDisabled() {
  if (!player) return false;
  return isPlayerFrozen()
    || !!player.userData?.weaponLockedByHunter
    || (player.userData?.weaponsDisabledUntil || 0) > elapsedTime;
}

function setPlayerWeaponVisible(visible) {
  if (!player) return;
  const weapon = typeof player.getObjectByName === 'function' ? player.getObjectByName('player-weapon') : null;
  if (weapon) weapon.visible = visible;
}

function updatePlayer(delta) {
  const step = frameScale(delta);
  let dx = 0, dz = 0;
  if (!isPlayerFrozen()) {
    if (keys['w'] || keys['arrowup']) dz -= 1;
    if (keys['s'] || keys['arrowdown']) dz += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    if (joystickInput.x !== 0 || joystickInput.y !== 0) {
      dx = joystickInput.x;
      dz = joystickInput.y;
    }
  }

  if (dx !== 0 || dz !== 0) {
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 1) { dx /= len; dz /= len; }
    const slowMultiplier = (player.userData?.slowedUntil || 0) > elapsedTime ? 0.42 : 1;
    player.position.x += dx * stats.speed * slowMultiplier * step;
    player.position.z += dz * stats.speed * slowMultiplier * step;
    if (isTouchDevice) player.rotation.y = Math.atan2(dx, dz);

    clampToArena(player.position);
  }

  player.position.y = 0.75 + Math.sin(elapsedTime * 6) * 0.05;

  // Mobile aim
  if (isTouchDevice) {
    aimDir.set(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y));
  }

  // Desktop mouse aim
  if (!isTouchDevice) {
    raycaster.setFromCamera(mouseNDC, camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(aimPlane, hit)) {
      aimPoint.copy(hit);
      const dx2 = hit.x - player.position.x;
      const dz2 = hit.z - player.position.z;
      const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
      if (len2 > 0.001) {
        aimDir.set(dx2 / len2, 0, dz2 / len2);
        player.rotation.y = Math.atan2(aimDir.x, aimDir.z);
      }
    }
  }

  // Base disc follows player
  if (player.userData.baseDisc) {
    player.userData.baseDisc.position.x = player.position.x;
    player.userData.baseDisc.position.z = player.position.z;
  }

  // Trail
  const trailDensity = getGameSettings().quality === 'low' ? 0.22 : 0.6;
  const trailChance = 1 - Math.pow(1 - trailDensity, step);
  if ((dx !== 0 || dz !== 0) && Math.random() < trailChance) {
    const tGeo = new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 5, 4);
    const tMat = new THREE.MeshBasicMaterial({ color: 0x3dffd2, transparent: true, opacity: 0.5 });
    const tMesh = new THREE.Mesh(tGeo, tMat);
    tMesh.position.copy(player.position);
    tMesh.position.y = 0.4;
    scene.add(tMesh);
    playerTrail.push({ mesh: tMesh, life: 0.35, maxLife: 0.35 });
    const trailLimit = getGameSettings().quality === 'low' ? 6 : CONFIG.TRAIL_LENGTH;
    if (playerTrail.length > trailLimit) {
      const old = playerTrail.shift();
      removeAndDispose(old.mesh);
    }
  }
}

function findEnemyInCone(maxDist, halfAngle) {
  let nearest = null, minDist = Infinity;
  const candidates = enemies.slice();
  if (bossActive && bossMesh && bossData && !bossData.introRising) candidates.push(bossMesh);
  for (const e of candidates) {
    const toE = new THREE.Vector3().subVectors(e.position, player.position);
    toE.y = 0;
    const d = toE.length();
    if (d > maxDist || d < 0.001) continue;
    toE.normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(toE.dot(aimDir), -1, 1));
    if (angle <= halfAngle && d < minDist) { minDist = d; nearest = e; }
  }
  return { enemy: nearest, dist: minDist };
}