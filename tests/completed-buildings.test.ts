import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { campusLocations } from '../src/ui/campusLocations.ts';
import { travelMinutes } from '../src/core/campusLife.ts';

test('all previously planned areas are reachable, mapped and used by actual independent actions', () => {
  const reached = new Set<number>();
  let northMeal = false, academyLab = false;
  for (let seed = 0; seed < 10; seed++) {
    const world = new World(`new-${seed}`);
    while (world.step()) {
      for (const person of world.npcs) {
        if (person.loc === 13 && person.action.includes('窗口')) {
          expect(person.hunger).toBeLessThanOrEqual(35);
          northMeal = true;
        }
      }
    }
    for (const event of world.events) {
      if (event.type !== 'action' || typeof event.data.location !== 'number') continue;
      reached.add(event.data.location);
      if ([14, 18].includes(event.data.location) && event.data.labCourseId) academyLab = true;
    }
  }
  for (let id = 12; id <= 19; id++) {
    expect(campusLocations.some((location) => location.id === id)).toBe(true);
    expect(reached.has(id), `地点 ${id} 没有人实际选择`).toBe(true);
    expect(travelMinutes(1, id as 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19)).toBeGreaterThan(0);
  }
  expect(northMeal).toBe(true);
  expect(academyLab).toBe(true);
});
