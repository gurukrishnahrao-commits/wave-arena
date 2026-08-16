// ============================================
// WEAPON UPDATE LOOPS — called every frame
// ============================================

function updateWeapons(delta) {
  // Passive regen
  if (passiveRegen) {
    regenTimer += delta;
    if (regenTimer >= 1) {
      stats.hp = Math.min(stats.maxHP, stats.hp + 2);
      regenTimer = 0;
    }
  }

  const shouldFire = isTouchDevice || mouseDown;
  const active = equippedWeapons();
  for (const w of active) {
    if (w.id === 'orbital' || w.id === 'plasma') continue; // self-managed
    if (fireOnDemand && w.timer > 0) w.timer = 0; // fresh click fires instantly
    if (!shouldFire) continue;
    w.timer -= delta;
    if (w.timer <= 0) {
      w.fire();
      w.timer = w.interval();
    }
  }
  fireOnDemand = false;

  updateFireballs(delta);
  updateOrbitalBlades(delta);
  updateRailBeams(delta);
  updateRockets(delta);
  updatePlasmaBeam(delta);
}

// ---- FIREBALL UPDATE ----
function updateFireballs(delta) {
  const step = frameScale(delta);
  // Burn patches
  for (let i = burnPatches.length - 1; i >= 0; i--) {
    const bp = burnPatches[i];
    bp.life -= delta;
    bp.mesh.material.opacity = bp.life / 2;
    for (const e of enemies) {
      if (new THREE.Vector3(bp.x, 0, bp.z).distanceTo(new THREE.Vector3(e.position.x, 0, e.position.z)) < 1.5) {
        damageEnemy(e, stats.attackDamage * 0.5 * delta, false, { silentNumber: true });
      }
    }
    if (bossActive && bossMesh && flatDist(bp.mesh.position, bossMesh.position) < 1.5) {
      damageBossTarget(stats.attackDamage * 0.5 * delta, false, bossMesh.position, { silentNumber: true });
    }
    if (bp.life <= 0) {
      removeAndDispose(bp.mesh);
      burnPatches.splice(i, 1);
    }
  }

  // Fireballs
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const f = fireballs[i];
    f.position.x += f.userData.dir.x * f.userData.speed * step;
    f.position.z += f.userData.dir.z * f.userData.speed * step;
    f.rotation.y += delta * 4;
    f.userData.life -= delta;

    let exploded = false;
    for (const e of enemies) {
      if (f.position.distanceTo(e.position) < 0.9) { exploded = true; break; }
    }
    if (bossActive && bossMesh && flatDist(f.position, bossMesh.position) < (bossData.size || 2) * 0.65) exploded = true;

    if (exploded || f.userData.life <= 0) {
      if (exploded) {
        const splashDmg = Math.round(stats.attackDamage * 4);
        for (const e of enemies) {
          if (f.position.distanceTo(e.position) < 3) damageEnemy(e, splashDmg, false);
        }
        if (bossActive && bossMesh && flatDist(f.position, bossMesh.position) < 3 + (bossData.size || 1)) {
          damageBossTarget(splashDmg, false, f.position);
        }
        spawnDeathParticles(f.position, 0xff4400);
        spawnDeathParticles(f.position, 0xffaa00);
        triggerScreenShake(0.2);
        AudioManager.explosion();

        if (getWeapon('fireball')?.upgrade.applied) {
          const geo = new THREE.CircleGeometry(1.5, 16);
          const mat = new THREE.MeshBasicMaterial({
            color: 0xff3300, transparent: true, opacity: 0.5, side: THREE.DoubleSide
          });
          const patch = new THREE.Mesh(geo, mat);
          patch.rotation.x = -Math.PI / 2;
          patch.position.set(f.position.x, 0.05, f.position.z);
          scene.add(patch);
          burnPatches.push({ mesh: patch, x: f.position.x, z: f.position.z, life: 2 });
        }
      }
      removeAndDispose(f);
      fireballs.splice(i, 1);
    }
  }
}

