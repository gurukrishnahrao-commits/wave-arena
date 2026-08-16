// ============================================
// SHOP — upgrades, weapon select, passives
// ============================================

const SHOP_ITEMS = [
  { id: 'speed', icon: '👟', name: 'SWIFT FEET', desc: '+15% move speed', baseCost: 15, level: 0, maxLevel: 5, apply: () => stats.speed *= 1.15 },
  { id: 'range', icon: '🎯', name: 'LONGER REACH', desc: '+20% attack range', baseCost: 15, level: 0, maxLevel: 5, apply: () => stats.attackRange *= 1.2 },
  { id: 'atkspeed', icon: '⚡', name: 'RAPID FIRE', desc: '+15% attack speed', baseCost: 20, level: 0, maxLevel: 5, apply: () => stats.attackSpeed *= 0.85 },
  { id: 'damage', icon: '💥', name: 'HEAVY ROUNDS', desc: '+1 attack damage', baseCost: 20, level: 0, maxLevel: 8, apply: () => stats.attackDamage += 1 },
  { id: 'maxhp', icon: '❤️', name: 'VITALITY', desc: '+25 max HP', baseCost: 18, level: 0, maxLevel: 6, apply: () => { stats.maxHP += 25; stats.hp += 25; } },
  { id: 'heal', icon: '💊', name: 'MEDIC KIT', desc: 'Heal to full HP', baseCost: 10, level: 0, maxLevel: 999, apply: () => { stats.hp = stats.maxHP; } },
];

function itemCost(item) {
  return Math.round(item.baseCost * Math.pow(1.4, item.level));
}

function openShop() {
  gameState = 'upgrading';
  AudioManager.shopOpen();
  const screen = document.getElementById('upgrade-screen');
  screen.style.display = 'flex';
  screen.classList.remove('shop-visible');
  screen.style.pointerEvents = 'none';
  renderShop();
  requestAnimationFrame(() => screen.classList.add('shop-visible'));
  setTimeout(() => { screen.style.pointerEvents = 'all'; }, 200);
}

function renderShop() {
  document.getElementById('shop-wave-num').textContent = waveNumber - 1;
  document.getElementById('shop-coin-count').textContent = coins;

  // Tabs
  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
    btn.onclick = () => { activeTab = btn.dataset.tab; renderShop(); };
  });

  const container = document.getElementById('upgrade-options');
  container.innerHTML = '';

  if (activeTab === 'upgrades') {
    renderUpgradesTab(container);
  } else if (activeTab === 'weapons') {
    renderWeaponsTab(container);
  } else {
    renderPassivesTab(container);
  }

  renderLoadoutBar();
  setupContinueButton();
}

function renderUpgradesTab(container) {
  SHOP_ITEMS.forEach(item => {
    const maxed = item.level >= item.maxLevel;
    const cost = itemCost(item);
    const canAfford = coins >= cost && !maxed;

    const card = document.createElement('div');
    card.className = 'shop-card' + (!canAfford && !maxed ? ' cant-afford' : '') + (maxed ? ' maxed' : '');

    if (maxed) card.innerHTML += `<div class="card-badge badge-maxed">MAX</div>`;

    card.innerHTML += `
      <div class="card-icon">${item.icon}</div>
      <div class="card-name">${item.name}</div>
      <div class="card-desc">${item.desc}</div>
      <div class="card-level">Level ${item.level}${item.maxLevel < 999 ? ' / ' + item.maxLevel : ''}</div>
      <div class="card-cost ${maxed ? 'free' : canAfford ? 'affordable' : 'expensive'}">
        ${maxed ? '✓ MAXED' : '💰 ' + cost}
      </div>
    `;

    if (canAfford) {
      card.onclick = () => {
        coins -= cost;
        item.level++;
        item.apply();
        AudioManager.purchase();
        document.getElementById('shop-coin-count').textContent = coins;
        document.getElementById('coins').textContent = coins;
        renderShop();
      };
    }
    container.appendChild(card);
  });
}

