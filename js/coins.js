// ============================================
// COIN PICKUPS
// ============================================

function spawnCoinPickup(pos, value) {
  const geo = new THREE.CylinderGeometry(0.18, 0.18, 0.06, 6);
  const mat = new THREE.MeshStandardMaterial({
    flatShading: true, color: 0xffd23d, emissive: 0xb8900a,
    emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3
  });
  const coin = new THREE.Mesh(geo, mat);
  coin.position.copy(pos);
  coin.position.y = 0.5;
  coin.rotation.x = Math.PI / 2;
  scene.add(coin);

  coin.userData = { value, vy: 0.12, settled: false };
  coinPickups.push(coin);
}

function collectAllCoinPickups() {
  for (const c of coinPickups) {
    coins += c.userData.value;
    scene.remove(c);
  }
  coinPickups.length = 0;
  document.getElementById('coins').textContent = coins;
}

function updateCoinPickups(delta) {
  const step = frameScale(delta);
  const magnetRange = stats.coinMagnet ? 999 : 3.5; // BUG FIX: magnet passive now works

  for (let i = coinPickups.length - 1; i >= 0; i--) {
    const c = coinPickups[i];
    c.rotation.z += delta * 3;

    if (!c.userData.settled) {
      c.userData.vy -= 0.01 * step;
      c.position.y += c.userData.vy * step;
      if (c.position.y <= 0.3) {
        c.position.y = 0.3;
        c.userData.settled = true;
      }
    }

    const distToPlayer = c.position.distanceTo(player.position);

    if (waveCompleteMagnet) {
      c.userData.magnetT = (c.userData.magnetT || 0) + delta;
      const dir = new THREE.Vector3().subVectors(player.position, c.position);
      dir.y = 0;
      const dist = dir.length();
      if (dist > 0.001) dir.normalize();
      const pullSpeed = 0.25 + c.userData.magnetT * 0.9;
      const travel = Math.min(dist, pullSpeed * step);
      c.position.x += dir.x * travel;
      c.position.z += dir.z * travel;
      c.position.y += (0.9 - c.position.y) * frameLerp(0.2, delta);
      c.rotation.z += delta * 12;
    } else if (distToPlayer < magnetRange) {
      const dir = new THREE.Vector3().subVectors(player.position, c.position);
      dir.y = 0;
      const dist = dir.length();
      dir.normalize();
      const pullSpeed = Math.max(0.08, (magnetRange - dist) * 0.06);
      const travel = Math.min(dist, pullSpeed * 4 * step);
      c.position.x += dir.x * travel;
      c.position.z += dir.z * travel;
      c.position.y += (0.7 - c.position.y) * frameLerp(0.15, delta);
    }

    if (distToPlayer < 0.6) {
      coins += c.userData.value;
      document.getElementById('coins').textContent = coins;
      scene.remove(c);
      coinPickups.splice(i, 1);
      AudioManager.coinPickup();
      continue;
    }
  }
}