import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { runScenario } from '../src/core/scenario.ts';

// These former course/project/library scenarios have identical seeds, options,
// inputs and duration. Observe each world once; never share mutable fixtures.
test('50 shared semesters retain reachable places, actual project work and library outcomes', () => {
  const visited = new Set<number>(), kinds = new Set<string>(), library = new Set<string>();
  for (let seed = 0; seed < 50; seed++) {
    const world = runScenario({ seed }, [{ step(world) { for (const n of world.npcs) visited.add(n.loc); } }]);
    for (const project of world.activities.filter(a => a.kind === 'project')) {
      kinds.add(project.status);
      for (const [person, contribution] of Object.entries(project.contributions)) {
        const works = world.events.filter(e => e.type === 'activity_progress' && e.people.includes(Number(person)) && e.data.activityId === project.id && e.data.location === project.preparationLocation);
        expect(contribution).toBe(works.length * 2);
      }
      if (project.status === 'held') expect(project.attendees.length).toBeGreaterThanOrEqual(2);
    }
    if (seed < 10) {
      for (const e of world.events) if (e.type.startsWith('library_')) library.add(e.type);
      expect(World.fromSave(world.toSave())).toEqual(world);
    }
  }
  for (const id of [6, 7, 8, 9, 10, 11]) expect(visited.has(id)).toBe(true);
  expect(kinds.has('held')).toBe(true);
  expect(kinds.has('cancelled')).toBe(true);
  for (const type of ['library_borrow', 'library_return', 'library_room_reserved', 'library_room_rejected', 'library_room_used', 'library_room_missed']) expect(library.has(type)).toBe(true);
}, 15000);
