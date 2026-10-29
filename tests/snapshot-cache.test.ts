import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { createSnapshotCapture } from '../src/controller/snapshot.ts';

const fullCopy = (world: World) => JSON.parse(JSON.stringify({
  version: world.version, seed: world.seed, tick: world.tick, npcs: world.npcs,
  events: world.events, rooms: world.rooms, groups: world.groups, party: world.party,
  inputs: world.inputs, tasks: world.tasks, homework: world.homework,
  library: world.library, assessments: world.assessments, deliveries: world.deliveries,
  activities: world.activities, clubs: world.clubs, enrollments: world.enrollments, parcels: world.parcels, laundry: world.laundry, livingEnabled: world.livingEnabled, living: world.living,
}));

test('published snapshots remain detached and match a full copy across steps, interventions and reset', () => {
  const capture = createSnapshotCapture();
  const world = new World('snapshot-cache');
  const checkpoints = new Set([0, 1, 27, 81, 105, 106, 107, 116, 140, 165, 167]);
  for (let tick = 0; tick < 168; tick++) {
    if (tick % 7 === 0) world.intervene('rooms');
    if (tick % 9 === 0) world.intervene('party');
    const old = capture(world);
    const oldJson = checkpoints.has(tick) ? JSON.stringify(old) : undefined;
    if (checkpoints.has(tick)) expect(old).toEqual(fullCopy(world));
    world.step();
    if (oldJson !== undefined) {
      expect(JSON.stringify(old)).toBe(oldJson);
      expect(capture(world)).toEqual(fullCopy(world));
    }
  }
  const replacement = new World('snapshot-replacement');
  replacement.step();
  expect(capture(replacement)).toEqual(fullCopy(replacement));
  expect(capture(world)).toEqual(fullCopy(world));
}, 15000);

test('a published event and nested details cannot corrupt later snapshots or the save', () => {
  const world = new World('snapshot-immutability');
  world.step();
  const capture = createSnapshotCapture();
  const first = capture(world);
  const action = first.events.find((event) => event.type === 'action')!;
  const originalText = action.text;
  const score = action.data.scores![0];
  const originalScore = score.total;
  const originalSave = world.toSave();
  expect(Reflect.set(action, 'text', '篡改')).toBe(false);
  expect(Reflect.set(score, 'total', 999999)).toBe(false);
  expect(Reflect.set(action.people, 0, 99)).toBe(false);
  first.events.pop(); // The containing snapshot array is independently owned.
  const next = capture(world);
  expect(next.events[action.id - 1].text).toBe(originalText);
  expect(next.events[action.id - 1].data.scores![0].total).toBe(originalScore);
  expect(world.toSave()).toEqual(originalSave);
  expect(World.fromSave(originalSave)).toEqual(world);
});