function renderWeaponsTab(container) {
  WEAPONS.forEach(w => {
    const unlocked = isWeaponUnlocked(w.id);
    const isEquipped = loadout.primary === w.id || loadout.secondary === w.id;
    const slotFull = w.slot === 'primary' ? !!loadout.primary : !!loadout.secondary;
    const canBuy = unlocked && !isEquipped && !slotFull;

    const card = document.createElement('div');
    card.className = 'shop-card' + (!unlocked ? ' locked' : '') + (isEquipped ? ' owned' : !canBuy ? ' cant-afford' : '');

    if (!unlocked) card.innerHTML += `<div class="card-badge badge-locked">LOCKED</div>`;
    else if (isEquipped) card.innerHTML += `<div class="card-badge badge-owned">${w.slot.toUpperCase()}</div>`;
    else if (!canBuy) card.innerHTML += `<div class="card-badge" style="background:#222;color:#555">SLOT FULL</div>`;

    card.innerHTML += `
      <div class="card-icon">${w.icon}</div>
      <div class="card-name">${w.name}</div>
      <div class="card-desc">${w.desc}</div>
      <div style="margin:6px 0 2px;">
        <div class="card-stat-row"><span class="card-stat-label">DMG</span><span class="card-stars">${starsHTML(w.stats.dmg)}</span></div>
        <div class="card-stat-row"><span class="card-stat-label">AOE</span><span class="card-stars">${starsHTML(w.stats.aoe)}</span></div>
        <div class="card-stat-row"><span class="card-stat-label">RNG</span><span class="card-stars">${starsHTML(w.stats.range)}</span></div>
        <div class="card-stat-row"><span class="card-stat-label">SPD</span><span class="card-stars">${starsHTML(w.stats.speed)}</span></div>
      </div>
      ${isEquipped && !w.upgrade.applied ? `<div class="card-cost affordable" style="font-size:11px; margin-top:4px; cursor:pointer;" id="upgrade-${w.id}">🔧 UPGRADE: ${w.upgrade.name} (💰${Math.round(30 * Math.pow(1.5, waveNumber * 0.3))})</div>` : ''}
      ${isEquipped && w.upgrade.applied ? `<div class="card-cost free" style="font-size:11px; margin-top:4px;">✓ ${w.upgrade.name}</div>` : ''}
      ${!isEquipped ? `<div class="card-cost ${canBuy ? 'free' : 'expensive'}">${!unlocked ? `🔒 ${weaponUnlockText(w.id)}` : canBuy ? '+ EQUIP FREE' : '—'}</div>` : ''}
    `;

    if (!isEquipped && canBuy) {
      card.onclick = () => {
        if (w.slot === 'primary') loadout.primary = w.id;
        else loadout.secondary = w.id;
        if (w.id === 'orbital') fireWeaponOrbital();
        AudioManager.purchase();
        renderShop();
      };
    }

    container.appendChild(card);

    // Weapon upgrade button handler
    if (isEquipped && !w.upgrade.applied) {
      setTimeout(() => {
        const upgBtn = document.getElementById(`upgrade-${w.id}`);
        if (upgBtn) {
          const upgCost = Math.round(30 * Math.pow(1.5, waveNumber * 0.3));
          if (coins >= upgCost) {
            upgBtn.onclick = (ev) => {
              ev.stopPropagation();
              coins -= upgCost;
              w.upgrade.applied = true;
              AudioManager.purchase();
              document.getElementById('shop-coin-count').textContent = coins;
              document.getElementById('coins').textContent = coins;
              renderShop();
            };
          } else {
            upgBtn.style.color = '#555';
            upgBtn.style.cursor = 'default';
          }
        }
      }, 0);
    }
  });
}

