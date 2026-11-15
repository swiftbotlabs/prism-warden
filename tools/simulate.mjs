// Balance check: plays whole runs with the built-in autopilot in Node (no browser) and prints how each wave went.
import { createWorld, stepWorld, beginWave, colourAccuracy } from '../game/js/world.js';
import { autopilotControls, autopilotPick, createPilot } from '../game/js/autopilot.js';
import { dealUpgradeCards, applyUpgrade } from '../game/js/upgrades.js';
import { simRandom } from '../game/js/random.js';
import { STEP } from '../game/js/config.js';

const reaction = Number(process.env.REACTION ?? 0);
const seeds = process.argv.slice(2).map(Number);
for (const seed of seeds.length ? seeds : [1, 2, 3, 4, 5]) {
  const world = createWorld(seed);
  const log = [];
  const pilot = createPilot(reaction, Number(process.env.AIM ?? 0));
  let waveStart = 0;
  let steps = 0;
  while (steps < 60 * 60 * 15) {
    steps += 1;
    stepWorld(world, autopilotControls(world, pilot, STEP), STEP);
    world.events.length = 0;
    if (world.state === 'cleared' && world.stateTime > 1.2) {
      const hand = dealUpgradeCards(world.upgrades, simRandom, world.core.hp / world.core.maxHp);
      const pick = hand[autopilotPick(hand, world.upgrades)];
      applyUpgrade(world, pick);
      log.push(`w${world.wave} ${(world.time - waveStart).toFixed(0)}s hp${world.core.hp} ${pick}`);
      waveStart = world.time;
      beginWave(world, world.wave + 1);
    }
    if ((world.state === 'won' || world.state === 'lost') && world.stateTime > 1) break;
  }
  console.log(`seed ${seed}: ${world.state} wave ${world.wave} t=${world.time.toFixed(0)}s score ${world.score} kills ${world.stats.kills} best combo ${world.stats.bestCombo} acc ${colourAccuracy(world)}% hp ${world.core.hp}/${world.core.maxHp}`);
  console.log('   ' + log.join(' | ') + (world.boss ? ` | boss phase ${world.boss.phase} hp ${world.boss.hp.toFixed(1)}` : ''));
}
