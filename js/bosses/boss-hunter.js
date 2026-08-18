// ============================================
// THE HUNTER — visibility, tracking, traps, and last-hit duel (wave 20)
// ============================================

const HUNTER_FINAL_PATTERN = ['charge', 'disappear', 'flank', 'charge', 'trap', 'charge'];
const HUNTER_TRAP_COLORS = { red: 0xff334d, blue: 0x36a9ff, purple: 0xb84dff };

function buildHunterMesh(def) {
  const group = new THREE.Group();
  const hideableMaterials = [];
  const bodyMat = new THREE.MeshStandardMaterial({
    color: def.color, emissive: def.emissive, emissiveIntensity: 0.35,
    roughness: 0.82, metalness: 0.12, flatShading: true, transparent: true,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x252a31, emissive: 0x07090c, emissiveIntensity: 0.3,
    roughness: 0.58, metalness: 0.35, flatShading: true, transparent: true,
  });
  const clawMat = new THREE.MeshStandardMaterial({
    color: 0x8b93a1, emissive: 0x171b20, emissiveIntensity: 0.45,
    roughness: 0.3, metalness: 0.65, flatShading: true, transparent: true,
  });
  hideableMaterials.push(bodyMat, armorMat, clawMat);

  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 0), bodyMat);
  torso.scale.set(0.82, 1.25, 0.68);
  torso.position.y = 1.15;
  torso.rotation.x = -0.28;
  group.add(torso);

  const backPlate = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.05, 5), armorMat);
  backPlate.position.set(0, 1.22, -0.28);
  backPlate.rotation.x = -0.22;
  group.add(backPlate);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.43, 0), bodyMat);
  head.scale.set(1, 0.72, 1.25);
  head.position.set(0, 1.9, 0.12);
  group.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff253f, transparent: true, opacity: 1 });
  const eyes = new THREE.Group();
  for (const x of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 5), eyeMat);
    eye.position.set(x, 1.93, 0.5);
    eyes.add(eye);
  }
  group.add(eyes);

  const limbGeo = new THREE.CylinderGeometry(0.1, 0.16, 1.05, 5);
  const clawGeo = new THREE.ConeGeometry(0.11, 0.46, 5);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(limbGeo, bodyMat);
    arm.position.set(side * 0.63, 1.03, 0.08);
    arm.rotation.z = side * -0.72;
    arm.rotation.x = 0.25;
    group.add(arm);

    const claw = new THREE.Mesh(clawGeo, clawMat);
    claw.position.set(side * 1.02, 0.63, 0.28);
    claw.rotation.z = side * -0.78;
    claw.name = side === 1 ? 'hunter-weapon' : '';
    group.add(claw);

    const leg = new THREE.Mesh(limbGeo, bodyMat);
    leg.position.set(side * 0.4, 0.48, -0.08);
    leg.rotation.z = side * -0.24;
    group.add(leg);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.58), clawMat);
    foot.position.set(side * 0.49, 0.05, 0.16);
    group.add(foot);
  }

  group.traverse(child => { if (child.isMesh) child.castShadow = true; });
  group.userData.hunterBodyMaterials = hideableMaterials;
  group.userData.hunterEyeMaterial = eyeMat;
  group.userData.hunterEyes = eyes;
  return group;
}

function spawnHunter(def) {
  showBossWarning(def);
  bossMesh = buildHunterMesh(def);
  bossMesh.position.set(-10, 0, 7);
  scene.add(bossMesh);

  bossData = {
    ...def,
    currentHp: def.hp,
    phase: 1,
    mode: 'hidden',
    modeTimer: 1.45,
    clueTimer: 0.18,
    pounceTimer: 2.8,
    trapTimer: 1.2,
    trapIndex: 0,
    flankSide: 1,
    flankTimer: 0,
    desiredPosition: bossMesh.position.clone(),
    damageMultiplier: 0,
    contactTimer: 0,
    chargeDir: new THREE.Vector3(),
    chargeTravel: 0,
    chargeHitPlayer: false,
    phase4Action: false,
    finalPatternIndex: 0,
    transients: [],
    clues: [],
    traps: [],
    timeouts: [],
    lightingSnapshot: null,
    hunterLightingActive: false,
    flashlightRevealTimer: 0,
    flashlightContact: false,
    flashlight: null,
    visionLight: null,
    flashlightTarget: null,
    lastHitState: null,
    lastTimer: 0,
    lastShotUsed: false,
    core: bossMesh.userData.hunterEyes.children[0],
  };

  chooseHunterFlankPosition(bossData, 9.5);
  setHunterVisual(bossData, 0, 0);
  document.getElementById('boss-name').textContent = 'THE HUNTER · THE HUNT';
  flashCenterMsg('YOU ARE NOT ALONE', '#ff334d');
  triggerScreenShake(0.38);
}

