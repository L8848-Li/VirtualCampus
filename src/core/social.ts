import type { AgentState, EventType } from './types.ts';
import type { World } from '../engine.ts';
const clamp = (v: number, min = 0) => Math.max(min, Math.min(100, v));
const contexts = [
  "熄灯前的聊天",
  "课程小组分工",
  "一起吃饭的邀约",
  "参考书借阅",
  "活动海报的准备",
];
export function invitationDecision(receiver: AgentState, senderId: number, random: () => number) {
  const r = receiver.rel[senderId];
  const parts = {
    willingness: 25 + receiver.ext * 10,
    social: receiver.social * 0.42,
    affection: r.aff * 0.4,
    trust: r.trust * 0.18,
    tired: receiver.energy < 28 ? -38 : 0,
    hungry: receiver.hunger > 76 ? -32 : 0,
    noise: random() * 12,
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return {
    accepted: score >= 48,
    score,
    parts,
    reason:
      score >= 48
        ? "对方愿意相处，精力、需求和关系共同支持接受邀约"
        : receiver.energy < 28
          ? "对方精力不足，决定先休息"
          : receiver.hunger > 76
            ? "对方更想先解决吃饭问题"
            : r.aff < 0
              ? "对方对这段关系仍有顾虑"
              : "对方当前更想按自己的节奏行动",
  };
}
function resolve(world: World, a: AgentState, b: AgentState, invited = false) {
  const r = a.rel[b.id],
    s = b.rel[a.id];
  const memory = a.memory
    .map((id) => world.events[id - 1])
    .filter((e) => e.people.includes(b.id));
  const negative = memory.filter((e) => e.type === "misunderstanding").length;
  const chance = 0.09 + a.sensitive * 0.17 + negative * 0.04;
  const roll = world.rand();
  const topic = contexts[a.loc];
  let type: EventType, delta: number, text: string, reason: string;
  let perspectives: {person: number; interpretation: string}[] = [];
  if ((r.aff < 0 || a.intent?.kind === "repair") && roll > 0.32) {
    type = "repair";
    delta = 10;
    text = `${a.name}与${b.name}聊起${topic}，把上次没说清的意思重新解释了一遍。`;
    reason = "双方再次当面相遇，旧的紧张关系获得澄清机会";
  } else if (roll < chance) {
    type = "misunderstanding";
    delta = -8;
    text = `${a.name}在${topic}时，把${b.name}的简短回应理解成了冷淡。`;
    reason = `亲历的负面记忆与敏感度使误读概率达到 ${Math.round(chance * 100)}%`;
    perspectives = [
      { person: a.id, interpretation: "对方好像不太想理我" },
      {
        person: b.id,
        interpretation:
          b.energy < 40
            ? "只是有些累，没来得及多解释"
            : "只是简短地回应了眼前这件事",
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
  s.aff = clamp(
    s.aff + (type === "misunderstanding" ? -2 : delta + bonus),
    -100,
  );
  r.trust = clamp(r.trust + (delta > 0 ? 4 : -5), -100);
  s.trust = clamp(s.trust + (delta > 0 ? 3 : -2), -100);
  a.social = clamp(a.social - 27);
  b.social = clamp(b.social - 24);
  a.interaction = b.interaction =
    type === "misunderstanding"
      ? "气氛有点尴尬"
      : type === "repair"
        ? "把话说开了"
        : "正在一起相处";
  const parents = [
    a.last,
    b.last,
    ...memory.slice(0, 2).map((e) => e.id),
    ...world.environmentParents(a.loc),
  ];
  const id = world.log(
    text,
    type,
    [a.id, b.id],
    parents,
    {
      reason,
      delta: delta + bonus,
      otherDelta: type === "misunderstanding" ? -2 : delta + bonus,
      roll,
      probability: chance,
      location: a.loc,
      topic,
      perspectives,
    },
    type === "friendship" ? (firstFriend ? 3 : 2) : 4,
  );
  world.remember(a, id);
  world.remember(b, id);
}
export function runSocial(world: World) {
  const paired = new Set();
  const order = world.shuffle([...world.npcs]);
  // Invitations are resolved after everyone independently chooses and moves.
  for (const a of order) {
    if (!a.intent || paired.has(a.id)) continue;
    const b = world.npcs[a.intent.target];
    const colocated =
      b.loc === a.loc &&
      (a.loc !== 0 || world.rooms[a.id] === world.rooms[b.id]);
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
      `${a.name}邀请${b.name}一起${["聊聊天", "讨论作业", "吃顿饭", "看一会儿书", "准备活动"][a.loc]}。`,
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
    if (paired.has(a.id)) continue;
    const peers = order.filter(
      (b) =>
        b.id !== a.id &&
        !paired.has(b.id) &&
        b.loc === a.loc &&
        (a.loc !== 0 || world.rooms[a.id] === world.rooms[b.id]),
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