function renderPassivesTab(container) {
  PASSIVES.forEach(p => {
    const unlocked = isPassiveUnlocked(p.id);
    const isEquipped = loadout.passive === p.id;
    const slotFull = !!loadout.passive && !isEquipped;
    const canEquip = unlocked && !isEquipped && !slotFull;

    const card = document.createElement('div');
    card.className = 'shop-card' + (!unlocked ? ' locked' : '') + (isEquipped ? ' owned' : !canEquip ? ' cant-afford' : '');

    if (!unlocked) card.innerHTML += `<div class="card-badge badge-locked">LOCKED</div>`;
    else if (isEquipped) card.innerHTML += `<div class="card-badge badge-owned">ACTIVE</div>`;
    else if (slotFull) card.innerHTML += `<div class="card-badge" style="background:#222;color:#555">SLOT FULL</div>`;

    card.innerHTML += `
      <div class="card-icon">${p.icon}</div>
      <div class="card-name">${p.name}</div>
      <div class="card-desc">${p.desc}</div>
      <div class="card-cost ${canEquip ? 'free' : isEquipped ? 'free' : 'expensive'}">
        ${!unlocked ? `🔒 ${passiveUnlockText(p.id)}` : isEquipped ? '✓ ACTIVE' : canEquip ? '+ EQUIP FREE' : '—'}
      </div>
    `;

    if (canEquip) {
      card.onclick = () => {
        loadout.passive = p.id;
        if (!p.applied) { p.apply(); p.applied = true; }
        AudioManager.purchase();
        renderShop();
      };
    }
    container.appendChild(card);
  });
}

function renderLoadoutBar() {
  const lb = document.getElementById('loadout-bar');
  lb.innerHTML = '';
  const chips = [
    loadout.primary ? { label: getWeapon(loadout.primary).icon + ' ' + getWeapon(loadout.primary).name, cls: 'primary' } : { label: '🔵 No Primary', cls: 'primary' },
    loadout.secondary ? { label: getWeapon(loadout.secondary).icon + ' ' + getWeapon(loadout.secondary).name, cls: 'secondary' } : { label: '— No Secondary', cls: 'secondary' },
    loadout.passive ? { label: getPassive(loadout.passive).icon + ' ' + getPassive(loadout.passive).name, cls: 'passive' } : { label: '✨ No Passive', cls: 'passive' },
  ];
  chips.forEach(c => {
    const el = document.createElement('div');
    el.className = `loadout-chip ${c.cls}`;
    el.textContent = c.label;
    lb.appendChild(el);
  });
}

function setupContinueButton() {
  const continueBtn = document.getElementById('shop-continue-btn');
  continueBtn.onclick = () => {
    const screen = document.getElementById('upgrade-screen');
    screen.classList.remove('shop-visible');
    screen.style.display = 'none';
    gameState = 'playing';
    AudioManager.setMusicMode(isBossWave(waveNumber) ? 'boss' : 'combat');
    invincibleTimer = CONFIG.INVINCIBLE_DURATION;
    blinkTimer = 0;
    waveTimer = 0; // ADD THIS - reset for new wave
    saveCheckpoint();
    clock.getDelta();
  };
}

// ---- WEAPON SELECT SCREEN ----
function destroyPreviews() {
  previewRenderers.forEach(({ renderer, animId }) => {
    cancelAnimationFrame(animId);
    renderer.dispose();
  });
  previewRenderers = [];
}

