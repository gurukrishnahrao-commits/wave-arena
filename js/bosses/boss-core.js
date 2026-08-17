// ============================================
// BOSS CORE — spawn routing, kill, shared utils
// ============================================

const BOSS_DEFS = [
  {
    name: 'THE SENTINEL', type: 'sentinel',
    color: 0x8844ff, emissive: 0x4411aa, coreColor: 0xcc66ff,
    hp: 500, size: 2.4, coins: 200,
    orbitRadius: 6, orbitSpeed: 0.38,
  },
  {
    name: 'THE HIVE MOTHER', type: 'hivemother',
    color: 0x33ff55, emissive: 0xff6a1a, coreColor: 0x88ff33,
    hp: 850, size: 2.5, speed: 0.014, damage: 24, coins: 260,
  },
  {
    name: 'THE VOID COLOSSUS', type: 'colossus',
    color: 0x4400ff, emissive: 0x220088,
    hp: 500, size: 2.5, speed: 0.02, damage: 35, coins: 80,
    slamRange: 5, slamCooldown: 2.5,
  },
  {
    name: 'THE WARDEN — CRYO-MIRROR PROTOCOL', type: 'warden',
    color: 0x17263d, emissive: 0x173f66, coreColor: 0x39d9ff,
    hp: 5000, size: 3.05, speed: 0.026, damage: 38, coins: 1000,
  },
  {
    name: 'THE AETHER REGENT', type: 'aetherregent',
    color: 0x073c54, emissive: 0x002b3a, coreColor: 0x38f8ff,
    hp: 2550, size: 3.15, speed: 0.044, damage: 31, coins: 430,
    shootInterval: 1.1, projectileSpeed: 0.18, projectileDamage: 20,
  },
  {
    name: 'THE SOVEREIGN CORE', type: 'sovereigncore',
    color: 0x521018, emissive: 0x2e0007, coreColor: 0xffd03d,
    hp: 3800, size: 3.45, speed: 0.04, damage: 36, coins: 600,
    shootInterval: 0.95, projectileSpeed: 0.19, projectileDamage: 23,
  },
];

const BOSS_BY_WAVE = {
  5: BOSS_DEFS[0],
  10: BOSS_DEFS[1],
  15: BOSS_DEFS[3],
  20: BOSS_DEFS[4],
  25: BOSS_DEFS[5],
};

// Shared construction used by the three late-campaign milestone bosses.
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

function spawnBoss() {
  bossSpawnedWave = waveNumber;
  bossActive = true;
  bossDeathInProgress = false;
  AudioManager.setMusicMode('boss');
  AudioManager.bossWarning();

  const def = BOSS_BY_WAVE[waveNumber];
  if (!def) {
    console.error(`No boss configured for wave ${waveNumber}`);
    bossActive = false;
    return;
  }

  if (def.type === 'sentinel') {
    spawnSentinelIntro(def);
    return;
  }
  if (def.type === 'hivemother') {
    spawnHiveMotherIntro(def);
    return;
  }
  if (def.type === 'warden') {
    spawnWarden(def);
    return;
  }
  if (def.type === 'aetherregent') {
    spawnAetherRegent(def);
    return;
  }
  if (def.type === 'sovereigncore') {
    spawnSovereignCore(def);
    return;
  }

  spawnColossus(def);
}

function updateBoss(delta) {
  if (!bossMesh || !bossData) return;
  if (bossData.type === 'sentinel') { updateSentinelBoss(delta); return; }
  if (bossData.type === 'hivemother') { updateHiveMotherBoss(delta); return; }
  if (bossData.type === 'warden') { updateWarden(delta); return; }
  if (bossData.type === 'aetherregent') { updateAetherRegent(delta); return; }
  if (bossData.type === 'sovereigncore') { updateSovereignCore(delta); return; }
  updateColossusBoss(delta);
}

function clearBossPlayerEffects() {
  if (!player?.userData) return;
  const freezeShell = player.userData.freezeShell;
  if (freezeShell) {
    if (bossData?.transients) {
      bossData.transients = bossData.transients.filter(entry => (entry.mesh || entry) !== freezeShell);
    }
    removeAndDispose(freezeShell);
    delete player.userData.freezeShell;
  }
  player.userData.frozenUntil = 0;
}

