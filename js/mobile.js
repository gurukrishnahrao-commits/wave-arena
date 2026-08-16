// ============================================
// MOBILE / TOUCH CONTROLS
// ============================================

function setupMobileControls() {
  if (!isTouchDevice) return;

  document.getElementById('joystick-zone').style.display = 'block';
  document.getElementById('mobile-hint').style.display = 'flex';
  document.getElementById('controls-hint').textContent = 'Drag joystick to move  |  auto-attack is on';

  setupJoystick();
}

function setupJoystick() {
  const zone = document.getElementById('joystick-zone');
  const stick = document.getElementById('joystick-stick');
  let active = false;
  let originX = 0, originY = 0;
  const maxDist = 45;

  function start(e) {
    active = true;
    const touch = e.touches ? e.touches[0] : e;
    originX = touch.clientX;
    originY = touch.clientY;
    e.preventDefault();
    AudioManager.resume();
  }

  function move(e) {
    if (!active) return;
    const touch = e.touches ? e.touches[0] : e;
    let dx = touch.clientX - originX;
    let dy = touch.clientY - originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    joystickInput.x = dx / maxDist;
    joystickInput.y = dy / maxDist;
    e.preventDefault();
  }

  function end(e) {
    active = false;
    stick.style.transform = 'translate(0px, 0px)';
    joystickInput.x = 0;
    joystickInput.y = 0;
    if (e) e.preventDefault();
  }

  zone.addEventListener('touchstart', start, { passive: false });
  zone.addEventListener('touchmove', move, { passive: false });
  zone.addEventListener('touchend', end, { passive: false });
  zone.addEventListener('touchcancel', end, { passive: false });

  zone.addEventListener('mousedown', start);
  window.addEventListener('mousemove', e => { if (active) move(e); });
  window.addEventListener('mouseup', end);
}