function setHunterVisual(bd, bodyOpacity, eyeOpacity = bodyOpacity) {
  if (!bossMesh) return;
  const bodyAlpha = THREE.MathUtils.clamp(bodyOpacity, 0, 1);
  for (const material of bossMesh.userData.hunterBodyMaterials || []) {
    material.opacity = bodyAlpha;
    material.depthWrite = bodyAlpha > 0.35;
  }
  const eyeMat = bossMesh.userData.hunterEyeMaterial;
  if (eyeMat) {
    eyeMat.opacity = THREE.MathUtils.clamp(eyeOpacity, 0, 1);
    eyeMat.depthWrite = eyeOpacity > 0.35;
  }
}

function updateHunter(delta) {
  const bd = bossData;
  if (!bd || !bossMesh) return;

  bd.contactTimer = Math.max(0, bd.contactTimer - delta);
  updateHunterClues(delta);
  updateHunterTraps(delta);

  if (bd.lastHitState) {
    updateHunterLastHit(delta);
    updateBossHPBar(bd);
    return;
  }

  const ratio = bd.currentHp / bd.hp;
  const nextPhase = ratio <= 0.15 ? 4 : ratio <= 0.4 ? 3 : ratio <= 0.7 ? 2 : 1;
  if (nextPhase !== bd.phase) enterHunterPhase(bd, nextPhase);

  if (bd.phase === 1) updateHunterHunt(delta);
  else if (bd.phase === 2 || bd.phase === 3) updateHunterDarkness(delta);
  else updateHunterFinalCombat(delta);

  bossMesh.lookAt(player.position.x, 1.1, player.position.z);
  bossMesh.rotation.z += (0 - bossMesh.rotation.z) * frameLerp(0.15, delta);
  checkBossProjectileHits(bd, 1.12);
  updateBossHPBar(bd);
}

function enterHunterPhase(bd, phase) {
  bd.phase = phase;
  removeHunterTelegraph(bd);
  bd.mode = phase === 1 ? 'hidden' : phase === 4 ? 'finalIdle' : 'tracking';
  bd.modeTimer = phase === 4 ? 0.55 : 0;
  bd.damageMultiplier = phase === 4 ? 1 : 0;

  if (phase === 2) {
    activateHunterDarkness(bd);
    bd.pounceTimer = 2.4;
    document.getElementById('boss-name').textContent = 'THE HUNTER · THE DARKNESS';
    flashCenterMsg('PHASE II · LIGHT MAKES IT VULNERABLE', '#d9f8ff');
  } else if (phase === 3) {
    activateHunterDarkness(bd);
    bd.pounceTimer = 2.2;
    bd.trapTimer = 0.75;
    document.getElementById('boss-name').textContent = 'THE HUNTER · THE TRAPS';
    flashCenterMsg('PHASE III · RED EXPLODES · BLUE SLOWS · PURPLE DISARMS', '#c45cff');
  } else if (phase === 4) {
    restoreHunterLighting(bd);
    bd.finalPatternIndex = 0;
    setHunterVisual(bd, 1, 1);
    document.getElementById('boss-name').textContent = 'THE HUNTER · NO ESCAPE';
    flashCenterMsg('FINAL PHASE · CHARGE · VANISH · FLANK', '#ff334d');
    triggerColorFlash('rgba(255,70,70,0.28)', 100, 420);
  }
}

function updateHunterHunt(delta) {
  const bd = bossData;
  if (bd.mode === 'hidden') {
    setHunterVisual(bd, 0, 0);
    bd.damageMultiplier = 0;
    bossMesh.position.lerp(bd.desiredPosition, frameLerp(0.18, delta));
    bd.modeTimer -= delta;
    bd.clueTimer -= delta;
    if (bd.clueTimer <= 0) {
      spawnHunterClue(bd);
      bd.clueTimer = 0.28 + Math.random() * 0.48;
    }
    if (bd.modeTimer <= 0) startHunterCharge(bd, 0.7, false);
    return;
  }
  updateHunterCharge(delta);
}

