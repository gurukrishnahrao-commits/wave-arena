// ============================================
// THE HIVE MOTHER — spider boss, eggs, acid, nests
// ============================================

function buildHiveMotherMesh(def) {
  const s = def.size;
  const group = new THREE.Group();

  const shellMat = new THREE.MeshStandardMaterial({ flatShading: true, color: def.color, emissive: 0x0a3d14, emissiveIntensity: 0.55, metalness: 0.25, roughness: 0.55 });
  const plateMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x1a6a2e, emissive: 0x0a3d14, emissiveIntensity: 0.4, metalness: 0.3, roughness: 0.5 });
  const glowMat = new THREE.MeshStandardMaterial({ flatShading: true, color: def.emissive, emissive: def.emissive, emissiveIntensity: 1.4, roughness: 0.4 });

  // Abdomen
  const abdomen = new THREE.Group();
  abdomen.position.set(0, s * 0.1, -s * 0.45);
  const sacGeo = new THREE.SphereGeometry(s * 0.68, 8, 7);
  sacGeo.scale(1.15, 0.95, 1.3);
  abdomen.add(new THREE.Mesh(sacGeo, shellMat));
  for (let i = 0; i < 3; i++) {
    const ringGeo = new THREE.TorusGeometry(s * (0.62 - i * 0.1), s * 0.05, 4, 10);
    const ring = new THREE.Mesh(ringGeo, plateMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, s * 0.05, -s * 0.15 + i * s * 0.28);
    abdomen.add(ring);
  }
  group.add(abdomen);

  // Thorax
  const thoraxGeo = new THREE.SphereGeometry(s * 0.4, 7, 6);
  const thorax = new THREE.Mesh(thoraxGeo, shellMat);
  thorax.position.set(0, s * 0.15, s * 0.05);
  thorax.scale.set(1, 0.9, 0.9);
  group.add(thorax);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.3, 6, 5), shellMat);
  head.position.set(0, s * 0.22, s * 0.55);
  head.scale.set(0.9, 0.85, 1);
  group.add(head);

  // Mandibles
  for (const side of [-1, 1]) {
    const mandible = new THREE.Mesh(new THREE.ConeGeometry(s * 0.05, s * 0.32, 4), plateMat);
    mandible.position.set(side * s * 0.16, s * 0.08, s * 0.75);
    mandible.rotation.x = Math.PI / 2.3;
    mandible.rotation.z = side * 0.5;
    group.add(mandible);
  }

  // Eyes
  for (let i = 0; i < 3; i++) {
    const spread = (i - 1) * s * 0.14;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.06, 5, 4), glowMat);
    eye.position.set(spread, s * 0.28, s * 0.78);
    group.add(eye);
  }

  // Horns
  for (let i = 0; i < 4; i++) {
    const a = (i / 3 - 0.5) * 1.6;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(s * 0.05, s * 0.35, 4), plateMat);
    horn.position.set(Math.sin(a) * s * 0.2, s * 0.42, s * 0.55 - Math.cos(a) * s * 0.05);
    horn.rotation.z = -Math.sin(a) * 0.9;
    horn.rotation.x = -0.4;
    group.add(horn);
  }

  // Weak point
  const weakpoint = new THREE.Mesh(new THREE.SphereGeometry(s * 0.22, 8, 6), glowMat);
  weakpoint.position.set(0, -s * 0.15, -s * 0.35);
  group.add(weakpoint);
  const weakpointLight = new THREE.PointLight(def.emissive, 1.2, s * 3);
  weakpointLight.position.copy(weakpoint.position);
  group.add(weakpointLight);

  const bioLight = new THREE.PointLight(def.color, 1.0, s * 5);
  bioLight.position.set(0, -s * 0.3, 0);
  group.add(bioLight);

  // Spider legs
  const legs = [];
  const legPositions = [-0.55, -0.2, 0.18, 0.5];
  for (const side of [-1, 1]) {
    legPositions.forEach((zOff, idx) => {
      const hip = new THREE.Group();
      hip.position.set(side * s * 0.35, s * 0.12, zOff * s);
      group.add(hip);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06, s * 0.045, s * 0.55, 5), plateMat);
      upper.position.set(side * s * 0.28, -s * 0.02, 0);
      upper.rotation.z = side * 1.05;
      hip.add(upper);

      const knee = new THREE.Group();
      knee.position.set(side * s * 0.52, -s * 0.18, 0);
      hip.add(knee);

      const lower = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.045, s * 0.02, s * 0.6, 5), shellMat);
      lower.position.set(side * s * 0.2, -s * 0.28, 0);
      lower.rotation.z = side * 0.5;
      knee.add(lower);

      legs.push({ hip, knee, side, phase: (idx + (side > 0 ? 0.5 : 0)) * 1.4 });
    });
  }

  group.traverse(c => { if (c.isMesh) c.castShadow = true; });
  group.material = shellMat;
  group.userData.hiveParts = { abdomen, thorax, head, weakpoint, weakpointLight, bioLight, legs, shellMat, plateMat, glowMat };
  return group;
}