function killBoss() {
  if (bossDeathInProgress || !bossMesh || !bossData) return;
  bossDeathInProgress = true;
  clearBossPlayerEffects();
  bossActive = false;
  document.getElementById('boss-bar').style.display = 'none';

  // Restore arena lighting
  if (ambientLight) {
    const theme = ARENA_THEMES[currentArena] || ARENA_THEMES[0];
    ambientLight.intensity = theme.ambient.intensity;
    ambientLight.color.setHex(theme.ambient.color);
  }

  const deathPos = bossMesh.position.clone();
  const deathColor = bossData.color;
  const deathType = bossData.type;
  const deathCoins = bossData.coins;
  const deathEggs = bossData.eggs || [];
  const deathPuddles = bossData.puddles || [];
  const deathNests = bossData.nests || [];
  const deathShockwaves = bossData.shockwaves || [];
  const deathAcidProj = bossData.acidProjectiles || [];
  const deathTransients = bossData.transients || [];
  const deathActiveAttack = bossData.activeAttack;
  const dyingMesh = bossMesh;
  const deathEffectId = ++bossEffectId;
  for (const transient of deathTransients) {
    const mesh = transient && transient.mesh ? transient.mesh : transient;
    if (mesh) removeAndDispose(mesh);
  }
  if (deathActiveAttack?.mesh) removeAndDispose(deathActiveAttack.mesh);

  // Null out globals immediately
  bossMesh = null;
  bossData = null;

  // Schedule wave advance
  onBossDefeated();

  // Death shudder
  const shudderDur = 0.4;
  const shudderStart = performance.now();
  triggerScreenShake(0.2);

  function shudderStep() {
    if (deathEffectId !== bossEffectId) {
      removeAndDispose(dyingMesh);
      cleanupCapturedBossEffects();
      return;
    }
    const t = (performance.now() - shudderStart) / 1000;
    if (t >= shudderDur) {
      removeAndDispose(dyingMesh);
      spawnDeathExplosion();
      return;
    }
    const jitter = 0.06 * (1 - t / shudderDur);
    dyingMesh.position.x = deathPos.x + (Math.random() - 0.5) * jitter;
    dyingMesh.position.z = deathPos.z + (Math.random() - 0.5) * jitter;
    const wobble = 1 - 0.15 * (t / shudderDur) * (Math.sin(t * 40) * 0.5 + 0.5);
    dyingMesh.scale.set(wobble, wobble, wobble);
    if (dyingMesh.material && dyingMesh.material.emissiveIntensity !== undefined) {
      dyingMesh.material.emissiveIntensity = 1 + Math.sin(t * 50) * 1.5;
    }
    requestAnimationFrame(shudderStep);
  }
  requestAnimationFrame(shudderStep);

  let capturedEffectsCleaned = false;
  function cleanupCapturedBossEffects() {
    if (capturedEffectsCleaned) return;
    capturedEffectsCleaned = true;
    if (deathType !== 'hivemother') return;
    for (const egg of deathEggs) {
      if (!egg.mesh) continue;
      const pos = egg.mesh.position.clone();
      removeAndDispose(egg.mesh);
      if (deathEffectId === bossEffectId) spawnDeathParticles(pos, 0xaa44ff);
    }
    for (const puddle of deathPuddles) removeAcidPuddle(puddle);
    for (const nest of deathNests) {
      if (!nest.mesh) continue;
      const pos = nest.mesh.position.clone();
      removeAndDispose(nest.mesh);
      if (deathEffectId === bossEffectId) spawnDeathParticles(pos, 0x9944ff);
    }
    for (const sw of deathShockwaves) {
      if (sw.mesh) removeAndDispose(sw.mesh);
    }
    for (const ap of deathAcidProj) {
      if (ap.mesh) removeAndDispose(ap.mesh);
    }
  }

  function spawnDeathExplosion() {
    if (deathEffectId !== bossEffectId) {
      cleanupCapturedBossEffects();
      return;
    }
    triggerColorFlash('rgba(255,255,255,0.55)', 90, 500);
    triggerScreenShake(0.7);
    timeScale = 0.2;
    setTimeout(() => { timeScale = 1; }, 220);
    AudioManager.bossDefeat();

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (deathEffectId !== bossEffectId) return;
        spawnDeathParticles(deathPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), deathColor);
        spawnDeathParticles(deathPos.clone(), 0xffd23d);
        triggerScreenShake(0.4);
      }, i * 120);
    }

    for (let j = 0; j < 8; j++) {
      setTimeout(() => {
        if (deathEffectId !== bossEffectId) return;
        const pos = deathPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.5, (Math.random() - 0.5) * 3));
        spawnCoinPickup(pos, Math.floor(deathCoins / 8));
      }, j * 80);
    }

    // Boss-type-specific rewards
    if (deathType === 'sentinel' || deathType === 'hivemother') {
      const upgradable = equippedWeapons().find(w => w && !w.upgrade.applied);
      if (upgradable) {
        upgradable.upgrade.applied = true;
        setTimeout(() => {
          if (deathEffectId === bossEffectId) flashCenterMsg(`⚙ ${upgradable.upgrade.name} UNLOCKED!`, '#66ccff');
        }, 900);
      }
      stats.hp = stats.maxHP;
    }

    cleanupCapturedBossEffects();
    flashCenterMsg('BOSS DEFEATED!', '#ffd23d');
  }
}

// Boss hit flash
function flashBossHit(bd, hitPos) {
  if (bd.core) {
    const core = bd.core;
    if (core.userData._baseEmissive === undefined) core.userData._baseEmissive = core.material.emissiveIntensity;
    core.material.emissiveIntensity = 3.2;
    clearTimeout(core.userData._pulseTimeout);
    core.userData._pulseTimeout = setTimeout(() => {
      core.material.emissiveIntensity = core.userData._baseEmissive;
    }, 110);
  }

  if (bd.shieldMesh) {
    const shield = bd.shieldMesh;
    const restOpacity = bd.shieldActive ? 0.35 : 0;
    shield.material.opacity = bd.shieldActive ? 0.75 : 0.22;
    clearTimeout(shield.userData._flickerTimeout);
    shield.userData._flickerTimeout = setTimeout(() => {
      shield.material.opacity = restOpacity;
    }, 130);
  }

  if (hitPos) spawnDeathParticles(hitPos, 0xaa44ff);
  triggerScreenShake(0.08);
}

