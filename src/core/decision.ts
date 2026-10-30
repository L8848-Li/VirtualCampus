import { examFor } from "./assessment.ts";
import { isPrivateDorm, menuPreference, weeklyMenu } from "./campusLife.ts";
import { JOBS } from "./livingExperiment.ts";
import { courseAt, labAt } from "./academics.ts";
import { active } from "./plans.ts";
import { isSpringCampusDay, springCampusDay } from "./calendar.ts";
import { foodFestivalOption } from "./foodFestival.ts";
import type {
  AgentState,
  DecisionContext,
  ActionOption,
  ScoredAction,
  Knowledge,
} from "./types.ts";
import { clamp } from './math.ts';
export { clamp } from './math.ts';
// Only the agent's own state, recent observations and public environment enter
// this policy. It cannot inspect another agent's current position or needs.
export function chooseAction(
  n: AgentState,
  context: DecisionContext,
  random: () => number,
) {
  const { tick, slot, party, memories, roommates } = context;
  const dorm = context.dorm ?? 0;
  const options: ActionOption[] = [
    {
      loc: dorm,
      action: "休息",
      base: (100 - n.energy) * 0.95 + (slot === 3 ? 28 : 0),
      reason: "恢复精力，夜晚更想回宿舍",
    },
    {
      loc: 2,
      action: "吃饭",
      base: n.hunger + (slot === 1 ? 8 : 0) - Math.max(0, (context.crowding?.[2] || 0) - 4) * 2,
      reason: (context.crowding?.[2] || 0) > 4 ? "饥饿与饭点吸引吃饭；上时段的人数较多" : "饥饿与饭点提高了吃饭的吸引力",
    },
    {
      loc: 1,
      base: (courseAt(tick, n.id, context.courseIds) ? 82 : 2) + n.ambition * 20,
      reason: courseAt(tick, n.id, context.courseIds) ? `课表安排了两节${courseAt(tick, n.id, context.courseIds)!.name}，也要考虑自己的状态` : n.education === "graduate" ? "想去教学楼整理研究笔记" : "想去教学楼整理笔记",
      action: courseAt(tick, n.id, context.courseIds) ? `上${courseAt(tick, n.id, context.courseIds)!.name}` : n.education === "graduate" ? "整理研究笔记" : "整理课堂笔记",
    },
    {
      loc: 3,
      action: "自习",
      base: 24 + n.ambition * 24 + (n.goal === "争取奖学金" ? 14 : 0),
      reason: "进取心与学业目标推动自习",
    },
    {
      loc: 4,
      action: party && isSpringCampusDay(tick) ? `逛${springCampusDay.name}` : "参加社团",
      base: 16 + n.social * 0.5 + n.ext * 17 + (party ? 48 : 0),
      reason: party
        ? isSpringCampusDay(tick) ? "虚构春日开放午后有社团展示，可以自主选择前往" : "社团开放日提供了一次相遇机会"
        : "社交需求与兴趣推动参加社团",
    },
  ];
  if (n.education === "graduate" && tick < 112 && tick % 28 === 10) {
    options.push({ loc: n.id % 2 === 0 ? 12 : 18, action: "参加科研研讨", kind: "seminar",
      base: 83 + n.ambition * 20, reason: "虚构的每周研讨安排，仍由本人决定是否前往" });
  }
  for (const club of context.clubs || []) {
    if (!club.member && tick % 28 < 8 && tick < 140 && tick % 7 === n.id % 7) options.push({
      loc: 4, action: `申请加入${club.name}`, kind: "club_join", activityId: club.id,
      base: 82 + n.ext * 12 + n.social * 0.2 - (n.energy < 48 || n.hunger > 65 ? 35 : 0), reason: "公开招新期间，结合自己的兴趣和状态自主申请" });
    if (club.member && tick % 28 === club.meetingSlot) options.push({
      loc: club.meetingLocation, action: `参加${club.name}活动`, kind: "club_meeting", activityId: club.id,
      base: 110 + n.ext * 10 + n.social * 0.2 - (n.energy < 48 || n.hunger > 65 ? 35 : 0), reason: "公开的每周活动可自主选择参加" });
    if (club.member && club.canPropose && tick < 120 && tick % 28 === 11 && n.energy > 50 && n.hunger < 60) options.push({
      loc: 4, action: `为${club.name}提议作品`, kind: "club_propose", activityId: club.id,
      base: 90 + n.ambition * 15, reason: "有兴趣为社团提议跨周作品，仍需参与者和实际筹备" });
    if (club.member && tick > 30 && tick % 28 === 8 && n.social < 15 && n.energy < 45) options.push({
      loc: 4, action: `退出${club.name}`, kind: "club_leave", activityId: club.id,
      base: 32, reason: "本人想减少活动安排" });
  }
  const festivalOption = foodFestivalOption(n, tick);
  if (festivalOption) options.push(festivalOption);
  options.push(
    { loc: 6, action: "吃风味餐", base: n.hunger - 5 + (slot === 1 ? 8 : 0) - Math.max(0, (context.crowding?.[6] || 0) - 4) * 2, reason: (context.crowding?.[6] || 0) > 4 ? "想换个餐厅吃饭；上时段的人数较多" : "想换个餐厅吃饭" },
    { loc: 7, action: "在运动场活动", base: 27 + n.social * 0.4 + n.ext * 18 + (slot === 2 ? 14 : 0), reason: "想活动身体，也许能遇见同学" },
    { loc: 8, action: "在实验楼练习", base: 29 + n.ambition * 30 + (n.interest === "机器人制作" ? 16 : 0), reason: "想用实践巩固所学" },
    { loc: 9, action: "在智慧教学楼自习", base: 38 + n.ambition * 30, reason: "想找一处安静的学习空间" },
    { loc: 10, action: "在理学楼学习", base: 34 + n.ambition * 30 + (n.interest === "数学谜题" ? 14 : 0), reason: "想花时间思考学习问题" },
    { loc: 11, action: "到综合办公楼办事", base: 28 + (tick % 7 === n.id % 7 ? 32 : 0), reason: "抽空处理校园事务" },
    { loc: 12, action: "在科研楼查阅资料", base: 32 + n.ambition * 30 + (n.interest === "机器人制作" ? 16 : 0), reason: "想为学习和项目查阅资料；科研楼为游戏中的已启用建筑" },
    { loc: 13, action: "去北区餐厅吃饭", base: n.hunger - 5 + (slot === 1 ? 8 : 0) + (n.loc === 5 || n.loc === 12 || n.loc === 14 ? 14 : 0) - Math.max(0, (context.crowding?.[13] || 0) - 4) * 2, reason: "根据饥饿、自己先前的位置和餐厅上时段人数选择北区餐厅" },
    { loc: 14, action: "在学院实验楼练习", base: 29 + n.ambition * 30 + (n.interest === "机器人制作" ? 18 : 0), reason: "想在学院实验空间练习" },
    { loc: 15, action: "在体育馆运动", base: 25 + n.social * 0.4 + n.ext * 18 + (slot === 2 ? 14 : 0) + (context.weather === "小雨" ? 12 : 0), reason: context.weather === "小雨" ? "下雨时考虑室内活动" : "想在室内活动身体" },
    { loc: 16, action: "在研究生公寓公共空间学习", base: 30 + n.ambition * 26 + (n.id % 3 === 1 ? 12 : 0) + (tick % 28 === ((n.id + 2) % 7) * 4 + 2 ? 36 : 0), reason: "想换个公共空间学习；此处不模拟进入私人宿舍" },
    { loc: 17, action: "在学生宿舍 IV 区公共空间学习", base: 29 + n.ambition * 25 + (n.id % 3 === 2 ? 13 : 0) + (tick % 28 === ((n.id + 4) % 7) * 4 + 2 ? 36 : 0), reason: "想在宿舍区公共学习空间整理资料；此处不模拟进入私人宿舍" },
    { loc: 18, action: "在智能工程学院楼练习", base: 29 + n.ambition * 30 + (n.interest === "机器人制作" ? 19 : 0), reason: "想在学院楼练习项目技能" },
    { loc: 19, action: "在南侧运动场活动", base: 25 + n.social * 0.4 + n.ext * 18 + (slot === 2 ? 14 : 0) + (tick % 28 === ((n.id + 1) % 7) * 4 + 2 ? 30 : 0), reason: "想在南侧运动场活动身体" },
  );
  if (slot === 3 && tick % 7 === n.id % 7 && !context.laundry) options.push({ loc: dorm, action: "整理宿舍和洗衣", kind: "laundry_start", base: 68 + (100 - n.energy) * 0.35, reason: "想趁晚上处理自己的生活事务" });
  if (context.parcel) options.push({ loc: 4, action: "取快递", kind: "parcel_pickup", base: 72 + n.ext * 10 + Math.min(28, Math.max(0, tick - context.parcel.arrivedTick) * 1.5) - (n.energy < 35 || n.hunger > 70 ? 30 : 0), reason: "收到包裹通知，想前往取件点领取；疲惫或饥饿时先照顾自己", evidence: [context.parcel.lastEvent] });
  if (context.laundry && tick > context.laundry.startedTick) options.push({ loc: context.laundry.dorm, action: "取回洗好的衣物", kind: "laundry_pickup", base: 72 + Math.min(15, tick - context.laundry.startedTick), reason: "记得衣物仍在原楼洗衣机，需要本人回去领取", evidence: [context.laundry.lastEvent] });
  if (context.delivery?.status === 'ready' && tick <= context.delivery.expiresTick) {
    options.push({ loc: context.delivery.dorm, action: '到宿舍楼下取订餐', kind: 'delivery_pickup', base: n.hunger + 25,
      reason: '自己的订餐已送到楼下，可以选择取餐；仍需兼顾其他安排', evidence: context.delivery.lastEvent ? [context.delivery.lastEvent] : [] });
  }
  if (context.living) {
    const state = context.living;
    options[0].base += state.stress * 0.45;
    options[0].reason += '；压力较高时也会考虑休息';
    if (slot === 2 && tick % 7 === n.id % 7) for (const job of JOBS) {
      options.push({ loc: job.location, action: job.name, kind: 'part_time', base: 68 + Math.max(0, 30 - state.balance) * 1.5 - (n.energy < 40 || n.hunger > 70 ? 35 : 0), reason: '考虑自己的模拟余额，兼职需要本人到场并消耗精力' });
    }
    if (state.stress >= 15) {
      for (const [id, known] of Object.entries(n.known)) {
        const target = Number(id);
        if (n.rel[target].trust < 4 || known.missed || tick - known.tick > 3 || (isPrivateDorm(known.loc) && (!context.roommates.includes(target) || known.loc !== dorm))) continue;
        options.push({ loc: known.loc, action: '向熟人求助', kind: 'living_support', target, base: 60 + state.stress * 0.8, reason: '希望向熟人主动求助，记得对方曾在此出现，但不保证遇见或获得同意', evidence: [known.event] });
      }
    }
  }
  const exam = examFor(context.assessments || [], tick, n.id);
  if (exam) options.push({ loc: 1, action: `参加${exam.title}${exam.status === "failed" ? "补考" : exam.status === "deferred" ? "缓考" : ["retake_needed", "missed"].includes(exam.status) ? "重修考试" : "考试"}`,
    kind: "exam", courseId: exam.courseId, base: 96 + n.ambition * 20, reason: "个人考表安排了考试，仍需本人选择前往" });
  if (exam && exam.status === "scheduled" && n.energy < 28) options.push({ loc: dorm, action: `申请${exam.title}缓考`,
    kind: "defer_exam", courseId: exam.courseId, base: 120 + (28 - n.energy), reason: "精力不足，申请虚构场景中的缓考" });
  for (const record of context.assessments || []) if (["retake_needed", "missed"].includes(record.status) && tick >= 152 && tick < record.retakeTick) {
    options.push({ loc: 3, action: `复习${record.title}重修课程`, kind: "retake_study", courseId: record.courseId,
      base: 43 + n.ambition * 26 + Math.max(0, 6 - (record.retakeTick - tick)) * 3, reason: "此前未通过，计划为重修重新学习" });
  }
  const lab = labAt(tick, n.id, context.courseIds);
  if (lab) options.push({ loc: n.id % 6 === 0 ? 14 : n.id % 6 === 2 ? 18 : 8, action: `参加${lab.name}实验`, kind: "lab", base: 70 + n.ambition * 18,
    reason: "个人课表中安排了实验，仍会考虑疲劳与其他约定" });
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
    const urgency = Math.max(0, 8 - (task.deadline - tick)) * 3.6;
    options.push({
      loc: task.location,
      action: task.id.startsWith("research-") ? "推进科研课题" : "整理小组报告资料",
      kind: "task",
      taskId: task.id,
      base:
        (task.research ? 58 - (n.energy < 48 || n.hunger > 65 ? 30 : 0) : 28) + (task.research?.feedback === "建议复核" ? 4 : 0) + n.ambition * 24 + (n.goal === "争取奖学金" ? 22 : 10) + urgency +
        (context.library?.reservations.some((item) => item.taskId === task.id && item.organizer === n.id && item.status === "reserved" && item.dueTick === tick) ? 28 : 0),
      reason: `${task.title}的${task.research?.stage || "资料"}还需要推进，临近截止会提高优先级`,
      evidence: [task.lastEvent],
    });
  }
  if (context.library) {
    const loan = context.library.loans.find((item) => item.owner === n.id && item.returnedTick === null);
    const wait = context.library.waitlist.find((item) => item.owner === n.id && (item.status === 'waiting' || item.status === 'notified'));
    if (loan && tick >= loan.borrowedTick + 3) {
      options.push({ loc: 3, action: "归还图书", kind: "library_return",
        base: 42 + Math.max(0, tick - loan.dueTick + 3) * 8, reason: "记得自己借过的书，想找时间归还", evidence: [loan.lastEvent] });
    } else if (!loan && wait?.status === 'notified') {
      options.push({ loc: 3, action: '领取候补图书', kind: 'library_borrow', base: 76 + n.ambition * 10 + Math.max(0, 4 - (wait.expiresTick! - tick)) * 3, reason: '收到候补到书通知，可在期限内自行到馆借阅', evidence: [wait.lastEvent] });
    } else if (!loan && !wait && tick >= 2 && tick < 19 && !context.library.loans.some((item) => item.owner === n.id)) {
      options.push({ loc: 3, action: "借阅图书", kind: "library_borrow",
        base: 65 + n.ambition * 20 + (n.interest.includes("书") ? 12 : 0) - (n.energy < 35 || n.hunger > 70 ? 30 : 0), reason: "想借一本书，带回去慢慢读；疲惫或饥饿时先照顾自己" });
    }
    if (wait && tick - wait.createdTick > 20) options.push({ loc: n.loc, action: '取消图书候补', kind: 'library_cancel', base: 30, reason: '候补等待较久，考虑取消', evidence: [wait.lastEvent] });
    const task = (context.tasks || []).find((item) => item.id.startsWith("report-") && item.status === "open" && item.members.includes(n.id));
    if (task && tick < task.deadline && tick < 111 && !context.library.reservations.some((item) => item.taskId === task.id && item.organizer === n.id)) {
      options.push({ loc: 3, action: "预约小组研讨间", kind: "library_book_room", taskId: task.id,
        base: 49 + n.ambition * 24 + Math.max(0, 6 - (task.deadline - tick)) * 2,
        reason: "小组报告需要讨论，想预约下一时段的研讨间", evidence: [task.lastEvent] });
    }
  }
  for (const homework of context.homework || []) {
    if (homework.status !== "open" || homework.owner !== n.id) continue;
    const urgency = Math.max(0, 10 - (homework.deadline - tick)) * 2.4;
    options.push({ loc: n.id % 2 ? 8 : 3, action: "完成课程练习", kind: "homework", homeworkId: homework.id,
      base: 41 + n.ambition * 25 + urgency, reason: `${homework.title}还未完成，临近截止会提高优先级`, evidence: [homework.lastEvent] });
  }
  // Offers are copied from invitations this agent actually received. They do
  // not expose the live whereabouts, choices or private knowledge of guests.
  for (const activity of context.activities || []) {
    if (!activity.accepted || tick > activity.dueTick) continue;
    if (tick === activity.dueTick) {
      options.push({ loc: 4, action: `参加${activity.title}`, kind: "activity_attend", activityId: activity.activityId,
        base: 43 + n.social * 0.48 + (n.id === activity.organizer ? 36 : 18) + n.ext * 12,
        reason: "记得自己答应过的活动时间，愿意为共同的兴趣留出一个午后",
        evidence: [activity.sourceEvent] });
    } else if (activity.ownPreparation < activity.preparationGoal) {
      options.push({ loc: activity.preparationLocation ?? 4, action: `筹备${activity.title}`, kind: "activity_prepare", activityId: activity.activityId,
        base: (n.id === activity.organizer ? 100 : 62) + n.social * 0.2 + n.ext * 10
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
    if (isPrivateDorm(knowledge.loc) && (!roommates.includes(target) || knowledge.loc !== dorm)) continue;
    const evidence = memories
      .filter((e) => e.people.includes(target))
      .map((e) => e.id);
    if (relation.aff >= 7 || relation.crush > 0) {
      options.push({
        loc: knowledge.loc,
        action: "找熟人一起度过时段",
        kind: "seek",
        target,
        base: Math.min(95,
          22 +
          n.social * 0.48 +
          Math.max(0, relation.aff) * 0.6 +
          Math.max(0, relation.trust) * 0.15 +
          relation.crush * 0.2),
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
    if ((o.loc === 2 || o.loc === 6 || o.loc === 13) && (o.action === '吃饭' || o.action === '吃风味餐' || o.action === '去北区餐厅吃饭')) {
      o.base += menuPreference(n, tick, o.loc);
      o.reason += `；本周公开菜单标签为${weeklyMenu(tick, o.loc)}`;
    }
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
    o.exhaustion = o.kind && o.kind !== 'delivery_pickup' && n.energy < 25 ? 38 : 0;
    o.urgentMeal = o.kind && o.kind !== 'delivery_pickup' && n.hunger > 78 && o.loc !== 2 && o.loc !== 6 && o.loc !== 13 ? 30 : 0;
    const honors =
      plan &&
      tick >= plan.dueTick &&
      (plan.kind === "appointment"
        ? o.kind === "appointment" && o.target === plan.target
        : o.kind === "task" && o.taskId === plan.taskId);
    o.commitment = honors || o.kind === "activity_attend" ? 26 : 0;
    o.switching = plan && tick >= plan.dueTick && !honors ? 9 : 0;
    if (context.weather === "小雨" && (o.loc === 7 || o.loc === 19)) {
      o.base -= 18;
      o.reason += "；下雨降低了去室外运动场的意愿";
    }
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