function animateHiveMotherMesh(bd, delta, moving, chargeState) {
  const parts = bossMesh.userData.hiveParts;
  if (!parts) return;

  const enrageMult = bd.enraged ? 1.5 : 1;

  if (chargeState === 'crouch') {
    const ch = bd.charge;
    const p = 1 - THREE.MathUtils.clamp(ch.timer / ch.crouchDur, 0, 1);
    for (const leg of parts.legs) {
      leg.hip.rotation.x = leg.side * (0.3 + p * 0.9);
      leg.knee.rotation.x = 0.2 + p * 1.15;
    }
    bossMesh.scale.set(1 + p * 0.16, 1 - p * 0.32, 1 + p * 0.16);
    parts.abdomen.rotation.x = -p * p * 0.4;
  } else if (chargeState === 'airborne') {
    const ch = bd.charge;
    const t = Math.min(1, ch.airT / ch.airDur);
    const arc = Math.sin(t * Math.PI);
    for (const leg of parts.legs) {
      leg.hip.rotation.x = leg.side * (1.2 - t * 0.35);
      leg.knee.rotation.x = 0.9 - arc * 0.5;
    }
    bossMesh.scale.set(1 - arc * 0.15, 1 + arc * 0.22, 1 - arc * 0.15);
    bossMesh.rotation.x = -arc * 0.18;
    parts.abdomen.rotation.x = -0.1;
  } else {
    bossMesh.scale.set(1, 1, 1);
    bossMesh.rotation.x = 0;
    parts.abdomen.rotation.x = 0;
    const walkSpeed = (moving ? 6 : 2.2) * enrageMult;
    const strideAmp = chargeState === 'stunned' ? 0.05 : (moving ? 0.55 : 0.22);
    for (const leg of parts.legs) {
      const cycle = Math.sin(bd.bobT * walkSpeed + leg.phase);
      leg.hip.rotation.x = cycle * strideAmp;
      leg.knee.rotation.x = Math.max(0, -cycle) * strideAmp * 1.3 + 0.2;
    }
  }

  // Abdomen breathing
  const breathe = 1 + Math.sin(bd.bobT * (bd.enraged ? 3.2 : 1.8)) * (bd.enraged ? 0.07 : 0.04);
  parts.abdomen.scale.set(breathe, breathe * 0.98, breathe);

  // Weak point
  const isOpen = bd.weakpointOpen !== false;
  const pulse = isOpen ? 1 + Math.sin(bd.bobT * 4) * 0.18 : 0.35;
  parts.weakpoint.scale.set(pulse, pulse, pulse);
  const exposedBoost = chargeState === 'stunned' ? 1.8 : 1;
  parts.weakpoint.material.emissiveIntensity = isOpen ? (1.2 + Math.sin(bd.bobT * 4) * 0.4) * exposedBoost : 0.25;
  parts.weakpointLight.intensity = isOpen ? (1.0 + Math.sin(bd.bobT * 4) * 0.5) * exposedBoost : 0.15;

  // Head bob
  parts.head.position.y = bd.size * 0.22 + Math.sin(bd.bobT * 1.8 + 1) * 0.03 * bd.size;
}

