import { expect, test, vi } from 'vitest';
import { World } from '../src/engine.ts';
import { evaluateSeeds } from '../src/core/evaluation.ts';

test('first-week meal rate excludes agreements due later and reports them separately', () => {
  let agreed = 0, notDue = 0, fulfilled = 0;
  for (let seed = 0; seed < 10; seed++) {
    const world = new World(`quality-${seed}`);
    while (world.tick < 28) {
      if (world.tick === 2) world.intervene('party');
      world.step();
    }
    const agreements = world.events.filter((event) => event.type === 'plan_accepted');
    agreed += agreements.length;
    notDue += agreements.filter((event) => Number(event.data.dueTick) >= world.tick).length;
    fulfilled += world.events.filter((event) => event.type === 'plan_fulfilled' && String(event.data.planId).startsWith('meal-')).length;
  }
  const result = evaluateSeeds(10);
  expect(notDue).toBeGreaterThan(0);
  expect(result.plansAgreed).toBe(agreed);
  expect(result.plansNotDue).toBe(notDue);
  expect(result.plansFulfilled).toBe(fulfilled);
  expect(result.planFulfillmentRate).toBe(Math.round(fulfilled / (agreed - notDue) * 1000) / 1000);
});

test('intervention and control advance through the same observed week', () => {
  const step = vi.spyOn(World.prototype, 'step');
  try {
    evaluateSeeds(1);
    const counts = new Map<World, number>();
    for (const world of step.mock.instances as World[]) counts.set(world, (counts.get(world) ?? 0) + 1);
    expect(counts.size).toBe(2);
    expect([...counts.values()]).toEqual([28, 28]);
    expect([...counts.keys()].every((world) => world.tick === 28)).toBe(true);
  } finally {
    step.mockRestore();
  }
});
