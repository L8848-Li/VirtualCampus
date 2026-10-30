import assert from 'node:assert/strict';
import { test } from 'vitest';
import reference from './fixtures/v016-behavior.json';
import { World } from '../src/engine.ts';
import { behaviourEvents, behaviourState, digest, interveneAt } from './helpers/scenario.ts';

test.each(reference.scenarios)('original v0.16 behaviour: seed $seed, living=$livingEnabled', ({ seed, livingEnabled, frames }) => {
  const world = new World(seed, { livingEnabled });
  let cursor = 0;
  for (const expected of frames) {
    if (world.tick !== expected.tick) { interveneAt(world); world.step(); }
    assert.equal(digest(behaviourState(world)), expected.state, `state at tick ${expected.tick}`);
    assert.equal(digest(behaviourEvents(world, cursor)), expected.events, `events/scores at tick ${expected.tick}`);
    cursor = world.events.length;
  }
});