// Standard boss warning intro (used by Colossus)
function showBossWarning(def) {
  document.getElementById('boss-bar').style.display = 'block';
  document.getElementById('boss-name').textContent = def.name;
  document.getElementById('boss-hp-fill').style.width = '100%';
  document.getElementById('boss-hp-text').textContent = `${def.hp} / ${def.hp}`;
  document.getElementById('boss-shield-bar').style.display = 'none';

  const centerEl = document.getElementById('center-msg');
  const msgGen = ++centerMsgGen;
  centerEl.style.opacity = 1;
  centerEl.style.transition = '';
  centerEl.innerHTML = `
    <div style="color:#ff1144;font-size:14px;letter-spacing:6px;margin-bottom:10px;">⚠ WARNING ⚠</div>
    <div style="background:#ff1144;height:3px;width:300px;margin:0 auto 14px;box-shadow:0 0 12px #ff1144;"></div>
    <h1 style="font-size:36px;color:#ff3d6e;text-shadow:0 0 30px #ff3d6e;">${def.name}</h1>
  `;
  setTimeout(() => {
    if (msgGen !== centerMsgGen) return;
    centerEl.style.transition = 'opacity 1s';
    centerEl.style.opacity = 0;
    setTimeout(() => {
      if (msgGen === centerMsgGen) { centerEl.style.transition = ''; centerEl.innerHTML = ''; }
    }, 1000);
  }, 2000);
}

// Shared direct-damage path used by every weapon. Specialized bosses may still
// intercept standard bullets for weak points, but no weapon is excluded.
function damageBossTarget(amount, isCrit = false, hitPos = null, options = {}) {
  if (!bossActive || !bossMesh || !bossData || bossDeathInProgress || bossData.introRising || bossData.teleporting) return false;
  const rawDamage = Math.max(0, Math.round(amount));
  if (!rawDamage) return false;
  const multiplier = Number.isFinite(bossData.damageMultiplier) ? Math.max(0, bossData.damageMultiplier) : 1;
  const dmg = multiplier > 0 ? Math.max(1, Math.round(rawDamage * multiplier)) : 0;
  if (!dmg) return false;

  if (bossData.shieldActive && Number.isFinite(bossData.shieldHp)) {
    bossData.shieldHp -= dmg;
    const shieldFill = document.getElementById('boss-shield-fill');
    if (shieldFill && bossData.maxShieldHp) {
      shieldFill.style.width = `${Math.max(0, bossData.shieldHp / bossData.maxShieldHp) * 100}%`;
    }
    if (bossData.shieldHp <= 0 && bossData.type === 'sentinel') breakSentinelShield();
  } else {
    bossData.currentHp -= dmg;
  }

  const pos = hitPos ? hitPos.clone() : bossMesh.position.clone();
  flashBossHit(bossData, pos);
  if (!options.silentNumber) {
    pos.y = Math.max(pos.y, bossMesh.position.y + bossData.size + 0.5);
    spawnDamageNumber(pos, dmg, isCrit);
  }
  updateBossHPBar(bossData);
  return true;
}

// Update boss HP bar
function updateBossHPBar(bd) {
  const fill = document.getElementById('boss-hp-fill');
  if (fill) fill.style.width = Math.max(0, (bd.currentHp / bd.hp) * 100) + '%';
  const text = document.getElementById('boss-hp-text');
  if (text) text.textContent = `${Math.max(0, Math.ceil(bd.currentHp))} / ${bd.hp}`;
}

// Check projectile hits against boss (shared by all boss types)
function checkBossProjectileHits(bd, hitRadius, onHit) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (flatDist(p.position, bossMesh.position) < hitRadius) {
      const isCrit = Math.random() < stats.critChance;
      const dmgMult = p.userData.dmgMult ?? 1;
      const dmg = Math.round((isCrit ? stats.attackDamage * 2.5 : stats.attackDamage) * dmgMult);
      if (onHit) {
        onHit(dmg, isCrit, p.position);
      } else {
        damageBossTarget(dmg, isCrit, p.position);
      }
      projectiles.splice(i, 1);
      releasePlayerProjectile(p);
    }
  }
  for (let i = fireballs.length - 1; i >= 0; i--) {
    if (flatDist(fireballs[i].position, bossMesh.position) < hitRadius + 0.2) {
      const fbDmg = stats.attackDamage * 4;
      if (onHit) {
        onHit(fbDmg, false, fireballs[i].position);
      } else {
        damageBossTarget(fbDmg, false, fireballs[i].position);
      }
      spawnDeathParticles(fireballs[i].position, 0xff4400);
      removeAndDispose(fireballs[i]);
      fireballs.splice(i, 1);
    }
  }
}