function spawnHiveMotherIntro(def) {
  const introId = ++hiveIntroId;
  const spawnPos = new THREE.Vector3(0, 0, 0);
  bossMesh = null;
  bossData = null;

  const centerEl = document.getElementById('center-msg');
  centerMsgGen++;
  centerEl.style.transition = '';
  centerEl.style.opacity = 1;

  // Stage 1
  if (ambientLight) { ambientLight.intensity = 0.35; ambientLight.color.setHex(0x224422); }
  centerEl.innerHTML = `<div style="color:#33ff55;font-size:14px;letter-spacing:6px;text-shadow:0 0 16px #33ff55;">⚠ BIOLOGICAL ENTITY DETECTED ⚠</div>`;
  triggerScreenShake(0.15);

  const pulseInterval = setInterval(() => {
    if (introId !== hiveIntroId) { clearInterval(pulseInterval); return; }
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 6;
    const pos = new THREE.Vector3(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    const geo = new THREE.CircleGeometry(0.6, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x33ff55, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const pulse = new THREE.Mesh(geo, mat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.copy(pos);
    scene.add(pulse);
    tweenValue(0.6, t => { pulse.scale.set(1 + t * 2, 1 + t * 2, 1); pulse.material.opacity = 0.6 * (1 - t); },
      () => { removeAndDispose(pulse); });
  }, 220);

  // Stage 2
  setTimeout(() => {
    if (introId !== hiveIntroId) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        if (introId !== hiveIntroId) return;
        const a = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
        spawnDeathParticles(new THREE.Vector3(Math.cos(a) * 2.4, 0.3, Math.sin(a) * 2.4), 0xaa44ff);
        triggerScreenShake(0.15);
      }, i * 90);
    }
  }, 500);

  // Stage 3
  let cocoon;
  setTimeout(() => {
    if (introId !== hiveIntroId) return;
    centerEl.innerHTML = `
      <div style="color:#ff6a1a;font-size:14px;letter-spacing:6px;margin-bottom:10px;">⚠ WARNING ⚠</div>
      <div style="background:#33ff55;height:3px;width:300px;margin:0 auto 14px;box-shadow:0 0 12px #33ff55;"></div>
      <h1 style="font-size:36px;color:#66ff88;text-shadow:0 0 30px #66ff88;">${def.name}</h1>
    `;
    const cocoonGeo = new THREE.SphereGeometry(def.size * 0.85, 8, 8);
    cocoonGeo.scale(0.8, 1.3, 0.8);
    const cocoonMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x3a5a3a, emissive: 0x662211, emissiveIntensity: 0.4, roughness: 0.8 });
    cocoon = new THREE.Mesh(cocoonGeo, cocoonMat);
    cocoon.position.set(0, -def.size, 0);
    scene.add(cocoon);
    triggerScreenShake(0.4);
    tweenValue(0.9, t => { if (introId !== hiveIntroId || !cocoon) return; cocoon.position.y = -def.size + t * def.size * 1.05; });
  }, 1200);

  // Stage 4
  setTimeout(() => {
    if (introId !== hiveIntroId) return;
    clearInterval(pulseInterval);
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (introId !== hiveIntroId) return;
        if (cocoon) spawnDeathParticles(cocoon.position.clone(), 0x33ff55);
        triggerScreenShake(0.3);
      }, i * 140);
    }
  }, 2200);

  setTimeout(() => {
    if (introId !== hiveIntroId) return;
    document.getElementById('boss-name').textContent = def.name;
    if (cocoon) { removeAndDispose(cocoon); cocoon = null; }

    bossMesh = buildHiveMotherMesh(def);
    bossMesh.position.set(spawnPos.x, def.size * 0.55, spawnPos.z);
    bossMesh.scale.set(0.1, 0.1, 0.1);
    scene.add(bossMesh);

    const parts = bossMesh.userData.hiveParts;
    for (const leg of parts.legs) { leg.hip.rotation.x = leg.side * 1.1; leg.knee.rotation.x = 1.3; }

    bossData = {
      ...def, currentHp: def.hp, core: parts.weakpoint,
      phase: 1, phase2Triggered: false, phase3Triggered: false,
      madQueen: false, enraged: false,
      attackTimer: 2.5, acidTimer: 3, eggTimer: 5, chargeTimer: 8,
      activeAttack: null, eggs: [], puddles: [], nests: [],
      weakpointOpen: true, weakpointTimer: 0, enrageSparkTimer: 0,
      charge: null, shockwaves: [], stunTimer: 0,
      bobT: Math.random() * 10, acidProjectiles: [],
    };

    triggerScreenShake(0.6);
    tweenValue(0.9, t => {
      if (introId !== hiveIntroId || !bossMesh) return;
      const e = 1 - (1 - t) * (1 - t);
      const s = 0.1 + 0.9 * e;
      bossMesh.scale.set(s, s, s);
      for (const leg of parts.legs) {
        leg.hip.rotation.x = leg.side * 1.1 * (1 - e);
        leg.knee.rotation.x = 1.3 * (1 - e) + 0.2 * e;
      }
    });
  }, 2800);

  setTimeout(() => {
    if (introId !== hiveIntroId) return;
    const bar = document.getElementById('boss-bar');
    bar.style.display = 'block';
    bar.style.transition = 'none';
    bar.style.transform = 'translate(-50%, -40px)';
    bar.style.opacity = '0';
    document.getElementById('boss-hp-fill').style.width = '100%';
    document.getElementById('boss-hp-text').textContent = `${def.hp} / ${def.hp}`;
    document.getElementById('boss-shield-bar').style.display = 'none';
    requestAnimationFrame(() => {
      bar.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
      bar.style.transform = 'translate(-50%, 0)';
      bar.style.opacity = '1';
    });
  }, 3600);

  setTimeout(() => {
    if (introId !== hiveIntroId) return;
    centerEl.style.transition = 'opacity 1s';
    centerEl.style.opacity = 0;
    setTimeout(() => { if (introId === hiveIntroId) { centerEl.style.transition = ''; centerEl.innerHTML = ''; } }, 1000);
  }, 4000);
}