function showWeaponSelectScreen(slot, onPick, allowSkip = true) {
  destroyPreviews();
  const screen = document.getElementById('weapon-select-screen');
  screen.style.display = 'flex';

  const isPrimary = slot === 'primary';
  document.getElementById('ws-title').textContent = isPrimary ? 'CHOOSE YOUR PRIMARY' : 'CHOOSE YOUR SECONDARY';
  document.getElementById('ws-subtitle').textContent = isPrimary
    ? 'YOUR PRIMARY WEAPON — THIS DEFINES YOUR RUN'
    : 'SUPPORT YOUR BUILD WITH A SECONDARY';

  const available = WEAPONS.filter(w =>
    w.slot === slot && isWeaponUnlocked(w.id) && w.id !== loadout.primary && w.id !== loadout.secondary
  );

  const container = document.getElementById('ws-cards');
  container.innerHTML = '';

  available.forEach(w => {
    const card = document.createElement('div');
    card.className = 'ws-card';
    card.style.minWidth = '180px';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100px;border-radius:6px;display:block;margin-bottom:8px;';
    card.appendChild(canvas);

    const nameEl = document.createElement('div');
    nameEl.className = 'ws-card-name';
    nameEl.textContent = w.icon + ' ' + w.name;
    card.appendChild(nameEl);

    const descEl = document.createElement('div');
    descEl.className = 'ws-card-desc';
    descEl.textContent = w.desc;
    card.appendChild(descEl);

    const statsEl = document.createElement('div');
    statsEl.style.marginTop = '6px';
    statsEl.innerHTML = `
      <div class="card-stat-row"><span class="card-stat-label">DMG</span><span class="card-stars">${starsHTML(w.stats.dmg)}</span></div>
      <div class="card-stat-row"><span class="card-stat-label">AOE</span><span class="card-stars">${starsHTML(w.stats.aoe)}</span></div>
      <div class="card-stat-row"><span class="card-stat-label">RNG</span><span class="card-stars">${starsHTML(w.stats.range)}</span></div>
      <div class="card-stat-row"><span class="card-stat-label">SPD</span><span class="card-stars">${starsHTML(w.stats.speed)}</span></div>
    `;
    card.appendChild(statsEl);

    card.onclick = () => {
      destroyPreviews();
      screen.style.display = 'none';
      onPick(w.id);
    };
    container.appendChild(card);
    requestAnimationFrame(() => buildWeaponPreview(canvas, w.id));
  });

  // Optional skip for secondary selection flows
  if (!isPrimary && allowSkip) {
    const skipCard = document.createElement('div');
    skipCard.className = 'ws-card';
    skipCard.style.opacity = '0.6';
    skipCard.innerHTML = `
      <div class="ws-card-name">⏭ SKIP</div>
      <div class="ws-card-desc">Start without a secondary weapon. You can buy one later in the shop.</div>
    `;
    skipCard.onclick = () => {
      destroyPreviews();
      screen.style.display = 'none';
      onPick(null);
    };
    container.appendChild(skipCard);
  }
}

