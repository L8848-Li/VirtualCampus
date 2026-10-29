import { isPrivateDorm } from "./campusLife.ts";
import { isOnCampus } from "./holiday.ts";
import { invitationDecision } from "./invitations.ts";
export { invitationDecision } from "./invitations.ts";
import { proposeAppointment, resolveAppointment } from "./plans.ts";
import { briefReply, explainBelief } from "./cognition.ts";
import { considerActivity } from "./activities.ts";
import type { AgentState, EventType } from "./types.ts";
import type { World } from "../engine.ts";
const clamp = (v: number, min = 0) => Math.max(min, Math.min(100, v));
const contexts = [
  "熄灯前的聊天",
  "课程小组分工",
  "一起吃饭的邀约",
  "参考书借阅",
  "活动海报的准备",
];
// Later-added buildings reuse a suitable interaction theme rather than
// indexing beyond the five original locations and producing undefined text.
const socialContext = [0, 1, 2, 3, 4, 0, 2, 0, 1, 1, 1, 0, 1, 2, 1, 0, 3, 3, 1, 0, 0, 0, 0] as const;

function resolve(world: World, a: AgentState, b: AgentState, invited = false, planId?: string) {
  const r = a.rel[b.id],
    s = b.rel[a.id];
  const memory = a.memory
    .map((id) => world.events[id - 1])
    .filter((e) => e.people.includes(b.id));
  if (explainBelief(world, a, b) || explainBelief(world, b, a)) {
    a.social = clamp(a.social - 18);
    b.social = clamp(b.social - 18);
    return;
  }
  const roll = world.rand();
  const task = world.tasks.find(
    (t) => t.id === a.intent?.taskId || t.id === b.intent?.taskId,
  );
  const activity = world.activities.find((t) => t.id === a.intent?.activityId || t.id === b.intent?.activityId);
  const topic = task ? `“${task.title}”的资料分工` : activity ? `“${activity.title}”里的兴趣交流` : contexts[socialContext[a.loc]];
  const belief = briefReply(world, a, b, topic, { planId, taskId: task?.id, activityId: activity?.id });
  let type: EventType, delta: number, text: string, reason: string;
  let perspectives: { person: number; interpretation: string }[] = [];
  if (belief) {
    type = "misunderstanding";
    delta = -8;
    text = `${a.name}在聊起${topic}时，把${b.name}的简短回应理解成了冷淡。`;
    reason = "确实听到了简短回应，但不知道背后的原因；按自己的敏感度和信任形成了可能有误的判断";
    perspectives = [
      { person: a.id, interpretation: "对方好像不太想理我" },
      {
        person: b.id,
        interpretation: "当时只做了简短回应，还不知道对方把它理解成了冷淡",
      },
    ];
  } else if (
    (a.loc === 1 || a.loc === 3) &&
    a.ambition > 0.65 &&
    b.ambition > 0.65 &&
    roll > 0.55
  ) {
    type = "rivalry";
    delta = -3;
    text = `${a.name}与${b.name}在${topic}中都想争取更好的表现，悄悄较起了劲。`;
    reason = "学习场景中的双方都有较强进取心，触发竞争";
  } else if (r.aff >= 18 && r.trust >= 4 && roll > 0.6) {
    type = "crush";
    delta = 5;
    r.crush = clamp(r.crush + 12);
    text = `${a.name}在${topic}后，发现自己开始期待下一次见到${b.name}。`;
    reason = "亲近与信任积累后触发单向心动，内向角色也能产生暗恋";
  } else {
    type = "friendship";
    delta = invited ? 8 : 6;
    text = `${a.name}与${b.name}围绕${topic}聊了一会儿，多了一点默契。`;
    reason = invited
      ? "自主接受的邀约带来一次正向相处"
      : "同地点相遇，围绕当前事务进行交流";
  }
  const bonus =
    a.loc === 1 && world.groups[a.id] === world.groups[b.id] && delta > 0
      ? 3
      : 0;
  const firstFriend = r.aff <= 0 && delta > 0;
  r.aff = clamp(r.aff + delta + bonus, -100);
  if (!belief) s.aff = clamp(s.aff + delta + bonus, -100);
  r.trust = clamp(r.trust + (delta > 0 ? 4 : -5), -100);
  if (!belief) s.trust = clamp(s.trust + (delta > 0 ? 3 : -2), -100);
  a.social = clamp(a.social - 27);
  b.social = clamp(b.social - 24);
  a.interaction =
    type === "misunderstanding"
      ? "气氛有点尴尬"
      : "正在一起相处";
  b.interaction = belief ? "简短回应后，继续自己的安排" : a.interaction;
  const parents = [
    a.last,
    b.last,
    belief?.sourceEvent,
    ...memory.slice(0, 2).map((e) => e.id),
    ...world.environmentParents(a.loc),
  ];
  const id = world.log(
    text,
    type,
    belief ? [a.id] : [a.id, b.id],
    parents,
    {
      reason,
      delta: delta + bonus,
      otherDelta: belief ? 0 : delta + bonus,
      roll,
      beliefId: belief?.id,
      sourceEvent: belief?.sourceEvent,
      claim: belief?.claim,
      confidence: belief?.confidence,
      planId,
      location: a.loc,
      topic,
      taskId: task?.id,
      activityId: activity?.id,
      perspectives,
    },
    type === "friendship" ? (firstFriend ? 3 : 2) : 4,
  );
  world.remember(a, id);
  if (belief) belief.evidence.push(id);
  else world.remember(b, id);
  if (type === "friendship" || type === "crush") {
    proposeAppointment(world, a, b, id);
    considerActivity(world, a, b, id);
  }
}
export function runSocial(world: World) {
  const paired = new Set();
  const order = world.shuffle([...world.npcs]);
  // Invitations are resolved after everyone independently chooses and moves.
  const initiative = [
    ...order.filter((a) => a.intent?.kind === "appointment"),
    ...order.filter((a) => a.intent?.kind !== "appointment"),
  ];
  for (const a of initiative) {
    if (
      !isOnCampus(a.loc) || !a.intent ||
      paired.has(a.id) ||
      a.intent.kind === "task" ||
      a.intent.target === undefined
    )
      continue;
    const b = world.npcs[a.intent.target];
    const colocated =
      isOnCampus(b.loc) && b.intent?.kind !== "delivery_pickup" && b.loc === a.loc &&
      (!isPrivateDorm(a.loc) || world.rooms[a.id] === world.rooms[b.id]);
    if (a.intent.kind === "appointment") {
      const met = resolveAppointment(world, a, b, colocated);
      paired.add(a.id);
      if (met) {
        paired.add(b.id);
        resolve(world, a, b, true, a.plan?.id);
      }
      continue;
    }
    if (!colocated) {
      const observation = a.known[b.id];
      if (observation) {
        observation.missed = true;
        if (observation.routine?.[world.tick % 4])
          observation.routine[world.tick % 4]!.missed = true;
      }
      const id = world.log(
        `${a.name}去了上次见面的地方，这次没有遇见${b.name}。`,
        "missed",
        [a.id],
        [a.last, ...a.intent.evidence],
        {
          reason: "角色只能根据过去亲眼见到的位置寻找，对方可能已经离开",
          target: b.id,
        },
        2,
      );
      a.interaction = "没有遇见，先做自己的事";
      world.remember(a, id);
      continue;
    }
    if (paired.has(b.id)) continue;
    paired.add(a.id);
    paired.add(b.id);
    const invitation = world.log(
      `${a.name}邀请${b.name}一起${["聊聊天", "讨论作业", "吃顿饭", "看一会儿书", "准备活动"][socialContext[a.loc]]}。`,
      "invitation",
      [a.id, b.id],
      [a.last, b.last, ...a.intent.evidence],
      {
        reason:
          a.intent.kind === "repair"
            ? "希望找机会解释上次的误会"
            : "曾经的好感与亲历记忆让角色主动发出邀约",
        target: b.id,
      },
      3,
    );
    world.remember(a, invitation);
    world.remember(b, invitation);
    const response = invitationDecision(b, a.id, () => world.rand());
    const id = world.log(
      response.accepted
        ? `${b.name}接受了${a.name}的邀约。`
        : `${b.name}婉拒了${a.name}的邀约，决定先按自己的节奏行动。`,
      response.accepted ? "accepted" : "declined",
      [b.id, a.id],
      [invitation],
      {
        reason: response.reason,
        score: response.score,
        parts: response.parts,
      },
      response.accepted ? 2 : 3,
    );
    world.remember(a, id);
    world.remember(b, id);
    if (response.accepted) resolve(world, a, b, true);
    else {
      a.interaction = "邀约被婉拒";
      b.interaction = "这次想独处";
    }
  }
  for (const a of order) {
    if (!isOnCampus(a.loc) || paired.has(a.id) || a.intent?.kind === "delivery_pickup") continue;
    const peers = order.filter(
      (b) =>
        b.id !== a.id &&
        !paired.has(b.id) && b.intent?.kind !== "delivery_pickup" &&
        b.loc === a.loc &&
        (!isPrivateDorm(a.loc) || world.rooms[a.id] === world.rooms[b.id]),
    );
    if (!peers.length) continue;
    // Existing affection biases whom to approach; no forced pairing by story.
    const weights = peers.map((b) =>
      Math.max(0.2, 1 + a.rel[b.id].aff * 0.045 + a.rel[b.id].crush * 0.025),
    );
    let pick = world.rand() * weights.reduce((a, b) => a + b, 0),
      index = 0;
    while (index < peers.length - 1 && (pick -= weights[index]) > 0) index++;
    const b = peers[index];
    paired.add(a.id);
    paired.add(b.id);
    resolve(world, a, b);
  }
}