function chooseHunterFlankPosition(bd, distance = 7) {
  const side = Math.random() < 0.5 ? -1 : 1;
  bd.flankSide = side;
  const behind = aimDir.clone().multiplyScalar(-1);
  const angle = side * (0.65 + Math.random() * 0.75);
  const c = Math.cos(angle), s = Math.sin(angle);
  const x = behind.x * c - behind.z * s;
  const z = behind.x * s + behind.z * c;
  const desired = player.position.clone().add(new THREE.Vector3(x, 0, z).multiplyScalar(distance));
  desired.y = 0;
  const radial = Math.sqrt(desired.x * desired.x + desired.z * desired.z);
  const maxRadius = CONFIG.ARENA_RADIUS - 2.2;
  if (radial > maxRadius) desired.multiplyScalar(maxRadius / radial);
  bd.desiredPosition.copy(desired);
}

function startHunterCharge(bd, telegraphTime = 0.7, phase4Action = false) {
  removeHunterTelegraph(bd);
  const toPlayer = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  toPlayer.y = 0;
  if (toPlayer.lengthSq() < 0.01) toPlayer.set(1, 0, 0);
  toPlayer.normalize();
  bd.chargeDir.copy(toPlayer);
  bd.chargeTravel = 0;
  bd.chargeHitPlayer = false;
  bd.phase4Action = phase4Action;
  bd.mode = 'telegraph';
  bd.modeTimer = telegraphTime;
  bd.damageMultiplier = bd.phase <= 1 || bd.phase === 4 ? 1 : 0;
  setHunterVisual(bd, 1, 1);
  bd.chargeTelegraph = createHunterLine(bossMesh.position, bd.chargeDir, 0xff334d, 0.28);
  bd.transients.push({ mesh: bd.chargeTelegraph });
  AudioManager.bossWarning();
}

function createHunterLine(origin, dir, color, opacity) {
  const length = CONFIG.ARENA_RADIUS * 2;
  const geometry = new THREE.BoxGeometry(length, 0.035, 0.1);
  geometry.translate(length / 2, 0, 0);
  const line = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false,
  }));
  line.position.copy(origin);
  line.position.y = 0.08;
  line.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  scene.add(line);
  return line;
}

function removeHunterTelegraph(bd) {
  if (!bd?.chargeTelegraph) return;
  const line = bd.chargeTelegraph;
  removeAndDispose(line);
  bd.transients = (bd.transients || []).filter(entry => (entry.mesh || entry) !== line);
  bd.chargeTelegraph = null;
}

function updateHunterCharge(delta) {
  const bd = bossData;
  if (bd.mode === 'telegraph') {
    bd.modeTimer -= delta;
    if (bd.chargeTelegraph) {
      bd.chargeTelegraph.material.opacity = 0.18 + Math.sin(performance.now() * 0.03) * 0.12;
      bd.chargeTelegraph.position.x = bossMesh.position.x;
      bd.chargeTelegraph.position.z = bossMesh.position.z;
    }
    if (bd.modeTimer <= 0) {
      removeHunterTelegraph(bd);
      bd.mode = 'charging';
      bd.modeTimer = 1.1;
      AudioManager.enemyShoot();
      triggerScreenShake(0.28);
    }
    return;
  }

  if (bd.mode === 'charging') {
    const speed = bd.phase === 4 ? 0.58 : bd.phase >= 2 ? 0.5 : 0.54;
    const distance = speed * frameScale(delta);
    bossMesh.position.addScaledVector(bd.chargeDir, distance);
    bd.chargeTravel += distance;
    bd.modeTimer -= delta;

    if (!bd.chargeHitPlayer && flatDist(bossMesh.position, player.position) < 1.05) {
      bd.chargeHitPlayer = true;
      if (invincibleTimer <= 0) {
        stats.hp -= bd.damage + (bd.phase === 4 ? 10 : 0);
        invincibleTimer = 0.45;
        triggerHealthFlash();
        triggerScreenShake(0.5);
        AudioManager.playerHit();
      }
    }

    const wall = Math.sqrt(bossMesh.position.x ** 2 + bossMesh.position.z ** 2) >= CONFIG.ARENA_RADIUS - 1;
    if (bd.modeTimer <= 0 || bd.chargeTravel >= 23 || wall) {
      bd.mode = 'recovery';
      bd.modeTimer = bd.phase === 1 ? 0.55 : 0.32;
      bd.damageMultiplier = bd.phase === 1 || bd.phase === 4 ? 1 : 0;
    }
    return;
  }

  if (bd.mode === 'recovery') {
    bd.modeTimer -= delta;
    if (bd.modeTimer > 0) return;
    if (bd.phase === 1) {
      setHunterVisual(bd, 0, 0);
      bd.damageMultiplier = 0;
      chooseHunterFlankPosition(bd, 8 + Math.random() * 3);
      bd.mode = 'hidden';
      bd.modeTimer = 1.05 + Math.random() * 1.2;
      bd.clueTimer = 0.18;
    } else if (bd.phase === 4 && bd.phase4Action) {
      bd.finalPatternIndex = (bd.finalPatternIndex + 1) % HUNTER_FINAL_PATTERN.length;
      bd.mode = 'finalIdle';
      bd.modeTimer = 0.18;
      bd.damageMultiplier = 1;
    } else {
      bd.mode = 'tracking';
      bd.pounceTimer = 2.4 + Math.random() * 1.1;
    }
  }
}

