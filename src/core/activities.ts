import type { World } from "../engine.ts";
import type { AgentState, CampusActivity } from "./types.ts";
import { invitationDecision } from "./invitations.ts";
import { clamp } from "./decision.ts";

const together = (world: World, a: AgentState, b: AgentState) =>
  a.loc === b.loc && ((a.loc !== 0 && a.loc !== 5) || world.rooms[a.id] === world.rooms[b.id]);

export function inviteToActivity(world: World, activity: CampusActivity, guest: AgentState, parent: number) {
  const organizer = world.npcs[activity.organizer];
  if (activity.status !== "preparing" || world.tick >= activity.dueTick ||
      guest.id === organizer.id || activity.invited.includes(guest.id) || !together(world, organizer, guest)) return;
  const invitation = world.log(
    `${organizer.name}当面邀请${guest.name}参加自己筹办的“${activity.title}”。`,
    "activity_invited", [organizer.id, guest.id], [parent, activity.lastEvent],
    { activityId: activity.id, dueTick: activity.dueTick, location: 4,
      reason: "在实际相处中说出活动的主题和时间；未收到邀请的人不会自动知道" }, 3,
  );
  activity.invited.push(guest.id);
  const anticipated = { ...guest, social: Math.min(100, guest.social + 35), hunger: Math.min(60, guest.hunger) };
  const response = invitationDecision(anticipated, organizer.id,
    () => world.sample("activity-response", activity.id, guest.id));
  const id = world.log(
    response.accepted
      ? `${guest.name}答应来“${activity.title}”，也愿意有空时帮忙准备。`
      : `${guest.name}婉拒了这次活动，想给自己留些时间。`,
    response.accepted ? "activity_accepted" : "activity_declined", [guest.id, organizer.id], [invitation],
    { activityId: activity.id, dueTick: activity.dueTick, reason: response.reason, score: response.score }, 3,
  );
  guest.activityInvitations.push({ activityId: activity.id, title: activity.title, organizer: organizer.id,
    dueTick: activity.dueTick, accepted: response.accepted, sourceEvent: id, preparationGoal: 2 });
  if (response.accepted) activity.members.push(guest.id);
  activity.lastEvent = id;
  world.remember(organizer, invitation);
  world.remember(guest, invitation);
  world.remember(organizer, id);
  world.remember(guest, id);
}

export function considerActivity(world: World, a: AgentState, b: AgentState, parent: number) {
  const encounter = world.events[parent - 1];
  if (!together(world, a, b) || !encounter || !["friendship", "crush"].includes(encounter.type) ||
      !encounter.people.includes(a.id) || !encounter.people.includes(b.id)) return;
  // One personal project in this seven-day prototype. The organizer and outcome
  // emerge from an actual positive encounter, personality, needs and a keyed draw.
  if (!world.activities.length && world.tick >= 4 && world.tick <= 16) {
    for (const organizer of [a, b]) {
      if (organizer.energy < 40 || organizer.hunger > 75) continue;
      const willingness = 0.12 + organizer.ext * 0.3 + (organizer.home === 4 ? 0.24 : 0);
      if (world.sample("activity-idea", world.tick, organizer.id) >= willingness) continue;
      let dueTick = world.tick + 6;
      while (dueTick % 4 !== 2) dueTick++;
      const activityId = `activity-${world.tick}-${organizer.id}`;
      const title = `${organizer.interest}分享会`;
      const id = world.log(
        `${organizer.name}聊起自己的兴趣，决定试着在第 ${Math.floor(dueTick / 4) + 1} 天午后筹办一场“${title}”。`,
        "activity_proposed", [organizer.id], [parent],
        { activityId, dueTick, location: 4, reason: "一次实际的正向相处激发了个人愿望；需要自己准备和邀请伙伴，结果尚未确定" }, 4,
      );
      const activity: CampusActivity = { id: activityId, title, organizer: organizer.id,
        createdTick: world.tick, dueTick, location: 4, status: "preparing", progress: 0, required: 4,
        invited: [], members: [organizer.id], attendees: [], contributions: {}, lastEvent: id };
      world.activities.push(activity);
      organizer.activityInvitations.push({ activityId, title, organizer: organizer.id,
        dueTick, accepted: true, sourceEvent: id, preparationGoal: activity.required });
      world.remember(organizer, id);
      break;
    }
  }
  for (const activity of world.activities) {
    if (activity.organizer === a.id) inviteToActivity(world, activity, b, parent);
    else if (activity.organizer === b.id) inviteToActivity(world, activity, a, parent);
  }
}

