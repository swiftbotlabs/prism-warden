// Upgrade cards offered between waves: what each does, its level cap, how three are dealt, and the stats they add up to.
import { BEAM_TUNING, WARDEN_TUNING } from './config.js';

export const UPGRADES = [
  { id: 'prism', name: 'Prism', max: 2, line: '+1 beam branch in another colour' },
  { id: 'reflect', name: 'Reflect', max: 3, line: 'Beams bounce off the arena walls' },
  { id: 'focus', name: 'Focus', max: 4, line: '+35% beam damage' },
  { id: 'lens', name: 'Lens', max: 3, line: 'Wider beam, +15% damage' },
  { id: 'chain', name: 'Chain', max: 3, line: 'Kills arc to a Shade of that colour' },
  { id: 'lance', name: 'Lance', max: 2, line: 'Beam pierces one more Shade' },
  { id: 'bastion', name: 'Bastion', max: 3, line: '+3 Core HP, repair, +1 shield' },
  { id: 'swift', name: 'Swift', max: 3, line: '+18% Warden speed' },
  { id: 'harvest', name: 'Harvest', max: 3, line: 'Kills drop motes that heal the Core' },
];

/** How a card combines with what the run already owns, in one short line (or what it is good for, if nothing). */
export function upgradeSynergy(id, levels) {
  const owns = (other) => levels[other] > 0;
  switch (id) {
    case 'prism':
      if (owns('reflect')) return 'with Reflect: every branch bounces too';
      if (owns('lance')) return 'with Lance: every branch pierces';
      if (owns('focus')) return 'with Focus: branches hit harder too';
      return 'hit Shades of two colours at once';
    case 'reflect':
      if (owns('prism')) return 'with Prism: split beams bounce too';
      return 'bank shots reach Shades behind you';
    case 'focus':
      if (owns('prism')) return 'with Prism: branches hit harder too';
      if (owns('lens')) return 'with Lens: the damage bonuses stack';
      return 'Bulwarks and THE ECLIPSE fall faster';
    case 'lens':
      if (owns('lance')) return 'with Lance: a wide beam pierces crowds';
      if (owns('prism')) return 'with Prism: every branch widens';
      return 'easier to catch zig-zagging Darters';
    case 'chain':
      if (owns('prism')) return 'with Prism: more kills start more arcs';
      if (owns('lance')) return 'with Lance: pierce kills arc onward';
      return 'clears packs of one colour';
    case 'lance':
      if (owns('prism')) return 'with Prism: every branch pierces';
      if (owns('lens')) return 'with Lens: a wide beam pierces crowds';
      return 'hits a second Shade in line';
    case 'bastion':
      if (owns('harvest')) return 'with Harvest: motes refill a bigger Core';
      return 'more room for mistakes';
    case 'swift':
      if (owns('reflect')) return 'with Reflect: reposition for bank shots';
      return 'reach the far side of the Core sooner';
    case 'harvest':
      if (owns('chain')) return 'with Chain: more kills, more motes';
      if (owns('bastion')) return 'with Bastion: heal into a bigger Core';
      return 'turns kills into Core HP';
    default:
      return '';
  }
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

/** "Prism II": an upgrade's name and level as the HUD, cards and results show it. */
export function upgradeLabel(id, level) {
  return `${upgradeById(id).name} ${NUMERALS[level - 1] ?? level}`;
}

/** The owned build as one line, e.g. "Prism II · Reflect III · Lens I". */
export function buildSummary(levels) {
  return UPGRADES.filter((upgrade) => levels[upgrade.id] > 0).map((upgrade) => upgradeLabel(upgrade.id, levels[upgrade.id])).join(' · ');
}

export function upgradeById(id) {
  return UPGRADES.find((upgrade) => upgrade.id === id);
}

export function createUpgradeLevels() {
  return Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, 0]));
}

/** Deals `count` different cards that are not yet maxed; Bastion is favoured when the Core is low. */
export function dealUpgradeCards(levels, random, coreRatio = 1, count = 3) {
  const pool = UPGRADES.filter((upgrade) => levels[upgrade.id] < upgrade.max).map((upgrade) => ({
    id: upgrade.id,
    weight: (upgrade.id === 'bastion' && coreRatio < 0.5 ? 3 : 1) * (levels[upgrade.id] === 0 ? 1.2 : 1),
  }));
  const hand = [];
  while (hand.length < count && pool.length > 0) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;
    let index = 0;
    while (index < pool.length - 1 && roll >= pool[index].weight) {
      roll -= pool[index].weight;
      index += 1;
    }
    hand.push(pool[index].id);
    pool.splice(index, 1);
  }
  return hand;
}

/** Applies one card to a run: raises its level and does any one-off effect (Bastion repairs the Core). */
export function applyUpgrade(run, id) {
  run.upgrades[id] += 1;
  if (id === 'bastion') {
    run.core.maxHp += 3;
    run.core.hp = Math.min(run.core.maxHp, run.core.hp + 3);
    run.core.shield = run.upgrades.bastion;
  }
  run.picks.push(id);
}

/** What the beam can do with these levels. */
export function beamStats(levels) {
  return {
    damage: BEAM_TUNING.dps * (1 + 0.35 * levels.focus) * (1 + 0.15 * levels.lens),
    halfWidth: BEAM_TUNING.halfWidth + 4 * levels.lens,
    branches: levels.prism,
    wallBounces: levels.reflect,
    pierce: levels.lance,
  };
}

export function wardenSpeed(levels) {
  return WARDEN_TUNING.speed * (1 + 0.18 * levels.swift);
}

/** Chance that a kill drops a healing mote. */
export function harvestChance(levels) {
  return levels.harvest * 0.2;
}

/** Damage a Chain arc deals to its next target. */
export function chainDamage(levels) {
  return levels.chain > 0 ? 1.4 + 1.2 * levels.chain : 0;
}
