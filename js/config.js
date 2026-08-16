// ============================================
// GAME CONFIGURATION — all tunable constants
// ============================================

const CONFIG = {
  ARENA_RADIUS: 18,
  WAVE_DURATION: 20,        // seconds per wave
  FINAL_WAVE: 25,           // campaign victory endpoint
  BOSS_WAVES: [5, 10, 15, 20, 25],
  BOSS_EVERY: 5,            // retained for compatibility with older helpers
  MAX_ENEMIES_BASE: 10,     // base max enemies on screen
  MAX_ENEMIES_PER_WAVE: 2,  // additional per wave number
  TRAIL_LENGTH: 12,
  INVINCIBLE_DURATION: 3,   // seconds after wave start
  CONTINUE_INVINCIBLE: 2,   // seconds after continue

  PLAYER: {
    BASE_SPEED: 0.09,
    BASE_RANGE: 4.5,
    BASE_DAMAGE: 1,
    BASE_ATTACK_SPEED: 0.6,
    BASE_MAX_HP: 100,
    BASE_CRIT_CHANCE: 0.15,
  },

  CAMERA: {
    OFFSET: new THREE.Vector3(0, 9, 7),
    LERP_SPEED: 0.08,
  },

  PARTICLES: {
    DEATH_COUNT_MIN: 12,
    DEATH_COUNT_MAX: 18,
  },

  SPAWN: {
    ANIMATION_DURATION: 0.4,
    BASE_INTERVAL: 1.6,
    MIN_INTERVAL: 0.4,
    INTERVAL_REDUCTION: 0.1,
  },
};