import assert from "node:assert/strict";
import { test } from "vitest";
import { World } from "../src/engine.ts";
import { briefReply, explainBelief } from "../src/core/cognition.ts";
import { finishPlan, resolveAppointment } from "../src/core/plans.ts";
import { buildStories } from "../src/core/stories.ts";
import type { AgentPlan } from "../src/core/types.ts";

function conversation() {
  const w = new World("specific-evidence");
  w.sample = () => 0;
  const [listener, speaker] = w.npcs;
  Object.assign(listener, { loc: 2, sensitive: 1 });
  Object.assign(speaker, { loc: 2, energy: 25, social: 40 });
  listener.rel[speaker.id].trust = -10;
  return { w, listener, speaker };
}

test("a mistaken interpretation needs a real, locally heard short reply", () => {
  const { w, listener, speaker } = conversation();
  speaker.loc = 3;
  const count = w.events.length;
  assert.equal(briefReply(w, listener, speaker, "报告分工"), null);
  assert.equal(w.events.length, count);
  speaker.loc = 2;
  const belief = briefReply(w, listener, speaker, "报告分工")!;
  assert(belief);
  const source = w.events[belief.sourceEvent - 1];
  assert.equal(source.type, "brief_reply");
  assert(source.people.includes(listener.id));
  assert(source.people.includes(speaker.id));
  assert.equal(speaker.beliefs.length, 0);
  assert.equal(speaker.accounts[0].sourceEvent, source.id);
  assert(!source.text.includes("有些累"), "the private cause has not been spoken yet");
});

test("an ordinary reply does not create a conflict and an unresolved guess is not repeatedly penalized", () => {
  const { w, listener, speaker } = conversation();
  speaker.energy = 80;
  assert.equal(briefReply(w, listener, speaker, "饭约"), null);
  speaker.energy = 25;
  briefReply(w, listener, speaker, "饭约");
  briefReply(w, listener, speaker, "饭约");
  assert.equal(listener.beliefs.length, 1);
});

test("a private cause does not correct a listener remotely; an actual explanation can change only their judgment", () => {
  const { w, listener, speaker } = conversation();
  const belief = briefReply(w, listener, speaker, "上次的回应")!;
  const originalSource = JSON.stringify(w.events[belief.sourceEvent - 1]);
  speaker.energy = 80;
  speaker.loc = 3;
  const before = belief.confidence;
  assert.equal(explainBelief(w, listener, speaker), false);
  assert.equal(belief.confidence, before);
  speaker.loc = 2;
  listener.rel[speaker.id].trust = 20;
  const reverseTrust = speaker.rel[listener.id].trust;
  assert(explainBelief(w, listener, speaker));
  assert.equal(belief.status, "revised");
  assert(belief.confidence < before);
  assert.equal(speaker.rel[listener.id].trust, reverseTrust);
  assert.equal(JSON.stringify(w.events[belief.sourceEvent - 1]), originalSource);
  const explanation = w.events[belief.explanationEvent! - 1];
  assert.equal(explanation.type, "explanation");
  assert(explanation.parents.includes(belief.sourceEvent));
});

test("an explanation may fail and repeating it does not count as new evidence", () => {
  const { w, listener, speaker } = conversation();
  listener.rel[speaker.id].trust = -80;
  const belief = briefReply(w, listener, speaker, "小组资料")!;
  speaker.energy = 80;
  assert(explainBelief(w, listener, speaker));
  assert.equal(belief.status, "unresolved");
  const confidence = belief.confidence, count = w.events.length;
  assert.equal(explainBelief(w, listener, speaker), false);
  assert.equal(belief.confidence, confidence);
  assert.equal(w.events.length, count);
});

test("a missing personal account cannot be replaced by an automatic reconciliation", () => {
  const { w, listener, speaker } = conversation();
  const belief = briefReply(w, listener, speaker, "报告")!;
  speaker.accounts = [];
  assert.equal(explainBelief(w, listener, speaker), false);
  assert.equal(belief.status, "unresolved");
});