function spawnHunterClue(bd) {
  const roll = bd.trapIndex++ % 4;
  let mesh;
  if (roll === 0) {
    const material = new THREE.MeshBasicMaterial({ color: 0x020205, transparent: true, opacity: 0.42, depthWrite: false });
    mesh = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(1.8, 0.55, 1);
    mesh.position.copy(bossMesh.position).setY(0.04);
  } else if (roll === 1) {
    mesh = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff253f, transparent: true, opacity: 0.9 });
    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), mat);
      eye.position.x = x;
      mesh.add(eye);
    }
    mesh.position.copy(bossMesh.position).setY(1.65);
  } else if (roll === 2) {
    mesh = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x63707b, transparent: true, opacity: 0.38 });
    const forward = bd.chargeDir.lengthSq() > 0 ? bd.chargeDir : aimDir;
    for (let i = 0; i < 4; i++) {
      const print = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.36), mat);
      print.position.set((i % 2 ? 0.2 : -0.2) - forward.x * i * 0.38, 0.04, -forward.z * i * 0.38);
      print.rotation.y = Math.atan2(forward.x, forward.z);
      mesh.add(print);
    }
    mesh.position.copy(bossMesh.position).setY(0);
  } else {
    const mat = new THREE.MeshBasicMaterial({ color: 0x090b10, transparent: true, opacity: 0.55, depthWrite: false });
    mesh = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.4, 5), mat);
    mesh.position.copy(bossMesh.position).setY(1.1);
  }
  scene.add(mesh);
  const clue = { mesh, life: roll === 3 ? 0.42 : 0.62, maxLife: roll === 3 ? 0.42 : 0.62, drift: roll === 3 ? (Math.random() < 0.5 ? -1 : 1) * 8 : 0 };
  bd.clues.push(clue);
  bd.transients.push(clue);
}

function updateHunterClues(delta) {
  const bd = bossData;
  if (!bd?.clues) return;
  for (let i = bd.clues.length - 1; i >= 0; i--) {
    const clue = bd.clues[i];
    clue.life -= delta;
    clue.mesh.position.x += clue.drift * delta;
    const alpha = Math.max(0, clue.life / clue.maxLife);
    clue.mesh.traverse(child => {
      if (child.material?.opacity !== undefined) child.material.opacity = alpha * 0.58;
    });
    if (clue.life <= 0) {
      removeAndDispose(clue.mesh);
      bd.transients = bd.transients.filter(entry => entry !== clue);
      bd.clues.splice(i, 1);
    }
  }
}

function activateHunterDarkness(bd) {
  if (bd.hunterLightingActive) return;
  bd.hunterLightingActive = true;
  bd.lightingSnapshot = {
    ambientColor: ambientLight?.color.getHex(), ambientIntensity: ambientLight?.intensity,
    dirColor: dirLight?.color.getHex(), dirIntensity: dirLight?.intensity,
    background: scene.background?.getHex(), fogColor: scene.fog?.color.getHex(),
    fogNear: scene.fog?.near, fogFar: scene.fog?.far,
  };
  if (ambientLight) { ambientLight.color.setHex(0x020309); ambientLight.intensity = 0.035; }
  if (dirLight) { dirLight.color.setHex(0x080b12); dirLight.intensity = 0.04; }
  if (scene.background) scene.background.setHex(0x000103);
  if (scene.fog) {
    scene.fog.color.setHex(0x000103);
    scene.fog.near = 4.5;
    scene.fog.far = 22;
  }

  bd.visionLight = new THREE.PointLight(0x8fcfff, 1.6, 7.2, 1.7);
  bd.flashlight = new THREE.SpotLight(0xe2f7ff, 4.8, 15, Math.PI / 7, 0.5, 1.25);
  bd.flashlightTarget = new THREE.Object3D();
  bd.flashlight.target = bd.flashlightTarget;
  scene.add(bd.visionLight, bd.flashlight, bd.flashlightTarget);
  document.body.classList.add('hunter-darkness');
}