// Hatchling spawner
function spawnHatchling(pos) {
  const type = { color: 0x66ff44, emissive: 0x224411, size: 0.4, shape: 'octa' };
  const mesh = buildLowPolyAlien(type);
  mesh.position.set(pos.x, type.size, pos.z);
  mesh.castShadow = true;
  mesh.scale.set(0.01, 0.01, 0.01);

  const hp = 2 + Math.floor(waveNumber * 0.3);
  mesh.userData = {
    type: 'basic', hp, maxHp: hp,
    speed: 0.06 + waveNumber * 0.002, damage: 6, coins: 1,
    shootTimer: 99, shootInterval: 99, preferDist: 6,
    fuseRange: 0, exploded: false, spawning: true,
  };

  const portalGeo = new THREE.RingGeometry(0.15, 0.7, 20);
  const portalMat = new THREE.MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const portal = new THREE.Mesh(portalGeo, portalMat);
  portal.rotation.x = -Math.PI / 2;
  portal.position.set(pos.x, 0.05, pos.z);
  scene.add(portal);

  const glowGeo = new THREE.CircleGeometry(0.5, 20);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x33ff55, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(pos.x, 0.06, pos.z);
  scene.add(glow);

  scene.add(mesh);
  enemies.push(mesh);
  spawnAnimations.push({ portal, glow, mesh, timer: 0, duration: 0.4 });
}

// Egg barrage
function hiveEggBarrage(bd) {
  const basePos = player.position.clone();
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 3;
    const targetPos = new THREE.Vector3(basePos.x + Math.cos(a) * r, 0, basePos.z + Math.sin(a) * r);
    clampToArena(targetPos, 1);

    const eggGeo = new THREE.SphereGeometry(0.32, 6, 6);
    eggGeo.scale(0.8, 1.2, 0.8);
    const eggMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x9944ff, emissive: 0x551188, emissiveIntensity: 0.7, roughness: 0.4 });
    const eggMesh = new THREE.Mesh(eggGeo, eggMat);
    eggMesh.position.copy(bossMesh.position);
    eggMesh.position.y = Math.max(0.4, bossMesh.position.y);
    scene.add(eggMesh);

    bd.eggs.push({ mesh: eggMesh, target: targetPos, flightT: 0, flightDur: 0.5 + Math.random() * 0.2, landed: false, hatchTimer: 3 });
  }
}

// Acid spit
function hiveAcidSpit(bd) {
  if (!bd.acidProjectiles) bd.acidProjectiles = [];
  const baseTarget = player.position.clone();
  const baseAng = Math.atan2(baseTarget.z, baseTarget.x);
  const baseDist = Math.min(baseTarget.length(), CONFIG.ARENA_RADIUS - 1);
  const angles = bd.madQueen ? [baseAng - 0.5, baseAng, baseAng + 0.5] : [baseAng];

  for (const ang of angles) {
    const target = new THREE.Vector3(Math.cos(ang) * baseDist, 0, Math.sin(ang) * baseDist);
    const geo = new THREE.SphereGeometry(0.35, 8, 6);
    const mat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x88ff33, emissive: 0x448800, emissiveIntensity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(bossMesh.position);
    scene.add(mesh);
    bd.acidProjectiles.push({ mesh, start: bossMesh.position.clone(), target, t: 0, dur: 0.7 });
  }
}

function updateHiveAcidProjectile(bd, delta) {
  if (!bd.acidProjectiles) bd.acidProjectiles = [];
  for (let i = bd.acidProjectiles.length - 1; i >= 0; i--) {
    const ap = bd.acidProjectiles[i];
    ap.t += delta / ap.dur;
    const t = Math.min(1, ap.t);
    ap.mesh.position.lerpVectors(ap.start, ap.target, t);
    ap.mesh.position.y = ap.start.y * (1 - t) + Math.sin(t * Math.PI) * 2.5;
    if (t >= 1) {
      removeAndDispose(ap.mesh);
      for (let j = 0; j < 8; j++) spawnDeathParticles(ap.target.clone(), 0x88ff33);
      const puddle = createAcidPuddle(ap.target.x, ap.target.z, 1.6);
      bd.puddles.push({ mesh: puddle.mesh, age: 0, life: 5, radius: 1.6, tickTimer: 0 });
      bd.acidProjectiles.splice(i, 1);
    }
  }
}

function updateHiveEggs(bd, delta) {
  for (let i = bd.eggs.length - 1; i >= 0; i--) {
    const egg = bd.eggs[i];
    if (!egg.landed) {
      egg.flightT += delta / egg.flightDur;
      const t = Math.min(1, egg.flightT);
      egg.mesh.position.lerpVectors(bossMesh.position, egg.target, t);
      egg.mesh.position.y = Math.max(0.3, bossMesh.position.y) * (1 - t) + 0.3 + Math.sin(t * Math.PI) * 1.5;
      if (t >= 1) { egg.landed = true; egg.mesh.position.y = 0.3; triggerScreenShake(0.08); }
    } else {
      egg.hatchTimer -= delta;
      const pulse = 1 + Math.sin(elapsedTime * 8) * 0.15 * Math.max(0, 1 - egg.hatchTimer / 3);
      egg.mesh.scale.set(pulse, pulse, pulse);
      if (egg.hatchTimer <= 0) {
        for (let j = 0; j < 6; j++) spawnDeathParticles(egg.mesh.position.clone(), 0x9944ff);
        spawnHatchling(egg.mesh.position);
        removeAndDispose(egg.mesh);
        bd.eggs.splice(i, 1);
      }
    }
  }
}

