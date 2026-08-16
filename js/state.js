// ============================================
// GLOBAL GAME STATE — single source of truth
// ============================================

// Core references
let scene, camera, renderer, player, clock;

// Entity arrays
let enemies = [];
let projectiles = [];
let enemyProjectiles = [];
let particles = [];
let coinPickups = [];
let fireballs = [];
let orbitalBlades = [];
let rockets = [];
let railBeams = [];
let burnPatches = [];
let spawnAnimations = [];
let playerTrail = [];

// Input state
let keys = {};
let joystickInput = { x: 0, y: 0 };
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// Mouse state
const mouseNDC = new THREE.Vector2(0, 0);
let mouseDown = false;
let fireOnDemand = false;
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.75);
const aimDir = new THREE.Vector3(0, 0, 1);
const aimPoint = new THREE.Vector3(0, 0.75, 0);

// Game state
let gameState = 'menu';
let elapsedTime = 0;
let timeScale = 1;
let waveClearPending = false;
let waveCompleteMagnet = false;
let killCount = 0;
let coins = 0;
let waveNumber = 1;
let spawnTimer = 0;

// Loadout
const loadout = { primary: null, secondary: null, passive: null };

// Player stats
const stats = {
  speed: CONFIG.PLAYER.BASE_SPEED,
  attackRange: CONFIG.PLAYER.BASE_RANGE,
  attackDamage: CONFIG.PLAYER.BASE_DAMAGE,
  attackSpeed: CONFIG.PLAYER.BASE_ATTACK_SPEED,
  maxHP: CONFIG.PLAYER.BASE_MAX_HP,
  hp: CONFIG.PLAYER.BASE_MAX_HP,
  critChance: CONFIG.PLAYER.BASE_CRIT_CHANCE,
  coinMult: 1,
  coinMagnet: false,
  thorns: false,
};

// Passive state
let passiveRegen = false;
let regenTimer = 0;

// Visual state
let shakeAmount = 0;
let muzzleLight = null;
let muzzleTimer = 0;
let redFlashTimer = 0;
let healthFlashTimer = 0;
let combatLightIntensity = 0;
let combatLight = null;
let graphicsTime = 0;
let orbitalAngle = 0;

// Plasma beam
let plasmaBeamMesh = null;
let plasmaTickTimer = 0;

// Scene references
let groundMesh = null;
let ambientLight = null;
let dirLight = null;
let wallMesh = null;
let arenaRingMeshes = [];
let currentArena = -1;

// Boss state
let bossActive = false;
let bossMesh = null;
let bossData = null;
let sentinelIntroId = 0;
let hiveIntroId = 0;
let bossSpawnedWave = -1;
let bossAmbientLight = null;

// Invincibility
let invincibleTimer = 0;
let blinkTimer = 0;

// Checkpoint
let checkpoint = null;

// UI
let centerMsgGen = 0;
let activeTab = 'upgrades';

// Weapon preview
let previewRenderers = [];

// Wave/boss timing
let waveTimer = 0;
let bossDeathPending = false;