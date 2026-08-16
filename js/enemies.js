// ============================================
// ENEMIES — types, spawning, AI, meshes
// ============================================

const ENEMY_TYPES = {
  basic: {
    color: 0xff7a3d, emissive: 0x992200, size: 0.55,
    hp: w => 2 + Math.floor(w * 0.5),
    speed: w => 0.045 + w * 0.002,
    damage: 8, coins: 1,
    shape: 'octa', unlockWave: 1,
  },
  fast: {
    color: 0xffef00, emissive: 0x997700, size: 0.35,
    hp: w => 1 + Math.floor(w * 0.3),
    speed: w => 0.1 + w * 0.003,
    damage: 5, coins: 2,
    shape: 'tetra', unlockWave: 2,
  },
  shooter: {
    color: 0x00e5ff, emissive: 0x006688, size: 0.5,
    hp: w => 3 + Math.floor(w * 0.7),
    speed: w => 0.03 + w * 0.001,
    damage: 3, coins: 4,
    shape: 'octa', unlockWave: 4,
    shootInterval: 2.5, preferDist: 6,
  },
  exploder: {
    color: 0xff2244, emissive: 0x880011, size: 0.6,
    hp: w => 3 + Math.floor(w * 0.4),
    speed: w => 0.055 + w * 0.002,
    damage: 45, coins: 3,
    shape: 'sphere', unlockWave: 5,
    fuseRange: 1.8,
  },
};

function pickEnemyType() {
  const available = Object.entries(ENEMY_TYPES)
    .filter(([, t]) => waveNumber >= t.unlockWave)
    .map(([id, t]) => ({ id, ...t }));

  const weights = available.map(t => {
    if (t.id === 'basic') return Math.max(1, 6 - waveNumber * 0.3);
    if (t.id === 'fast') return 1.0 + waveNumber * 0.1;
    if (t.id === 'shooter') return 0.8 + waveNumber * 0.1;
    if (t.id === 'exploder') return 0.7 + waveNumber * 0.09;
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

  // Legs
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

  // Body core
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

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.4, 6, 5), bodyMat);
  head.position.y = s * 0.42;
  head.scale.set(1, 1.15, 0.95);
  group.add(head);

  // Eyes
  const eyeCount = type.shootInterval ? 1 : (type.fuseRange ? 3 : 2);
  const eyeGeo = new THREE.SphereGeometry(s * (eyeCount === 1 ? 0.14 : 0.08), 5, 4);
  const eMat = type.fuseRange ? glowMat : eyeMat;
  for (let i = 0; i < eyeCount; i++) {
    const spread = eyeCount === 1 ? 0 : (i - (eyeCount - 1) / 2) * s * 0.18;
    const eye = new THREE.Mesh(eyeGeo, eMat);
    eye.position.set(spread, s * 0.44, s * 0.32);
    group.add(eye);
  }

  // Antenna for shooters
  if (type.shootInterval) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.3, 5), bodyMat);
    stalk.position.y = s * 0.75;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(s * 0.08, 5, 4), glowMat);
    tip.position.y = s * 0.92;
    group.add(stalk, tip);
  }

  // Spikes for exploders
  if (type.fuseRange) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(s * 0.09, s * 0.3, 4), glowMat);
      spike.position.set(Math.cos(a) * s * 0.4, s * 0.05, Math.sin(a) * s * 0.4);
      spike.rotation.z = -Math.cos(a) * 1.1;
      spike.rotation.x = Math.sin(a) * 1.1;
      group.add(spike);
    }
  }

  group.traverse(c => { if (c.isMesh) c.castShadow = true; });
  group.material = bodyMat;
  return group;
}

