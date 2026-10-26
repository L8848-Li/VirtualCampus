import { test } from "vitest";
import assert from "node:assert/strict";
import { World } from "../src/engine.ts";
import { chooseAction } from "../src/core/decision.ts";
import { preparePlans, resolveAppointment, active } from "../src/core/plans.ts";
import { workTasks } from "../src/core/tasks.ts";
import { evaluateSeeds } from "../src/core/evaluation.ts";
import type { AgentPlan } from "../src/core/types.ts";
const meal = (target: number, lastEvent: number = 1): AgentPlan => ({
  id: "meal-test",
  kind: "appointment",
  target,
  location: 2,
  createdTick: 0,
  dueTick: 1,
  untilTick: 2,
  stage: "pending",
  attempts: 0,
  worked: 0,
  lastEvent,
});

test("an agreed meeting persists across ordinary score fluctuations", () => {
  const w = new World("commitment"),
    a = w.npcs[0];
  Object.assign(a, { energy: 70, hunger: 55, social: 40, plan: meal(1) });
  for (const noise of [0, 0.2, 0.9]) {
    const choice = chooseAction(
      a,
      {
        tick: 1,
        slot: 1,
        party: false,
        memories: [],
        roommates: [0, 1],
        tasks: [],
      },
      () => noise,
    ).chosen;
    assert.equal(choice.kind, "appointment");
    assert.equal(choice.target, 1);
    assert(choice.commitment > 0);
  }
});

test("an emergency cancels only the affected agent plan without telepathy", () => {
  const w = new World("interrupt");
  w.npcs[0].plan = meal(1);
  w.npcs[1].plan = meal(0);
  w.npcs[0].energy = 8;
  w.tick = 1;
  preparePlans(w);
  assert.equal(w.npcs[0].plan.stage, "cancelled");
  assert.equal(w.npcs[1].plan.stage, "pending");
  const cancellation = w.events.find((e) => e.type === "plan_cancelled")!;
  assert.deepEqual(cancellation.people, [0]);
  assert(cancellation.data.reason?.includes("休息"));
});

test("a waiting agent has a bounded grace period and learns only from its own absence experience", () => {
  const w = new World("waiting"),
    [a, b] = w.npcs;
  a.plan = meal(1);
  b.plan = meal(0);
  a.rel[1].aff = 20;
  a.rel[1].trust = 15;
  b.rel[0].aff = 20;
  b.rel[0].trust = 15;
  w.tick = 1;
  assert.equal(resolveAppointment(w, a, b, false), false);
  assert.equal(a.plan.stage, "waiting");
  assert.equal(a.rel[1].trust, 15);
  w.tick = 2;
  resolveAppointment(w, a, b, false);
  assert.equal(a.plan.stage, "expired");
  assert.equal(a.rel[1].trust, 12);
  assert.equal(b.rel[0].trust, 15);
  assert.equal(b.plan.stage, "pending");
});

test("a fulfilled appointment requires an actual meeting of both independently committed agents", () => {
  const w = new World("fulfilled"),
    [a, b] = w.npcs;
  a.plan = meal(1);
  b.plan = meal(0);
  w.tick = 1;
  a.loc = 2;
  b.loc = 2;
  assert(resolveAppointment(w, a, b, true));
  assert.equal(a.plan.stage, "fulfilled");
  assert.equal(b.plan.stage, "fulfilled");
  assert(w.events.at(-1)?.parents.includes(1));
  assert.deepEqual(w.events.at(-1)?.people, [0, 1]);
});

test("shared task progress comes only from eligible agents actually working there", () => {
  const w = new World("work"),
    t = w.tasks[0],
    a = w.npcs[t.members[0]],
    outsider = w.npcs.find((n) => !t.members.includes(n.id))!;
  a.intent = { kind: "task", taskId: t.id, evidence: [] };
  a.loc = 3;
  outsider.intent = { kind: "task", taskId: t.id, evidence: [] };
  outsider.loc = 3;
  t.progress = t.required - 1;
  workTasks(w);
  assert.equal(t.status, "completed");
  assert(t.contributions[a.id] > 0);
  assert.equal(t.contributions[outsider.id], undefined);
  const event = w.events.find((e) => e.type === "task_completed")!;
  assert.equal(w.events[event.parents[0] - 1].type, "task_progress");
  assert(t.members.every((id) => event.people.includes(id)));
});

test("regrouping preserves task history and interrupts plans belonging to former teammates", () => {
  const w = new World("regroup");
  const previous = w.tasks.map((t) => t.lastEvent);
  const former = w.npcs.map(
    (n) => w.tasks.find((t) => t.members.includes(n.id))!.id,
  );
  for (const n of w.npcs) {
    const t = w.tasks.find((t) => t.id === former[n.id])!;
    n.plan = {
      ...meal(1, t.lastEvent),
      id: `work-${n.id}`,
      kind: "task",
      taskId: t.id,
      location: 3,
    };
  }
  w.intervene("groups");
  preparePlans(w);
  const moved = w.npcs.filter(
    (n) => !w.tasks.find((t) => t.id === former[n.id])!.members.includes(n.id),
  );
  assert(moved.length > 0);
  assert(moved.every((n) => n.plan?.stage === "cancelled"));
  for (let i = 0; i < 3; i++)
    assert(w.events[w.tasks[i].lastEvent - 1].parents.includes(previous[i]));
});

test("active plans and shared tasks survive validated save and resume", () => {
  const w = new World("plans-save");
  while (w.tick < 24 && !w.npcs.some((n) => active(n.plan))) w.step();
  assert(w.npcs.some((n) => active(n.plan)));
  const restored = World.fromSave(w.toSave());
  assert.deepEqual(restored, w);
  while (w.tick < 28) {
    w.step();
    restored.step();
  }
  assert.deepEqual(restored, w);
});

test("multi-seed behavioral quality stays within broad playable ranges", () => {
  const q = evaluateSeeds(30);
  assert(q.activityDiversity >= 5);
  assert(q.fourStepRepeatRate < 0.05);
  assert(q.crisisRate < 0.03);
  // Conflicts now require concrete observations; do not impose a drama quota.
  assert(q.misunderstandingRate > 0 && q.misunderstandingRate < 0.4);
  assert(
    q.invitationAcceptanceRate > 0.05 && q.invitationAcceptanceRate < 0.99,
  );
  assert(q.taskCompletionRate > 0.3);
  assert(q.plansAgreed > 0);
  assert(q.planFulfillmentRate > 0.25 && q.planFulfillmentRate < 0.99);
  assert(q.interventionChangedWorldRate > 0.5);
  assert(q.beliefsFormed > 0);
  assert.equal(q.beliefSourceErrors, 0);
  assert(q.beliefsRevised > 0 && q.beliefsRevised < q.beliefsFormed);
  assert(q.activitiesProposed > 0);
  assert(q.activitiesHeld > 0 && q.activitiesCancelled > 0);
});

test("hunger reinforces a meal appointment instead of wrongly cancelling it", () => {
  const w = new World("hungry-meeting"),
    a = w.npcs[0];
  Object.assign(a, { energy: 80, hunger: 99, social: 0, plan: meal(1) });
  const chosen = chooseAction(
    a,
    {
      tick: 1,
      slot: 1,
      party: false,
      memories: [],
      roommates: [0, 1],
      tasks: [],
    },
    () => 0.5,
  ).chosen;
  assert.equal(chosen.kind, "appointment");
  assert.equal(chosen.urgentMeal, 0);
});
