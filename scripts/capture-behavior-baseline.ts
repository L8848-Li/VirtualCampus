// One-time capture from the unmodified v0.16 engine. Never run from verification.
import { mkdirSync, writeFileSync } from 'node:fs';
import { World, ENGINE_VERSION, TOTAL_TICKS } from '../src/engine.ts';
import { evaluateSeeds } from '../src/core/evaluation.ts';
import { behaviourEvents, behaviourState, digest, interveneAt } from '../tests/helpers/scenario.ts';

if (String(ENGINE_VERSION) !== '0.16.0') throw new Error('Only the original v0.16 engine may generate this reference.');
const scenarios = [];
for (const livingEnabled of [false, true]) for (const seed of [0, 1, 99]) {
  const world = new World(seed, { livingEnabled });
  const frames: { tick: number; state: string; events: string }[] = [];
  let cursor = 0;
  const capture = () => {
    frames.push({ tick: world.tick, state: digest(behaviourState(world)), events: digest(behaviourEvents(world, cursor)) });
    cursor = world.events.length;
  };
  capture();
  while (world.tick < TOTAL_TICKS) { interveneAt(world); world.step(); capture(); }
  scenarios.push({ seed, livingEnabled, frames });
}
mkdirSync('tests/fixtures', { recursive: true });
writeFileSync('tests/fixtures/v016-behavior.json', JSON.stringify({
  sourceVersion: ENGINE_VERSION,
  description: 'Original b5fa1c1 behaviour: initial frame, then each step including preceding rooms/groups/party inputs. SHA-256 of sorted JSON; only version labels are excluded.',
  scenarios, evaluation: evaluateSeeds(100),
}, null, 2) + '\n');
console.log('Captured six original-engine scenarios and the 100-seed evaluation.');
