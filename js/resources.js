// ============================================
// RUNTIME RESOURCES — pooling and safe disposal
// ============================================

const RUNTIME_POOLS = {
  playerProjectiles: new Map(),
  enemyProjectiles: new Map(),
  coins: [],
};

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && value.isTexture) value.dispose();
  }
  if (material.dispose) material.dispose();
}

function disposeObject3D(object) {
  if (!object) return;
  const geometries = new Set();
  const materials = new Set();
  object.traverse?.(child => {
    if (child.geometry?.dispose && !geometries.has(child.geometry)) {
      geometries.add(child.geometry);
      child.geometry.dispose();
    }
    const list = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of list) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      disposeMaterial(material);
    }
  });
}

function removeAndDispose(object) {
  if (!object) return;
  if (object.parent) object.parent.remove(object);
  disposeObject3D(object);
}

function removeSharedObject(object) {
  if (!object) return;
  if (object.parent) object.parent.remove(object);
  object.visible = false;
}

function runtimeParticleLimit() {
  const quality = getGameSettings?.().quality || 'auto';
  if (quality === 'low') return 120;
  if (quality === 'high') return 320;
  return window.devicePixelRatio > 1.5 || isTouchDevice ? 180 : 260;
}

function trimParticleBudget(required = 1) {
  const limit = runtimeParticleLimit();
  while (particles.length + required > limit && particles.length > 0) {
    const oldest = particles.shift();
    removeAndDispose(oldest);
  }
}

function setObjectShadows(object, enabled) {
  if (!object) return;
  object.traverse?.(child => {
    if (child.isMesh) {
      child.castShadow = enabled;
      child.receiveShadow = enabled;
    }
  });
}
