// ============================================
// THE SENTINEL — orbit, shield, generators, laser
// ============================================

const LASER_BASE_HALF_WIDTH = 0.105;

function spawnSentinelIntro(def) {
  const introId = ++sentinelIntroId;
  const playerAngle = Math.atan2(player.position.z, player.position.x);
  const spawnAngle = playerAngle + Math.PI + (Math.random() - 0.5) * 1.2;
  const spawnRadius = CONFIG.ARENA_RADIUS - 4;
  const spawnPos = new THREE.Vector3(Math.cos(spawnAngle) * spawnRadius, 0, Math.sin(spawnAngle) * spawnRadius);

  bossMesh = null;
  bossData = null;

  const centerEl = document.getElementById('center-msg');
  centerMsgGen++;
  centerEl.style.transition = '';
  centerEl.style.opacity = 1;

  // Stage 1
  if (ambientLight) ambientLight.intensity = 0.12;
  centerEl.innerHTML = `<div style="color:#8844ff;font-size:14px;letter-spacing:6px;text-shadow:0 0 16px #8844ff;">⚠ SOMETHING STIRS ⚠</div>`;
  triggerScreenShake(0.2);
  const rumble = setInterval(() => {
    if (introId !== sentinelIntroId) { clearInterval(rumble); return; }
    triggerScreenShake(0.22);
  }, 200);

  // Stage 2
  setTimeout(() => {
    if (introId !== sentinelIntroId) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (introId !== sentinelIntroId) return;
        spawnDeathParticles(spawnPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.4, (Math.random() - 0.5) * 1.5)), 0x8844ff);
        triggerScreenShake(0.3);
      }, i * 180);
    }
  }, 500);

  // Stage 3
  let portal, glow;
  setTimeout(() => {
    if (introId !== sentinelIntroId) return;
    clearInterval(rumble);

    const portalGeo = new THREE.RingGeometry(0.3, 2.2, 32);
    const portalMat = new THREE.MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0, side: THREE.DoubleSide });
    portal = new THREE.Mesh(portalGeo, portalMat);
    portal.rotation.x = -Math.PI / 2;
    portal.position.copy(spawnPos);
    portal.position.y = 0.06;
    portal.scale.set(0.05, 0.05, 0.05);
    scene.add(portal);

    const glowGeo = new THREE.CircleGeometry(1.6, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x6600ff, transparent: true, opacity: 0, side: THREE.DoubleSide });
    glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.copy(spawnPos);
    glow.position.y = 0.05;
    scene.add(glow);

    centerEl.innerHTML = `
      <div style="color:#ff1144;font-size:14px;letter-spacing:6px;margin-bottom:10px;">⚠ WARNING ⚠</div>
      <div style="background:#8844ff;height:3px;width:300px;margin:0 auto 14px;box-shadow:0 0 12px #8844ff;"></div>
      <h1 style="font-size:36px;color:#aa66ff;text-shadow:0 0 30px #aa66ff;">${def.name}</h1>
    `;
    triggerScreenShake(0.5);

    tweenValue(0.8, t => {
      if (introId !== sentinelIntroId) return;
      const e = 1 - (1 - t) * (1 - t);
      portal.scale.set(e, e, e);
      portal.material.opacity = 0.9 * Math.min(1, t * 2);
      glow.material.opacity = 0.5 * Math.min(1, t * 2);
      portal.rotation.z += 0.05;
    });
  }, 1100);

  // Stage 4
  setTimeout(() => {
    if (introId !== sentinelIntroId) return;
    document.getElementById('boss-name').textContent = def.name;

    bossMesh = buildLowPolyAlien({
      size: def.size, color: def.color, emissive: def.emissive,
      shape: 'sphere', shootInterval: 1,
    });
    bossMesh.position.set(spawnPos.x, 0, spawnPos.z);
    bossMesh.scale.set(0.05, 0.05, 0.05);
    scene.add(bossMesh);

    const coreGeo = new THREE.SphereGeometry(def.size * 0.22, 8, 6);
    const coreMat = new THREE.MeshStandardMaterial({
      flatShading: true, color: def.coreColor, emissive: 0xaa33ff, emissiveIntensity: 1.4,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = def.size * 0.1;
    bossMesh.add(core);

    const shieldGeo = new THREE.IcosahedronGeometry(def.size * 0.95, 1);
    const shieldMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0, wireframe: true });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    bossMesh.add(shieldMesh);

    const targetY = def.size * 1.15;
    bossData = {
      ...def, currentHp: def.hp, phase: 1, phase2: false, enraged: false,
      shieldTriggered: false, shieldActive: false, shieldAttackTimer: 0,
      stunned: false, stunTimer: 0, enragedTriggered: false,
      lightningTimer: 1.2, generators: [],
      shieldMesh, core,
      orbitAngle: Math.random() * Math.PI * 2,
      baseY: targetY, floatT: 0,
      attackTimer: 2.2, activeAttack: null, nextAttack: 'plasma',
      introRising: true,
    };

    triggerScreenShake(0.6);
    tweenValue(1.0, t => {
      if (introId !== sentinelIntroId || !bossMesh) return;
      const e = 1 - (1 - t) * (1 - t);
      bossMesh.position.y = e * targetY;
      const s = 0.05 + 0.95 * e;
      bossMesh.scale.set(s, s, s);
    }, () => {
      if (introId !== sentinelIntroId) return;
      if (bossData) bossData.introRising = false;
      if (portal) { removeAndDispose(portal); portal = null; }
      if (glow) { removeAndDispose(glow); glow = null; }
    });
  }, 1700);

  // Stage 5
  setTimeout(() => {
    if (introId !== sentinelIntroId) return;
    const bar = document.getElementById('boss-bar');
    bar.style.display = 'block';
    bar.style.transition = 'none';
    bar.style.transform = 'translate(-50%, -40px)';
    bar.style.opacity = '0';
    document.getElementById('boss-hp-fill').style.width = '100%';
    document.getElementById('boss-hp-text').textContent = `${def.hp} / ${def.hp}`;
    requestAnimationFrame(() => {
      bar.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
      bar.style.transform = 'translate(-50%, 0)';
      bar.style.opacity = '1';
    });
  }, 2700);

  setTimeout(() => {
    if (introId !== sentinelIntroId) return;
    centerEl.style.transition = 'opacity 1s';
    centerEl.style.opacity = 0;
    setTimeout(() => { if (introId === sentinelIntroId) { centerEl.style.transition = ''; centerEl.innerHTML = ''; } }, 1000);
  }, 3200);
}

