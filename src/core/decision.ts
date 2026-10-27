import { courseAt } from "./academics.ts";
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
      base: (courseAt(tick) ? 64 : 2) + n.ambition * 20,
      reason: courseAt(tick) ? `今天有${courseAt(tick)!.name}，也要考虑自己的状态` : "想去教学楼整理笔记",
      action: courseAt(tick) ? `上${courseAt(tick)!.name}` : "整理课堂笔记",
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
  options.push(
    { loc: 6, action: "吃风味餐", base: n.hunger - 5 + (slot === 1 ? 8 : 0), reason: "想换个餐厅吃饭" },
    { loc: 7, action: "在运动场活动", base: 27 + n.social * 0.4 + n.ext * 18 + (slot === 2 ? 14 : 0), reason: "想活动身体，也许能遇见同学" },
    { loc: 8, action: "在实验楼练习", base: 29 + n.ambition * 30 + (n.interest === "机器人制作" ? 16 : 0), reason: "想用实践巩固所学" },
    { loc: 9, action: "在智慧教学楼自习", base: 29 + n.ambition * 30, reason: "想找一处安静的学习空间" },
    { loc: 10, action: "在理学楼学习", base: 27 + n.ambition * 30 + (n.interest === "数学谜题" ? 14 : 0), reason: "想花时间思考学习问题" },
    { loc: 11, action: "到综合办公楼办事", base: 23 + (tick % 7 === n.id % 7 ? 32 : 0), reason: "抽空处理校园事务" },
  );
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
  // Offers are copied from invitations this agent actually received. They do
  // not expose the live whereabouts, choices or private knowledge of guests.
  for (const activity of context.activities || []) {
    if (!activity.accepted || tick > activity.dueTick) continue;
    if (tick === activity.dueTick) {
      options.push({ loc: 4, action: `参加${activity.title}`, kind: "activity_attend", activityId: activity.activityId,
        base: 30 + n.social * 0.48 + (n.id === activity.organizer ? 24 : 10) + n.ext * 12,
        reason: "记得自己答应过的活动时间，愿意为共同的兴趣留出一个午后",
        evidence: [activity.sourceEvent] });
    } else if (activity.ownPreparation < activity.preparationGoal) {
      options.push({ loc: 4, action: `筹备${activity.title}`, kind: "activity_prepare", activityId: activity.activityId,
        base: (n.id === activity.organizer ? 62 : 36) + n.social * 0.2 + n.ext * 10
          + Math.max(0, 4 - (activity.dueTick - tick)) * 4,
        reason: n.id === activity.organizer ? "自己发起的小活动需要实际准备，也愿意为它花时间" : "答应过参加，想趁有空帮忙准备一点材料",
        evidence: [activity.sourceEvent] });
    }
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
    if ((knowledge.loc === 0 || knowledge.loc === 5) && !roommates.includes(target)) continue;
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
    } else if (n.beliefs.some((b) => b.subject === target && b.status === "unresolved" && !b.explanationEvent) && relation.trust > -35) {
      options.push({
        loc: knowledge.loc,
        action: "尝试把话说开",
        kind: "repair",
        target,
        base: 24 + n.social * 0.2 + (1 - n.sensitive) * 22 + n.ext * 16,
        reason: "对之前的事仍有疑问，想找当事人问清原因",
        evidence: [knowledge.event, ...n.beliefs.filter((b) => b.subject === target && b.status === "unresolved").map((b) => b.sourceEvent), ...evidence],
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
    o.urgentMeal = o.kind && n.hunger > 78 && o.loc !== 2 && o.loc !== 6 ? 30 : 0;
    const honors =
      plan &&
      tick >= plan.dueTick &&
      (plan.kind === "appointment"
        ? o.kind === "appointment" && o.target === plan.target
        : o.kind === "task" && o.taskId === plan.taskId);
    o.commitment = honors || o.kind === "activity_attend" ? 26 : 0;
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
