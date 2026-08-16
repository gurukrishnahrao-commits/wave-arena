// ============================================
// PARTICLES — death effects, ring flashes
// ============================================

function spawnDeathParticles(pos, color) {
  const count = CONFIG.PARTICLES.DEATH_COUNT_MIN +
    Math.floor(Math.random() * (CONFIG.PARTICLES.DEATH_COUNT_MAX - CONFIG.PARTICLES.DEATH_COUNT_MIN));
  for (let i = 0; i < count; i++) {
    const s = 0.08 + Math.random() * 0.2;
    const geo = Math.random() > 0.5
      ? new THREE.BoxGeometry(s, s, s)
      : new THREE.TetrahedronGeometry(s * 0.8, 0);
    const mat = new THREE.MeshBasicMaterial({ color });
    const part = new THREE.Mesh(geo, mat);
    part.position.copy(pos);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.06 + Math.random() * 0.16;
    const upward = 0.06 + Math.random() * 0.14;
    part.userData = {
      vel: new THREE.Vector3(Math.cos(angle) * speed, upward, Math.sin(angle) * speed),
      life: 0.5 + Math.random() * 0.4,
      maxLife: 0,
    };
    part.userData.maxLife = part.userData.life;
    scene.add(part);
    particles.push(part);
  }

  // Ring flash
  const ringGeo = new THREE.RingGeometry(0.1, 0.4, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(pos);
  ring.position.y = 0.05;
  ring.userData = { life: 0.35, maxLife: 0.35, expand: true };
  scene.add(ring);
  particles.push(ring);
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.userData.life -= delta;

    if (p.userData.expand) {
      const t = 1 - p.userData.life / p.userData.maxLife;
      const scale = 1 + t * 5;
      p.scale.set(scale, scale, scale);
      p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife * 0.9);
    } else {
      p.position.add(p.userData.vel);
      p.userData.vel.y -= 0.006;
      p.material.opacity = Math.max(0, p.userData.life / (p.userData.maxLife || 0.6));
      p.material.transparent = true;
      p.rotation.x += 0.15;
      p.rotation.z += 0.1;
    }

    if (p.userData.life <= 0) {
      scene.remove(p);
      particles.splice(i, 1);
    }
  }
}