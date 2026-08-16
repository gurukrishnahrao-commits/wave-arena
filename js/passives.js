// ============================================
// PASSIVE ABILITIES
// ============================================

const PASSIVES = [
  {
    id: 'regen', icon: '💚', name: 'REGENERATION',
    desc: 'Heal +2 HP every second',
    slot: 'passive', applied: false,
    apply: () => { passiveRegen = true; },
  },
  {
    id: 'crit', icon: '⚡', name: 'CRITICAL SURGE',
    desc: 'Critical hit chance +15% (→30%)',
    slot: 'passive', applied: false,
    apply: () => { stats.critChance = 0.30; },
  },
  {
    id: 'coinrush', icon: '💰', name: 'COIN RUSH',
    desc: 'Enemies drop 2× coins',
    slot: 'passive', applied: false,
    apply: () => { stats.coinMult = 2; },
  },
  {
    id: 'magnet', icon: '🧲', name: 'MAGNETISM',
    desc: 'Coins auto-collect from anywhere',
    slot: 'passive', applied: false,
    apply: () => { stats.coinMagnet = true; },
  },
  {
    id: 'thorns', icon: '🌵', name: 'THORNS',
    desc: 'Melee attackers take 5 dmg back',
    slot: 'passive', applied: false,
    apply: () => { stats.thorns = true; },
  },
];

function getPassive(id) { return PASSIVES.find(p => p.id === id); }