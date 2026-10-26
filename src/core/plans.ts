import type { AgentPlan, AgentState, PlanStage } from "./types.ts";
import type { World } from "../engine.ts";
import { invitationDecision } from "./social.ts";
export function active(plan: AgentPlan | null | undefined): plan is AgentPlan {
  return !!plan && ["pending", "waiting", "working"].includes(plan.stage);
}
export function finishPlan(
  world: World,
  n: AgentState,
  stage: Extract<PlanStage, "fulfilled" | "cancelled" | "expired">,
  reason: string,
) {
  if (!active(n.plan)) return;
  const plan = n.plan;
  plan.stage = stage;
  if (
    stage === "expired" &&
    plan.kind === "appointment" &&
    plan.attempts > 0 &&
    plan.target !== undefined
  ) {
    n.rel[plan.target].aff = Math.max(-100, n.rel[plan.target].aff - 2);
    n.rel[plan.target].trust = Math.max(-100, n.rel[plan.target].trust - 3);
    n.interaction = "把这次没等到的约定记在了心里";
    reason += "；不知道对方的原因，但这次亲历让自己的信任略有下降";
  }
  const id = world.log(
    `${n.name}${stage === "fulfilled" ? "完成了自己的小计划" : stage === "cancelled" ? "暂时放下了原来的计划" : "等过了约定的时间"}：${reason}`,
    stage === "fulfilled"
      ? "plan_fulfilled"
      : stage === "cancelled"
        ? "plan_cancelled"
        : "plan_expired",
    [n.id],
    [plan.lastEvent, n.last],
    { reason, planId: plan.id, taskId: plan.taskId, target: plan.target },
    3,
  );
  plan.lastEvent = id;
  world.remember(n, id);
}
export function preparePlans(world: World) {
  for (const n of world.npcs) {
    const p = n.plan;
    if (!active(p)) continue;
    if (
      p.kind === "task" &&
      world.tasks.find((t) => t.id === p.taskId)?.status === "completed"
    ) {
      finishPlan(world, n, "fulfilled", "共同事务已经完成");
      continue;
    }
    if (
      p.kind === "task" &&
      !world.tasks.find(
        (t) =>
          t.id === p.taskId && t.members.includes(n.id) && t.status === "open",
      )
    ) {
      finishPlan(world, n, "cancelled", "分组或事务状态发生了变化");
      continue;
    }
    if (world.tick > p.untilTick) {
      finishPlan(
        world,
        n,
        "expired",
        p.kind === "appointment"
          ? "这次没等到约好的人，决定继续自己的生活"
          : "这段专注时间结束了",
      );
      continue;
    }
    if (n.energy < 18 || (n.hunger > 90 && p.location !== 2)) {
      finishPlan(
        world,
        n,
        "cancelled",
        n.energy < 18 ? "精力太低，需要先休息" : "太饿了，需要先吃饭",
      );
    }
  }
}
export function proposeAppointment(
  world: World,
  a: AgentState,
  b: AgentState,
  parent: number,
) {
  if (
    active(a.plan) ||
    active(b.plan) ||
    world.tick - a.lastPlanTick < 4 ||
    world.tick - b.lastPlanTick < 4 ||
    a.rel[b.id].aff < 12 ||
    b.rel[a.id].aff < 4
  )
    return;
  let due = world.tick + 1;
  while (due % 4 !== 1) due++;
  if (due >= 28) return;
  a.lastPlanTick = world.tick;
  b.lastPlanTick = world.tick;
  const proposal = world.log(
    `${a.name}问${b.name}，要不要在第 ${Math.floor(due / 4) + 1} 天午间一起吃饭。`,
    "plan_proposed",
    [a.id, b.id],
    [parent],
    {
      reason: "几次正向相处后，主动把期待变成下一顿饭的具体约定",
      dueTick: due,
      location: 2,
    },
    3,
  );
  world.remember(a, proposal);
  world.remember(b, proposal);
  // The receiver anticipates social needs, not the sender's desired outcome.
  const anticipated = {
    ...b,
    social: Math.min(100, b.social + (due - world.tick) * 11),
    hunger: Math.min(60, b.hunger),
  };
  const response = invitationDecision(anticipated, a.id, () => world.rand());
  const planId = `meal-${world.tick}-${a.id}-${b.id}`;
  const agreed = world.log(
    response.accepted
      ? `${b.name}答应了。两人记下了午间在食堂见面的约定。`
      : `${b.name}没有答应这次饭约，想先给自己留一些自由时间。`,
    response.accepted ? "plan_accepted" : "plan_declined",
    [b.id, a.id],
    [proposal],
    {
      reason: response.accepted
        ? "按关系与预期社交需求独立接受，未来仍可能被迫中断"
        : "对方依据自己的状态与关系独立拒绝未来的饭约",
      dueTick: due,
      location: 2,
      planId,
      score: response.score,
    },
    4,
  );
  world.remember(a, agreed);
  world.remember(b, agreed);
  if (!response.accepted) return;
  const base = {
    id: planId,
    kind: "appointment" as const,
    location: 2 as const,
    createdTick: world.tick,
    dueTick: due,
    untilTick: due + 1,
    stage: "pending" as const,
    attempts: 0,
    worked: 0,
    lastEvent: agreed,
  };
  a.plan = { ...base, target: b.id };
  b.plan = { ...base, target: a.id };
}
export function resolveAppointment(
  world: World,
  a: AgentState,
  b: AgentState,
  colocated: boolean,
): boolean {
  const p = a.plan;
  if (!active(p) || p.kind !== "appointment") return false;
  if (colocated && active(b.plan) && b.plan.id === p.id) {
    p.stage = "fulfilled";
    b.plan.stage = "fulfilled";
    const id = world.log(
      `${a.name}和${b.name}都来到了食堂，兑现了之前的一起吃饭的约定。`,
      "plan_fulfilled",
      [a.id, b.id],
      [p.lastEvent, b.plan.lastEvent, a.last, b.last],
      {
        reason: "双方各自选择赴约，并在约定地点实际相遇",
        planId: p.id,
        location: 2,
      },
      4,
    );
    p.lastEvent = id;
    b.plan.lastEvent = id;
    world.remember(a, id);
    world.remember(b, id);
    return true;
  }
  p.stage = "waiting";
  p.attempts++;
  const id = world.log(
    `${a.name}到了约好的食堂，暂时还没有看到${b.name}。`,
    "plan_waiting",
    [a.id],
    [p.lastEvent, a.last],
    {
      reason: "只知道自己到了现场，不知道对方目前在哪里；最多再等一个时段",
      planId: p.id,
      target: b.id,
      location: 2,
    },
    3,
  );
  p.lastEvent = id;
  a.interaction = "还在等约好的人";
  world.remember(a, id);
  if (world.tick >= p.untilTick)
    finishPlan(world, a, "expired", "约定的等待时间过去了");
  return false;
}