function restoreHunterLighting(bd) {
  if (!bd?.hunterLightingActive) {
    document.body.classList.remove('hunter-darkness');
    return;
  }
  const snapshot = bd.lightingSnapshot;
  if (snapshot) {
    if (ambientLight) {
      if (Number.isFinite(snapshot.ambientColor)) ambientLight.color.setHex(snapshot.ambientColor);
      if (Number.isFinite(snapshot.ambientIntensity)) ambientLight.intensity = snapshot.ambientIntensity;
    }
    if (dirLight) {
      if (Number.isFinite(snapshot.dirColor)) dirLight.color.setHex(snapshot.dirColor);
      if (Number.isFinite(snapshot.dirIntensity)) dirLight.intensity = snapshot.dirIntensity;
    }
    if (scene.background && Number.isFinite(snapshot.background)) scene.background.setHex(snapshot.background);
    if (scene.fog) {
      if (Number.isFinite(snapshot.fogColor)) scene.fog.color.setHex(snapshot.fogColor);
      if (Number.isFinite(snapshot.fogNear)) scene.fog.near = snapshot.fogNear;
      if (Number.isFinite(snapshot.fogFar)) scene.fog.far = snapshot.fogFar;
    }
  }
  for (const light of [bd.visionLight, bd.flashlight]) {
    if (!light) continue;
    scene.remove(light);
    if (typeof light.dispose === 'function') light.dispose();
  }
  if (bd.flashlightTarget) scene.remove(bd.flashlightTarget);
  bd.visionLight = null;
  bd.flashlight = null;
  bd.flashlightTarget = null;
  bd.hunterLightingActive = false;
  document.body.classList.remove('hunter-darkness');
}

function updateHunterFlashlight(delta) {
  const bd = bossData;
  if (!bd.flashlight || !bd.flashlightTarget) return;
  bd.visionLight.position.copy(player.position).setY(2.1);
  bd.flashlight.position.copy(player.position).setY(2.35);
  bd.flashlightTarget.position.copy(player.position).addScaledVector(aimDir, 10).setY(0.7);

  const toHunter = new THREE.Vector3().subVectors(bossMesh.position, player.position);
  toHunter.y = 0;
  const distance = toHunter.length();
  if (distance > 0.001) toHunter.normalize();
  bd.flashlightContact = distance <= 14.5 && toHunter.dot(aimDir) >= Math.cos(Math.PI / 7);
  bd.flashlightRevealTimer = bd.flashlightContact
    ? 0.16
    : Math.max(0, bd.flashlightRevealTimer - delta);

  const revealed = bd.flashlightRevealTimer > 0;
  setHunterVisual(bd, revealed ? 1 : 0.035, revealed ? 1 : 0.1);
  bd.damageMultiplier = revealed ? 1 : 0;
  if (revealed && Math.random() < 0.14) spawnDeathParticles(bossMesh.position.clone().setY(1), 0xd9f8ff);
}

function updateHunterDarkness(delta) {
  const bd = bossData;
  updateHunterFlashlight(delta);

  if (bd.mode === 'telegraph' || bd.mode === 'charging' || bd.mode === 'recovery') {
    updateHunterCharge(delta);
    updateHunterFlashlight(0);
  } else {
    bd.flankTimer -= delta;
    if (bd.flankTimer <= 0) {
      chooseHunterFlankPosition(bd, 5.6 + Math.random() * 2.2);
      bd.flankTimer = 0.75 + Math.random() * 0.7;
    }
    bossMesh.position.lerp(bd.desiredPosition, frameLerp(0.105, delta));
    bd.pounceTimer -= delta;
    if (bd.pounceTimer <= 0) startHunterCharge(bd, 0.42, false);
  }

  if (bd.phase === 3) {
    bd.trapTimer -= delta;
    if (bd.trapTimer <= 0) {
      placeHunterTrap(bd);
      bd.trapTimer = 2 + Math.random() * 0.75;
    }
  }

  if (flatDist(bossMesh.position, player.position) < 0.9 && bd.contactTimer <= 0 && invincibleTimer <= 0) {
    stats.hp -= bd.damage;
    bd.contactTimer = 0.8;
    invincibleTimer = 0.35;
    triggerHealthFlash();
  }
}

