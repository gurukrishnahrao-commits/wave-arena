// ============================================
// GRAPHICS — visual updates, trail, glow
// ============================================

function updateGraphics(delta) {
  graphicsTime += delta;

  // Ground shader
  if (groundMesh && groundMesh.material.uniforms) {
    groundMesh.material.uniforms.uTime.value = graphicsTime;
  }

  // Player trail fade
  for (let i = playerTrail.length - 1; i >= 0; i--) {
    const t = playerTrail[i];
    t.life -= delta;
    const ratio = t.life / t.maxLife;
    t.mesh.material.opacity = ratio * 0.45;
    t.mesh.scale.setScalar(0.3 + ratio * 0.7);
    if (t.life <= 0) {
      scene.remove(t.mesh);
      playerTrail.splice(i, 1);
    }
  }

  // Combat light
  if (combatLight) {
    combatLight.position.x = player.position.x;
    combatLight.position.z = player.position.z;
    combatLightIntensity *= Math.pow(0.9, frameScale(delta));
    combatLight.intensity = combatLightIntensity;
  }

  // Player emissive pulse
  if (player.material) {
    player.material.emissiveIntensity = 0.6 + Math.sin(graphicsTime * 4) * 0.2;
  }

  // Enemy emissive animation
  enemies.forEach((e, i) => {
    if (e.material && e.material.emissiveIntensity !== undefined) {
      const base = e.userData.type === 'exploder'
        ? 0.3 + (1 - Math.min(1, e.position.distanceTo(player.position) / 5)) * 1.5
        : 0.4;
      e.material.emissiveIntensity = base + Math.sin(graphicsTime * 3 + i * 1.3) * 0.15;
    }
  });

  // Wall glow pulse
  if (wallMesh) {
    wallMesh.material.opacity = 0.08 + Math.sin(graphicsTime * 1.5) * 0.04;
  }
}