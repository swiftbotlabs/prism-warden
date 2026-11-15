# prism-warden

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/swiftbotlabs/prism-warden/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/swiftbotlabs/prism-warden/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**PRISM WARDEN: bend light, hold the core.** An original top-down arena defence game about coloured light. A crystal Core floats in the middle of a dark hex-grid arena, and Shades drift in from every edge to crack it. You are the Warden, a small glowing lens. Cast a beam toward the cursor and choose its colour: **Ember** (red, triangle), **Verdant** (green, square) or **Azure** (blue, circle). Only light of a Shade's own colour harms it; white Shades fall to any light. Beams bounce off the mirror shards placed for each wave, and upgrades let them bounce off walls and split into extra colours.

Survive ten waves. Each wave brings something new: Drifters, zig-zagging Darters, Splitters that burst into two Shades of the other colours, Prismlings that change colour every 2 s, and Bulwarks with rotating three-colour shells whose heart can only be hit through a gap you break. Wave 10 is the boss, **THE ECLIPSE**, with three phases that change its colour, orbit and summons. After every wave you pick 1 of 3 upgrade cards: Prism, Reflect, Focus, Lens, Chain, Lance, Bastion, Swift or Harvest. Your score is kills times your combo multiplier, and your best score is saved in the browser.

### Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | move the Warden |
| Hold left mouse button | cast the beam toward the cursor |
| 1 / 2 / 3 or mouse wheel | Ember / Verdant / Azure |
| 1 / 2 / 3 or click (between waves) | pick an upgrade card |
| P or Esc | pause / resume (Q quits to the title while paused) |
| M | mute / unmute |
| R | restart (on the results screen, a click works too) |

Every colour also has its own shape (on Shade shells, beam tips, the reticle and the HUD), so the game can be played without telling red from green. All art is drawn in code with Canvas 2D and additive light. All sound is synthesized with WebAudio (beam hum, hits, kills, wrong colour, Core cracks, waves, cards, boss phases, victory, defeat, plus a quiet generative music loop). Nothing is loaded from the network.

### Files

The game is plain static files in `game/`: ES modules, no build step and no third-party code.

| File | Job |
| --- | --- |
| `game/index.html`, `game/style.css` | page, full-window canvas, screen-reader text |
| `game/js/main.js` | boot, devicePixelRatio scaling, fixed-step loop, screen flow, sound cues |
| `game/js/config.js` | arena size, the three lights, palette, base tuning |
| `game/js/random.js` | seeded random streams so runs and screenshots replay exactly |
| `game/js/input.js` | keyboard and mouse state in arena coordinates |
| `game/js/world.js` | one run: the fixed step, damage, combo, score, the Core, win and loss |
| `game/js/warden.js` | the player's lens: steering, collisions, aim, colour |
| `game/js/beam.js` | ray casting, mirror and wall reflection, Prism branches, hits |
| `game/js/arena.js` | mirror shard layouts, bounds, collision push-out |
| `game/js/shades.js` | enemy kinds, movement, which light harms which part |
| `game/js/waves.js` | the ten-wave plan and spawn director |
| `game/js/boss.js` | THE ECLIPSE and its three phases |
| `game/js/upgrades.js` | upgrade cards, dealing, effects, derived stats |
| `game/js/particles.js` | pooled particles, chain arcs and floating score text |
| `game/js/render.js` | the arena scene with additive glow |
| `game/js/hud.js` | Core bar, wave and progress, score and combo, colour selector, upgrades, hints |
| `game/js/screens.js` | title, upgrade cards, results, pause |
| `game/js/icons.js` | colour shapes and upgrade icons |
| `game/js/audio.js` | WebAudio sound effects and generative music |
| `game/js/storage.js` | best score and mute setting in localStorage |
| `game/js/autopilot.js` | a built-in pilot for the screenshot scenes and playtests |
| `game/js/shots.js` | screenshot scenes (`?shot=title\|play\|upgrade\|results\|defeat&seed=n`) |

Outside `game/`: `main.ts` checks the screenshots and `game/` against the contest limits, copies them to the output folder and writes `dossier.json` (`vendor/makefun-game.ts` is make.fun's library, unchanged). `serve.ts` is a small local server. `shots.json` lists the screenshot scenes. `tools/capture-shots.mjs` captures them in headless Chrome, `tools/playtest.mjs` plays the game through start, play, pause, upgrade, win, lose and restart, and `tools/simulate.mjs` plays whole runs in Node to check the balance.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