function createHunterTrapMesh(type) {
  const color = HUNTER_TRAP_COLORS[type];
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.08, 6, 18),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = Math.PI / 2;
  const center = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  center.rotation.x = -Math.PI / 2;
  center.position.y = 0.015;
  group.add(ring, center);
  return group;
}

function placeHunterTrap(bd, forcedType = null) {
  if (!bd || bd.traps.length >= 12) return;
  const types = ['red', 'blue', 'purple'];
  const type = forcedType || types[bd.trapIndex++ % types.length];
  const angle = Math.random() * Math.PI * 2;
  const distance = 2.5 + Math.random() * 5.5;
  const position = player.position.clone().add(new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance));
  const radial = Math.sqrt(position.x ** 2 + position.z ** 2);
  const maxRadius = CONFIG.ARENA_RADIUS - 1.5;
  if (radial > maxRadius) position.multiplyScalar(maxRadius / radial);
  position.y = 0.08;
  const mesh = createHunterTrapMesh(type);
  mesh.position.copy(position);
  scene.add(mesh);
  const trap = { mesh, type, age: 0, armed: false };
  bd.traps.push(trap);
  bd.transients.push(trap);
}

function updateHunterTraps(delta) {
  const bd = bossData;
  if (!bd?.traps) return;
  for (let i = bd.traps.length - 1; i >= 0; i--) {
    const trap = bd.traps[i];
    trap.age += delta;
    trap.armed = trap.age >= 0.35;
    trap.mesh.rotation.y += delta * (trap.type === 'red' ? 2.6 : 1.3);
    const pulse = 0.82 + Math.sin(elapsedTime * 7 + i) * 0.16;
    trap.mesh.scale.setScalar(pulse);
    if (!trap.armed || flatDist(trap.mesh.position, player.position) >= 0.68) continue;

    if (trap.type === 'red') {
      if (invincibleTimer <= 0) {
        stats.hp -= 34;
        invincibleTimer = 0.45;
        triggerHealthFlash();
      }
      triggerScreenShake(0.48);
      AudioManager.explosion();
      flashCenterMsg('RED TRAP · DETONATED', '#ff334d');
    } else if (trap.type === 'blue') {
      player.userData.slowedUntil = Math.max(player.userData.slowedUntil || 0, elapsedTime + 3.5);
      flashCenterMsg('BLUE TRAP · MOVEMENT SLOWED', '#36a9ff');
      AudioManager.playerHit();
    } else {
      player.userData.weaponsDisabledUntil = Math.max(player.userData.weaponsDisabledUntil || 0, elapsedTime + 3);
      flashCenterMsg('PURPLE TRAP · WEAPONS OFFLINE', '#b84dff');
      AudioManager.playerHit();
    }

    spawnDeathParticles(trap.mesh.position.clone(), HUNTER_TRAP_COLORS[trap.type]);
    removeAndDispose(trap.mesh);
    bd.transients = bd.transients.filter(entry => entry !== trap);
    bd.traps.splice(i, 1);
  }
}

function updateHunterFinalCombat(delta) {
  const bd = bossData;
  setHunterVisual(bd, bd.mode === 'finalDisappear' || bd.mode === 'finalFlank' ? 0 : 1,
    bd.mode === 'finalDisappear' || bd.mode === 'finalFlank' ? 0 : 1);

  if (bd.mode === 'telegraph' || bd.mode === 'charging' || bd.mode === 'recovery') {
    updateHunterCharge(delta);
    return;
  }

  if (bd.mode === 'finalIdle') {
    bd.modeTimer -= delta;
    if (bd.modeTimer <= 0) startHunterFinalAction(bd);
  } else if (bd.mode === 'finalDisappear') {
    bd.damageMultiplier = 0;
    bd.modeTimer -= delta;
    if (bd.modeTimer <= 0) advanceHunterFinalPattern(bd);
  } else if (bd.mode === 'finalFlank') {
    bd.damageMultiplier = 0;
    bossMesh.position.lerp(bd.desiredPosition, frameLerp(0.22, delta));
    bd.modeTimer -= delta;
    if (bd.modeTimer <= 0) {
      setHunterVisual(bd, 1, 1);
      bd.damageMultiplier = 1;
      advanceHunterFinalPattern(bd);
    }
  } else if (bd.mode === 'finalPause') {
    bd.damageMultiplier = 1;
    bd.modeTimer -= delta;
    if (bd.modeTimer <= 0) advanceHunterFinalPattern(bd);
  }
}