export function workActivities(world: World) {
  for (const activity of world.activities) {
    if (activity.status !== "preparing" || world.tick >= activity.dueTick) continue;
    const workers = world.npcs.filter((n) => n.loc === activity.location &&
      n.intent?.kind === "activity_prepare" && n.intent.activityId === activity.id && activity.members.includes(n.id));
    if (!workers.length) continue;
    for (const n of workers) {
      activity.contributions[n.id] = (activity.contributions[n.id] || 0) + 2;
      activity.progress += 2;
      n.energy = clamp(n.energy - 5);
      n.interaction = workers.length > 1 ? "和伙伴一起准备小活动" : "认真准备自己的小活动";
    }
    activity.progress = Math.min(activity.required, activity.progress);
    const id = world.log(
      `${workers.map((n) => n.name).join("、")}为“${activity.title}”准备了材料，进度 ${activity.progress}/${activity.required}。`,
      "activity_progress", workers.map((n) => n.id), [activity.lastEvent, ...workers.map((n) => n.last)],
      { activityId: activity.id, progress: activity.progress, required: activity.required,
        reason: "只有实际选择筹备并来到社团中心的参与者才能推进；接受邀请本身不增加进度" }, 3,
    );
    activity.lastEvent = id;
    for (const n of workers) world.remember(n, id);
  }
}

export function resolveActivities(world: World) {
  for (const activity of world.activities) {
    if (activity.status !== "preparing" || world.tick < activity.dueTick) continue;
    const attendees = world.npcs.filter((n) => n.loc === activity.location &&
      n.intent?.kind === "activity_attend" && n.intent.activityId === activity.id && activity.members.includes(n.id));
    activity.attendees = attendees.map((n) => n.id);
    const held = activity.progress >= activity.required && activity.attendees.includes(activity.organizer) && attendees.length >= 2;
    activity.status = held ? "held" : "cancelled";
    const reason = activity.progress < activity.required ? "材料还没准备好"
      : !activity.attendees.includes(activity.organizer) ? "发起人临时没有到场"
        : "实际到场的人还不够";
    const id = world.log(
      held ? `${attendees.map((n) => n.name).join("、")}真的聚在了一起，“${activity.title}”办成了。`
        : `到了约定时间，“${activity.title}”没有办成：${reason}。`,
      held ? "activity_held" : "activity_cancelled", activity.attendees,
      [activity.lastEvent, ...attendees.map((n) => n.last)],
      { activityId: activity.id, dueTick: activity.dueTick, attendees: activity.attendees,
        reason: held ? "材料准备充足，发起人与至少一位伙伴各自选择到场；关系变化只属于实际参与者" : reason }, 4,
    );
    activity.lastEvent = id;
    // The observer can see the outcome. Only people on site experience it.
    for (const n of attendees) {
      world.remember(n, id);
      n.interaction = held ? "分享了自己的兴趣，也听见别人的故事" : "活动没办成，先与在场的人聊聊";
      if (!held) continue;
      n.social = clamp(n.social - 25);
      for (const other of attendees) {
        if (other.id === n.id) continue;
        n.rel[other.id].aff = clamp(n.rel[other.id].aff + 4, -100);
        n.rel[other.id].trust = clamp(n.rel[other.id].trust + 2, -100);
      }
    }
  }
}
