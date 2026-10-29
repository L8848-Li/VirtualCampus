import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';

const bounded = (n: number) => Math.max(0, Math.min(100, n));
test('visiting a restaurant to seek a person does not automatically buy and eat a meal', () => {
  let observed = 0;
  for (let seed = 0; seed < 20; seed++) {
    const world = new World(`purpose-${seed}`);
    while (world.tick < 50) {
      const before = world.npcs.map((n) => n.hunger);
      world.step();
      for (const n of world.npcs) {
        const action = world.events.slice().reverse().find((e) => e.tick === world.tick - 1 && e.type === 'action' && e.people[0] === n.id);
        if (!action || ![2, 6, 13].includes(Number(action.data.location)) || !action.text.includes('找熟人')) continue;
        observed++;
        expect(n.hunger).toBe(bounded(before[n.id] + 17));
        expect(n.action).not.toContain('窗口');
        expect(world.events.some((e) => e.tick === world.tick - 1 && e.people[0] === n.id && ['restaurant_wait', 'restaurant_alternative'].includes(e.type))).toBe(false);
      }
    }
  }
  expect(observed).toBeGreaterThan(0);
});

test('only deliberate rest has full recovery, while dorm chores have modest recovery', () => {
  let rests = 0, chores = 0;
  for (let seed = 0; seed < 6; seed++) {
    const world = new World(`energy-${seed}`);
    while (world.tick < 40) {
      const before = world.npcs.map((n) => n.energy);
      world.step();
      for (const n of world.npcs) {
        if (![0, 5].includes(n.loc)) continue;
        if (n.action === '休息') {
          rests++;
          expect(n.energy).toBeCloseTo(bounded(bounded(before[n.id] - 12) + 42));
        } else if (/洗衣|整理宿舍|整理物品/.test(n.action)) {
          chores++;
          expect(n.energy).toBeCloseTo(bounded(bounded(before[n.id] - 12) + 8));
        }
      }
    }
  }
  expect(rests).toBeGreaterThan(0);
  expect(chores).toBeGreaterThan(0);
});