// Acid puddle
function createAcidPuddle(x, z, baseRadius) {
  const geo = new THREE.CircleGeometry(baseRadius, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0x66ff22, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.04, z);
  scene.add(mesh);
  return { mesh, age: 0 };
}

function spawnAcidBubble(p, big) {
  let maxR, growDur, riseAmt;
  if (big) { maxR = p.radius * (0.22 + Math.random() * 0.08); growDur = 1.3 + Math.random() * 0.7; riseAmt = 0.09; }
  else {
    const roll = Math.random();
    if (roll < 0.7) { maxR = p.radius * (0.025 + Math.random() * 0.035); growDur = 0.3 + Math.random() * 0.3; }
    else { maxR = p.radius * (0.06 + Math.random() * 0.05); growDur = 0.45 + Math.random() * 0.35; }
    riseAmt = 0.03 + Math.random() * 0.02;
  }

  const spawnDist = big ? 0 : Math.random() * p.radius * 0.72;
  const ang = Math.random() * Math.PI * 2;
  const bx = p.mesh.position.x + Math.cos(ang) * spawnDist;
  const bz = p.mesh.position.z + Math.sin(ang) * spawnDist;
  const baseY = p.mesh.position.y + 0.01;

  const geo = new THREE.SphereGeometry(maxR, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: big ? 0xbbff77 : 0xaaff66, transparent: true, opacity: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(bx, baseY, bz);
  mesh.scale.setScalar(0.001);
  scene.add(mesh);

  if (!p.bubbles) p.bubbles = [];
  p.bubbles.push({ mesh, t: 0, growDur, popDur: big ? 0.22 : 0.16, state: 'grow', baseY, riseAmt, big: !!big });
}

function spawnBubblePopFx(pos, big) {
  const count = big ? 6 : 4 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const s = (big ? 0.05 : 0.03) + Math.random() * 0.02;
    const part = new THREE.Mesh(new THREE.TetrahedronGeometry(s, 0), new THREE.MeshBasicMaterial({ color: 0x99ff55 }));
    part.position.copy(pos);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.02 + Math.random() * (big ? 0.08 : 0.05);
    part.userData = {
      vel: new THREE.Vector3(Math.cos(angle) * speed, 0.03 + Math.random() * (big ? 0.09 : 0.05), Math.sin(angle) * speed),
      life: 0.25 + Math.random() * 0.15, maxLife: 0,
    };
    part.userData.maxLife = part.userData.life;
    scene.add(part);
    particles.push(part);
  }

  const ringGeo = new THREE.RingGeometry(0.02, big ? 0.1 : 0.06, 16);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x99ff55, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(pos);
  ring.position.y = 0.05;
  ring.userData = { life: big ? 0.4 : 0.22, maxLife: big ? 0.4 : 0.22, expand: true };
  scene.add(ring);
  particles.push(ring);
}

function removeAcidPuddle(p) {
  removeAndDispose(p.mesh);
  if (p.bubbles) for (const b of p.bubbles) removeAndDispose(b.mesh);
}

function updateHivePuddles(bd, delta) {
  for (let i = bd.puddles.length - 1; i >= 0; i--) {
    const p = bd.puddles[i];
    p.life -= delta;
    p.age = (p.age || 0) + delta;
    const fadeIn = Math.min(1, p.age / 0.25);
    const fadeOut = Math.min(1, p.life / 1.2);
    const k = Math.min(fadeIn, fadeOut);
    p.mesh.material.opacity = k * 0.55;

    p.bubbleTimer = (p.bubbleTimer === undefined ? 0.3 : p.bubbleTimer) - delta;
    if (p.bubbleTimer <= 0 && fadeOut > 0.4 && (p.bubbles ? p.bubbles.length : 0) < 4) {
      p.bubbleTimer = 0.2 + Math.random() * 0.35;
      spawnAcidBubble(p, false);
    }

    p.bigBubbleTimer = (p.bigBubbleTimer === undefined ? 1 + Math.random() : p.bigBubbleTimer) - delta;
    if (p.bigBubbleTimer <= 0 && fadeOut > 0.4 && p.radius > 0.6) {
      p.bigBubbleTimer = 2 + Math.random() * 1;
      spawnAcidBubble(p, true);
    }

    if (p.bubbles) {
      for (let bi = p.bubbles.length - 1; bi >= 0; bi--) {
        const b = p.bubbles[bi];
        b.t += delta;
        if (b.state === 'grow') {
          const gt = Math.min(1, b.t / b.growDur);
          b.mesh.scale.setScalar(Math.max(0.001, gt));
          b.mesh.material.opacity = k * 0.65 * gt;
          b.mesh.position.y = b.baseY + gt * b.riseAmt;
          if (gt >= 1) {
            b.state = 'pop'; b.t = 0;
            b.mesh.material.color.setHex(0xffffff);
            spawnBubblePopFx(b.mesh.position, b.big);
          }
        } else {
          const pt = Math.min(1, b.t / b.popDur);
          b.mesh.scale.setScalar(1 + pt * 0.9);
          b.mesh.material.opacity = k * 0.65 * (1 - pt);
          if (pt >= 1) { removeAndDispose(b.mesh); p.bubbles.splice(bi, 1); }
        }
      }
    }

    const dist = flatDist(player.position, p.mesh.position);
    if (dist < p.radius) {
      p.tickTimer -= delta;
      if (p.tickTimer <= 0) {
        p.tickTimer = 0.5;
        if (invincibleTimer <= 0) { stats.hp -= 6; triggerHealthFlash(); }
      }
    }
    if (p.life <= 0) { removeAcidPuddle(p); bd.puddles.splice(i, 1); }
  }
}

