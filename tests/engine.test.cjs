const assert = require("node:assert/strict");
const { World } = require("../src/engine.js");
for (let seed = 0; seed < 100; seed++) {
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
      for (const k of ["energy", "hunger", "social"])
        assert(n[k] >= 0 && n[k] <= 100);
    }
    for (const e of w.events)
      assert(e.parents.every((id) => id < e.id && id > 0));
  }
  assert.equal(w.step(), false);
  assert.equal(w.intervene("party"), false);
}
let a = new World("test"),
  b = new World("test");
while (a.step());
while (b.step());
assert.deepEqual(a, b);
let c = new World("different");
while (c.step());
assert.notDeepEqual(a.npcs, c.npcs);
console.log(
  "PASS: 100 seeds × 28 steps; replay, bounds, memory, causal DAG, cycle termination, seed variation.",
);
