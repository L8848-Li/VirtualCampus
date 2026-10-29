import assert from "node:assert/strict";
import { test } from "vitest";
import { places } from "../src/core/config.ts";
import { World, TOTAL_TICKS } from "../src/engine.ts";
// The long run keeps every original seed and assertion; the default suite
// samples boundaries quickly, while CI runs both suites explicitly.
const replaySeeds = process.env.VIRTUAL_CAMPUS_FULL_REPLAY === "1"
  ? Array.from({ length: 100 }, (_, i) => i)
  : [0, 1, 99];
test.each(replaySeeds)(
  "seed %i preserves every-step replay and state invariants",
  (seed) => {
    const w = new World(seed);
    for (let t = 0; t < TOTAL_TICKS; t++) {
      if (t % 5 === 0) w.intervene("rooms");
      if (t % 7 === 0) w.intervene("groups");
      if (t % 6 === 0) w.intervene("party");
      w.step();
      assert.deepEqual(w.replay(), w);
      for (const n of w.npcs) {
        assert(n.loc >= 0 && n.loc < places.length);
        assert(n.memory.length <= 8);
        for (const k of ["energy", "hunger", "social"] as const)
          assert(n[k] >= 0 && n[k] <= 100);
      }
      for (const e of w.events)
        assert(e.parents.every((id) => id < e.id && id > 0));
    }
    assert.equal(w.step(), false);
    assert.equal(w.intervene("party"), false);
  }, 15000,
);
test("same input agrees, different seeds diverge", () => {
  const a = new World("test"),
    b = new World("test"),
    c = new World("different");
  while (a.step());
  while (b.step());
  while (c.step());
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.npcs, c.npcs);
});