function updateSentinelBoss(delta) {
  if (bossData && bossData.introRising) return;
  const bd = bossData;
  const mesh = bossMesh;

  // Orbit
  if (!bd.stunned) {
    bd.orbitAngle += delta * bd.orbitSpeed * (bd.enraged ? 1.5 : 1);
    const targetX = player.position.x + Math.cos(bd.orbitAngle) * bd.orbitRadius;
    const targetZ = player.position.z + Math.sin(bd.orbitAngle) * bd.orbitRadius;
    const follow = frameLerp(0.025, delta);
    mesh.position.x += (targetX - mesh.position.x) * follow;
    mesh.position.z += (targetZ - mesh.position.z) * follow;
  }
  bd.floatT += delta;
  mesh.position.y = bd.baseY + Math.sin(bd.floatT * 0.55) * 0.9 + Math.sin(bd.floatT * 0.23) * 0.25;

  const toPlayer = new THREE.Vector3().subVectors(player.position, mesh.position);
  toPlayer.y = 0;
  if (toPlayer.lengthSq() > 0.01) mesh.lookAt(mesh.position.clone().add(toPlayer));

  if (bd.shieldMesh) bd.shieldMesh.rotation.y += delta * 0.6;
  if (bd.core) bd.core.rotation.y += delta * 1.2;

  // Shield at 70%
  if (!bd.shieldTriggered && bd.currentHp <= bd.hp * 0.7) {
    bd.shieldTriggered = true;
    if (bd.activeAttack) { removeAndDispose(bd.activeAttack.mesh); bd.activeAttack = null; }
    activateSentinelShield();
  }

  if (bd.shieldActive) updateSentinelGenerators(delta);
  else if (bd.stunned) updateSentinelStun(delta);
  else updateSentinelAttacks(delta);

  // Enrage at 30%
  if (!bd.enragedTriggered && bd.currentHp <= bd.hp * 0.3) {
    bd.enragedTriggered = true;
    bd.enraged = true;
    if (mesh.material) mesh.material.emissiveIntensity = 1.3;
    flashCenterMsg('SENTINEL ENRAGED!', '#ff3d6e');
    triggerScreenShake(0.4);
  }

  if (bd.enraged) updateSentinelLightning(delta);

  updateBossHPBar(bd);

  // Damage handling
  if (!bd.shieldActive) {
    checkBossProjectileHits(bd, bd.size * 0.55, (dmg, isCrit, hitPos) => {
      bd.currentHp -= dmg;
      flashBossHit(bd, mesh.position.clone().add(new THREE.Vector3(0, bd.size * 0.15, 0)));
      spawnDamageNumber(mesh.position.clone().add(new THREE.Vector3(0, bd.size + 0.5, 0)), dmg, isCrit);
    });
  } else {
    // Shield absorbs damage
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (flatDist(p.position, mesh.position) < bd.size * 0.55) {
        const isCrit = Math.random() < stats.critChance;
        const dmg = Math.round((isCrit ? stats.attackDamage * 2.5 : stats.attackDamage) * (p.userData.dmgMult ?? 1));
        bd.shieldHp -= dmg;
        const sf = document.getElementById('boss-shield-fill');
        if (sf) sf.style.width = Math.max(0, (bd.shieldHp / bd.maxShieldHp) * 100) + '%';
        flashBossHit(bd, mesh.position.clone().add(new THREE.Vector3(0, bd.size * 0.15, 0)));
        projectiles.splice(i, 1); releasePlayerProjectile(p);
      }
    }
    for (let i = fireballs.length - 1; i >= 0; i--) {
      if (flatDist(fireballs[i].position, mesh.position) < bd.size * 0.7) {
        bd.shieldHp -= stats.attackDamage * 4;
        const sf2 = document.getElementById('boss-shield-fill');
        if (sf2) sf2.style.width = Math.max(0, (bd.shieldHp / bd.maxShieldHp) * 100) + '%';
        flashBossHit(bd, mesh.position.clone().add(new THREE.Vector3(0, bd.size * 0.15, 0)));
        spawnDeathParticles(fireballs[i].position, 0xff4400);
        removeAndDispose(fireballs[i]); fireballs.splice(i, 1);
      }
    }
    if (bd.shieldHp <= 0 && bd.shieldActive) breakSentinelShield();
  }

  if (bd.currentHp <= 0) {
    if (bd.activeAttack) { removeAndDispose(bd.activeAttack.mesh); bd.activeAttack = null; }
    killBoss();
  }
}