// ---- ORBITAL BLADES UPDATE ----
function updateOrbitalBlades(delta) {
  if (orbitalBlades.length === 0) return;
  const w = getWeapon('orbital');
  const speed = w?.upgrade.applied ? 6 : 3;
  const radius = 2.2 + stats.attackRange * 0.15 + (w?.upgrade.applied ? 1 : 0);
  orbitalAngle += delta * speed;

  for (const blade of orbitalBlades) {
    const angle = orbitalAngle + blade.userData.angleOffset;
    blade.position.x = player.position.x + Math.cos(angle) * radius;
    blade.position.z = player.position.z + Math.sin(angle) * radius;
    blade.position.y = 0.7;
    blade.rotation.y = angle + Math.PI / 2;

    const cd = blade.userData.hitCooldowns;
    const now = performance.now();
    for (const e of enemies) {
      if (blade.position.distanceTo(e.position) < 1.0) {
        const lastHit = cd.get(e.uuid) || 0;
        if (now - lastHit > 400) {
          const dmg = Math.round(stats.attackDamage * 1.2);
          damageEnemy(e, dmg, false);
          cd.set(e.uuid, now);
          AudioManager.hit();
        }
      }
    }
    if (bossActive && bossMesh && flatDist(blade.position, bossMesh.position) < (bossData.size || 1) * 0.7 + 0.6) {
      const lastHit = cd.get('active-boss') || 0;
      if (now - lastHit > 400) {
        damageBossTarget(Math.round(stats.attackDamage * 1.2), false, blade.position);
        cd.set('active-boss', now);
        AudioManager.hit();
      }
    }
  }
}

// ---- RAIL BEAMS UPDATE ----
function updateRailBeams(delta) {
  for (let i = railBeams.length - 1; i >= 0; i--) {
    railBeams[i].life -= delta;
    railBeams[i].mesh.material.opacity = railBeams[i].life / 0.15;
    if (railBeams[i].life <= 0) {
      removeAndDispose(railBeams[i].mesh);
      railBeams.splice(i, 1);
    }
  }
}

// ---- ROCKETS UPDATE ----
function updateRockets(delta) {
  const step = frameScale(delta);
  const w = getWeapon('rocket');
  const boosted = w?.upgrade.applied;

  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.position.x += r.userData.dir.x * r.userData.speed * step;
    r.position.z += r.userData.dir.z * r.userData.speed * step;
    r.userData.life -= delta;

    let exploded = false;
    for (const e of enemies) {
      if (r.position.distanceTo(e.position) < 1.0) { exploded = true; break; }
    }
    if (bossActive && bossMesh && flatDist(r.position, bossMesh.position) < (bossData.size || 2) * 0.7) exploded = true;

    if (exploded || r.userData.life <= 0) {
      if (exploded) {
        const dmg = Math.round(stats.attackDamage * 6);
        const radius = boosted ? 6.4 : 4;
        for (const e of enemies) {
          if (r.position.distanceTo(e.position) < radius) damageEnemy(e, dmg, false);
        }
        if (bossActive && bossMesh && flatDist(r.position, bossMesh.position) < radius + (bossData.size || 1)) {
          damageBossTarget(dmg, false, r.position);
        }
        spawnDeathParticles(r.position, 0xffa500);
        spawnDeathParticles(r.position, 0xff4400);
        triggerScreenShake(0.35);
        AudioManager.explosion();
      }
      removeAndDispose(r);
      rockets.splice(i, 1);
    }
  }
}

// ---- PLASMA BEAM UPDATE ----
function updatePlasmaBeam(delta) {
  const equipped = loadout.primary === 'plasma' || loadout.secondary === 'plasma';
  if (!equipped) {
    if (plasmaBeamMesh) plasmaBeamMesh.visible = false;
    return;
  }

  if (!plasmaBeamMesh) {
    const geo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffe0, transparent: true, opacity: 0.85 });
    plasmaBeamMesh = new THREE.Mesh(geo, mat);
    scene.add(plasmaBeamMesh);
  }

  const shouldFire = isTouchDevice || mouseDown;
  const { enemy } = shouldFire ? findEnemyInCone(stats.attackRange * 1.4, 0.2) : { enemy: null };

  if (!enemy) {
    plasmaBeamMesh.visible = false;
    return;
  }

  plasmaBeamMesh.visible = true;

  const from = player.position.clone().setY(0.8);
  const to = enemy.position.clone().setY(0.8);
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  dir.normalize();
  plasmaBeamMesh.position.copy(from).addScaledVector(dir, len / 2);
  plasmaBeamMesh.scale.set(1, len, 1);
  plasmaBeamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  const w = getWeapon('plasma');
  const boosted = w?.upgrade.applied;
  plasmaTickTimer -= delta;
  if (plasmaTickTimer <= 0) {
    const isCrit = Math.random() < stats.critChance;
    const dmg = Math.round((isCrit ? stats.attackDamage * 1.5 : stats.attackDamage) * (boosted ? 0.75 : 0.5));
    damageTarget(enemy, dmg, isCrit);
    if (isCrit) AudioManager.critHit();
    plasmaTickTimer = 0.15;
  }
}