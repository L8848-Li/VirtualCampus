import { World } from "../engine.ts";
export interface QualityMetrics {
  seeds: number;
  actions: number;
  activityDiversity: number;
  fourStepRepeatRate: number;
  crisisRate: number;
  invitationAcceptanceRate: number;
  misunderstandingRate: number;
  plansAgreed: number;
  plansFulfilled: number;
  planFulfillmentRate: number;
  taskCompletionRate: number;
  interventionChangedWorldRate: number;
  eventTypes: Record<string, number>;
}
const round = (n: number) => Math.round(n * 1000) / 1000;
export function evaluateSeeds(seeds: number = 100): QualityMetrics {
  if (!Number.isInteger(seeds) || seeds < 1 || seeds > 1000)
    throw new Error("评估种子数量应为 1–1000。");
  let actions = 0,
    diversity = 0,
    repeats = 0,
    windows = 0,
    crises = 0,
    agentSteps = 0,
    accepted = 0,
    invitations = 0,
    misunderstandings = 0,
    interactions = 0,
    plansAgreed = 0,
    plansFulfilled = 0,
    completedTasks = 0,
    changed = 0;
  const eventTypes: Record<string, number> = {};
  for (let seed = 0; seed < seeds; seed++) {
    const w = new World(`quality-${seed}`),
      histories = Array.from({ length: 10 }, () => [] as string[]);
    while (w.tick < 28) {
      if (w.tick === 2) w.intervene("party");
      w.step();
      for (const n of w.npcs) {
        agentSteps++;
        if (n.energy < 10 || n.hunger > 95) crises++;
        const action = w.events
          .filter((e) => e.type === "action" && e.people[0] === n.id)
          .at(-1)!;
        histories[n.id].push(
          `${action.data.location}:${n.intent?.kind || n.action}`,
        );
      }
    }
    for (const h of histories) {
      actions += h.length;
      diversity += new Set(h).size;
      for (let i = 3; i < h.length; i++) {
        windows++;
        if (h.slice(i - 3, i + 1).every((x) => x === h[i])) repeats++;
      }
    }
    const agreedIds = new Set<string>(),
      fulfilledIds = new Set<string>();
    for (const e of w.events) {
      eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
      if (e.type === "invitation") invitations++;
      if (e.type === "accepted") accepted++;
      if (
        [
          "friendship",
          "crush",
          "misunderstanding",
          "repair",
          "rivalry",
        ].includes(e.type)
      )
        interactions++;
      if (e.type === "misunderstanding") misunderstandings++;
      if (e.type === "plan_accepted" && typeof e.data.planId === "string")
        agreedIds.add(e.data.planId);
      if (
        e.type === "plan_fulfilled" &&
        typeof e.data.planId === "string" &&
        e.data.planId.startsWith("meal-")
      )
        fulfilledIds.add(e.data.planId);
    }
    plansAgreed += agreedIds.size;
    plansFulfilled += fulfilledIds.size;
    completedTasks += w.tasks.filter((t) => t.status === "completed").length;
    const control = new World(`quality-${seed}`);
    while (control.step());
    if (
      JSON.stringify(control.npcs.map((n) => ({ loc: n.loc, rel: n.rel }))) !==
      JSON.stringify(w.npcs.map((n) => ({ loc: n.loc, rel: n.rel })))
    )
      changed++;
  }
  return {
    seeds,
    actions,
    activityDiversity: round(diversity / (seeds * 10)),
    fourStepRepeatRate: round(repeats / windows),
    crisisRate: round(crises / agentSteps),
    invitationAcceptanceRate: round(accepted / Math.max(1, invitations)),
    misunderstandingRate: round(misunderstandings / Math.max(1, interactions)),
    plansAgreed,
    plansFulfilled,
    planFulfillmentRate: round(plansFulfilled / Math.max(1, plansAgreed)),
    taskCompletionRate: round(completedTasks / (seeds * 3)),
    interventionChangedWorldRate: round(changed / seeds),
    eventTypes,
  };
}