function updateSentinelStun(delta) {
  const bd = bossData;
  bd.stunTimer -= delta;
  if (bd.core) bd.core.material.emissiveIntensity = 1.4 + Math.sin(performance.now() * 0.03) * 1.2;
  if (bd.stunTimer <= 0) {
    bd.stunned = false;
    bd.phase2 = true;
    bd.attackTimer = 0.6;
    if (bd.core) bd.core.material.emissiveIntensity = bd.core.userData._baseEmissive ?? 1.4;
  }
}

function updateSentinelLightning(delta) {
  const bd = bossData;
  const sourceMesh = bossMesh;
  bd.lightningTimer = (bd.lightningTimer ?? 1.2) - delta;
  if (bd.lightningTimer <= 0) {
    for (let i = 0; i < 2; i++) {
      setTimeout(() => {
        if (bossMesh !== sourceMesh || bossData !== bd || !bd.enraged) return;
        const off = new THREE.Vector3((Math.random() - 0.5) * bd.size * 1.6, Math.random() * bd.size, (Math.random() - 0.5) * bd.size * 1.6);
        spawnDeathParticles(bossMesh.position.clone().add(off), 0x8844ff);
      }, i * 90);
    }
    triggerScreenShake(0.1);
    bd.lightningTimer = 1.0 + Math.random() * 0.8;
  }
}

