# prism-warden

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/swiftbotlabs/prism-warden/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/swiftbotlabs/prism-warden/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**PRISM WARDEN: bend lantern-light through glass to burn the colour-matched Shades.** An original top-down arena defence game about coloured light, set in **the Lantern Observatory at golden hour**. Honey-marble floors are inlaid with a brass star map, and bookshelves, telescopes and potted plants line the walls under warm sun shafts and lamplight. You are the Warden, a small robed keeper with a lantern staff tipped with cut crystal. You guard the Core, a crystal held in a turning brass orrery on a carved dais whose runes light up one per wave. The Shades are creatures: hooded shadow-imps, soot-moths, ink-toads, ink-wisps and crystal-horned Prismlings. Each wears its colour as a glowing cloak or wing tint and carries that colour's rune. They squash as they appear, flinch when hit and burst into coloured ash. Shades drift in from every edge to crack the Core.

Survive ten waves. Each wave brings something new: Drifters, zig-zagging Darters, Splitters that burst into two Shades of the other colours, Prismlings that change colour every 2 s, Umbra orbs from the boss's Shadow Ring, and Bulwarks with rotating three-colour shells whose heart can only be hit through a gap you break. Wave 10 is the boss, **THE ECLIPSE**, with three phases that change its colour and orbit. In each phase it calls legions of minions in all three colours from the arena edges. Every few seconds it telegraphs a **Shadow Ring**: the ground darkens round it, then a ring of Umbra orbs flies out. Any light cuts the orbs, and those that reach the Core crack it. After every wave you pick 1 of 3 upgrade cards: Prism, Reflect, Focus, Lens, Chain, Lance, Bastion, Swift or Harvest. Your score is kills times your combo multiplier, and your best score is saved in the browser.

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

The HUD teaches as you play. One line under the wave panel states both conditions: "WIN: break THE ECLIPSE after wave 10 · LOSE: the Core shatters". The title repeats it as the OBJECTIVE, and the victory screen names the lose path too. The Core panel states the stakes ("0 = RUN LOST"), and the wave panel names the goal ("HOLD 3 MORE WAVES · THEN THE ECLIPSE"). An INCOMING panel lists each Shade kind the wave still has to send, with its colours and count. A rule strip by the colour bar says "MATCH THE BEAM TO THE SHADE". Your build shows by name and level ("Prism II"), and a short event log reports chains, broken shells and Core cracks. Each upgrade card also says how it combines with what you already own. When wave 9 is cleared, the upgrade screen previews THE ECLIPSE and names its three phases. The victory screen shows the boss cracked beneath the title. Score popups stack so they never cover each other, and every kill flashes a bright ring in the Shade's colour.

Every colour also has its own shape (a rune on each creature's cloak, on beam tips, the reticle and the HUD), so the game can be played without telling red from green. The creatures, the Warden, the moon faces of THE ECLIPSE and the floor are painted in code by our own `tools/art/paint-art.js` and baked by `tools/bake-art.mjs` into `game/art/atlas.png` (a fixed 128 px grid) and `game/art/floor.jpg`. Everything else (beams with ink outlines and white-hot cores, brass mirrors, the orrery, scorch marks, the cream-and-brass HUD) is drawn live with Canvas 2D. All sound is synthesized with WebAudio (beam hum, hits, kills, wrong colour, Core cracks, waves, cards, boss phases, victory, defeat, plus a quiet generative music loop). Nothing is loaded from the network.

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
| `game/js/beam.js` | reflection (`reflectDirection`), the Prism split (`castPrismBeams`, `splitAngle`), ray tracing, hits |
| `game/js/arena.js` | mirror shard layouts, bounds, collision push-out |
| `game/js/shades.js` | enemy kinds, the colour rule (`lightHarmsShade`), movement |
| `game/js/waves.js` | the ten-wave plan, the run's goal (`waveGoalText`), spawn director, INCOMING counts |
| `game/js/boss.js` | THE ECLIPSE: its three phases (`ECLIPSE_PHASES`, `nextEclipsePhase`), orbit and summons |
| `game/js/upgrades.js` | upgrade cards, dealing, effects, synergy lines, derived stats |
| `game/js/particles.js` | pooled particles, chain arcs and floating score text |
| `game/js/sprites.js` | loads the baked art (`game/art/atlas.png`, `game/art/floor.jpg`) and draws creatures and characters from it |
| `game/js/render.js` | the arena scene: brass mirrors, the orrery Core and dais runes, creature Shades, THE ECLIPSE, beams, the Warden |
| `game/js/hud.js` | Core and stakes, wave goal and progress, score and combo, INCOMING list, rule strip, colour selector, named build, event log, hints |
| `game/js/screens.js` | title, upgrade cards with THE ECLIPSE preview, results, pause |
| `game/js/icons.js` | colour shapes and upgrade icons |
| `game/js/audio.js` | WebAudio sound effects and generative music |
| `game/js/storage.js` | best score and mute setting in localStorage |
| `game/js/autopilot.js` | a built-in pilot for the screenshot scenes and playtests |
| `game/js/shots.js` | screenshot scenes (`?shot=title\|play\|upgrade\|results\|defeat`, `play` replaying a seed to a given step) |

Outside `game/`: `main.ts` checks the screenshots and `game/` against the contest limits, copies them to the output folder and writes `dossier.json` (`vendor/makefun-game.ts` is make.fun's library, unchanged). `serve.ts` is a small local server. `shots.json` lists the screenshot scenes. `tools/capture-shots.mjs` captures them in headless Chrome, `tools/playtest.mjs` plays the game through start, play, pause, upgrade, win, lose and restart, `tools/simulate.mjs` plays whole runs in Node to check the balance, `tools/bake-art.mjs` bakes the sprite atlas and floor from `tools/art/paint-art.js`, and `tools/find-cover.mjs` searches hundreds of autopilot runs in Node for the cover frame and writes its seed and step into `shots.json` (the game's `?shot=play` replays exactly that step).

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