function startHunterFinalAction(bd) {
  const action = HUNTER_FINAL_PATTERN[bd.finalPatternIndex];
  if (action === 'charge') {
    startHunterCharge(bd, 0.34, true);
  } else if (action === 'disappear') {
    bd.mode = 'finalDisappear';
    bd.modeTimer = 0.48;
    bd.damageMultiplier = 0;
    setHunterVisual(bd, 0, 0);
  } else if (action === 'flank') {
    chooseHunterFlankPosition(bd, 5.2);
    bd.mode = 'finalFlank';
    bd.modeTimer = 0.58;
    bd.damageMultiplier = 0;
  } else {
    placeHunterTrap(bd);
    bd.mode = 'finalPause';
    bd.modeTimer = 0.36;
  }
}

function advanceHunterFinalPattern(bd) {
  bd.finalPatternIndex = (bd.finalPatternIndex + 1) % HUNTER_FINAL_PATTERN.length;
  bd.mode = 'finalIdle';
  bd.modeTimer = 0.12;
}

function clearHunterOffensiveObjects() {
  while (projectiles.length) releasePlayerProjectile(projectiles.pop());
  fireballs.forEach(removeAndDispose);
  fireballs.length = 0;
  rockets.forEach(removeAndDispose);
  rockets.length = 0;
  burnPatches.forEach(patch => removeAndDispose(patch.mesh));
  burnPatches.length = 0;
  orbitalBlades.forEach(removeAndDispose);
  orbitalBlades.length = 0;
  railBeams.forEach(beam => removeAndDispose(beam.mesh));
  railBeams.length = 0;
  if (plasmaBeamMesh) plasmaBeamMesh.visible = false;
}

function startHunterLastHit() {
  const bd = bossData;
  if (!bd || bd.type !== 'hunter' || bd.lastHitState) return;
  removeHunterTelegraph(bd);
  restoreHunterLighting(bd);
  clearHunterOffensiveObjects();
  for (const trap of bd.traps) removeAndDispose(trap.mesh);
  bd.transients = bd.transients.filter(entry => !bd.traps.includes(entry));
  bd.traps.length = 0;
  bd.phase = 5;
  bd.lastHitState = 'prepare';
  bd.lastTimer = 0.7;
  bd.lastShotUsed = false;
  bd.damageMultiplier = 0;
  setHunterVisual(bd, 1, 1);
  const hunterWeapon = bossMesh.getObjectByName('hunter-weapon');
  if (hunterWeapon) hunterWeapon.visible = false;
  player.userData.weaponLockedByHunter = true;
  player.userData.weaponsDisabledUntil = 0;
  setPlayerWeaponVisible(false);
  document.getElementById('boss-name').textContent = 'THE HUNTER · THE LAST HIT';
  flashCenterMsg('5% · WEAPONS LOST · DODGE THE CHARGE', '#ffffff');
  triggerColorFlash('rgba(255,255,255,0.38)', 100, 480);
  triggerScreenShake(0.6);
}

function positionHunterForLastCharge(bd) {
  const angle = Math.random() * Math.PI * 2;
  const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  bossMesh.position.copy(player.position).addScaledVector(outward, 10);
  bossMesh.position.y = 0;
  const radial = Math.sqrt(bossMesh.position.x ** 2 + bossMesh.position.z ** 2);
  const maxRadius = CONFIG.ARENA_RADIUS - 2;
  if (radial > maxRadius) bossMesh.position.multiplyScalar(maxRadius / radial);
  bd.chargeDir.subVectors(player.position, bossMesh.position).setY(0);
  if (bd.chargeDir.lengthSq() < 0.01) bd.chargeDir.copy(outward).multiplyScalar(-1);
  bd.chargeDir.normalize();
  bd.chargeTravel = 0;
  bd.chargeHitPlayer = false;
}

