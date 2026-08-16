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
];

function spawnBoss() {
  bossSpawnedWave = waveNumber;
  bossActive = true;
  AudioManager.bossWarning();

  const defIndex = Math.floor((waveNumber / CONFIG.BOSS_EVERY - 1)) % BOSS_DEFS.length;
  const def = BOSS_DEFS[defIndex];

  if (def.type === 'sentinel') {
    spawnSentinelIntro(def);
    return;
  }
  if (def.type === 'hivemother') {
    spawnHiveMotherIntro(def);
    return;
  }

  // Colossus (default)
  spawnColossus(def);
}

function updateBoss(delta) {
  if (!bossMesh || !bossData) return;
  if (bossData.type === 'sentinel') { updateSentinelBoss(delta); return; }
  if (bossData.type === 'hivemother') { updateHiveMotherBoss(delta); return; }
  updateColossusBoss(delta);
}

function killBoss() {
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
  const dyingMesh = bossMesh;

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
    const t = (performance.now() - shudderStart) / 1000;
    if (t >= shudderDur) {
      scene.remove(dyingMesh);
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

  function spawnDeathExplosion() {
    triggerColorFlash('rgba(255,255,255,0.55)', 90, 500);
    triggerScreenShake(0.7);
    timeScale = 0.2;
    setTimeout(() => { timeScale = 1; }, 220);
    AudioManager.bossDefeat();

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        spawnDeathParticles(deathPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), deathColor);
        spawnDeathParticles(deathPos.clone(), 0xffd23d);
        triggerScreenShake(0.4);
      }, i * 120);
    }

    for (let j = 0; j < 8; j++) {
      setTimeout(() => {
        const pos = deathPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.5, (Math.random() - 0.5) * 3));
        spawnCoinPickup(pos, Math.floor(deathCoins / 8));
      }, j * 80);
    }

    // Boss-type-specific rewards
    if (deathType === 'sentinel' || deathType === 'hivemother') {
      const upgradable = equippedWeapons().find(w => w && !w.upgrade.applied);
      if (upgradable) {
        upgradable.upgrade.applied = true;
        setTimeout(() => flashCenterMsg(`⚙ ${upgradable.upgrade.name} UNLOCKED!`, '#66ccff'), 900);
      }
      stats.hp = stats.maxHP;
    }

    // Hive Mother cleanup
    if (deathType === 'hivemother') {
      for (const egg of deathEggs) {
        if (egg.mesh) {
          scene.remove(egg.mesh);
          spawnDeathParticles(egg.mesh.position, 0xaa44ff);
        }
      }
      for (const puddle of deathPuddles) removeAcidPuddle(puddle);
      for (const nest of deathNests) {
        if (nest.mesh) {
          scene.remove(nest.mesh);
          spawnDeathParticles(nest.mesh.position, 0x9944ff);
        }
      }
      for (const sw of deathShockwaves) {
        if (sw.mesh) scene.remove(sw.mesh);
      }
      for (const ap of deathAcidProj) {
        if (ap.mesh) scene.remove(ap.mesh);
      }
    }

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
        bd.currentHp -= dmg;
        flashBossHit(bd, bossMesh.position.clone().add(new THREE.Vector3(0, bd.size * 0.15, 0)));
        spawnDamageNumber(bossMesh.position.clone().add(new THREE.Vector3(0, bd.size + 0.5, 0)), dmg, isCrit);
      }
      scene.remove(p);
      projectiles.splice(i, 1);
    }
  }
  for (let i = fireballs.length - 1; i >= 0; i--) {
    if (flatDist(fireballs[i].position, bossMesh.position) < hitRadius + 0.2) {
      const fbDmg = stats.attackDamage * 4;
      if (onHit) {
        onHit(fbDmg, false, fireballs[i].position);
      } else {
        bd.currentHp -= fbDmg;
        flashBossHit(bd, bossMesh.position.clone().add(new THREE.Vector3(0, bd.size * 0.15, 0)));
      }
      spawnDeathParticles(fireballs[i].position, 0xff4400);
      scene.remove(fireballs[i]);
      fireballs.splice(i, 1);
    }
  }
}