function activateSentinelShield() {
  const bd = bossData;
  const sourceMesh = bossMesh;
  bd.shieldActive = true;
  bd.shieldHp = bd.hp * 0.6;
  bd.maxShieldHp = bd.shieldHp;
  const shieldBar = document.getElementById('boss-shield-bar');
  if (shieldBar) shieldBar.style.display = 'block';
  const shieldFill = document.getElementById('boss-shield-fill');
  if (shieldFill) shieldFill.style.width = '100%';
  bd.shieldAttackTimer = 1.9;
  flashCenterMsg('SHIELD ACTIVATING...', '#66ccff');
  triggerScreenShake(0.4);

  const scale = bd.size / 2.4;
  const positions = [[0, 0, 1.7], [1.7, 0, 0], [0, 0, -1.7], [-1.7, 0, 0]]
    .map(p => p.map(v => v * scale));
  bd.generators = [];

  positions.forEach((pos, i) => {
    setTimeout(() => {
      if (bossMesh !== sourceMesh || bossData !== bd) return;
      const worldPos = sourceMesh.position.clone().add(new THREE.Vector3(pos[0], pos[1], pos[2]));
      spawnDeathParticles(worldPos, 0x66ccff);
      triggerScreenShake(0.15);

      const geo = new THREE.OctahedronGeometry(0.35, 0);
      const mat = new THREE.MeshStandardMaterial({
        flatShading: true, color: 0x66ccff, emissive: 0x2288ff, emissiveIntensity: 0.8,
        metalness: 0.4, roughness: 0.4,
      });
      const gm = new THREE.Mesh(geo, mat);
      gm.position.set(pos[0], pos[1], pos[2]);
      gm.scale.set(0.01, 0.01, 0.01);
      sourceMesh.add(gm);

      const entry = { mesh: gm, hp: 60, maxHp: 60, destroyed: false, spawning: true };
      bd.generators.push(entry);

      tweenValue(0.45, t => {
        if (bossMesh !== sourceMesh || bossData !== bd) return;
        const e = 1 - Math.pow(1 - t, 3);
        const s = 0.05 + 0.95 * Math.min(1.15, e * 1.15);
        gm.scale.set(s, s, s);
      }, () => {
        if (bossMesh !== sourceMesh || bossData !== bd) return;
        gm.scale.set(1, 1, 1);
        entry.spawning = false;
        if (bd.generators.length === 4 && bd.generators.every(g => !g.spawning)) {
          triggerScreenShake(0.4);
          flashCenterMsg('SHIELD ACTIVATED — DESTROY GENERATORS', '#66ccff');
          tweenValue(0.5, t => {
            if (bossMesh === sourceMesh && bossData === bd && bd.shieldMesh) bd.shieldMesh.material.opacity = 0.35 * t;
          });
        }
      });
    }, i * 220);
  });
}

function updateSentinelGenerators(delta) {
  const bd = bossData;
  bd.shieldAttackTimer -= delta;
  if (bd.shieldAttackTimer <= 0 && bd.generators.length === 4 && bd.generators.every(g => !g.spawning)) {
    fireSentinelPlasmaBurst();
    bd.shieldAttackTimer = 1.7;
  }

  bd.generators.forEach(g => {
    if (g.destroyed || g.spawning) return;
    g.mesh.rotation.y += delta * 3;
    g.mesh.rotation.x += delta * 2;
    const worldPos = g.mesh.getWorldPosition(new THREE.Vector3());

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (flatDist(p.position, worldPos) < 0.5) {
        const isCrit = Math.random() < stats.critChance;
        const dmg = Math.round((isCrit ? stats.attackDamage * 2.5 : stats.attackDamage) * (p.userData.dmgMult ?? 1));
        g.hp -= dmg;
        flashEnemy(g.mesh);
        spawnDamageNumber(worldPos.clone().add(new THREE.Vector3(0, 0.5, 0)), dmg, isCrit);
        projectiles.splice(i, 1); releasePlayerProjectile(p);
      }
    }
    for (let i = fireballs.length - 1; i >= 0; i--) {
      if (flatDist(fireballs[i].position, worldPos) < 0.7) {
        g.hp -= stats.attackDamage * 4;
        flashEnemy(g.mesh);
        spawnDeathParticles(fireballs[i].position, 0xff4400);
        removeAndDispose(fireballs[i]); fireballs.splice(i, 1);
      }
    }

    if (g.hp <= 0) {
      g.destroyed = true;
      spawnDeathParticles(worldPos, 0x66ccff);
      removeAndDispose(g.mesh);
      triggerScreenShake(0.25);
    }
  });

  if (bd.generators.length === 4 && bd.generators.every(g => g.destroyed)) {
    breakSentinelShield();
  }
}

function breakSentinelShield() {
  const bd = bossData;
  if (!bd || !bd.shieldActive) return;
  bd.shieldActive = false;
  if (bd.shieldMesh) bd.shieldMesh.material.opacity = 0;
  const shieldBar = document.getElementById('boss-shield-bar');
  if (shieldBar) shieldBar.style.display = 'none';
  bd.generators.forEach(g => {
    if (!g.destroyed && bossMesh) {
      g.destroyed = true;
      const worldPos = g.mesh.getWorldPosition(new THREE.Vector3());
      spawnDeathParticles(worldPos, 0x66ccff);
      removeAndDispose(g.mesh);
    }
  });
  bd.stunned = true;
  bd.stunTimer = 1.0;
  flashCenterMsg('SHIELD DOWN — CORE EXPOSED', '#ff3d6e');
  triggerScreenShake(0.5);
}

