# Wave Arena

A lightweight Three.js arena-survival browser game with desktop and touch controls, weapon builds, upgrades, arena themes, and boss waves.

## Use a folder, not one giant HTML file

Keep the **source game in multiple files**. This is easier to debug, update, reuse, and optimize than one very large HTML file. Package the folder as a ZIP only when publishing.

The upload ZIP must have `index.html` at its root:

```text
wave-arena.zip
├── index.html
├── css/
│   └── styles.css
└── js/
    ├── main.js
    ├── ...game modules...
    ├── bosses/
    └── vendor/
        ├── three.min.js
        └── THREE-LICENSE.txt
```

Do **not** make an extra parent folder inside the ZIP. A portal should find `index.html` immediately after opening the archive. A single self-contained HTML file is useful only for tiny prototypes; it is not the best format for this game.

## Run locally

Opening `index.html` directly with a `file://` URL can hide hosting problems. Run it through a local web server instead:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then open `http://localhost:4173`.

## Build the portal ZIP

No npm install or bundler is required:

```bash
python3 scripts/build_release.py
```

This creates `release/wave-arena.zip`. While the temporary boss test phase is enabled, its routing and save-isolation harness can be run with:

```bash
node scripts/test_boss_qa.js
node scripts/test_warden.js
node scripts/test_hunter.js
```

The build script:

- puts `index.html` at the ZIP root;
- includes only runtime files from `css/` and `js/`;
- verifies local script and stylesheet references;
- rejects third-party script and stylesheet references in `index.html`; and
- tests the completed ZIP.

Three.js r128 is stored locally under `js/vendor/`, so the game does not depend on a third-party CDN. Keep `THREE-LICENSE.txt` with the vendored library.

## Portal strategy

Maintain one shared source game, but make a separate release variant when a portal requires its own SDK:

```text
shared game source
├── itch build       (no ad SDK)
├── CrazyGames build (CrazyGames SDK)
└── Poki build       (Poki SDK)
```

Do not combine several advertising SDKs in one generic upload.

### itch.io

Upload `release/wave-arena.zip` as an HTML game. Itch also accepts one HTML file for a truly self-contained game, but this project correctly uses a ZIP. Use relative file paths and test the embedded/fullscreen modes.

### CrazyGames

The current self-contained build is suitable for initial testing. A full launch and monetization require the CrazyGames SDK and correct gameplay start/stop, ad-break, and save behavior. Add ads only at natural interruptions, such as after a wave, after defeat, or for one rewarded continue.

### Poki

Prepare a dedicated Poki build with its SDK and event lifecycle. Keep all game assets and libraries local, support desktop/mobile/tablet, test a 16:9 viewport, and keep storage calls protected with `try/catch`. This project already wraps its `localStorage` access and now avoids external CDN requests.

## Current game features

> **Temporary QA control:** the start screen currently exposes boss-only jumps for waves 5, 10, 15, and 20. Boss-test runs use a fixed QA loadout and do not write progression. Remove the marked boss-test code and UI before final release.

- Immediate Pulse Rifle start with first-run playable movement, firing, kill, and pickup training.
- A 20-wave campaign across five arena themes, ending with The Hunter and its scripted last-hit duel.
- Fixed milestone bosses: Sentinel (5), Hive Mother (10), Warden (15), and final boss The Hunter (20). The Hunter moves through a clue-led hunt, visible flanking pursuit, colored traps, an aggressive charge pattern, and an unarmed wall-crash/final-shot sequence. The 5,000-HP Warden fires a telegraphed plasma beam every second in phase one. At 50% health, it creates two combat clones; all three Wardens continue the one-second plasma attack and launch glowing cryo balls every five seconds that briefly freeze movement and weapons on hit.
- Defeating the Warden awards 1,000 arena coins and permanently unlocks the Warden Core, granting +10% base weapon damage on future campaign runs. Existing wave-15 milestone saves receive the unlock automatically.
- Seven enemy archetypes, including telegraphed dashers, healing/shield support units, and splitters.
- Primary and secondary weapons, passives, upgrades, between-wave shops, and checkpoint continues.
- Permanent Core upgrades, weapon/passive unlocks, achievements, Operations, and lifetime statistics.
- Adaptive procedural menu, combat, boss, and victory music with separate persisted music/SFX levels.
- Low/auto/high graphics settings, optional screenshake, bounded particles, pooled projectiles and pickups, and disposal-aware cleanup for longer sessions.
- Keyboard, mouse, and touch controls plus pause, mute, safe-area, and high-refresh-rate support.
- Protected local saves and a small, self-contained build with no runtime network dependencies.

Before a curated-portal release, complete cross-browser/device playthroughs, create the deferred branding and store media, and add a dedicated platform adapter/SDK build for each selected portal.

## Release checklist

- Test Chrome, Edge, Firefox, and Safari where available.
- Test keyboard/mouse, Android touch, iPhone/iPad touch, and tablet detection.
- Test 640×360, 836×470, 1031×580, common laptop sizes, and ultrawide screens.
- Test with network access blocked after the ZIP has loaded.
- Test incognito/private mode and disabled storage.
- Test tab switching, pause/resume, audio interruption, and focus loss.
- Play through every weapon, passive, shop state, boss, death, and continue path.
- Check that no console errors or missing files appear.
- Keep the initial download small and avoid unnecessary analytics or external requests.