function buildWeaponPreview(canvas, weaponId) {
  const W = canvas.width = 200;
  const H = canvas.height = 120;

  const pScene = new THREE.Scene();
  const pCamera = new THREE.PerspectiveCamera(50, W / H, 0.1, 50);
  pCamera.position.set(0, 3, 6);
  pCamera.lookAt(0, 0, 0);

  const pRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  pRenderer.setSize(W, H);
  pRenderer.setClearColor(0x000000, 0);

  pScene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8);
  dl.position.set(3, 5, 3);
  pScene.add(dl);

  const playerGeo = new THREE.ConeGeometry(0.35, 1, 6);
  const playerMat = new THREE.MeshStandardMaterial({
    flatShading: true, color: 0x3dffd2, emissive: 0x1a8070, emissiveIntensity: 0.5
  });
  const pPlayer = new THREE.Mesh(playerGeo, playerMat);
  pPlayer.position.set(0, 0.5, 0);
  pScene.add(pPlayer);

  const gd = new THREE.Mesh(
    new THREE.CircleGeometry(4, 32),
    new THREE.MeshStandardMaterial({ flatShading: true, color: 0x180a2e })
  );
  gd.rotation.x = -Math.PI / 2;
  pScene.add(gd);

  let t = 0;
  let animId;

  function loop() {
    animId = requestAnimationFrame(loop);
    t += 0.04;

    switch (weaponId) {
      case 'pulse': {
        if (!pScene.userData.proj || t % 1.2 < 0.04) {
          if (pScene.userData.proj) pScene.remove(pScene.userData.proj);
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 5, 4), new THREE.MeshBasicMaterial({ color: 0x3dffd2 }));
          m.position.set(0, 0.5, 0);
          pScene.add(m);
          pScene.userData.proj = m;
        }
        const proj = pScene.userData.proj;
        if (proj) { proj.position.z -= 0.18; if (proj.position.z < -4) { pScene.remove(proj); pScene.userData.proj = null; } }
        break;
      }
      case 'fireball': {
        if (!pScene.userData.fb || t % 2.2 < 0.04) {
          if (pScene.userData.fb) pScene.remove(pScene.userData.fb);
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.38, 6, 5), new THREE.MeshStandardMaterial({ flatShading: true, color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1.5 }));
          m.position.set(0, 0.5, 0);
          pScene.add(m);
          pScene.userData.fb = m;
        }
        const fb = pScene.userData.fb;
        if (fb) {
          fb.position.z -= 0.07;
          fb.rotation.y += 0.12;
          const pulse = 1 + Math.sin(t * 8) * 0.08;
          fb.scale.setScalar(pulse);
          if (fb.position.z < -3.5) {
            fb.material.emissiveIntensity = 3;
            fb.scale.setScalar(2.5);
            setTimeout(() => { pScene.remove(fb); pScene.userData.fb = null; }, 200);
          }
        }
        break;
      }
      case 'orbital': {
        if (!pScene.userData.orbs) {
          pScene.userData.orbs = [0, 1, 2].map(i => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.13), new THREE.MeshStandardMaterial({ flatShading: true, color: 0xcc44ff, emissive: 0x6600cc, emissiveIntensity: 0.8 }));
            pScene.add(m);
            return { mesh: m, offset: (i / 3) * Math.PI * 2 };
          });
        }
        const R = 1.6;
        pScene.userData.orbs.forEach(o => {
          const angle = t * 2 + o.offset;
          o.mesh.position.set(Math.cos(angle) * R, 0.5, Math.sin(angle) * R);
          o.mesh.rotation.y = angle + Math.PI / 2;
        });
        break;
      }
      case 'shotgun': {
        if (!pScene.userData.pellets || t % 1.4 < 0.04) {
          if (pScene.userData.pellets) pScene.userData.pellets.forEach(p => pScene.remove(p));
          const pellets = [];
          for (let i = 0; i < 5; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffaa55 }));
            m.position.set(0, 0.5, 0);
            m.userData.a = -0.4 + i * 0.2;
            pScene.add(m);
            pellets.push(m);
          }
          pScene.userData.pellets = pellets;
        }
        (pScene.userData.pellets || []).forEach(p => {
          p.position.z -= 0.2;
          p.position.x += Math.sin(p.userData.a) * 0.05;
        });
        break;
      }
      case 'sniper': {
        if (Math.sin(t * 3) > 0.85) {
          if (pScene.userData.beam) pScene.remove(pScene.userData.beam);
          const pts = [new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0.35, -4)];
          const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x00e5ff }));
          pScene.add(beam);
          pScene.userData.beam = beam;
        } else if (pScene.userData.beam) {
          pScene.remove(pScene.userData.beam);
          pScene.userData.beam = null;
        }
        break;
      }
      case 'rocket': {
        if (!pScene.userData.rk || t % 2 < 0.04) {
          if (pScene.userData.rk) pScene.remove(pScene.userData.rk);
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 6), new THREE.MeshStandardMaterial({ flatShading: true, color: 0xffa500, emissive: 0xaa4400, emissiveIntensity: 1.2 }));
          m.position.set(0, 0.5, 0);
          m.rotation.x = Math.PI / 2;
          pScene.add(m);
          pScene.userData.rk = m;
        }
        const rk = pScene.userData.rk;
        if (rk) {
          rk.position.z -= 0.08;
          if (rk.position.z < -3.5) {
            rk.scale.setScalar(2.2);
            setTimeout(() => { pScene.remove(rk); pScene.userData.rk = null; }, 180);
          }
        }
        break;
      }
      case 'plasma': {
        if (!pScene.userData.beamMesh) {
          const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
          const beamMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ffe0, transparent: true, opacity: 0.85 }));
          pScene.add(beamMesh);
          pScene.userData.beamMesh = beamMesh;
        }
        const beamMesh = pScene.userData.beamMesh;
        const from = new THREE.Vector3(0, 0.5, 0);
        const to = new THREE.Vector3(0, 0.35, -3.2);
        const dir = new THREE.Vector3().subVectors(to, from);
        const len = dir.length();
        dir.normalize();
        beamMesh.position.copy(from).addScaledVector(dir, len / 2);
        beamMesh.scale.set(1, len, 1);
        beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        beamMesh.material.opacity = 0.6 + Math.sin(t * 10) * 0.25;
        break;
      }
    }

    pRenderer.render(pScene, pCamera);
  }

  loop();
  previewRenderers.push({ renderer: pRenderer, animId });
}