function updateSentinelAttacks(delta) {
  const bd = bossData;
  if (!bossMesh) return;

  if (bd.activeAttack) {
    const atk = bd.activeAttack;
    atk.timer -= delta;
    if (atk.state === 'charging') {
      orientSentinelLaser(atk);
      const t = Math.min(1, 1 - atk.timer / atk.duration);
      const pulse = Math.sin(performance.now() * 0.025) * 0.08;
      atk.mesh.material.opacity = 0.22 + t * 0.55 + pulse;
      atk.mesh.scale.z = 0.5 + t * 0.9;
      const heat = Math.min(1, t * 1.15);
      atk.mesh.material.color.setRGB(1, 0.18 + 0.62 * heat, 0.2 + 0.55 * heat);
      if (atk.timer <= 0) {
        fireSentinelLaserImpact(atk);
        atk.state = 'firing';
        atk.timer = 0.25;
      }
    } else if (atk.state === 'firing') {
      if (atk.timer <= 0) {
        removeAndDispose(atk.mesh);
        bd.activeAttack = null;
        bd.attackTimer = sentinelCooldown(bd, 2.0, 1.4, 1.0);
      }
    }
    return;
  }

  bd.attackTimer -= delta;
  if (bd.attackTimer <= 0) {
    if (bd.nextAttack === 'plasma') {
      fireSentinelPlasmaBurst();
      bd.nextAttack = 'laser';
      bd.attackTimer = sentinelCooldown(bd, 1.8, 1.2, 1.0);
    } else {
      startSentinelLaser();
      bd.nextAttack = 'plasma';
      bd.attackTimer = 999;
    }
  }
}

function sentinelCooldown(bd, base, phase2Val, enragedVal) {
  if (bd.enraged) return enragedVal;
  if (bd.phase2) return phase2Val;
  return base;
}

function fireSentinelPlasmaBurst() {
  const bd = bossData;
  const sourceMesh = bossMesh;
  const volleys = bd.enraged ? 2 : 1;
  const baseDir = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  baseDir.y = 0; baseDir.normalize();
  const spreadAngles = [-0.28, 0, 0.28];

  for (let v = 0; v < volleys; v++) {
    setTimeout(() => {
      if (!bossActive || bossMesh !== sourceMesh || bossData !== bd) return;
      spreadAngles.forEach(a => {
        const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        spawnEnemyProjectile(sourceMesh.position.clone(), dir, { speed: 0.16, damage: 14, color: 0xaa44ff });
      });
    }, v * 220);
  }
}

function startSentinelLaser() {
  const bd = bossData;
  const dir = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.0001) dir.set(1, 0, 0); else dir.normalize();

  const length = 12;
  const geo = new THREE.BoxGeometry(length, 0.04, 0.21);
  geo.translate(length / 2, 0, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.22 });
  const beam = new THREE.Mesh(geo, mat);
  const rageWidthMult = bd.enraged ? 2.5 : 1;
  beam.scale.z = 0.75 * rageWidthMult;
  scene.add(beam);

  const duration = bd.enraged ? 0.6 : 1.0;
  bd.activeAttack = { type: 'laser', state: 'charging', timer: duration, duration, dir, mesh: beam, rageWidthMult };
  orientSentinelLaser(bd.activeAttack);
  flashCenterMsg('⚠ LASER LOCK ⚠', '#ff3355');
}

function orientSentinelLaser(atk) {
  atk.mesh.position.copy(bossMesh.position);
  atk.mesh.position.y = 0.05;
  const axis = new THREE.Vector3(1, 0, 0);
  atk.mesh.quaternion.setFromUnitVectors(axis, atk.dir);
}

function fireSentinelLaserImpact(atk) {
  const bd = bossData;
  atk.mesh.material.color.setHex(0xffffff);
  atk.mesh.material.opacity = 0.95;
  atk.mesh.scale.z = 4 * atk.rageWidthMult;
  triggerScreenShake(0.5);
  AudioManager.explosion();

  const laserHalfWidth = atk.mesh.scale.z * LASER_BASE_HALF_WIDTH;
  const toPlayer = new THREE.Vector3().subVectors(player.position, bossMesh.position);
  toPlayer.y = 0;
  const along = toPlayer.dot(atk.dir);
  const perp = toPlayer.clone().sub(atk.dir.clone().multiplyScalar(along));
  const impactPoint = bossMesh.position.clone().addScaledVector(atk.dir, Math.max(0, along));
  impactPoint.y = 0.3;
  spawnDeathParticles(impactPoint, 0xff3355);

  if (along > 0 && perp.length() < laserHalfWidth && invincibleTimer <= 0) {
    stats.hp -= bd.enraged ? 35 : 25;
    triggerHealthFlash();
  }
}