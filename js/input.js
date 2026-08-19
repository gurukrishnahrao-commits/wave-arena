// ============================================
// INPUT HANDLING — keyboard + mouse
// ============================================

function setupInput() {
  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    const isButtonAction = e.target instanceof Element && e.target.closest('button');
    const isPauseKey = key === 'escape' || key === 'p' || (e.code === 'Space' && !isButtonAction);

    if (isPauseKey && !e.repeat) {
      e.preventDefault();
      togglePause();
      return;
    }

    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      e.preventDefault();
    }
    keys[key] = true;
  });

  window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    keys[key] = false;
  });

  window.addEventListener('mousemove', e => {
    mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('mousedown', e => {
    const clickedControl = e.target instanceof Element && e.target.closest('button');
    if (e.button === 0 && gameState === 'playing' && !clickedControl) {
      AudioManager.resume();
      if (bossData?.type === 'hunter' && bossData.lastHitState === 'stunned'
          && typeof tryHunterFinalShot === 'function') {
        tryHunterFinalShot(false);
        return;
      }
      mouseDown = true;
      fireOnDemand = true;
    }
  });

  window.addEventListener('mouseup', e => {
    if (e.button === 0) mouseDown = false;
  });

  window.addEventListener('blur', clearActiveInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearActiveInput();
      pauseGame();
    }
  });
}

function clearActiveInput() {
  mouseDown = false;
  fireOnDemand = false;
  keys = {};
  joystickInput.x = 0;
  joystickInput.y = 0;
}
