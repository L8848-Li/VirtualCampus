import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { chooseBreakErrand, lateness } from '../src/core/campusLife.ts';

test('the person checks the available time before an errand, but the actual delay can be longer than estimated', () => {
  const person = { id: 0, energy: 50, ambition: 1 };
  expect(chooseBreakErrand(person, 0, 0.9).name).toBe('整理课本');
  const choice = chooseBreakErrand(person, 10, 0.9);
  expect(choice.name).toBe('打印资料');
  expect(choice.estimatedMinutes).toBeLessThanOrEqual(10);
  expect(choice.actualMinutes).toBeGreaterThan(choice.estimatedMinutes);
});

test('real errands happen at the center and can make the next attended class late', () => {
  let errands = 0, delayed = 0;
  for (let seed = 0; seed < 20 && delayed === 0; seed++) {
    const world = new World(seed);
    while (world.tick < 112) world.step();
    for (const event of world.events.filter((e) => e.type === 'between_classes' && Number(e.data.errandMinutes) > 0)) {
      errands++;
      expect(event.data.location).toBe(4);
      expect(['买水', '打印资料']).toContain(event.data.errand);
      expect(Number(event.data.estimatedMinutes)).toBeLessThanOrEqual(Number(event.data.availableMinutes));
      const action = world.events.find((e) => e.type === 'action' && e.people[0] === event.people[0] && e.tick === event.tick + 1 && e.data.courseId);
      if (!action || !Number(action.data.lateMinutes)) continue;
      expect(action.parents).toContain(event.id);
      expect(action.data.lateMinutes).toBe(lateness(Number(action.data.travelMinutes), 0, true, Number(event.data.errandMinutes)));
      delayed++;
    }
  }
  expect(errands).toBeGreaterThan(0);
  expect(delayed).toBeGreaterThan(0);
});
