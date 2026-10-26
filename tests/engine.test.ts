import assert from "node:assert/strict";
import { test } from "vitest";
import { World } from "../src/engine.ts";
test.each(Array.from({ length: 100 }, (_, i) => i))(
  "seed %i preserves every-step replay and state invariants",
  (seed) => {
    const w = new World(seed);
    for (let t = 0; t < 28; t++) {
      if (t % 5 === 0) w.intervene("rooms");
      if (t % 7 === 0) w.intervene("groups");
      if (t % 6 === 0) w.intervene("party");
      w.step();
      assert.deepEqual(w.replay(), w);
      for (const n of w.npcs) {
        assert(n.loc >= 0 && n.loc < 5);
        assert(n.memory.length <= 8);
        for (const k of ["energy", "hunger", "social"] as const)
          assert(n[k] >= 0 && n[k] <= 100);
      }
      for (const e of w.events)
        assert(e.parents.every((id) => id < e.id && id > 0));
    }
    assert.equal(w.step(), false);
    assert.equal(w.intervene("party"), false);
  },
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
