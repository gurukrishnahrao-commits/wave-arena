// ============================================
// UI — HUD, messages, damage numbers
// ============================================

function flashCenterMsg(text, color) {
  const el = document.getElementById('center-msg');
  const gen = ++centerMsgGen;
  el.innerHTML = `<h1 style="color:${color}; text-shadow: 0 0 20px ${color}80; font-size:42px;">${text}</h1>`;
  el.style.transition = '';
  el.style.opacity = 1;
  setTimeout(() => { if (gen === centerMsgGen) { el.style.transition = 'opacity 1s'; el.style.opacity = 0; } }, 800);
  setTimeout(() => { if (gen === centerMsgGen) { el.style.transition = ''; el.innerHTML = ''; } }, 1900);
}

function triggerColorFlash(rgba, holdMs = 90, fadeMs = 300) {
  const flash = document.getElementById('damage-flash');
  flash.style.transition = 'none';
  flash.style.background = rgba;
  setTimeout(() => {
    flash.style.transition = `background ${fadeMs}ms ease-out`;
    flash.style.background = 'rgba(0,0,0,0)';
  }, holdMs);
}

function triggerDamageFlash(intensity = 0.35) {
  redFlashTimer = Math.max(redFlashTimer, intensity);
  triggerScreenShake(0.15);
}

function triggerHealthFlash() {
  healthFlashTimer = 0.12;
  const flash = document.getElementById('damage-flash');
  flash.style.transition = 'none';
  flash.style.background = 'rgba(255,30,30,0.38)';
  setTimeout(() => {
    flash.style.transition = 'background 0.25s ease-out';
    flash.style.background = 'rgba(255,30,30,0)';
  }, 30);
  AudioManager.playerHit();
}

function triggerScreenShake(amount) {
  shakeAmount = Math.max(shakeAmount, amount);
}

function triggerMuzzleFlash() {
  muzzleLight.position.copy(player.position);
  muzzleLight.intensity = 4;
  muzzleTimer = 0.06;
  combatLightIntensity = Math.min(4, combatLightIntensity + 0.4);
}

function spawnDamageNumber(worldPos, damage, isCrit) {
  const vec = worldPos.clone().project(camera);
  const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-vec.y * 0.5 + 0.5) * window.innerHeight;

  const el = document.createElement('div');
  el.className = 'dmg-num' + (isCrit ? ' dmg-crit' : '');
  el.textContent = isCrit ? `${damage}!` : damage;
  el.style.color = isCrit ? '#ffd23d' : '#ff7a3d';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function flashEnemy(mesh) {
  // No-op — kept for call-site compatibility
}

function hideLoadingScreen() {
  const ls = document.getElementById('loading-screen');
  ls.classList.add('hidden');
  setTimeout(() => { ls.style.display = 'none'; }, 500);
}

function updateLoadingBar(percent) {
  document.getElementById('loading-bar-fill').style.width = percent + '%';
}