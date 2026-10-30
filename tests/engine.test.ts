import assert from 'node:assert/strict';
import { test } from 'vitest';
import { World, TOTAL_TICKS, MAX_INPUTS, places } from '../src/engine.ts';
import { LAUNDRY_CAPACITY } from '../src/core/parcelLaundry.ts';
import { interveneAt } from './helpers/scenario.ts';

const seeds = process.env.VIRTUAL_CAMPUS_FULL_REPLAY === '1'
  ? Array.from({ length: 100 }, (_, i) => i) : [0, 1, 99];
const scenarios = [false, true].flatMap(livingEnabled => seeds.map(seed => ({ seed, livingEnabled })));

test.each(scenarios)('seed $seed, living=$livingEnabled: every-step determinism and invariants', ({ seed, livingEnabled }) => {
  const a = new World(seed, { livingEnabled }), b = new World(seed, { livingEnabled });
  assert.deepEqual(a, b);
  let cursor = 0;
  for (let tick = 0; tick < TOTAL_TICKS; tick++) {
    // The cursor precedes interventions, so same-tick input events are checked too.
    interveneAt(a, tick); interveneAt(b, tick);
    a.step(); b.step();
    assert.deepEqual(a.getState(), b.getState());
    assert.deepEqual(a.events.slice(cursor), b.events.slice(cursor));
    for (let id = cursor + 1; id <= a.events.length; id++) assert.deepEqual(a.getEncodedActionScores(id), b.getEncodedActionScores(id));
    assert.equal(a.events.length, b.events.length);
    for (const n of a.npcs) {
      assert(n.loc >= 0 && n.loc < places.length);
      assert(n.memory.length <= 8);
      for (const k of ['energy', 'hunger', 'social'] as const) assert(n[k] >= 0 && n[k] <= 100);
      for (const r of n.rel) { assert(r.aff >= -100 && r.aff <= 100); assert(r.trust >= -100 && r.trust <= 100); assert(r.crush >= 0 && r.crush <= 100); }
    }
    for (const e of a.events.slice(cursor)) assert(e.parents.every(id => id < e.id && id > 0));
    for (const book of a.library.books) {
      const borrowed = a.library.loans.filter(l => l.bookId === book.id && l.returnedTick === null).length;
      const held = a.library.waitlist.filter(e => e.bookId === book.id && e.status === 'notified').length;
      assert(borrowed + held <= book.copies);
    }
    for (const dorm of [0, 5, 20, 21]) assert(a.laundry.filter(l => l.dorm === dorm && l.status === 'washing').length <= LAUNDRY_CAPACITY);
    for (const s of a.living) assert(s.balance >= 0 && s.stress >= 0 && s.stress <= 100);
    cursor = a.events.length;
  }
  assert.deepEqual(a.events, b.events);
  for (const event of a.events) assert.deepEqual(a.getEncodedActionScores(event.id), b.getEncodedActionScores(event.id));
  // Independent import/continuation is exercised at all specified checkpoints
  // below. Do not repeat an extra whole-semester import for every fuzz seed.
  assert.equal(a.step(), false);
  assert.equal(a.intervene('party'), false);
}, 15000);

const checkpoints = new Set([0, 1, 27, 28, 111, 112, 116, 117, 140, 152, 156, 157, 162, 163, 166, 167, 168]);
test.each([false, true].flatMap(livingEnabled => [0, 1, 99].map(seed => ({ seed, livingEnabled }))))(
  'seed $seed, living=$livingEnabled: checkpoint import and continuation', ({ seed, livingEnabled }) => {
    const expected = new World(seed, { livingEnabled }), saves = [];
    for (;;) {
      if (checkpoints.has(expected.tick)) saves.push(expected.toSave());
      if (expected.tick === TOTAL_TICKS) break;
      interveneAt(expected); expected.step();
    }
    for (const save of saves) {
      const restored = World.fromSave(JSON.parse(JSON.stringify(save)));
      while (restored.tick < TOTAL_TICKS) { interveneAt(restored); restored.step(); }
      assert.deepEqual(restored.getState(), expected.getState());
      assert.deepEqual(restored.events, expected.events);
      assert.equal(restored.checksum(), expected.checksum());
    }
  }, 15000,
);

test('same-tick ordered inputs survive saving without a step; limits do not mutate a world', () => {
  const world = new World('input-boundaries');
  for (const kind of ['party', 'rooms', 'groups', 'rooms']) assert(world.intervene(kind));
  assert.deepEqual(World.fromSave(world.toSave()), world);
  while (world.inputs.length < MAX_INPUTS) assert(world.intervene('party'));
  const before = world.toSave();
  assert.equal(world.intervene('party'), false);
  assert.equal(world.intervene('invalid'), false);
  assert.deepEqual(world.toSave(), before);
});

test('same input agrees, different seeds diverge', () => {
  const a = new World('test'), b = new World('test'), c = new World('different');
  while (a.step()); while (b.step()); while (c.step());
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.npcs, c.npcs);
});
