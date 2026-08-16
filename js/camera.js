// ============================================
// CAMERA — follow, shake
// ============================================

function updateCamera(delta) {
  const camOffset = CONFIG.CAMERA.OFFSET;
  const targetPos = new THREE.Vector3().addVectors(player.position, camOffset);

  if (!camera.userData.basePos) camera.userData.basePos = camera.position.clone();
  const base = camera.userData.basePos;
  base.lerp(targetPos, frameLerp(CONFIG.CAMERA.LERP_SPEED, delta));
  camera.position.copy(base);

  camera.lookAt(player.position.x, 0.5, player.position.z);

  // Screen shake
  if (shakeAmount > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeAmount * 2;
    camera.position.y += (Math.random() - 0.5) * shakeAmount * 1.2;
    camera.position.z += (Math.random() - 0.5) * shakeAmount * 2;
    camera.rotateZ((Math.random() - 0.5) * shakeAmount * 0.05);
    camera.rotateX((Math.random() - 0.5) * shakeAmount * 0.02);
  }
}