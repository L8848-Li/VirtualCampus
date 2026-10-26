import assert from "node:assert/strict";
import { test } from "vitest";
import { World } from "../src/engine.ts";
import { considerActivity, inviteToActivity, workActivities, resolveActivities } from "../src/core/activities.ts";
import { chooseAction } from "../src/core/decision.ts";

function proposal() {
  const w = new World("personal-wish");
  w.tick = 4;
  w.sample = () => 0;
  const [a, b] = w.npcs;
  for (const n of [a, b]) Object.assign(n, { loc: 4, energy: 80, hunger: 10, social: 70 });
  a.rel[b.id] = { aff: 25, trust: 20, crush: 0 };
  b.rel[a.id] = { aff: 25, trust: 20, crush: 0 };
  const parent = w.log("两人聊起各自的兴趣，产生了新的默契。", "friendship", [a.id, b.id]);
  considerActivity(w, a, b, parent);
  return { w, a, b, activity: w.activities[0], parent };
}

test("an NPC's project starts from a real positive encounter, not a remote or system event", () => {
  const { w, a, b, activity, parent } = proposal();
  assert.equal(activity.organizer, a.id);
  assert.equal(activity.progress, 0);
  assert(activity.dueTick > w.tick);
  assert.equal(activity.dueTick % 4, 2);
  assert(w.events.find((e) => e.type === "activity_proposed")!.parents.includes(parent));
  w.activities = [];
  b.loc = 3;
  considerActivity(w, a, b, parent);
  assert.equal(w.activities.length, 0);
  b.loc = 4;
  considerActivity(w, a, b, 1);
  assert.equal(w.activities.length, 0);
});

test("only an actual invitation teaches a guest the activity; declining stays a real choice", () => {
  const { w, a, activity, parent } = proposal();
  const guest = w.npcs[2];
  guest.loc = 3;
  inviteToActivity(w, activity, guest, parent);
  assert.equal(guest.activityInvitations.length, 0);
  Object.assign(guest, { loc: a.loc, energy: 5, social: 0 });
  guest.rel[a.id].aff = -40;
  inviteToActivity(w, activity, guest, parent);
  assert.equal(guest.activityInvitations[0].accepted, false);
  assert(!activity.members.includes(guest.id));
  guest.energy = 100;
  inviteToActivity(w, activity, guest, parent);
  assert.equal(guest.activityInvitations.length, 1, "declining does not trigger repeated pressure to agree");
});

test("preparation requires a consenting member to choose work and actually be there", () => {
  const { w, a, b, activity } = proposal();
  assert(activity.members.includes(b.id));
  workActivities(w);
  assert.equal(activity.progress, 0, "accepting or standing nearby is not work");
  a.intent = { kind: "activity_prepare", activityId: activity.id, evidence: [] };
  b.intent = { kind: "activity_prepare", activityId: activity.id, evidence: [] };
  b.loc = 3;
  const outsider = w.npcs[2];
  outsider.loc = 4;
  outsider.intent = { kind: "activity_prepare", activityId: activity.id, evidence: [] };
  w.tick++;
  workActivities(w);
  assert.equal(activity.progress, 2);
  assert.equal(activity.contributions[a.id], 2);
  assert.equal(activity.contributions[b.id], undefined);
  assert.equal(activity.contributions[outsider.id], undefined);
});

test("an agreed activity competes with real physiological needs instead of compelling attendance", () => {
  const { w, b, activity } = proposal();
  const context = { tick: activity.dueTick, slot: 2, party: false, memories: [], roommates: [], tasks: [],
    activities: b.activityInvitations.map((invitation) => ({ ...invitation, ownPreparation: 0 })) };
  const ordinary = chooseAction(b, context, () => 0);
  assert(ordinary.options.some((o) => o.kind === "activity_attend" && o.commitment > 0));
  Object.assign(b, { energy: 5, hunger: 99, social: 0 });
  assert.notEqual(chooseAction(b, context, () => 0).chosen.kind, "activity_attend");
  assert(!chooseAction(b, { ...context, activities: [] }, () => 0).options.some((o) => o.kind === "activity_attend"));
});

test("a prepared gathering succeeds only with actual attendance and does not give absent guests shared memories", () => {
  const { w, a, b, activity, parent } = proposal();
  const absent = w.npcs[3];
  Object.assign(absent, { loc: 4, energy: 80, social: 80, hunger: 0 });
  absent.rel[a.id].aff = 30;
  inviteToActivity(w, activity, absent, parent);
  assert(activity.members.includes(absent.id));
  a.intent = { kind: "activity_prepare", activityId: activity.id, evidence: [] };
  w.tick++;
  workActivities(w);
  w.tick++;
  workActivities(w);
  assert.equal(activity.progress, activity.required);
  const absentMemory = [...absent.memory];
  const absentTrust = absent.rel[a.id].trust;
  w.tick = activity.dueTick;
  for (const n of [a, b]) n.intent = { kind: "activity_attend", activityId: activity.id, evidence: [] };
  absent.loc = 2;
  resolveActivities(w);
  assert.equal(activity.status, "held");
  assert.deepEqual(activity.attendees, [a.id, b.id]);
  assert.deepEqual(absent.memory, absentMemory);
  assert.equal(absent.rel[a.id].trust, absentTrust);
  assert.deepEqual(w.events.at(-1)!.people, activity.attendees);
  const count = w.events.length;
  resolveActivities(w);
  assert.equal(w.events.length, count, "a deadline is settled once");
});

test("accepted invitations alone cannot guarantee a gathering, and regrouping does not rewrite consent", () => {
  const { w, a, b, activity } = proposal();
  const members = [...activity.members];
  w.intervene("groups");
  assert.deepEqual(activity.members, members);
  w.tick = activity.dueTick;
  for (const n of [a, b]) n.intent = { kind: "activity_attend", activityId: activity.id, evidence: [] };
  resolveActivities(w);
  assert.equal(activity.status, "cancelled");
  assert(w.events.at(-1)!.data.reason?.includes("材料"));
});

test("ready materials cannot make an absent organizer or guest attend automatically", () => {
  const { w, a, b, activity } = proposal();
  activity.progress = activity.required;
  a.loc = 0;
  a.intent = null;
  const before = [...a.memory];
  b.intent = { kind: "activity_attend", activityId: activity.id, evidence: [] };
  w.tick = activity.dueTick;
  resolveActivities(w);
  assert.equal(activity.status, "cancelled");
  assert(w.events.at(-1)!.data.reason?.includes("发起人"));
  assert.deepEqual(a.memory, before);
});