test("a missed meal keeps the actual reason private until a later meeting, even after the old plan is replaced", () => {
  const { w, listener, speaker } = conversation();
  listener.rel[speaker.id].trust = 20;
  const plan: AgentPlan = { id: "meal-fixture", kind: "appointment", location: 2,
    createdTick: 0, dueTick: 1, untilTick: 2, stage: "pending", attempts: 0, worked: 0, lastEvent: 1 };
  listener.plan = { ...plan, target: speaker.id };
  speaker.plan = { ...plan, target: listener.id };
  w.tick = 1;
  finishPlan(w, speaker, "cancelled", "当时精力太低，需要先休息");
  assert.equal(listener.beliefs.length, 0);
  w.tick = 2;
  resolveAppointment(w, listener, speaker, false);
  const belief = listener.beliefs[0];
  assert.equal(belief.kind, "absence");
  assert.equal(belief.planId, plan.id);
  assert(!listener.memory.some((id) => w.events[id - 1].type === "plan_cancelled"));
  speaker.plan = null;
  speaker.energy = 80;
  assert(explainBelief(w, listener, speaker));
  assert(w.events[belief.explanationEvent! - 1].text.includes("先休息"));
  assert.equal(belief.status, "revised");
});

test("story cards group the entire meal episode including the original proposal and later explanations", () => {
  const w = new World("group-meals");
  while (w.step());
  const cards = buildStories(w);
  const proposals = w.events.filter((e) => e.type === "plan_proposed");
  assert(proposals.length > 0);
  for (const proposal of proposals) {
    const matches = cards.filter((s) => s.events.some((e) => e.id === proposal.id));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, proposal.data.planId);
    for (const event of w.events.filter((e) => e.data.planId === proposal.data.planId && e.type !== "action"))
      assert(matches[0].events.some((e) => e.id === event.id));
  }
});

test("story reading never changes the world, never presents beliefs as facts, and always retains evidence links", () => {
  const w = new World("campus-2026");
  while (w.step());
  const checksum = w.checksum();
  const cards = buildStories(w);
  assert.equal(w.checksum(), checksum);
  assert(cards.some((s) => s.kind === "activity"));
  assert(cards.some((s) => s.perspectives.length));
  for (const story of cards) {
    if (story.kind === "activity") {
      const outcome = story.events.find((e) => e.type === "activity_held" || e.type === "activity_cancelled");
      assert(outcome && story.facts.some((e) => e.id === outcome.id), "later conversation must not hide the gathering's actual outcome");
    }
    for (const event of story.facts)
      assert(!["misunderstanding", "belief_formed", "belief_revised", "repair"].includes(event.type));
    for (const { person, belief } of story.perspectives) {
      assert(story.events.some((e) => e.id === belief.sourceEvent));
      assert(w.events[belief.sourceEvent - 1].people.includes(person));
    }
    assert.equal(new Set(story.events.map((e) => e.id)).size, story.events.length);
  }
});

test("keyed cognitive draws do not consume the simulation's shared random stream", () => {
  const w = new World("isolated-purpose");
  const state = w.random.state;
  const a = w.sample("explanation", 2, "person-1");
  w.sample("activity-idea", 8, 5);
  assert.equal(w.sample("explanation", 2, "person-1"), a);
  assert.equal(w.random.state, state);
});

test("a completed shared task still has an open story when a sourced question remains", () => {
  const { w, listener, speaker } = conversation();
  const task = w.tasks[0];
  briefReply(w, listener, speaker, "资料分工", { taskId: task.id });
  task.status = "completed";
  const stories = buildStories(w);
  const card = stories.find((s) => s.id === task.id)!;
  assert.equal(card.kind, "task");
  assert.equal(card.active, true);
  assert.equal(card.perspectives.length, 1);
  assert(!stories.some((s) => s.kind === "relationship"));
});