// Nests
function buildHiveNestMesh(size) {
  const group = new THREE.Group();
  const podMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x552299, emissive: 0x220a44, emissiveIntensity: 0.6, roughness: 0.6 });
  const veinMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x9944ff, emissive: 0xaa55ff, emissiveIntensity: 1.1 });
  const podGeo = new THREE.IcosahedronGeometry(size * 0.55, 0);
  podGeo.scale(1, 0.7, 1);
  const pod = new THREE.Mesh(podGeo, podMat);
  pod.position.y = size * 0.3;
  group.add(pod);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(size * 0.1, size * 0.4, 4), veinMat);
    spike.position.set(Math.cos(a) * size * 0.4, size * 0.55, Math.sin(a) * size * 0.4);
    spike.rotation.z = -Math.cos(a) * 0.7;
    spike.rotation.x = Math.sin(a) * 0.7;
    group.add(spike);
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 6, 5), veinMat);
  glow.position.y = size * 0.35;
  group.add(glow);
  group.material = podMat;
  group.userData.nestGlow = glow;
  return group;
}

function spawnHiveNests(bd) {
  bd.nests = [];
  const count = 3;
  const baseAngle = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = baseAngle + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const r = CONFIG.ARENA_RADIUS - 3.5;
    const pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const mesh = buildHiveNestMesh(1.3);
    mesh.position.copy(pos);
    mesh.scale.set(0.01, 0.01, 0.01);
    scene.add(mesh);
    tweenValue(0.6, t => { const e = 1 - (1 - t) * (1 - t); mesh.scale.set(e, e, e); });
    for (let j = 0; j < 6; j++) spawnDeathParticles(pos.clone(), 0x9944ff);
    const hp = 22 + Math.floor(waveNumber * 1.5);
    bd.nests.push({ mesh, hp, maxHp: hp, spawnTimer: 1.5 + i * 0.8, alive: true });
  }
  flashCenterMsg('NESTS EMERGING', '#aa66ff');
}

function updateHiveNests(bd, delta) {
  if (!bd.nests) return;
  const spawnInterval = bd.phase >= 3 ? 3 : 4.5;
  for (let i = bd.nests.length - 1; i >= 0; i--) {
    const nest = bd.nests[i];
    nest.mesh.rotation.y += delta * 0.3;
    if (nest.mesh.userData.nestGlow) {
      const p = 1 + Math.sin(elapsedTime * 5) * 0.25;
      nest.mesh.userData.nestGlow.scale.set(p, p, p);
    }
    nest.spawnTimer -= delta;
    if (nest.spawnTimer <= 0) {
      nest.spawnTimer = spawnInterval;
      spawnHatchling(nest.mesh.position);
      for (let j = 0; j < 4; j++) spawnDeathParticles(nest.mesh.position.clone(), 0x9944ff);
      triggerScreenShake(0.06);
    }
    for (let pi = projectiles.length - 1; pi >= 0; pi--) {
      if (flatDist(projectiles[pi].position, nest.mesh.position) < 1.0) {
        nest.hp -= Math.round(stats.attackDamage);
        spawnDeathParticles(nest.mesh.position.clone(), 0xaa55ff);
        const projectile = projectiles[pi];
        projectiles.splice(pi, 1);
        releasePlayerProjectile(projectile);
      }
    }
    for (let fi = fireballs.length - 1; fi >= 0; fi--) {
      if (flatDist(fireballs[fi].position, nest.mesh.position) < 1.1) {
        nest.hp -= stats.attackDamage * 4;
        spawnDeathParticles(fireballs[fi].position, 0xff4400);
        removeAndDispose(fireballs[fi]); fireballs.splice(fi, 1);
      }
    }
    if (nest.hp <= 0) {
      for (let k = 0; k < 10; k++) spawnDeathParticles(nest.mesh.position.clone(), 0x9944ff);
      triggerScreenShake(0.2);
      removeAndDispose(nest.mesh);
      bd.nests.splice(i, 1);
      bd.currentHp -= bd.hp * 0.04;
      bd.damage *= 0.9;
      bd.speed *= 0.95;
      flashCenterMsg('HIVE WEAKENED', '#66ff88');
    }
  }
}

