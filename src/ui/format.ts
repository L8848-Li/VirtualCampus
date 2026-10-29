import { slots } from "../core/config.ts";
import type {
  EventType,
  Relation,
  CampusEvent,
  EventFilter,
} from "../core/types.ts";
export const clock = (tick: number) =>
  `第 ${Math.min(42, Math.floor(tick / 4) + 1)} 天 · ${slots[tick % 4]}`;
export const labels: Record<EventType, string> = {
  holiday_departed: '短暂离校', holiday_returned: '返校',
  course_catalog: "公开选课", course_selected: "选课成功", course_selection_failed: "选课未成功",
  club_joined: "加入社团", club_left: "退出社团", club_meeting: "社团活动", club_meeting_cancelled: "社团活动取消", club_project_rejected: "场地预约失败",
  festival_visit: "校园美食节",
  living_meal: "模拟餐费",
  living_work: "兼职完成",
  living_support_accepted: "获得支持",
  living_support_unavailable: "求助未成",
  living_delivery_paid: "模拟订餐支出",
  library_waitlisted: "图书候补",
  library_hold_notified: "候补到书",
  library_hold_expired: "候补过期",
  library_wait_cancelled: "取消候补",
  parcel_arrived: "包裹到达",
  parcel_overdue: "包裹逾期",
  parcel_collected: "包裹领取",
  laundry_started: "开始洗衣",
  laundry_waiting: "等待洗衣机",
  laundry_collected: "取回衣物",
  delivery_ordered: "食堂订餐",
  delivery_ready: "订餐送达",
  delivery_collected: "取餐用餐",
  delivery_expired: "订餐错过",
  library_print: "自助文印",
  dorm_borrow: "室友借物",
  dorm_declined: "借物婉拒",
  dorm_return: "归还物品",
  dorm_routine_agreed: "室友作息商量",
  dorm_routine_declined: "室友作息商量",
  between_classes: "课间片段",
  quiz_result: "阶段测验",
  schedule_changed: "课程调整",
  exam_deferred: "模拟缓考",
  exam_taken: "参加考试",
  exam_missed: "未参加考试",
  exam_result: "成绩公布",
  restaurant_alternative: "更换餐厅",
  restaurant_wait: "食堂排队",
  library_borrow: "借阅图书",
  library_return: "归还图书",
  library_unavailable: "暂未借到",
  library_room_reserved: "预约研讨间",
  library_room_rejected: "预约未成功",
  library_room_used: "研讨间使用",
  library_room_missed: "预约未到场",
  homework_assigned: "课程作业",
  homework_progress: "作业进展",
  homework_completed: "作业完成",
  homework_expired: "作业截止",
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
  research_experiment_failed: "实验需要重试",
  research_stage: "科研阶段",
  research_feedback: "组会反馈",
  research_meeting_missed: "缺席组会",
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
