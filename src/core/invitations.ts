import type { AgentState } from "./types.ts";
export function invitationDecision(
  receiver: AgentState,
  senderId: number,
  random: () => number,
) {
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