// Charge attack
function hiveStartCharge(bd) {
  const target = player.position.clone();
  clampToArena(target, bd.size * 0.6);
  bd.charge = { state: 'crouch', timer: 1.0, crouchDur: 1.0, jumpTarget: target, start: null, airT: 0, airDur: 0 };
  if (bossMesh) bossMesh.material.emissiveIntensity = 1.6;
}

function updateHiveCharge(bd, delta) {
  const ch = bd.charge;
  if (!ch) return;
  if (ch.state === 'crouch') {
    ch.timer -= delta;
    if (ch.timer <= 0) {
      ch.start = bossMesh.position.clone();
      const dist = flatDist(ch.start, ch.jumpTarget);
      ch.airDur = THREE.MathUtils.clamp(0.28 + dist * 0.02, 0.35, 0.85);
      ch.airT = 0;
      ch.state = 'airborne';
      triggerScreenShake(0.15);
    }
  } else if (ch.state === 'airborne') {
    ch.airT += delta;
    const t = Math.min(1, ch.airT / ch.airDur);
    bossMesh.position.x = ch.start.x + (ch.jumpTarget.x - ch.start.x) * t;
    bossMesh.position.z = ch.start.z + (ch.jumpTarget.z - ch.start.z) * t;
    bossMesh.position.y = bd.size * 0.55 + Math.sin(t * Math.PI) * bd.size * 2.2;
    if (t >= 1) {
      bossMesh.position.set(ch.jumpTarget.x, bd.size * 0.55, ch.jumpTarget.z);
      hiveLeapLand(bd, ch.jumpTarget);
      ch.state = 'stunned';
      ch.timer = 0.5;
    }
  } else if (ch.state === 'stunned') {
    ch.timer -= delta;
    if (ch.timer <= 0) {
      bd.charge = null;
      if (bossMesh) bossMesh.material.emissiveIntensity = 0.55;
    }
  }
}

function hiveLeapLand(bd, landPos) {
  triggerScreenShake(0.5);
  AudioManager.explosion();
  for (let i = 0; i < 10; i++) spawnDeathParticles(landPos.clone(), 0x66ff33);
  if (bossMesh) bossMesh.material.emissiveIntensity = 0.9;

  // Shockwave
  const ringGeo = new THREE.RingGeometry(0.2, 0.5, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x88ff44, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.set(landPos.x, 0.06, landPos.z);
  scene.add(ringMesh);
  bd.shockwaves.push({ mesh: ringMesh, t: 0, dur: 0.5, maxRadius: bd.size * 4.2 });

  // Knockback
  const knockRadius = bd.size * 2.6;
  const dist = flatDist(player.position, landPos);
  if (dist < knockRadius) {
    const push = new THREE.Vector3().subVectors(player.position, landPos);
    push.y = 0;
    if (push.lengthSq() < 0.0001) push.set(1, 0, 0); else push.normalize();
    const falloff = 1 - dist / knockRadius;
    player.position.x += push.x * 1.6 * falloff;
    player.position.z += push.z * 1.6 * falloff;
    clampToArena(player.position, 1);
    if (dist < bd.size * 1.1 && invincibleTimer <= 0) {
      stats.hp -= bd.damage * 0.8;
      triggerHealthFlash();
    }
  }

  // Acid splashes
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
    const r = bd.size * (1.4 + Math.random() * 0.6);
    const splashPos = new THREE.Vector3(landPos.x + Math.cos(a) * r, 0, landPos.z + Math.sin(a) * r);
    clampToArena(splashPos, 1);
    spawnDeathParticles(splashPos.clone(), 0x88ff33);
    const puddle = createAcidPuddle(splashPos.x, splashPos.z, 0.9);
    bd.puddles.push({ mesh: puddle.mesh, age: 0, life: 4, radius: 0.9, tickTimer: 0 });
  }

  // Mad Queen big puddle
  if (bd.madQueen) {
    for (let i = 0; i < 10; i++) spawnDeathParticles(landPos.clone(), 0x66ff22);
    const bigRadius = bd.size * 2.2;
    const bigPuddle = createAcidPuddle(landPos.x, landPos.z, bigRadius);
    bd.puddles.push({ mesh: bigPuddle.mesh, age: 0, life: 8, radius: bigRadius, tickTimer: 0 });
  }
}

function updateHiveShockwaves(bd, delta) {
  for (let i = bd.shockwaves.length - 1; i >= 0; i--) {
    const sw = bd.shockwaves[i];
    sw.t += delta;
    const t = Math.min(1, sw.t / sw.dur);
    const radius = 0.3 + t * sw.maxRadius;
    sw.mesh.geometry.dispose();
    sw.mesh.geometry = new THREE.RingGeometry(Math.max(0.05, radius - 0.5), radius, 32);
    sw.mesh.material.opacity = 0.85 * (1 - t);
    if (t >= 1) {
      removeAndDispose(sw.mesh);
      bd.shockwaves.splice(i, 1);
    }
  }
}