function updateHunterLastHit(delta) {
  const bd = bossData;
  if (bd.lastHitState === 'prepare') {
    bd.lastTimer -= delta;
    if (bd.lastTimer <= 0) {
      positionHunterForLastCharge(bd);
      bd.lastHitState = 'telegraph';
      bd.lastTimer = 0.7;
      bd.chargeTelegraph = createHunterLine(bossMesh.position, bd.chargeDir, 0xffffff, 0.34);
      bd.transients.push({ mesh: bd.chargeTelegraph });
      flashCenterMsg('DODGE!', '#ff334d');
    }
    return;
  }

  if (bd.lastHitState === 'telegraph') {
    bd.lastTimer -= delta;
    if (bd.chargeTelegraph) bd.chargeTelegraph.material.opacity = 0.24 + Math.sin(performance.now() * 0.04) * 0.18;
    if (bd.lastTimer <= 0) {
      removeHunterTelegraph(bd);
      bd.lastHitState = 'charging';
      AudioManager.enemyShoot();
    }
    return;
  }

  if (bd.lastHitState === 'charging') {
    const distance = 0.62 * frameScale(delta);
    bossMesh.position.addScaledVector(bd.chargeDir, distance);
    bd.chargeTravel += distance;
    if (flatDist(bossMesh.position, player.position) < 0.88) {
      stats.hp = 0;
      bd.lastHitState = 'failed';
      triggerHealthFlash();
      triggerScreenShake(0.75);
      AudioManager.playerHit();
      return;
    }
    const radial = Math.sqrt(bossMesh.position.x ** 2 + bossMesh.position.z ** 2);
    if (radial >= CONFIG.ARENA_RADIUS - 0.72 || bd.chargeTravel >= CONFIG.ARENA_RADIUS * 2.3) {
      bd.lastHitState = 'stunned';
      bd.lastTimer = 5;
      bossMesh.rotation.z = Math.PI / 2;
      setPlayerWeaponVisible(true);
      triggerScreenShake(0.85);
      AudioManager.explosion();
      spawnDeathParticles(bossMesh.position.clone().setY(0.8), 0xffffff);
      flashCenterMsg(isTouchDevice ? 'WALL CRASH · FINAL SHOT!' : 'WALL CRASH · AIM AND CLICK!', '#3dffd2');
    }
    return;
  }

  if (bd.lastHitState === 'stunned') {
    bd.lastTimer -= delta;
    if (isTouchDevice && bd.lastTimer <= 4.35) {
      tryHunterFinalShot(true);
      return;
    }
    if (bd.lastTimer <= 0) {
      stats.hp = 0;
      bd.lastHitState = 'failed';
      triggerHealthFlash();
      flashCenterMsg('THE HUNTER RECOVERS', '#ff334d');
    }
  }
}

function tryHunterFinalShot(forceAim = false) {
  const bd = bossData;
  if (!bd || bd.type !== 'hunter' || bd.lastHitState !== 'stunned' || bd.lastShotUsed) return false;
  const toHunter = new THREE.Vector3().subVectors(bossMesh.position, player.position).setY(0);
  if (toHunter.lengthSq() > 0.01) toHunter.normalize();
  if (!forceAim && toHunter.dot(aimDir) < 0.58) {
    flashCenterMsg('AIM AT THE STUNNED HUNTER', '#ffd23d');
    return false;
  }

  bd.lastShotUsed = true;
  bd.lastHitState = 'finished';
  const from = player.position.clone().setY(0.82);
  const direction = new THREE.Vector3().subVectors(bossMesh.position, from).normalize();
  const finalLine = createHunterLine(from, direction, 0x3dffd2, 1);
  finalLine.scale.z = 4;
  bd.transients.push({ mesh: finalLine });
  spawnDeathParticles(bossMesh.position.clone().setY(1), 0x3dffd2);
  triggerColorFlash('rgba(100,255,225,0.7)', 80, 520);
  triggerScreenShake(1);
  AudioManager.critHit();
  player.userData.weaponLockedByHunter = false;
  setPlayerWeaponVisible(true);
  bd.currentHp = 0;
  bd.damageMultiplier = 1;
  bd.timeouts.push(setTimeout(() => {
    if (bossData === bd && bossActive && bd.lastHitState === 'finished') killBoss();
  }, 160));
  return true;
}

function cleanupHunterEncounter(bd) {
  if (!bd || bd.type !== 'hunter') return;
  for (const timeout of (bd.timeouts || [])) clearTimeout(timeout);
  bd.timeouts = [];
  removeHunterTelegraph(bd);
  restoreHunterLighting(bd);
  document.body.classList.remove('hunter-darkness');
  if (player?.userData) {
    player.userData.slowedUntil = 0;
    player.userData.weaponsDisabledUntil = 0;
    player.userData.weaponLockedByHunter = false;
  }
  setPlayerWeaponVisible(true);
  const hunterWeapon = bossMesh?.getObjectByName('hunter-weapon');
  if (hunterWeapon) hunterWeapon.visible = true;
  for (const clue of bd.clues || []) removeAndDispose(clue.mesh);
  for (const trap of bd.traps || []) removeAndDispose(trap.mesh);
  bd.clues = [];
  bd.traps = [];
  for (const entry of (bd.transients || [])) removeAndDispose(entry.mesh || entry);
  bd.transients = [];
}
