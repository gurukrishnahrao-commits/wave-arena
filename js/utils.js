// ============================================
// UTILITY FUNCTIONS
// ============================================

// Horizontal-only distance (ignores Y)
function flatDist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Simple tween helper
function tweenValue(duration, onUpdate, onComplete) {
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / (duration * 1000));
    onUpdate(t);
    if (t < 1) requestAnimationFrame(step);
    else if (onComplete) onComplete();
  }
  requestAnimationFrame(step);
}

// Star rating HTML
function starsHTML(val) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="${i < val ? 'star-filled' : 'star-empty'}">★</span>`
  ).join('');
}

// Clamp position to arena
function clampToArena(pos, margin = 0.6) {
  const dist = Math.sqrt(pos.x ** 2 + pos.z ** 2);
  if (dist > CONFIG.ARENA_RADIUS - margin) {
    const scale = (CONFIG.ARENA_RADIUS - margin) / dist;
    pos.x *= scale;
    pos.z *= scale;
  }
}