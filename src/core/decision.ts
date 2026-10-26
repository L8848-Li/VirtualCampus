import { active } from "./plans.ts";
import type {
  AgentState,
  DecisionContext,
  ActionOption,
  ScoredAction,
  Knowledge,
} from "./types.ts";
export const clamp = (v: number, low = 0, high = 100) =>
  Math.max(low, Math.min(high, v));
// Only the agent's own state, recent observations and public environment enter
// this policy. It cannot inspect another agent's current position or needs.
export function chooseAction(
  n: AgentState,
  context: DecisionContext,
  random: () => number,
) {
  const { tick, slot, party, memories, roommates } = context;
  const options: ActionOption[] = [
    {
      loc: 0,
      action: "休息",
      base: (100 - n.energy) * 0.9 + (slot === 3 ? 28 : 0),
      reason: "恢复精力，夜晚更想回宿舍",
    },
    {
      loc: 2,
      action: "吃饭",
      base: n.hunger + (slot === 1 ? 8 : 0),
      reason: "饥饿与饭点提高了吃饭的吸引力",
    },
    {
      loc: 1,
      action: "上课",
      base: (slot === 0 ? 64 : 8) + n.ambition * 20,
      reason: "清晨的课程安排与学业目标",
    },
    {
      loc: 3,
      action: "自习",
      base: 24 + n.ambition * 24 + (n.goal === "争取奖学金" ? 14 : 0),
      reason: "进取心与学业目标推动自习",
    },
    {
      loc: 4,
      action: "参加社团",
      base: 16 + n.social * 0.5 + n.ext * 17 + (party ? 48 : 0),
      reason: party
        ? "社团开放日提供了一次相遇机会"
        : "社交需求与兴趣推动参加社团",
    },
  ];
  const plan = active(n.plan) ? n.plan : null;
  if (
    plan?.kind === "appointment" &&
    tick >= plan.dueTick &&
    tick <= plan.untilTick
  ) {
    options.push({
      loc: plan.location,
      action: "赴约一起吃饭",
      kind: "appointment",
      target: plan.target,
      base: n.hunger + n.social * 0.18 + 8,
      reason: "记得已经答应的时间和地点，愿意为约定留出一个时段",
      evidence: [plan.lastEvent],
    });
  }
  for (const task of context.tasks || []) {
    if (task.status !== "open" || !task.members.includes(n.id)) continue;
    const urgency = Math.max(0, 8 - (task.deadline - tick)) * 2.6;
    options.push({
      loc: task.location,
      action: "整理小组报告资料",
      kind: "task",
      taskId: task.id,
      base:
        28 + n.ambition * 24 + (n.goal === "争取奖学金" ? 22 : 10) + urgency,
      reason: `${task.title}还需要整理，临近截止会提高优先级`,
      evidence: [task.lastEvent],
    });
  }
  const seen = Object.entries(n.known).flatMap<
    [string, Knowledge & { basis?: string }]
  >(([id, k]) => {
    const routine = k.routine?.[slot];
    // Prefer a personally observed routine at the same time of day. This is
    // still a fallible prediction, not a read of another agent's live state.
    if (routine && !routine.missed && tick - routine.tick <= 8)
      return [[id, { ...routine, basis: "routine" }]];
    return tick - k.tick <= 3 && !k.missed ? [[id, k]] : [];
  });
  for (const [id, knowledge] of seen) {
    const target = Number(id),
      relation = n.rel[target];
    if (knowledge.loc === 0 && !roommates.includes(target)) continue;
    const evidence = memories
      .filter((e) => e.people.includes(target))
      .map((e) => e.id);
    if (relation.aff >= 7 || relation.crush > 0) {
      options.push({
        loc: knowledge.loc,
        action: "找熟人一起度过时段",
        kind: "seek",
        target,
        base:
          22 +
          n.social * 0.48 +
          Math.max(0, relation.aff) * 0.6 +
          Math.max(0, relation.trust) * 0.15 +
          relation.crush * 0.2,
        reason:
          knowledge.basis === "routine"
            ? "记得对方曾在这个时段出现，想去碰碰运气并发出邀约"
            : "想再次见到熟悉的人，尝试在上次见面的地方发出邀约",
        evidence: [knowledge.event, ...evidence],
        knownTick: knowledge.tick,
      });
    } else if (relation.aff < -4 && relation.trust > -25) {
      options.push({
        loc: knowledge.loc,
        action: "尝试把话说开",
        kind: "repair",
        target,
        base: 24 + n.social * 0.2 + (1 - n.sensitive) * 22 + n.ext * 16,
        reason: "还记得之前的不愉快，愿意尝试当面澄清",
        evidence: [knowledge.event, ...evidence],
        knownTick: knowledge.tick,
      });
    }
  }
  for (const o of options) {
    o.habit = o.loc === n.home ? (slot === n.habit ? 17 : 7) : 0;
    o.avoidance = 0;
    o.evidence = o.evidence || [];
    for (const [id, k] of seen) {
      const r = n.rel[Number(id)];
      if (r.aff <= -12 && k.loc === o.loc && o.kind !== "repair") {
        o.avoidance += Math.min(25, -r.aff * 0.4 + n.sensitive * 8);
        o.evidence.push(
          k.event,
          ...memories
            .filter((e) => e.people.includes(Number(id)))
            .map((e) => e.id),
        );
      }
    }
    // Meeting friends cannot remove the physiological cost of an outing.
    o.exhaustion = o.kind && n.energy < 25 ? 38 : 0;
    o.urgentMeal = o.kind && n.hunger > 78 && o.loc !== 2 ? 30 : 0;
    const honors =
      plan &&
      tick >= plan.dueTick &&
      (plan.kind === "appointment"
        ? o.kind === "appointment" && o.target === plan.target
        : o.kind === "task" && o.taskId === plan.taskId);
    o.commitment = honors ? 26 : 0;
    o.switching = plan && tick >= plan.dueTick && !honors ? 9 : 0;
    o.noise = random() * 12;
    o.score =
      o.base +
      o.habit +
      o.commitment -
      o.switching -
      o.avoidance -
      o.exhaustion -
      o.urgentMeal +
      o.noise;
    if (o.avoidance) o.reason += "；也想避开上次相处紧张的人";
  }
  options.sort((a, b) => b.score! - a.score!);
  return {
    chosen: options[0] as ScoredAction,
    options: options as ScoredAction[],
  };
}
