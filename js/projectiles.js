// ============================================
// PROJECTILES — pooled player and enemy shots
// ============================================

function projectilePoolKey(size, color) {
  return `${Number(size).toFixed(3)}:${Number(color).toString(16)}`;
}

function acquireProjectile(kind, size, color) {
  const pools = kind === 'enemy' ? RUNTIME_POOLS.enemyProjectiles : RUNTIME_POOLS.playerProjectiles;
  const key = projectilePoolKey(size, color);
  let pool = pools.get(key);
  if (!pool) { pool = []; pools.set(key, pool); }
  let mesh = pool.pop();
  if (!mesh) {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 5, 4),
      new THREE.MeshBasicMaterial({ color })
    );
  }
  mesh.visible = true;
  mesh.scale.set(1, 1, 1);
  mesh.userData = { poolKey: key, projectileKind: kind };
  scene.add(mesh);
  return mesh;
}

function releaseProjectile(mesh, kind) {
  if (!mesh) return;
  const pools = kind === 'enemy' ? RUNTIME_POOLS.enemyProjectiles : RUNTIME_POOLS.playerProjectiles;
  const key = mesh.userData.poolKey;
  removeSharedObject(mesh);
  mesh.userData = { poolKey: key, projectileKind: kind };
  let pool = pools.get(key);
  if (!pool) { pool = []; pools.set(key, pool); }
  if (pool.length < 80) pool.push(mesh);
  else disposeObject3D(mesh);
}

function releasePlayerProjectile(mesh) { releaseProjectile(mesh, 'player'); }
function releaseEnemyProjectile(mesh) { releaseProjectile(mesh, 'enemy'); }

function fireProjectile(target, pierce = false) {
  const proj = acquireProjectile('player', 0.15, 0x3dffd2);
  proj.position.copy(player.position);
  proj.position.y = 0.7;

  const dir = new THREE.Vector3().subVectors(target.position, player.position);
  dir.y = 0;
  dir.normalize();

  Object.assign(proj.userData, { dir, speed: 0.35, life: 2, target, pierce, hitIds: new Set() });
  projectiles.push(proj);
  triggerMuzzleFlash();
  AudioManager.shoot();
}

function fireProjectileInDir(dir, opts = {}) {
  const size = opts.size || 0.12;
  const color = opts.color || 0x3dffd2;
  const proj = acquireProjectile('player', size, color);
  proj.position.copy(player.position);
  proj.position.y = 0.7;
  Object.assign(proj.userData, {
    dir: dir.clone(), speed: opts.speed ?? 0.4, life: opts.life ?? 0.8,
    pierce: opts.pierce || false, dmgMult: opts.dmgMult ?? 1, hitIds: new Set(),
  });
  projectiles.push(proj);
}

function updateProjectiles(delta) {
  const step = frameScale(delta);
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.position.x += p.userData.dir.x * p.userData.speed * step;
    p.position.z += p.userData.dir.z * p.userData.speed * step;
    p.userData.life -= delta;

    let hit = false;
    for (const e of enemies) {
      if (p.userData.hitIds?.has(e.uuid)) continue;
      if (p.position.distanceTo(e.position) < 0.6) {
        const isCrit = Math.random() < stats.critChance;
        const dmgMult = p.userData.dmgMult ?? 1;
        const dmg = Math.round((isCrit ? stats.attackDamage * 2.5 : stats.attackDamage) * dmgMult);
        damageEnemy(e, dmg, isCrit);
        p.userData.hitIds?.add(e.uuid);
        if (isCrit) { triggerScreenShake(0.12); AudioManager.critHit(); }
        else AudioManager.hit();
        if (!p.userData.pierce) { hit = true; break; }
      }
    }

    if (hit || p.userData.life <= 0) {
      releasePlayerProjectile(p);
      projectiles.splice(i, 1);
    }
  }
}

function spawnEnemyProjectile(from, dir, opts = {}) {
  const size = opts.size || 0.12;
  const color = opts.color ?? 0x00e5ff;
  const proj = acquireProjectile('enemy', size, color);
  proj.position.copy(from);
  proj.position.y = opts.y ?? 0.7;
  Object.assign(proj.userData, {
    dir: dir.clone(), speed: opts.speed ?? 0.18, life: opts.life ?? 4,
    damage: opts.damage ?? 12,
  });
  enemyProjectiles.push(proj);
}

function updateEnemyProjectiles(delta) {
  const step = frameScale(delta);
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const p = enemyProjectiles[i];
    p.position.x += p.userData.dir.x * p.userData.speed * step;
    p.position.z += p.userData.dir.z * p.userData.speed * step;
    p.userData.life -= delta;
    if (p.position.distanceTo(player.position) < 0.5) {
      if (invincibleTimer <= 0) {
        stats.hp -= p.userData.damage ?? 12;
        triggerHealthFlash();
        triggerScreenShake(0.2);
      }
      releaseEnemyProjectile(p);
      enemyProjectiles.splice(i, 1);
      continue;
    }
    if (p.userData.life <= 0) {
      releaseEnemyProjectile(p);
      enemyProjectiles.splice(i, 1);
    }
  }
}
