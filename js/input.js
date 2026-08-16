// ============================================
// INPUT HANDLING — keyboard + mouse
// ============================================

function setupInput() {
  window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  window.addEventListener('mousemove', e => {
    mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('mousedown', e => {
    if (e.button === 0 && gameState === 'playing') {
      mouseDown = true;
      fireOnDemand = true;
      AudioManager.resume();
    }
  });

  window.addEventListener('mouseup', e => {
    if (e.button === 0) mouseDown = false;
  });

  window.addEventListener('blur', () => { mouseDown = false; });
}