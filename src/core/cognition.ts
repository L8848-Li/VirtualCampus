import type { World } from "../engine.ts";
import type { AgentPlan, AgentState, Belief } from "./types.ts";
import { clamp } from "./decision.ts";

export function noteAbsence(world: World, observer: AgentState, plan: AgentPlan, source: number) {
  if (plan.target === undefined || observer.beliefs.some((b) => b.planId === plan.id)) return;
  const subject = plan.target;
  const confidence = clamp(0.5 + observer.sensitive * 0.25 - observer.rel[subject].trust * 0.004, 0.2, 0.9);
  const belief: Belief = {
    id: `absence-${plan.id}-${observer.id}`,
    kind: "absence",
    subject,
    claim: `${world.npcs[subject].name}可能没把这次约定放在心上`,
    confidence,
    status: "unresolved",
    sourceEvent: source,
    evidence: [source],
    planId: plan.id,
    createdTick: world.tick,
    updatedTick: world.tick,
  };
  observer.beliefs.push(belief);
  const id = world.log(
    `${observer.name}没等到约好的人，开始猜想：${belief.claim}。这还只是自己的判断。`,
    "belief_formed", [observer.id], [source],
    { beliefId: belief.id, planId: plan.id, sourceEvent: source, claim: belief.claim, confidence,
      reason: "亲历了等待和错过，但没有收到对方改变安排的原因；猜测不等于事实" }, 3,
  );
  belief.evidence.push(id);
  world.remember(observer, id);
}

// A short reply must actually occur before anyone can interpret it as rejection.
export function briefReply(world: World, observer: AgentState, speaker: AgentState, topic: string,
  context: { planId?: string; taskId?: string; activityId?: string } = {}) {
  if (observer.loc !== speaker.loc || (observer.loc === 0 && world.rooms[observer.id] !== world.rooms[speaker.id])) return null;
  const busy = speaker.plan?.kind === "task" && speaker.plan.stage === "working";
  if (speaker.energy >= 35 && speaker.social >= 10 && !busy) return null;
  const account = speaker.energy < 35
    ? "当时有些累，只简短回应了一下，并不是在表达对你的态度"
    : busy
      ? "当时惦记着没整理完的小组资料，没能展开聊"
      : "当时想安静一会儿，所以没有多说";
  const source = world.log(
    `${speaker.name}对${observer.name}关于${topic}的话题只做了简短回应，没有展开。`,
    "brief_reply", [speaker.id, observer.id], [speaker.last, observer.last],
    { ...context, topic, reason: "简短回应是双方实际经历的交流；回应背后的原因没有在当时说出口" }, 2,
  );
  speaker.accounts.push({ kind: "brief_reply", sourceEvent: source, text: account, evidence: speaker.last ? [speaker.last] : [] });
  world.remember(speaker, source);
  world.remember(observer, source);
  if (observer.beliefs.some((b) => b.kind === "brief_reply" && b.subject === speaker.id && b.status === "unresolved")) return null;
  const confidence = clamp(0.33 + observer.sensitive * 0.33 - observer.rel[speaker.id].trust * 0.004
    + world.sample("interpretation", world.tick, observer.id, speaker.id) * 0.08, 0.15, 0.92);
  if (confidence < 0.58) return null;
  const belief: Belief = {
    id: `reply-${source}-${observer.id}`, kind: "brief_reply", subject: speaker.id,
    claim: `${speaker.name}可能不太想理自己`, confidence, status: "unresolved",
    sourceEvent: source, evidence: [source], ...context, createdTick: world.tick, updatedTick: world.tick,
  };
  observer.beliefs.push(belief);
  return belief;
}

// The listener reads their own belief; the speaker supplies only their own account.
// A repeated explanation never counts as independent evidence a second time.
export function explainBelief(world: World, listener: AgentState, speaker: AgentState) {
  if (listener.loc !== speaker.loc || (listener.loc === 0 && world.rooms[listener.id] !== world.rooms[speaker.id])) return false;
  if (speaker.energy < 20) return false;
  const candidate = listener.beliefs
    .filter((b) => b.subject === speaker.id && b.status === "unresolved" && !b.explanationEvent)
    .map((belief) => ({ belief, account: speaker.accounts.find((a) => a.kind === belief.kind &&
      (belief.kind === "absence" ? a.planId === belief.planId : a.sourceEvent === belief.sourceEvent)) }))
    .find((entry) => entry.account);
  if (!candidate?.account) return false;
  const { belief, account } = candidate;
  const willingness = 0.45 + speaker.ext * 0.3 + speaker.rel[listener.id].trust * 0.003;
  if (world.sample("explanation", world.tick, speaker.id, belief.id) > willingness) return false;
  const explanation = world.log(
    `${listener.name}问起之前的事，${speaker.name}解释：“${account.text}。”`,
    "explanation", [listener.id, speaker.id], [belief.sourceEvent, ...account.evidence],
    { beliefId: belief.id, planId: belief.planId, taskId: belief.taskId, activityId: belief.activityId, sourceEvent: belief.sourceEvent,
      reason: "两人实际相遇后，当事人主动说出了自己记得的原因；对方仍可保留疑虑" }, 3,
  );
  belief.explanationEvent = explanation;
  const previousConfidence = belief.confidence;
  const credibility = clamp(0.4 + listener.rel[speaker.id].trust / 130 - listener.sensitive * 0.12, 0.06, 0.65);
  belief.confidence = clamp(belief.confidence - credibility, 0.05, 0.95);
  belief.status = belief.confidence < 0.45 ? "revised" : "unresolved";
  belief.updatedTick = world.tick;
  belief.resolution = belief.status === "revised"
    ? `听到${speaker.name}的解释后，愿意重新理解当时的回应`
    : `听过${speaker.name}的解释，但暂时仍有疑虑`;
  const id = world.log(
    `${listener.name}${belief.status === "revised" ? "重新考虑了原来的猜测，愿意给这件事另一种解释" : "听到了原因，但还没有完全放下原来的疑虑"}。`,
    belief.status === "revised" ? "repair" : "belief_revised", [listener.id], [explanation, ...belief.evidence],
    { beliefId: belief.id, planId: belief.planId, taskId: belief.taskId, activityId: belief.activityId, sourceEvent: belief.sourceEvent,
      claim: belief.claim, confidence: belief.confidence, previousConfidence,
      reason: "人物按自己对说话者的信任更新判断，解释没有自动恢复整段关系" }, 3,
  );
  belief.evidence.push(explanation, id);
  if (belief.status === "revised") {
    listener.rel[speaker.id].aff = clamp(listener.rel[speaker.id].aff + 3, -100);
    listener.rel[speaker.id].trust = clamp(listener.rel[speaker.id].trust + 2, -100);
  }
  world.remember(listener, explanation);
  world.remember(speaker, explanation);
  world.remember(listener, id);
  listener.interaction = belief.status === "revised" ? "开始重新理解之前的事" : "听过解释，仍有些犹豫";
  speaker.interaction = "说出了之前没说清的原因";
  return true;
}
