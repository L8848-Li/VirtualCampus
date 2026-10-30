import { World } from '../engine.ts';
import { TOTAL_TICKS } from './config.ts';
import type { CampusEvent, Intervention } from './types.ts';

export interface Scenario {
  seed: string | number;
  livingEnabled?: boolean;
  ticks?: number;
  inputs?: readonly Intervention[];
}
export interface ScenarioObserver {
  step?: (world: Readonly<World>, added: readonly CampusEvent[]) => void;
  finish?: (world: Readonly<World>) => void;
}
/** One world per exact scenario, with multiple read-only observers. No global
 * cache or mutable fixture is shared between test files or separate runs. */
export function runScenario(scenario: Scenario, observers: readonly ScenarioObserver[] = []): World {
  const world = new World(scenario.seed, { livingEnabled: scenario.livingEnabled });
  const ticks = scenario.ticks ?? TOTAL_TICKS;
  if (!Number.isInteger(ticks) || ticks < 0 || ticks > TOTAL_TICKS) throw new Error('Invalid scenario duration.');
  let input = 0;
  for (;;) {
    const start = world.events.length;
    while (scenario.inputs?.[input]?.tick === world.tick) world.intervene(scenario.inputs[input++].kind);
    if (world.tick === ticks) break;
    world.step();
    const added = world.events.slice(start);
    for (const observer of observers) observer.step?.(world, added);
  }
  for (const observer of observers) observer.finish?.(world);
  return world;
}
