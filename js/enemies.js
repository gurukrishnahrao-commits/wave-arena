// ============================================
// ENEMIES — seven archetypes and readable AI
// ============================================

const ENEMY_TYPES = {
  basic: {
    color: 0xff7a3d, emissive: 0x992200, size: 0.55,
    hp: w => 2 + Math.floor(w * 0.5), speed: w => 0.045 + w * 0.002,
    damage: 8, coins: 1, shape: 'octa', unlockWave: 1,
  },
  fast: {
    color: 0xffef00, emissive: 0x997700, size: 0.35,
    hp: w => 1 + Math.floor(w * 0.3), speed: w => 0.1 + w * 0.003,
    damage: 5, coins: 2, shape: 'tetra', unlockWave: 2,
  },
  shooter: {
    color: 0x00e5ff, emissive: 0x006688, size: 0.5,
    hp: w => 3 + Math.floor(w * 0.7), speed: w => 0.03 + w * 0.001,
    damage: 3, coins: 4, shape: 'octa', unlockWave: 4,
    shootInterval: 2.5, preferDist: 6,
  },
  exploder: {
    color: 0xff2244, emissive: 0x880011, size: 0.6,
    hp: w => 3 + Math.floor(w * 0.4), speed: w => 0.055 + w * 0.002,
    damage: 45, coins: 3, shape: 'sphere', unlockWave: 5, fuseRange: 1.8,
  },
  dasher: {
    color: 0xff44bb, emissive: 0x881155, size: 0.48,
    hp: w => 4 + Math.floor(w * 0.65), speed: w => 0.042 + w * 0.0015,
    damage: 18, coins: 5, shape: 'tetra', unlockWave: 6, dash: true,
  },
  healer: {
    color: 0x55ff99, emissive: 0x116633, size: 0.62,
    hp: w => 7 + Math.floor(w * 0.9), speed: w => 0.027 + w * 0.001,
    damage: 4, coins: 7, shape: 'box', unlockWave: 8, healer: true, preferDist: 7,
  },
  splitter: {
    color: 0xff8844, emissive: 0x773311, size: 0.72,
    hp: w => 8 + Math.floor(w * 0.9), speed: w => 0.038 + w * 0.0015,
    damage: 10, coins: 6, shape: 'sphere', unlockWave: 11, splitter: true,
  },
};

