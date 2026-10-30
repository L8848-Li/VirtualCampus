import assert from 'node:assert/strict';
import { test } from 'vitest';
import { EventLog } from '../src/core/eventLog.ts';
import { ActionScoreStore, scoreColumns } from '../src/core/actionScores.ts';
import { World } from '../src/engine.ts';
import { queryEvents, shareEventIndex } from '../src/core/eventIndex.ts';
import { createSnapshotCapture } from '../src/controller/snapshot.ts';
import type { ActionScore, CampusEvent } from '../src/core/types.ts';
import { interveneAt } from './helpers/scenario.ts';

test('sealing detaches nested aliases, rejects further edits and owns its list', () => {
  const log = new EventLog(), people = [0], observedPeople = [1];
  log.append({ id: 1, tick: 0, type: 'action', people, parents: [], importance: 1, text: 'test', data: { observedPeople } });
  log.draft(1).data.mealWindow = '简餐';
  const published = log.committed(), digest = log.digest;
  people.push(2); observedPeople.push(3); published.pop();
  assert.deepEqual(log.events[0].people, [0]);
  assert.deepEqual(log.events[0].data.observedPeople, [1]);
  assert.equal(log.events[0].data.mealWindow, '简餐');
  assert.equal(Reflect.set(log.events[0].data, 'mealWindow', '篡改'), false);
  assert.throws(() => log.draft(1), /pending/);
  assert.equal(log.digest, digest);
});

test('all score columns round-trip, encoded buffers and dictionaries cannot corrupt the store', () => {
  const store = new ActionScoreStore();
  const score: ActionScore = { action: '校园😀', location: 2, target: 0, total: -12.34, needAndGoal: 12.34, habit: 17, avoidance: 0.01, exhaustion: 38, urgentMeal: 30, noise: 11.99, commitment: 26, switching: 9 };
  store.add(1, [score, { ...score, action: '第二项', target: null }]);
  const decoded = store.get(1)!;
  assert.deepEqual(decoded[0], score);
  assert.equal(decoded[1].target, null);
  for (const column of scoreColumns) assert.equal(decoded[0][column], score[column]);
  assert.equal(Reflect.set(decoded[0], 'total', 99), false);
  const encoded = store.encoded(1)!;
  encoded.values.fill(0);
  assert.equal(Reflect.set(encoded.names, 0, '改名'), false);
  assert.deepEqual(store.get(1)![0], score);
  store.add(2, [score]);
  assert.deepEqual(store.get(2)![0], score);
  assert.throws(() => store.add(1, [score]), /Duplicate/);
  assert.equal(store.get(99), undefined);
});

test('incremental checksums match independent full reconstruction after every operation', () => {
  const world = new World('校验😀', { livingEnabled: true });
  assert.equal(world.checksum(), world.checksumFromScratch());
  while (world.tick < 168) {
    interveneAt(world);
    world.step();
    if (process.env.VIRTUAL_CAMPUS_FULL_REPLAY === '1' || world.tick <= 28 || [82, 106, 112, 116, 140, 156, 162, 168].includes(world.tick)) {
      assert.equal(world.checksum(), world.checksumFromScratch());
    }
  }
  const before = world.checksum();
  world.random.state ^= 1;
  assert.notEqual(world.checksum(), before);
}, 15000);

test('indexed queries include pending events and retain old snapshot boundaries', () => {
  const world = new World('query-boundaries'), capture = createSnapshotCapture();
  const old = capture(world);
  const event = world.log('pending', 'library_print', [0], [], { taskId: 'test-task' });
  assert.equal(queryEvents(world.events, { type: 'library_print', person: 0 })[0].id, event);
  assert.deepEqual(queryEvents(old.events, { type: 'library_print' }), []);
  for (let tick = 0; tick < 35; tick++) {
    world.step();
    for (const person of [0, 3, 11]) {
      const query = { type: 'action' as const, person };
      assert.deepEqual(queryEvents(world.events, query), world.events.filter(e => e.type === query.type && e.people.includes(person)));
    }
    assert.deepEqual(queryEvents(world.events, { tick }), world.events.filter(e => e.tick === tick));
    assert.deepEqual(queryEvents(world.events, { taskId: 'test-task' }), world.events.filter(e => e.data.taskId === 'test-task'));
  }
  const current = capture(world);
  assert.deepEqual(queryEvents(old.events), old.events);
  current.events.pop();
  assert.deepEqual(queryEvents(current.events), current.events);
  const replacement = new World('query-replacement');
  assert.deepEqual(queryEvents(capture(replacement).events), replacement.events);
  const detached: CampusEvent[] = [...old.events];
  shareEventIndex(detached, world.events);
  assert.deepEqual(queryEvents(detached), old.events);
  const subset = world.events.filter(event => event.id % 3 === 0);
  assert.deepEqual(queryEvents(subset, { person: 0 }), subset.filter(event => event.people.includes(0)));
});
