import type { Belief, CampusEvent, WorldSnapshot } from "./types.ts";

export interface StoryCard {
  id: string;
  kind: "task" | "appointment" | "activity" | "relationship";
  title: string;
  status: string;
  active: boolean;
  people: number[];
  events: CampusEvent[];
  facts: CampusEvent[];
  perspectives: { person: number; belief: Belief }[];
  summary: string;
  next: string;
  updatedTick: number;
  dueTick?: number;
}

type StoryWorld = Pick<WorldSnapshot, "tick" | "npcs" | "events" | "tasks" | "activities">;
const opinionTypes = new Set(["misunderstanding", "belief_formed", "belief_revised", "repair"]);
const outcomeTypes = new Set(["task_completed", "task_expired", "plan_fulfilled", "plan_cancelled", "plan_expired", "activity_held", "activity_cancelled"]);

// This read model groups committed events. Reading a story never advances or
// edits the simulation, and character interpretations never become world facts.
export function buildStories(world: StoryWorld): StoryCard[] {
  const groups = new Map<string, { kind: StoryCard["kind"]; title: string; ids: Set<number>; people: Set<number> }>();
  const group = (id: string, kind: StoryCard["kind"], title: string, people: number[] = []) => {
    if (!groups.has(id)) groups.set(id, { kind, title, ids: new Set(), people: new Set(people) });
    return groups.get(id)!;
  };
  for (const task of world.tasks) group(task.id, "task", task.title, task.members);
  for (const activity of world.activities)
    group(activity.id, "activity", `${world.npcs[activity.organizer].name}的${activity.title}`, [activity.organizer, ...activity.members]);
  const beliefKeys = new Map<string, string>();
  for (const n of world.npcs) for (const belief of n.beliefs) {
    const key = belief.activityId || belief.taskId || belief.planId || `relationship-${Math.min(n.id, belief.subject)}-${Math.max(n.id, belief.subject)}`;
    beliefKeys.set(belief.id, key);
    const g = group(key, belief.activityId ? "activity" : belief.taskId ? "task" : belief.planId ? "appointment" : "relationship",
      belief.planId ? `${n.name}与${world.npcs[belief.subject].name}的饭约`
        : `${world.npcs[Math.min(n.id, belief.subject)].name}与${world.npcs[Math.max(n.id, belief.subject)].name}，那些没说清的话`, [n.id, belief.subject]);
    for (const id of [belief.sourceEvent, ...belief.evidence]) g.ids.add(id);
  }
  for (const event of world.events) {
    const { planId, taskId, activityId, beliefId } = event.data;
    const key = activityId || taskId || (planId?.startsWith("meal-") ? planId : undefined) || (beliefId ? beliefKeys.get(beliefId) : undefined);
    if (!key) continue;
    const g = group(key, "appointment", `${event.people.map((id) => world.npcs[id].name).join("与")}的饭约`);
    g.ids.add(event.id);
    for (const id of event.people) g.people.add(id);
  }
  const cards: StoryCard[] = [];
  for (const [id, g] of groups) {
    const events = [...g.ids].sort((a, b) => a - b).map((eventId) => world.events[eventId - 1]).filter((e): e is CampusEvent => !!e);
    const perspectives = world.npcs.flatMap((n) => n.beliefs
      .filter((b) => beliefKeys.get(b.id) === id).map((belief) => ({ person: n.id, belief })))
      .sort((a, b) => b.belief.updatedTick - a.belief.updatedTick);
    const unresolved = perspectives.some((p) => p.belief.status === "unresolved");
    let status = "还有话没说清", active = unresolved, next = "下一次相遇时，他们会愿意问清楚吗？";
    let dueTick: number | undefined;
    if (g.kind === "task") {
      const task = world.tasks.find((t) => t.id === id)!;
      dueTick = task.deadline;
      active = task.status === "open" || unresolved;
      status = task.status === "open" ? "一起推进中" : unresolved ? "事有结果，心有疑问" : task.status === "completed" ? "共同完成" : "错过截止";
      next = task.status === "open" ? `资料已整理 ${task.progress}/${task.required}。接下来谁会腾出时间？`
        : unresolved ? "报告有了结果，但相处中仍有没说清的话。他们会找到重新理解彼此的机会吗？"
          : task.status === "completed" ? "作品已经完成，每个人实际投入的时间都留在经过里。" : "报告没能如期完成，这次经历会留在组员的记忆里。";
    } else if (g.kind === "activity") {
      const activity = world.activities.find((a) => a.id === id)!;
      dueTick = activity.dueTick;
      active = activity.status === "preparing" || unresolved;
      status = activity.status === "preparing" ? "从愿望到准备" : unresolved ? "小聚之后，各有理解" : activity.status === "held" ? "小聚办成了" : "这次没办成";
      next = activity.status === "preparing" ? `准备 ${activity.progress}/${activity.required}，${activity.members.length} 人答应参加。到时候会有谁来？`
        : unresolved ? "活动告一段落，有人仍惦记着当时的一句话。下一次相遇会带来新的理解吗？"
          : activity.status === "held" ? `${activity.attendees.length} 人实际到场，一次小愿望有了共同的回忆。`
          : "准备和到场都有各自的难处。这次没有办成，也是一段真实经历。";
    } else if (g.kind === "appointment") {
      dueTick = events.find((e) => e.data.dueTick !== undefined)?.data.dueTick;
      const fulfilled = events.some((e) => e.type === "plan_fulfilled");
      const accepted = events.some((e) => e.type === "plan_accepted");
      const declined = events.some((e) => e.type === "plan_declined");
      const expired = events.some((e) => e.type === "plan_expired");
      const cancelled = new Set(events.filter((e) => e.type === "plan_cancelled").flatMap((e) => e.people));
      active = unresolved || (accepted && !fulfilled && dueTick !== undefined && world.tick <= dueTick + 1 && cancelled.size < 2);
      status = unresolved ? "错过后，各有理解" : fulfilled ? "约定兑现" : declined ? "这次没约成" : active ? "记着这次约定" : "各自改了安排";
      next = unresolved ? "有人仍在猜测这次错过的原因。他们会有机会谈起它吗？"
        : fulfilled ? "两人确实见到了彼此，这次约定有了落点。"
          : declined ? "一次拒绝不等于关系破裂，各自还有自己的安排。"
            : expired || cancelled.size ? "改变安排的原因留在各自的经历里，只有交流才能让对方知道。"
              : "他们会按约定到场，还是被别的事情绊住？";
    } else if (!unresolved) {
      status = "开始重新理解";
      next = "听到解释后，人物调整了判断；关系还会随以后的相处慢慢变化。";
    }
    const facts = events.filter((e) => e.type !== "action" && !opinionTypes.has(e.type));
    const outcome = facts.filter((e) => outcomeTypes.has(e.type)).at(-1);
    const question = perspectives.find((p) => p.belief.status === "unresolved");
    const source = question ? world.events[question.belief.sourceEvent - 1] : undefined;
    const chosenFacts = new Map<number, CampusEvent>();
    for (const fact of [outcome, source, facts.at(-1), ...facts.slice().reverse()]) {
      if (fact && !opinionTypes.has(fact.type) && chosenFacts.size < 3) chosenFacts.set(fact.id, fact);
    }
    const latestMilestone = events.filter((e) => e.type !== "action" && !["friendship", "crush", "rivalry", "brief_reply"].includes(e.type)).at(-1);
    cards.push({ id, kind: g.kind, title: g.title, status, active, people: [...g.people].sort((a, b) => a - b),
      events: events.filter((e) => e.type !== "action"),
      facts: [...chosenFacts.values()].sort((a, b) => a.id - b.id),
      summary: question ? `${world.npcs[question.person].name}仍在想：${question.belief.claim}。`
        : latestMilestone?.text || events.at(-1)?.text || next,
      perspectives, next, dueTick, updatedTick: events.at(-1)?.tick ?? 0 });
  }
  return cards.sort((a, b) => Number(b.active) - Number(a.active) || b.updatedTick - a.updatedTick || a.id.localeCompare(b.id));
}
