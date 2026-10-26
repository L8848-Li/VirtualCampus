const test = require("node:test");
const assert = require("node:assert/strict");
const { World, ENGINE_VERSION } = require("../src/engine.js");
const { chooseAction } = require("../src/sim/decision.js");
const { invitationDecision } = require("../src/sim/social.js");
function context(n) {
  return { tick: 1, slot: 2, party: false, memories: [], roommates: [n.id] };
}

test("positive relationships create a motive to find someone only at a known location", () => {
  const n = new World("policy").npcs[0];
  Object.assign(n, { energy: 90, hunger: 5, social: 85 });
  n.rel[1] = { aff: 80, trust: 40, crush: 10 };
  assert.equal(
    chooseAction(n, context(n), () => 0).options.some((a) => a.target === 1),
    false,
  );
  n.known[1] = { loc: 3, tick: 0, event: 1, missed: false };
  const action = chooseAction(n, context(n), () => 0).chosen;
  assert.equal(action.kind, "seek");
  assert.equal(action.target, 1);
  assert.equal(action.loc, 3);
  const expired = { ...context(n), tick: 5 };
  assert.equal(
    chooseAction(n, expired, () => 0).options.some((a) => a.target === 1),
    false,
  );
});

test("a negative relationship can change the chosen activity and leaves an explanation", () => {
  const n = new World("avoidance").npcs[0];
  Object.assign(n, {
    energy: 90,
    hunger: 73,
    social: 100,
    ext: 0.8,
    sensitive: 0.9,
    ambition: 0.2,
    home: 4,
    habit: 2,
  });
  n.known[1] = { loc: 4, tick: 0, event: 1, missed: false };
  const before = chooseAction(n, context(n), () => 0).chosen;
  assert.equal(before.loc, 4);
  n.rel[1] = { aff: -80, trust: -50, crush: 0 };
  const after = chooseAction(n, context(n), () => 0);
  assert.equal(after.chosen.loc, 2);
  assert(after.options.find((a) => a.loc === 4).evidence.includes(1));
});

test("the receiver independently accepts or declines, including due to needs", () => {
  const n = new World("response").npcs[1];
  Object.assign(n, { energy: 85, hunger: 5, social: 85 });
  n.rel[0] = { aff: 30, trust: 20, crush: 0 };
  assert.equal(invitationDecision(n, 0, () => 0).accepted, true);
  Object.assign(n, { energy: 10, hunger: 95 });
  assert.equal(invitationDecision(n, 0, () => 0).accepted, false);
});

test("an outdated sighting can lead to a missed meeting instead of omniscient pursuit", () => {
  const w = new World("missed");
  const [a, b] = w.npcs;
  Object.assign(a, { energy: 95, hunger: 0, social: 100 });
  a.rel[1] = { aff: 90, trust: 40, crush: 10 };
  a.known[1] = { loc: 4, tick: 0, event: 1, missed: false };
  Object.assign(b, {
    energy: 95,
    hunger: 0,
    social: 0,
    ambition: 0.5,
    ext: 0,
    home: 3,
  });
  w.step();
  assert.notEqual(b.loc, 4);
  const missed = w.events.find(
    (e) => e.type === "missed" && e.people[0] === 0 && e.data.target === 1,
  );
  assert(missed);
  assert.equal(a.known[1].missed, true);
  assert.equal(a.known[1].loc, 4);
});

test("save round trips preserve pending interventions and the future simulation", () => {
  for (const tick of [0, 1, 4, 13, 28]) {
    const w = new World(`save-${tick}`);
    for (let i = 0; i < tick; i++) {
      if (i % 3 === 0) w.intervene("party");
      if (i % 5 === 0) w.intervene("rooms");
      w.step();
    }
    if (tick < 28) {
      w.intervene("groups");
      w.intervene("party");
    }
    const restored = World.fromSave(JSON.parse(JSON.stringify(w.toSave())));
    assert.deepEqual(restored, w);
    while (w.tick < 28) {
      w.step();
      restored.step();
    }
    assert.deepEqual(restored, w);
  }
});

test("corrupt, incompatible and malformed saves fail without accepting arbitrary state", () => {
  const w = new World("validation");
  w.intervene("rooms");
  w.step();
  const save = w.toSave();
  assert.throws(
    () => World.fromSave({ ...save, schemaVersion: 1 }),
    /格式不兼容/,
  );
  assert.throws(
    () => World.fromSave({ ...save, engineVersion: "0.1.0" }),
    /不同|跨版本/,
  );
  assert.throws(
    () => World.fromSave({ ...save, checksum: "00000000" }),
    /校验失败/,
  );
  assert.throws(() => World.fromSave({ ...save, tick: 29 }), /允许范围/);
  assert.throws(
    () => World.fromSave({ ...save, inputs: [{ kind: "unknown", tick: 0 }] }),
    /干预/,
  );
  assert.throws(
    () =>
      World.fromSave({
        ...save,
        inputs: [
          { kind: "party", tick: 1 },
          { kind: "rooms", tick: 0 },
        ],
      }),
    /顺序/,
  );
  assert.throws(
    () => World.fromSave({ ...save, seed: "x".repeat(129) }),
    /允许范围/,
  );
  const before = w.checksum();
  assert.equal(w.intervene("unknown"), false);
  assert.equal(w.checksum(), before);
  assert.equal(save.engineVersion, ENGINE_VERSION);
});

test("the weekly simulation produces social initiative, asymmetric reactions and daily highlights", () => {
  const types = new Set();
  let introvertCrush = false;
  for (let seed = 0; seed < 35; seed++) {
    const w = new World(`stories-${seed}`);
    while (w.tick < 28) {
      if (w.tick % 7 === 1) w.intervene("party");
      w.step();
    }
    for (const e of w.events) {
      types.add(e.type);
      if (e.type === "crush" && w.npcs[e.people[0]].ext < 0.35)
        introvertCrush = true;
      assert(new Set(e.parents).size === e.parents.length);
    }
    const summaries = w.events.filter((e) => e.type === "summary");
    assert.equal(summaries.length, 7);
    assert(summaries.every((e) => e.parents.length <= 3));
    for (const n of w.npcs) {
      assert(n.memory.every((id) => w.events[id - 1].people.includes(n.id)));
      for (const [id, observation] of Object.entries(n.known)) {
        assert(
          w.events[observation.event - 1].data.observedPeople.includes(
            Number(id),
          ),
        );
      }
      for (const r of n.rel) {
        assert(r.aff >= -100 && r.aff <= 100);
        assert(r.trust >= -100 && r.trust <= 100);
        assert(r.crush >= 0 && r.crush <= 100);
      }
    }
  }
  for (const type of [
    "invitation",
    "accepted",
    "declined",
    "missed",
    "crush",
    "repair",
  ])
    assert(types.has(type), `missing ${type}`);
  assert(introvertCrush, "introverts can develop a crush");
});

test("an agent can infer a routine from its own same-period observations", () => {
  const n = new World("routine").npcs[0];
  Object.assign(n, { energy: 90, hunger: 5, social: 90 });
  n.rel[1] = { aff: 80, trust: 30, crush: 0 };
  n.known[1] = {
    loc: 0,
    tick: 7,
    event: 1,
    missed: false,
    routine: { 0: { loc: 1, tick: 4, event: 1, missed: false } },
  };
  const chosen = chooseAction(
    n,
    { ...context(n), tick: 8, slot: 0 },
    () => 0,
  ).chosen;
  assert.equal(chosen.target, 1);
  assert.equal(chosen.loc, 1);
  assert(chosen.reason.includes("这个时段"));
});