function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const x = Math.cos(angle) * (CONFIG.ARENA_RADIUS - 1);
  const z = Math.sin(angle) * (CONFIG.ARENA_RADIUS - 1);

  const type = pickEnemyType();
  const mesh = buildLowPolyAlien(type);
  mesh.position.set(x, type.size, z);
  mesh.castShadow = true;
  mesh.scale.set(0.01, 0.01, 0.01);

  const hp = type.hp(waveNumber);
  mesh.userData = {
    type: type.id, hp, maxHp: hp,
    speed: type.speed(waveNumber),
    damage: type.damage,
    coins: type.coins,
    shootTimer: type.shootInterval ?? 99,
    shootInterval: type.shootInterval ?? 99,
    preferDist: type.preferDist ?? 6,
    fuseRange: type.fuseRange ?? 0,
    exploded: false,
    spawning: true,
  };

  // Spawn portal
  const portalGeo = new THREE.RingGeometry(0.2, 1.0, 24);
  const portalMat = new THREE.MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const portal = new THREE.Mesh(portalGeo, portalMat);
  portal.rotation.x = -Math.PI / 2;
  portal.position.set(x, 0.05, z);
  scene.add(portal);

  const glowGeo = new THREE.CircleGeometry(0.7, 24);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x6600ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 0.06, z);
  scene.add(glow);

  scene.add(mesh);
  enemies.push(mesh);
  spawnAnimations.push({ portal, glow, mesh, timer: 0, duration: CONFIG.SPAWN.ANIMATION_DURATION });
}

function updateSpawnAnimations(delta) {
  for (let i = spawnAnimations.length - 1; i >= 0; i--) {
    const a = spawnAnimations[i];
    a.timer += delta;
    const t = Math.min(1, a.timer / a.duration);
    const scale = t < 0.8 ? (t / 0.8) * 1.15 : 1.15 - (t - 0.8) / 0.2 * 0.15;
    a.mesh.scale.set(scale, scale, scale);
    const portalScale = 1 + t * 1.5;
    a.portal.scale.set(portalScale, portalScale, portalScale);
    a.portal.material.opacity = (1 - t) * 0.9;
    a.glow.material.opacity = (1 - t) * 0.5;
    a.portal.rotation.z += delta * 4;

    if (a.timer >= a.duration) {
      a.mesh.scale.set(1, 1, 1);
      a.mesh.userData.spawning = false;
      scene.remove(a.portal);
      scene.remove(a.glow);
      spawnAnimations.splice(i, 1);
    }
  }
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
    const dir = toPlayer.clone().normalize();

    switch (ud.type) {
      case 'basic':
      case 'fast':
        if (distToPlayer > 0.9) {
          e.position.x += dir.x * ud.speed * step;
          e.position.z += dir.z * ud.speed * step;
        } else if (invincibleTimer <= 0) {
          stats.hp -= ud.damage * delta;
          triggerHealthFlash();
          triggerScreenShake(0.15);
          if (stats.thorns) e.userData.hp -= 5 * delta; // BUG FIX: thorns now works
        }
        e.rotation.y += delta * (ud.type === 'fast' ? 5 : 2);
        e.rotation.x += delta * 1.3;
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
        e.position.x += perp.x * ud.speed * 0.5 * Math.sin(elapsedTime * 2 + i) * step;
        e.position.z += perp.z * ud.speed * 0.5 * Math.sin(elapsedTime * 2 + i) * step;
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
          if (invincibleTimer <= 0) {
            stats.hp -= ud.damage;
            triggerScreenShake(0.5);
            triggerHealthFlash();
          }
          spawnDeathParticles(e.position, 0xff2244);
          spawnDeathParticles(e.position, 0xffaa00);
          AudioManager.explosion();
          for (const other of enemies) {
            if (other !== e && other.position.distanceTo(e.position) < 3) {
              other.userData.hp -= 3;
            }
          }
          ud.hp = 0;
        }
        e.rotation.y += delta * 3;
        e.rotation.z += delta * 2;
        break;
    }

    if (ud.hp <= 0) {
      killCount++;
      document.getElementById('kills').textContent = killCount;
      if (!ud.exploded) spawnDeathParticles(e.position, e.material.color.getHex());
      spawnCoinPickup(e.position, ud.coins * stats.coinMult); // BUG FIX: coin multiplier applied
      triggerScreenShake(ud.type === 'exploder' ? 0.4 : 0.1);
      combatLightIntensity = Math.min(4, combatLightIntensity + 1.5);
      AudioManager.enemyDeath();
      scene.remove(e);
      enemies.splice(i, 1);
    }
  }
}