function pickEnemyType() {
  const available = Object.entries(ENEMY_TYPES)
    .filter(([, t]) => waveNumber >= t.unlockWave)
    .map(([id, t]) => ({ id, ...t }));

  const weights = available.map(t => {
    if (t.id === 'basic') return Math.max(1, 6 - waveNumber * 0.25);
    if (t.id === 'fast') return 1.2 + waveNumber * 0.07;
    if (t.id === 'shooter') return 0.8 + waveNumber * 0.08;
    if (t.id === 'exploder') return 0.6 + waveNumber * 0.06;
    if (t.id === 'dasher') return 0.5 + waveNumber * 0.055;
    if (t.id === 'healer') return 0.32 + waveNumber * 0.035;
    if (t.id === 'splitter') return 0.38 + waveNumber * 0.04;
    return 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < available.length; i++) {
    r -= weights[i];
    if (r <= 0) return available[i];
  }
  return available[0];
}

function buildLowPolyAlien(type) {
  const s = type.size;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    flatShading: true, color: type.color, emissive: type.emissive,
    emissiveIntensity: 0.5, metalness: 0.35, roughness: 0.35,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    flatShading: true, color: 0x0a0a0a, emissive: 0xffffff,
    emissiveIntensity: 0.5, roughness: 0.6,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    flatShading: true, color: type.emissive, emissive: type.color,
    emissiveIntensity: 1.1, roughness: 0.4,
  });

  const legCount = type.shape === 'box' ? 4 : (type.shape === 'tetra' ? 2 : 3);
  const legGeo = new THREE.ConeGeometry(s * 0.12, s * 0.85, 5);
  for (let i = 0; i < legCount; i++) {
    const a = (i / legCount) * Math.PI * 2;
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(Math.cos(a) * s * 0.32, -s * 0.55, Math.sin(a) * s * 0.32);
    leg.rotation.z = Math.cos(a) * 0.35;
    leg.rotation.x = Math.sin(a) * 0.35;
    group.add(leg);
  }

  let bodyGeo;
  switch (type.shape) {
    case 'tetra': bodyGeo = new THREE.TetrahedronGeometry(s * 0.55, 0); break;
    case 'box': bodyGeo = new THREE.BoxGeometry(s * 0.8, s * 0.65, s * 0.7); break;
    case 'sphere': bodyGeo = new THREE.SphereGeometry(s * 0.5, 6, 5); break;
    default: bodyGeo = new THREE.OctahedronGeometry(s * 0.5, 0);
  }
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = -s * 0.05;
  body.scale.y = 0.85;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.4, 6, 5), bodyMat);
  head.position.y = s * 0.42;
  head.scale.set(1, 1.15, 0.95);
  group.add(head);

  const eyeCount = type.shootInterval || type.healer ? 1 : (type.fuseRange || type.splitter ? 3 : 2);
  const eyeGeo = new THREE.SphereGeometry(s * (eyeCount === 1 ? 0.14 : 0.08), 5, 4);
  const eMat = type.fuseRange || type.healer ? glowMat : eyeMat;
  for (let i = 0; i < eyeCount; i++) {
    const spread = eyeCount === 1 ? 0 : (i - (eyeCount - 1) / 2) * s * 0.18;
    const eye = new THREE.Mesh(eyeGeo, eMat);
    eye.position.set(spread, s * 0.44, s * 0.32);
    group.add(eye);
  }

  if (type.shootInterval || type.healer) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.3, 5), bodyMat);
    stalk.position.y = s * 0.75;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(s * 0.08, 5, 4), glowMat);
    tip.position.y = s * 0.92;
    group.add(stalk, tip);
  }

  if (type.fuseRange || type.splitter) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(s * 0.09, s * 0.3, 4), glowMat);
      spike.position.set(Math.cos(a) * s * 0.4, s * 0.05, Math.sin(a) * s * 0.4);
      spike.rotation.z = -Math.cos(a) * 1.1;
      spike.rotation.x = Math.sin(a) * 1.1;
      group.add(spike);
    }
  }

  if (type.healer) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(s * 0.72, s * 0.035, 4, 16),
      new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity: 0.7 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = s * 0.15;
    halo.userData.supportHalo = true;
    group.add(halo);
  }

  if (type.dash) {
    const fins = new THREE.Mesh(
      new THREE.TorusGeometry(s * 0.62, s * 0.05, 4, 8),
      new THREE.MeshBasicMaterial({ color: type.color, wireframe: true })
    );
    fins.rotation.x = Math.PI / 2;
    group.add(fins);
  }

  group.traverse(c => { if (c.isMesh) c.castShadow = getGameSettings().quality !== 'low'; });
  group.material = bodyMat;
  return group;
}

function enemyTypeWithId(id) {
  const type = ENEMY_TYPES[id];
  return type ? { id, ...type } : null;
}

