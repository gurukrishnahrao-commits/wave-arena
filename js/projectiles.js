// ============================================
// PROJECTILES — player + enemy
// ============================================

function fireProjectile(target, pierce = false) {
  const geo = new THREE.SphereGeometry(0.15, 5, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0x3dffd2 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(player.position);
  proj.position.y = 0.7;

  const dir = new THREE.Vector3().subVectors(target.position, player.position);
  dir.y = 0;
  dir.normalize();

  proj.userData = { dir, speed: 0.35, life: 2, target, pierce };
  scene.add(proj);
  projectiles.push(proj);
  triggerMuzzleFlash();
  AudioManager.shoot();
}

function fireProjectileInDir(dir, opts = {}) {
  const geo = new THREE.SphereGeometry(opts.size || 0.12, 5, 4);
  const mat = new THREE.MeshBasicMaterial({ color: opts.color || 0x3dffd2 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(player.position);
  proj.position.y = 0.7;
  proj.userData = {
    dir: dir.clone(), speed: opts.speed ?? 0.4, life: opts.life ?? 0.8,
    pierce: opts.pierce || false, dmgMult: opts.dmgMult ?? 1,
  };
  scene.add(proj);
  projectiles.push(proj);
}

function updateProjectiles(delta) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.position.x += p.userData.dir.x * p.userData.speed;
    p.position.z += p.userData.dir.z * p.userData.speed;
    p.userData.life -= delta;

    let hit = false;
    for (const e of enemies) {
      if (p.position.distanceTo(e.position) < 0.6) {
        const isCrit = Math.random() < stats.critChance;
        const dmgMult = p.userData.dmgMult ?? 1;
        const dmg = Math.round((isCrit ? stats.attackDamage * 2.5 : stats.attackDamage) * dmgMult);
        e.userData.hp -= dmg;
        flashEnemy(e);
        spawnDamageNumber(e.position.clone().add(new THREE.Vector3(0, 1.2, 0)), dmg, isCrit);
        if (isCrit) { triggerScreenShake(0.12); AudioManager.critHit(); }
        else { AudioManager.hit(); }
        if (!p.userData.pierce) { hit = true; break; }
      }
    }

    if (hit || p.userData.life <= 0) {
      scene.remove(p);
      projectiles.splice(i, 1);
    }
  }
}

function spawnEnemyProjectile(from, dir, opts = {}) {
  const geo = new THREE.SphereGeometry(0.12, 5, 4);
  const mat = new THREE.MeshBasicMaterial({ color: opts.color ?? 0x00e5ff });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(from);
  proj.position.y = 0.7;
  proj.userData = { dir: dir.clone(), speed: opts.speed ?? 0.18, life: 4, damage: opts.damage ?? 12 };
  scene.add(proj);
  enemyProjectiles.push(proj);
}

function updateEnemyProjectiles(delta) {
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const p = enemyProjectiles[i];
    p.position.x += p.userData.dir.x * p.userData.speed;
    p.position.z += p.userData.dir.z * p.userData.speed;
    p.userData.life -= delta;
    if (p.position.distanceTo(player.position) < 0.5) {
      if (invincibleTimer <= 0) {
        stats.hp -= p.userData.damage ?? 12;
        triggerHealthFlash();
        triggerScreenShake(0.2);
      }
      scene.remove(p);
      enemyProjectiles.splice(i, 1);
      continue;
    }
    if (p.userData.life <= 0) {
      scene.remove(p);
      enemyProjectiles.splice(i, 1);
    }
  }
}