function updateHiveMotherBoss(delta) {
  if (!bossMesh || !bossData) return;
  const step = frameScale(delta);
  const bd = bossData;
  bd.bobT += delta;

  updateHiveEggs(bd, delta);
  updateHiveAcidProjectile(bd, delta);
  updateHivePuddles(bd, delta);
  updateHiveNests(bd, delta);
  updateHiveShockwaves(bd, delta);

  const isCharging = !!bd.charge;
  if (isCharging) {
    updateHiveCharge(bd, delta);
  } else {
    const toPlayer = new THREE.Vector3().subVectors(player.position, bossMesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const dir = toPlayer.clone().normalize();
    if (dist > 4) {
      bossMesh.position.x += dir.x * bd.speed * step;
      bossMesh.position.z += dir.z * bd.speed * step;
      bd.__moving = true;
    } else {
      bd.__moving = false;
    }
    if (dist < bd.size + 0.9 && invincibleTimer <= 0) {
      stats.hp -= bd.damage * 0.4 * delta;
      triggerHealthFlash();
    }
    if (toPlayer.lengthSq() > 0.01) bossMesh.lookAt(bossMesh.position.clone().add(toPlayer));
    bossMesh.position.y = bd.size * 0.55 + Math.sin(bd.bobT * 1.4) * 0.08;

    const speedMult = bd.enraged ? 0.7 : 1;
    bd.acidTimer -= delta;
    if (bd.acidTimer <= 0) { hiveAcidSpit(bd); bd.acidTimer = 3 * speedMult; }
    bd.eggTimer -= delta;
    if (bd.eggTimer <= 0) { hiveEggBarrage(bd); bd.eggTimer = (bd.madQueen ? 3 : 5) * speedMult; }
    bd.chargeTimer -= delta;
    if (bd.chargeTimer <= 0) { hiveStartCharge(bd); bd.chargeTimer = (bd.phase >= 3 ? 6 : 8) * speedMult; }
  }

  const isMoving = !isCharging && bossData.__moving;
  animateHiveMotherMesh(bd, delta, isMoving, bd.charge ? bd.charge.state : null);

  // Phase 2 at 70%
  if (!bd.phase2Triggered && bd.currentHp <= bd.hp * 0.7) {
    bd.phase2Triggered = true;
    bd.phase = 2;
    spawnHiveNests(bd);
    triggerScreenShake(0.3);
  }

  // Phase 3 at 35%
  if (!bd.phase3Triggered && bd.currentHp <= bd.hp * 0.35) {
    bd.phase3Triggered = true;
    bd.phase = 3;
    bd.madQueen = true;
    bd.eggTimer = Math.min(bd.eggTimer, 3);
    flashCenterMsg('MAD QUEEN!', '#ff3300');
    triggerColorFlash('rgba(120,255,40,0.3)', 120, 550);
    triggerScreenShake(0.55);
    for (let i = 0; i < 14; i++) spawnDeathParticles(bossMesh.position.clone(), i % 2 ? 0x88ff33 : 0xff3300);
  }

  updateBossHPBar(bd);

  // Damage from projectiles
  const dmgMult = (bd.charge && bd.charge.state === 'stunned') ? 1.6 : 1;
  const weakWorldPos = bossMesh.userData.hiveParts ? bossMesh.userData.hiveParts.weakpoint.getWorldPosition(new THREE.Vector3()) : null;

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (flatDist(p.position, bossMesh.position) < bd.size * 0.6) {
      const isCrit = Math.random() < stats.critChance;
      const onWeakPoint = weakWorldPos && bd.weakpointOpen && p.position.distanceTo(weakWorldPos) < bd.size * 0.35;
      const weakMult = onWeakPoint ? 1.6 : 1;
      const pDmgMult = p.userData.dmgMult ?? 1;
      const dmg = Math.round((isCrit ? stats.attackDamage * 2.5 : stats.attackDamage) * dmgMult * weakMult * pDmgMult);
      bd.currentHp -= dmg;
      flashEnemy(bossMesh);
      if (onWeakPoint) spawnDeathParticles(weakWorldPos.clone(), bd.emissive);
      spawnDamageNumber(bossMesh.position.clone().add(new THREE.Vector3(0, bd.size + 0.5, 0)), dmg, isCrit || onWeakPoint);
      projectiles.splice(i, 1); releasePlayerProjectile(p);
    }
  }
  for (let i = fireballs.length - 1; i >= 0; i--) {
    if (flatDist(fireballs[i].position, bossMesh.position) < bd.size * 0.8) {
      bd.currentHp -= stats.attackDamage * 4 * dmgMult;
      flashEnemy(bossMesh);
      spawnDeathParticles(fireballs[i].position, 0xff4400);
      removeAndDispose(fireballs[i]); fireballs.splice(i, 1);
    }
  }

  if (bd.currentHp <= 0) {
    if (bd.charge) bd.charge = null;
    killBoss();
  }
}