function spawnEnemy(typeId = null, position = null, options = {}) {
  const angle = Math.random() * Math.PI * 2;
  const pos = position ? position.clone() : new THREE.Vector3(
    Math.cos(angle) * (CONFIG.ARENA_RADIUS - 1), 0,
    Math.sin(angle) * (CONFIG.ARENA_RADIUS - 1)
  );
  clampToArena(pos, 1);

  const type = typeId ? enemyTypeWithId(typeId) : pickEnemyType();
  if (!type) return null;
  const mesh = buildLowPolyAlien(type);
  const spawnScale = options.scale || 1;
  mesh.position.set(pos.x, type.size * spawnScale, pos.z);
  mesh.scale.setScalar(0.01 * spawnScale);

  const hp = options.hp ?? Math.max(1, Math.round(type.hp(waveNumber) * (options.hpMult || 1)));
  mesh.userData = {
    type: type.id, hp, maxHp: hp,
    speed: (options.speed ?? type.speed(waveNumber)) * (options.speedMult || 1),
    damage: options.damage ?? type.damage,
    coins: options.coins ?? type.coins,
    shootTimer: type.shootInterval ?? 99,
    shootInterval: type.shootInterval ?? 99,
    preferDist: type.preferDist ?? 6,
    fuseRange: type.fuseRange ?? 0,
    exploded: false, spawning: true,
    dashState: 'approach', dashTimer: 1.4 + Math.random() * 1.5,
    healTimer: 1.5 + Math.random(),
    splitChild: !!options.splitChild,
    tutorialTarget: !!options.tutorialTarget,
  };

  const segs = getGameSettings().quality === 'low' ? 12 : 24;
  const portal = new THREE.Mesh(
    new THREE.RingGeometry(0.2, options.portalSize || 1.0, segs),
    new THREE.MeshBasicMaterial({ color: options.portalColor || 0xaa44ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  portal.rotation.x = -Math.PI / 2;
  portal.position.set(pos.x, 0.05, pos.z);
  scene.add(portal);

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, segs),
    new THREE.MeshBasicMaterial({ color: type.emissive, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(pos.x, 0.06, pos.z);
  scene.add(glow);

  scene.add(mesh);
  enemies.push(mesh);
  spawnAnimations.push({
    portal, glow, mesh, targetScale: spawnScale,
    timer: 0, duration: options.spawnDuration || CONFIG.SPAWN.ANIMATION_DURATION,
  });
  return mesh;
}

function spawnEnemyAt(typeId, position, options = {}) {
  return spawnEnemy(typeId, position, options);
}

function updateSpawnAnimations(delta) {
  for (let i = spawnAnimations.length - 1; i >= 0; i--) {
    const a = spawnAnimations[i];
    if (!a.mesh.parent) {
      removeAndDispose(a.portal); removeAndDispose(a.glow);
      spawnAnimations.splice(i, 1);
      continue;
    }
    a.timer += delta;
    const t = Math.min(1, a.timer / a.duration);
    const baseScale = a.targetScale || 1;
    const scale = (t < 0.8 ? (t / 0.8) * 1.15 : 1.15 - (t - 0.8) / 0.2 * 0.15) * baseScale;
    a.mesh.scale.setScalar(scale);
    const portalScale = 1 + t * 1.5;
    a.portal.scale.set(portalScale, portalScale, portalScale);
    a.portal.material.opacity = (1 - t) * 0.9;
    a.glow.material.opacity = (1 - t) * 0.5;
    a.portal.rotation.z += delta * 4;

    if (a.timer >= a.duration) {
      a.mesh.scale.setScalar(a.targetScale || 1);
      a.mesh.userData.spawning = false;
      removeAndDispose(a.portal);
      removeAndDispose(a.glow);
      spawnAnimations.splice(i, 1);
    }
  }
}

function damageEnemy(enemy, amount, isCrit = false, options = {}) {
  if (!enemy?.userData || enemy.userData.hp <= 0) return 0;
  let actual = amount;
  if (!options.ignoreShield && enemy.userData.shieldedUntil > elapsedTime) actual *= 0.6;
  actual = Math.max(0, actual);
  enemy.userData.hp -= actual;
  flashEnemy(enemy);
  if (!options.silentNumber) {
    spawnDamageNumber(enemy.position.clone().add(new THREE.Vector3(0, 1.2, 0)), Math.max(1, Math.round(actual)), isCrit);
  }
  return actual;
}

function spawnSupportPulse(position, radius, color) {
  trimParticleBudget(1);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.16, getGameSettings().quality === 'low' ? 12 : 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(position);
  ring.position.y = 0.08;
  ring.userData = { life: 0.6, maxLife: 0.6, expand: true, baseScale: radius / 2 };
  ring.scale.setScalar(ring.userData.baseScale);
  scene.add(ring);
  particles.push(ring);
}

function updateDasher(e, ud, dir, dist, delta, step) {
  if (ud.dashState === 'windup') {
    ud.dashWindup -= delta;
    const pulse = 1 + Math.sin(ud.dashWindup * 36) * 0.18;
    e.scale.set(pulse, pulse, pulse);
    e.material.emissiveIntensity = 1.8;
    if (ud.dashWindup <= 0) {
      ud.dashState = 'dash';
      ud.dashLife = 0.34;
      ud.dashHit = false;
      e.scale.set(1, 1, 1);
    }
    return;
  }
  if (ud.dashState === 'dash') {
    ud.dashLife -= delta;
    e.position.x += ud.dashDir.x * 0.32 * step;
    e.position.z += ud.dashDir.z * 0.32 * step;
    if (!ud.dashHit && flatDist(e.position, player.position) < 0.9) {
      ud.dashHit = true;
      if (invincibleTimer <= 0) { stats.hp -= ud.damage; triggerHealthFlash(); }
    }
    if (ud.dashLife <= 0) {
      ud.dashState = 'approach';
      ud.dashTimer = 2.2 + Math.random();
      e.material.emissiveIntensity = 0.5;
    }
    return;
  }

  ud.dashTimer -= delta;
  if (ud.dashTimer <= 0 && dist < 11) {
    ud.dashState = 'windup';
    ud.dashWindup = 0.72;
    ud.dashDir = dir.clone();
    spawnSupportPulse(e.position, 1.5, 0xff44bb);
    return;
  }
  if (dist > 1) {
    e.position.x += dir.x * ud.speed * step;
    e.position.z += dir.z * ud.speed * step;
  }
  e.rotation.y += delta * 4;
}

function updateHealer(e, ud, dir, dist, delta, step, index) {
  if (dist < ud.preferDist - 1) {
    e.position.x -= dir.x * ud.speed * step;
    e.position.z -= dir.z * ud.speed * step;
  } else if (dist > ud.preferDist + 1) {
    e.position.x += dir.x * ud.speed * step;
    e.position.z += dir.z * ud.speed * step;
  }
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  e.position.addScaledVector(perp, ud.speed * Math.sin(elapsedTime + index) * 0.35 * step);
  ud.healTimer -= delta;
  for (const ally of enemies) {
    if (ally !== e && flatDist(ally.position, e.position) < 4.5) ally.userData.shieldedUntil = elapsedTime + 0.2;
  }
  if (ud.healTimer <= 0) {
    ud.healTimer = 3.2;
    let helped = false;
    for (const ally of enemies) {
      if (ally === e || flatDist(ally.position, e.position) >= 4.5) continue;
      const old = ally.userData.hp;
      ally.userData.hp = Math.min(ally.userData.maxHp, ally.userData.hp + 2 + waveNumber * 0.08);
      helped ||= ally.userData.hp > old;
    }
    if (helped) AudioManager.purchase();
    spawnSupportPulse(e.position, 4.5, 0x55ff99);
  }
  e.traverse(c => { if (c.userData.supportHalo) c.rotation.z += delta * 2; });
  e.rotation.y += delta;
}

function updateEnemies(delta) {
  const step = frameScale(delta);
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ud = e.userData;
    if (ud.spawning) continue;

    const toPlayer = new THREE.Vector3().subVectors(player.position, e.position);
    toPlayer.y = 0;
    const distToPlayer = toPlayer.length();
    const dir = distToPlayer > 0.001 ? toPlayer.clone().normalize() : new THREE.Vector3(1, 0, 0);

    switch (ud.type) {
      case 'basic':
      case 'fast':
      case 'splitter':
        if (distToPlayer > 0.9) {
          e.position.x += dir.x * ud.speed * step;
          e.position.z += dir.z * ud.speed * step;
        } else if (invincibleTimer <= 0) {
          stats.hp -= ud.damage * delta;
          triggerHealthFlash();
          if (stats.thorns) damageEnemy(e, 5 * delta, false, { silentNumber: true, ignoreShield: true });
        }
        e.rotation.y += delta * (ud.type === 'fast' ? 5 : 2);
        e.rotation.x += delta * (ud.type === 'splitter' ? 0.4 : 1.3);
        break;

      case 'shooter': {
        if (distToPlayer < ud.preferDist - 1) {
          e.position.x -= dir.x * ud.speed * 0.8 * step;
          e.position.z -= dir.z * ud.speed * 0.8 * step;
        } else if (distToPlayer > ud.preferDist + 1) {
          e.position.x += dir.x * ud.speed * step;
          e.position.z += dir.z * ud.speed * step;
        }
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);
        e.position.addScaledVector(perp, ud.speed * 0.5 * Math.sin(elapsedTime * 2 + i) * step);
        clampToArena(e.position, 1);
        ud.shootTimer -= delta;
        if (ud.shootTimer <= 0) {
          spawnEnemyProjectile(e.position, dir);
          ud.shootTimer = ud.shootInterval;
        }
        e.rotation.y += delta;
        break;
      }

      case 'exploder':
        if (distToPlayer > ud.fuseRange) {
          e.position.x += dir.x * ud.speed * step;
          e.position.z += dir.z * ud.speed * step;
          const pulse = Math.sin(elapsedTime * 10 + i) * 0.5 + 0.5;
          e.material.emissiveIntensity = 0.3 + (1 - Math.min(1, distToPlayer / 5)) * pulse * 1.5;
        } else if (!ud.exploded) {
          ud.exploded = true;
          if (invincibleTimer <= 0) { stats.hp -= ud.damage; triggerScreenShake(0.5); triggerHealthFlash(); }
          spawnDeathParticles(e.position, 0xff2244);
          spawnDeathParticles(e.position, 0xffaa00);
          AudioManager.explosion();
          for (const other of enemies) {
            if (other !== e && other.position.distanceTo(e.position) < 3) damageEnemy(other, 3, false, { silentNumber: true, ignoreShield: true });
          }
          ud.hp = 0;
        }
        e.rotation.y += delta * 3;
        e.rotation.z += delta * 2;
        break;

      case 'dasher':
        updateDasher(e, ud, dir, distToPlayer, delta, step);
        break;

      case 'healer':
        updateHealer(e, ud, dir, distToPlayer, delta, step, i);
        break;
    }

    clampToArena(e.position, 0.8);

    if (ud.hp <= 0) {
      const deathPos = e.position.clone();
      const deathColor = e.material.color.getHex();
      killCount++;
      recordEnemyDefeat();
      document.getElementById('kills').textContent = killCount;
      if (!ud.exploded) spawnDeathParticles(deathPos, deathColor);
      if (ud.coins > 0) spawnCoinPickup(deathPos, ud.coins * stats.coinMult);
      triggerScreenShake(ud.type === 'exploder' ? 0.4 : 0.1);
      combatLightIntensity = Math.min(4, combatLightIntensity + 1.5);
      AudioManager.enemyDeath();
      removeAndDispose(e);
      enemies.splice(i, 1);

      if (ud.type === 'splitter' && !ud.splitChild) {
        for (const side of [-1, 1]) {
          const offset = new THREE.Vector3(side * 0.45, 0, (Math.random() - 0.5) * 0.4);
          spawnEnemyAt('fast', deathPos.clone().add(offset), {
            hp: Math.max(1, Math.ceil(ud.maxHp * 0.28)), speedMult: 1.2,
            coins: 1, splitChild: true, spawnDuration: 0.18, portalSize: 0.55,
          });
        }
      }
    }
  }
}
