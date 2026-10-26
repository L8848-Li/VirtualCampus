import { slots } from "../core/config.ts";
import type {
  EventType,
  Relation,
  CampusEvent,
  EventFilter,
} from "../core/types.ts";
export const clock = (tick: number) =>
  `第 ${Math.min(7, Math.floor(tick / 4) + 1)} 天 · ${slots[tick % 4]}`;
export const labels: Record<EventType, string> = {
  friendship: "新默契",
  crush: "心动",
  misunderstanding: "误解",
  repair: "澄清",
  rivalry: "竞争",
  invitation: "邀约",
  accepted: "接受",
  declined: "婉拒",
  missed: "擦肩",
  action: "日常",
  intervention: "环境",
  summary: "手记",
  system: "开始",
  plan_started: "小计划",
  plan_proposed: "饭约提议",
  plan_accepted: "约好了",
  plan_declined: "婉拒饭约",
  plan_waiting: "等待",
  plan_fulfilled: "兑现",
  plan_cancelled: "改了安排",
  plan_expired: "错过约定",
  task_announced: "共同事务",
  task_progress: "一起整理",
  task_completed: "共同完成",
  task_expired: "截止了",
  brief_reply: "一句短答",
  belief_formed: "心里的猜测",
  explanation: "当面解释",
  belief_revised: "仍有疑虑",
  activity_proposed: "一个小愿望",
  activity_invited: "邀请伙伴",
  activity_accepted: "答应参加",
  activity_declined: "这次不参加",
  activity_progress: "认真筹备",
  activity_held: "小聚办成了",
  activity_cancelled: "这次没办成",
};
export const relationLabel = (r: Relation) =>
  r.crush > 0
    ? "悄悄在意"
    : r.aff < -6
      ? "有些紧张"
      : r.aff >= 25
        ? "越来越亲近"
        : r.aff > 0
          ? "渐渐熟悉"
          : "尚待相识";
export function filterEvents(
  events: CampusEvent[],
  filter: EventFilter,
  selected: number,
  watched: number[],
) {
  return events
    .filter(
      (e) =>
        filter === "all" ||
        (filter === "important" && e.importance >= 3) ||
        (filter === "selected" && e.people.includes(selected)) ||
        (filter === "watched" && e.people.some((id) => watched.includes(id))) ||
        (filter === "stories" &&
          [
            "friendship",
            "crush",
            "misunderstanding",
            "repair",
            "rivalry",
            "invitation",
            "accepted",
            "declined",
            "missed",
            "plan_started",
            "plan_proposed",
            "plan_accepted",
            "plan_declined",
            "plan_waiting",
            "plan_fulfilled",
            "plan_cancelled",
            "plan_expired",
            "task_progress",
            "task_completed",
            "task_expired",
            "brief_reply",
            "belief_formed",
            "explanation",
            "belief_revised",
            "activity_proposed",
            "activity_invited",
            "activity_accepted",
            "activity_declined",
            "activity_progress",
            "activity_held",
            "activity_cancelled",
          ].includes(e.type)),
    )
    .slice()
    .reverse();
}
