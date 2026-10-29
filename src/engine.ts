import { enrollStudents, type Enrollment } from "./core/enrollment.ts";
import { createClubs, isClubMember, scheduleClubMeetings, resolveClubChoices } from "./core/clubs.ts";
import { resolveDorm } from "./core/dorm.ts";
import { holiday, chooseHolidayReturn, isOnCampus } from "./core/holiday.ts";
import { createLivingStates, resolveLiving, type LivingState } from "./core/livingExperiment.ts";
import { notifyParcels, resolveParcelLaundry, type Parcel, type Laundry } from "./core/parcelLaundry.ts";
import { advanceMealDelivery, considerMealDelivery, type MealDelivery } from "./core/mealDelivery.ts";
import { springCampusDay } from "./core/calendar.ts";
import { foodFestival, foodFestivalAttendees } from "./core/foodFestival.ts";
import { weatherAt } from "./core/weather.ts";
import { travelMinutes, mealWindows, queueRank, preferredMealWindow, lateness, chooseBreakErrand, dormLocation, isPrivateDorm } from "./core/campusLife.ts";
import { createAssessments, resolveExams } from "./core/assessment.ts";
import { createLibrary, resolveLibrary, advanceLibraryWaitlist } from "./core/library.ts";
import { assignHomework, expireHomework, workHomework } from "./core/homework.ts";
import { courseAt, isLearningAction, labAt } from "./core/academics.ts";
import { active, preparePlans, finishPlan } from "./core/plans.ts";
import { createTasks, expireTasks, workTasks, resolveResearchMeetings } from "./core/tasks.ts";
import * as config from "./core/config.ts";
import { Random, hash } from "./core/random.ts";
import { chooseAction, clamp } from "./core/decision.ts";
import { runSocial } from "./core/social.ts";
import { workActivities, resolveActivities } from "./core/activities.ts";
import type {
  AgentState,
  CampusEvent,
  EventType,
  EventData,
  Intervention,
  InterventionKind,
  LocationId,
  SaveData,
  CampusTask,
  CampusActivity,
  Homework,
  LibraryState,
  Assessment,
} from "./core/types.ts";
const {
  ENGINE_VERSION,
  SCHEMA_VERSION,
  TOTAL_TICKS,
  MAX_INPUTS,
  profiles,
  places,
} = config;
export * from "./core/config.ts";
export type * from "./core/types.ts";
const kinds = ["rooms", "groups", "party"];
export class World {
  declare version: string;
  declare seed: string;
  declare random: Random;
  declare tick: number;
  declare events: CampusEvent[];
  declare inputs: Intervention[];
  declare rooms: number[];
  declare groups: number[];
  declare party: number;
  declare tasks: CampusTask[];
  declare activities: CampusActivity[];
  clubs = createClubs();
  declare homework: Homework[];
  declare library: LibraryState;
  declare assessments: Assessment[];
  declare enrollments: Enrollment[];
  declare deliveries: MealDelivery[];
  declare livingEnabled: boolean;
  declare living: LivingState[];
  declare parcels: Parcel[];
  declare laundry: Laundry[];
  declare environment: Record<InterventionKind, number | null>;
  declare npcs: AgentState[];
  constructor(seed: string | number = "campus-2026", options: { livingEnabled?: boolean } = {}) {
    this.version = ENGINE_VERSION;
    this.seed = String(seed);
    if (!this.seed.length || this.seed.length > 128)
      throw new Error("世界种子应为 1–128 个字符。");
    this.random = new Random(this.seed);
    this.tick = 0;
    this.events = [];
    this.inputs = [];
    this.rooms = Array.from({ length: profiles.length }, (_, i) => Math.floor(i / 2));
    this.groups = Array.from({ length: profiles.length }, (_, i) => i % 3);
    this.party = -1;
    this.environment = { rooms: null, groups: null, party: null };
    this.activities = [];
    this.homework = [];
    this.library = createLibrary();
    this.assessments = createAssessments();
    this.deliveries = [];
    this.livingEnabled = options.livingEnabled === true;
    this.living = [];
    this.parcels = [];
    this.laundry = [];
    this.npcs = profiles.map<AgentState>((p, id) => ({
      id,
      education: p.education ?? "undergraduate",
      name: p.name,
      role: p.role,
      interest: p.interest,
      quirk: p.quirk,
      home: p.home,
      habit: p.habit,
      goal: p.goal,
      ext: clamp(p.ext + (this.rand() - 0.5) * 0.18, 0, 1),
      sensitive: clamp(p.sensitive + (this.rand() - 0.5) * 0.18, 0, 1),
      ambition: clamp(p.ambition + (this.rand() - 0.5) * 0.18, 0, 1),
      energy: 65 + this.rand() * 25,
      hunger: 20 + this.rand() * 25,
      social: 25 + this.rand() * 35,
      progress: 0,
      loc: dormLocation(this.rooms[id]),
      previousLoc: dormLocation(this.rooms[id]),
      action: "整理开学行李",
      why: "新的一周，先熟悉校园",
      interaction: "还没有新的相遇",
      intent: null,
      memory: [],
      known: {},
      rel: Array.from({ length: profiles.length }, () => ({ aff: 0, trust: 0, crush: 0 })),
      last: null,
      plan: null,
      lastPlanTick: -9,
      beliefs: [],
      accounts: [],
      activityInvitations: [],
    }));
    if (this.livingEnabled) this.living = createLivingStates(this.npcs);
    this.log(
      `开学了。${profiles.length} 个人带着各自的习惯，走进了同一座校园。`,
      "system",
      [],
      [],
      { seed: this.seed, engineVersion: ENGINE_VERSION },
      1,
    );
    this.enrollments = enrollStudents(this);
    this.assessments = createAssessments(this.enrollments);
    this.tasks = createTasks(this);

  }
  rand() {
    return this.random.next();
  }
  sample(purpose: string, ...keys: (number | string)[]) {
    return new Random(JSON.stringify([this.seed, purpose, ...keys])).next();
  }
  shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  log(
    text: string,
    type: EventType,
    people: number[] = [],
    parents: (number | null | undefined)[] = [],
    data: EventData = {},
    importance = 1,
  ) {
    const id = this.events.length + 1;
    this.events.push({
      id,
      tick: this.tick,
      text,
      type,
      people,
      parents: [
        ...new Set(
          parents.filter(
            (p): p is number => Number.isInteger(p) && p! > 0 && p! < id,
          ),
        ),
      ],
      data,
      importance,
    });
    return id;
  }
  remember(n: AgentState, id: number) {
    n.last = id;
    const score = (eventId: number) => {
      const e = this.events[eventId - 1];
      return e.importance - (this.tick - e.tick) * 0.16;
    };
    n.memory = [...new Set([id, ...n.memory])]
      .sort((a, b) => score(b) - score(a) || b - a)
      .slice(0, 8);
  }
  environmentParents(loc: LocationId) {
    return [
      isPrivateDorm(loc) ? this.environment.rooms : null,
      loc === 1 ? this.environment.groups : null,
      loc === 4 && this.party === this.tick ? this.environment.party : null,
    ].filter((id): id is number => id !== null);
  }
  intervene(kind: string) {
    if (
      this.tick >= TOTAL_TICKS ||
      !kinds.includes(kind) ||
      this.inputs.length >= MAX_INPUTS
    )
      return false;
    this.inputs.push({ tick: this.tick, kind: kind as InterventionKind });
    let text = "";
    if (kind === "rooms") {
      const undergraduates = this.npcs.filter((n) => n.education === "undergraduate");
      const graduates = this.npcs.filter((n) => n.education === "graduate");
      for (const cohort of [undergraduates, graduates]) {
        const assignments = this.shuffle(cohort.map((n) => this.rooms[n.id]));
        cohort.forEach((n, i) => { this.rooms[n.id] = assignments[i]; });
      }
      // Reassignment represents the move itself for those currently in a
      // dorm. People elsewhere remain where they are until their next choice.
      for (const n of this.npcs) if (isPrivateDorm(n.loc)) {
        n.previousLoc = n.loc;
        n.loc = dormLocation(this.rooms[n.id]);
        n.action = "搬到新宿舍";
        n.why = "宿舍调整时搬入新分配的房间";
        n.interaction = "在新宿舍安顿下来";
        n.intent = null;
      }
      text = "宿舍重排：在宿舍的人已搬到新房间，其他人将在回来后入住。";
    }
    if (kind === "groups") {
      const undergraduates = this.npcs.filter((n) => n.education === "undergraduate");
      const assignments = this.shuffle(undergraduates.map((n) => this.groups[n.id]));
      undergraduates.forEach((n, i) => { this.groups[n.id] = assignments[i]; });
      text = "课程分组更新：一起完成课堂任务的人发生了变化。";
    }
    if (kind === "party") {
      this.party = this.tick;
      text = "社团开放日已准备好，下一时段大家可以自主决定是否参加。";
    }
    this.environment[kind as InterventionKind] = this.log(
      text,
      "intervention",
      [],
      [this.environment[kind as InterventionKind]],
      { kind, rooms: [...this.rooms], groups: [...this.groups] },
      3,
    );
    if (kind === "groups")
      for (const task of this.tasks.filter((item) => item.status === "open" && item.id.startsWith("report-"))) {
        const group = Number(task.id.split("-")[1]);
        task.members = this.npcs.filter((n) => n.education === "undergraduate" && this.groups[n.id] === group).map((n) => n.id);
        const previous = task.lastEvent;
        task.lastEvent = this.log(`${task.title}随课程分组更新了组员，已完成的资料仍然保留。`,
          "task_announced", task.members, [previous, this.environment.groups],
          { reason: "公开的课程分组改变了共同任务的参与人，历史工作仍可追溯", taskId: task.id, progress: task.progress, required: task.required }, 2);
        for (const n of this.npcs.filter((n) => task.members.includes(n.id))) this.remember(n, task.lastEvent);
      }
    return true;
  }
  private recentWait(person: number, earliestTick: number) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      if (event.tick < earliestTick) break;
      if (event.type === 'restaurant_wait' && event.people[0] === person) return event;
    }
    return undefined;
  }
  private previousBreak(person: number) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      if (event.tick < this.tick - 1) break;
      if (event.tick === this.tick - 1 && event.type === 'between_classes' && event.people[0] === person) return event;
    }
    return undefined;
  }
  step() {
    if (this.tick >= TOTAL_TICKS) return false;
    if (this.tick === holiday.announceTick) this.log(
      '模拟短假期即将开始；同学可以自行决定留校或暂时离校，资源仍按原期限处理。',
      'system', [], [], { reason: '虚构短假期，不对应现实校历' }, 3,
    );
    for (const n of this.npcs) {
      if (n.holidayReturnTick !== undefined && this.tick >= n.holidayReturnTick) {
        n.loc = dormLocation(this.rooms[n.id]);
        n.previousLoc = n.loc;
        delete n.holidayReturnTick;
        const event = this.log(`${n.name}结束短假期，回到校园。`, 'holiday_returned', [n.id], [n.last],
          { location: n.loc, reason: '本人按预计时段返校；不模拟校外行程' }, 2);
        this.remember(n, event);
      }
      if (this.tick !== holiday.departTick) continue;
      const returnTick = chooseHolidayReturn(n, (purpose, ...keys) => this.sample(purpose, ...keys));
      if (returnTick === null) continue;
      n.holidayReturnTick = returnTick;
      n.loc = holiday.offCampusLocation;
      n.intent = null;
      const event = this.log(`${n.name}选择短暂离校，计划稍后返校。`, 'holiday_departed', [n.id], [n.last],
        { dueTick: returnTick, reason: '本人自主选择离校；不记录或向他人推测私人目的地' }, 2);
      this.remember(n, event);
    }
    // Decay all needs first. Decisions then use the same pre-movement phase;
    // no earlier agent can leak its new location to the following agent.
    for (const n of this.npcs) {
      if (!isOnCampus(n.loc)) continue;
      n.hunger = clamp(n.hunger + 17);
      n.energy = clamp(n.energy - 12);
      n.social = clamp(n.social + 11);
    }
    // Arrival and expiry happen before choices. A notification is known only
    // by the order owner; it never automatically feeds them.
    for (let i = 0; i < this.deliveries.length; i++) {
      const order = this.deliveries[i];
      if (order.status !== 'ordered' && order.status !== 'ready') continue;
      const person = this.npcs[order.owner];
      const result = advanceMealDelivery(order, this.tick, person.id, person.loc, false);
      this.deliveries[i] = result.order;
      for (const notice of result.notices) {
        const id = this.log(notice.type === 'ready' ? `${person.name}收到订餐送达通知，餐食放在宿舍楼下取餐点。` : `${person.name}的订餐超过领取时段，没能取到。`,
          notice.type === 'ready' ? 'delivery_ready' : 'delivery_expired', [person.id], [result.order.lastEvent],
          { orderId: order.id, location: order.dorm, reason: notice.type === 'ready' ? '送达到楼下不等于已用餐，本人仍需选择取餐' : '超过模拟领取时限，未取餐不会降低饥饿' }, 2);
        result.order.lastEvent = id; this.remember(person, id);
      }
    }
    notifyParcels(this);
    advanceLibraryWaitlist(this);
    scheduleClubMeetings(this);
    if (this.tick > 0 && this.tick < 112 && this.tick % 28 === 0) this.tasks.push(...createTasks(this));
    if (this.tick === springCampusDay.tick) {
      this.party = this.tick;
      this.log('邮邮大学的春日校园开放午后开始了，学生活动中心有社团兴趣展示与作品，大家可以自行决定是否参加。', 'system', [], [],
        { reason: '虚构校园活动；不改变课程安排，也不强制参与', location: 4 }, 3);
    }
    if (this.tick === foodFestival.tick) {
      this.log('学生餐厅北侧举办模拟校园美食节，想逛逛的同学可以自主选择参加。', 'system', [], [],
        { location: foodFestival.location, reason: '虚构学期中的校园活动，开放参加但不强制人物到场' }, 3);
    }
    expireTasks(this);
    expireHomework(this);
    preparePlans(this);
    const decisions = this.npcs.map((n) =>
      isOnCampus(n.loc) ? chooseAction(
        n,
        {
          tick: this.tick,
          weather: weatherAt(this.seed, this.tick),
          crowding: { 2: this.npcs.filter((person) => person.loc === 2).length, 6: this.npcs.filter((person) => person.loc === 6).length, 13: this.npcs.filter((person) => person.loc === 13).length },
          slot: this.tick % 4,
          party: this.party === this.tick,
          clubs: this.clubs.clubs.map(c => ({ id: c.id, name: c.name, meetingLocation: c.meetingLocation, meetingSlot: c.meetingSlot, member: isClubMember(c, n.id), canPropose: true })),
          courseIds: this.enrollments.find(e => e.owner === n.id)?.courseIds || [],
          tasks: this.tasks.filter((t) => t.members.includes(n.id)),
          homework: this.homework.filter((h) => h.owner === n.id),
          assessments: this.assessments.filter((item) => item.owner === n.id),
          dorm: dormLocation(this.rooms[n.id]),
          delivery: this.deliveries.find((item) => item.owner === n.id && (item.status === 'ready' || item.status === 'ordered')),
          living: this.livingEnabled ? this.living[n.id] : undefined,
          parcel: this.parcels.find((item) => item.owner === n.id && item.status !== 'collected'),
          laundry: this.laundry.find((item) => item.owner === n.id && item.status === 'washing'),
          library: { books: this.library.books, loans: this.library.loans.filter((item) => item.owner === n.id), waitlist: this.library.waitlist.filter((item) => item.owner === n.id), reservations: this.library.reservations.filter((item) => item.organizer === n.id || item.attendees.includes(n.id)) },
          activities: n.activityInvitations.filter(invitation => { const activity = this.activities.find(a => a.id === invitation.activityId); return !activity?.clubId || this.clubs.clubs.some(c => c.id === activity.clubId && isClubMember(c, n.id)); }).map((invitation) => ({ ...invitation,
            ownPreparation: this.activities.find((a) => a.id === invitation.activityId)?.contributions[n.id] || 0 })),
          memories: n.memory.map((id) => this.events[id - 1]),
          roommates: this.npcs
            .filter((p) => this.rooms[p.id] === this.rooms[n.id])
            .map((p) => p.id),
        },
        () => this.rand(),
      ) : null,
    );
    for (const n of this.npcs) {
      const decision = decisions[n.id];
      if (!decision) {
        n.action = '短暂离校'; n.why = '短假期自主离校，校外活动不模拟';
        n.interaction = '不在校园'; n.intent = null;
        const event = this.log(`${n.name}暂时不在校园。`, 'action', [n.id], [n.last],
          { location: holiday.offCampusLocation, observedPeople: [], reason: n.why }, 1);
        this.remember(n, event);
        continue;
      }
      const { chosen, options } = decision;
      if (active(n.plan) && this.tick >= n.plan.dueTick) {
        const matches =
          n.plan.kind === "appointment"
            ? chosen.kind === "appointment" && chosen.target === n.plan.target
            : chosen.kind === "task" && chosen.taskId === n.plan.taskId;
        if (!matches)
          finishPlan(
            this,
            n,
            "cancelled",
            `想先${chosen.action}：${chosen.reason}`,
          );
      }
      if (chosen.kind === "task" && !active(n.plan)) {
        const planId = `work-${this.tick}-${n.id}`;
        const id = this.log(
          `${n.name}给自己留出了两个时段，想继续推进${chosen.taskId?.startsWith("research-") ? "科研课题" : "小组资料"}。`,
          "plan_started",
          [n.id],
          [n.last, ...chosen.evidence],
          {
            reason: "根据自己的目标自主开始短期计划，饥饿或疲劳仍可中断",
            taskId: chosen.taskId,
            planId,
          },
          3,
        );
        this.remember(n, id);
        n.plan = {
          id: planId,
          kind: "task",
          taskId: chosen.taskId,
          location: chosen.loc,
          createdTick: this.tick,
          dueTick: this.tick,
          untilTick: this.tick + 1,
          stage: "working",
          attempts: 0,
          worked: 0,
          lastEvent: id,
        };
      }
      // Picking up a meal downstairs can be a short stop before the main
      // period's activity. It requires that the owner is already at the dorm;
      // a personal draw may still leave the order waiting or missed.
      const deliveryIndex = this.deliveries.findIndex((item) => item.owner === n.id && item.status === 'ready');
      if (deliveryIndex >= 0) {
        const order = this.deliveries[deliveryIndex];
        const leavingForMeal = [2, 6, 13].includes(chosen.loc);
        const takeOnWay = n.loc === order.dorm && !leavingForMeal &&
          this.sample('delivery-pickup-choice', this.tick, n.id, order.id) < (chosen.kind === 'exam' ? 0.4 : 0.8);
        const result = advanceMealDelivery(order, this.tick, n.id, n.loc, chosen.kind === 'delivery_pickup' || takeOnWay);
        this.deliveries[deliveryIndex] = result.order;
        if (result.hungerDelta) {
          n.hunger = clamp(n.hunger + result.hungerDelta);
          const id = this.log(`${n.name}到宿舍楼下取到订餐并吃了饭。`, 'delivery_collected', [n.id], [result.order.lastEvent, n.last],
            { orderId: result.order.id, location: n.loc, hungerDelta: result.hungerDelta, reason: '本人已在对应宿舍并自主决定取餐，实际取到后才减少饥饿；作为时段内短暂停留' }, 2);
          result.order.lastEvent = id; this.remember(n, id);
        }
      }
      n.previousLoc = n.loc;
      const travel = travelMinutes(n.previousLoc, chosen.loc);
      const priorWait = this.recentWait(n.id, this.tick - 1);
      const priorBreak = this.tick % 4 === 2 ? this.previousBreak(n.id) : undefined;
      const errandMinutes = Number(priorBreak?.data.errandMinutes || 0);
      const lateMinutes = chosen.action.startsWith('上') ? lateness(travel, Number(priorWait?.data.waitMinutes || 0), this.tick % 4 === 2, errandMinutes) : 0;
      n.loc = chosen.loc;
      // A deliberate pickup can include travel to the original building.
      // This represents the pickup point downstairs, not access to its rooms.
      if (chosen.kind === 'delivery_pickup' && deliveryIndex >= 0 && this.deliveries[deliveryIndex].status === 'ready') {
        const result = advanceMealDelivery(this.deliveries[deliveryIndex], this.tick, n.id, n.loc, true);
        this.deliveries[deliveryIndex] = result.order;
        if (result.hungerDelta) {
          n.hunger = clamp(n.hunger + result.hungerDelta);
          const event = this.log(`${n.name}到宿舍楼下取到订餐并吃了饭。`, 'delivery_collected', [n.id], [result.order.lastEvent, n.last],
            { orderId: result.order.id, location: n.loc, hungerDelta: result.hungerDelta, reason: '本人自主前往原取餐点，实际取到后才减少饥饿' }, 2);
          result.order.lastEvent = event; this.remember(n, event);
        }
      }
      n.action = chosen.action + (lateMinutes ? `（迟到约 ${lateMinutes} 分钟）` : '');
      n.why = chosen.reason + (lateMinutes ? '；上一时段的等待、课间事务与路程挤占了课间时间' : '');
      n.interaction = "按自己的节奏生活";
      n.intent = chosen.kind
        ? {
            kind: chosen.kind,
            target: chosen.target,
            taskId: chosen.taskId,
            activityId: chosen.activityId,
            homeworkId: chosen.homeworkId,
            courseId: chosen.courseId,
            evidence: chosen.evidence,
          }
        : null;
      // Being in a dorm is not the same as sleeping: chores and visits are
      // lighter breaks, while deliberately resting restores substantially more.
      const dormRecovery = chosen.kind !== 'delivery_pickup' && isPrivateDorm(n.loc)
        ? chosen.action === '休息' ? 42 : /洗衣|整理宿舍|整理物品/.test(chosen.action) ? 8 : 5
        : 0;
      n.energy = clamp(n.energy + dormRecovery);

      if (isLearningAction(chosen, this.activities))
        n.progress += 4 + Math.round(n.ambition * 5);
      const id = this.log(
        `${n.name}前往${places[n.loc]}${chosen.kind ? `，${chosen.action}` : chosen.action}${lateMinutes ? `，迟到约 ${lateMinutes} 分钟` : ""}。`,
        "action",
        [n.id],
        [n.last, ...chosen.evidence, ...(lateMinutes ? [priorWait?.id, priorBreak?.id] : []), ...this.environmentParents(n.loc)],
        {
          reason: n.why,
          lateMinutes,
          travelMinutes: travel,
          errandMinutes,
          nextCourse: courseAt(this.tick + 1, n.id, this.enrollments.find(e => e.owner === n.id)?.courseIds || [])?.name,
          courseId: chosen.action.startsWith("上") ? courseAt(this.tick, n.id, this.enrollments.find(e => e.owner === n.id)?.courseIds || [])?.id : undefined,
          labCourseId: chosen.kind === "lab" ? labAt(this.tick, n.id, this.enrollments.find(e => e.owner === n.id)?.courseIds || [])?.id : undefined,
          taskId: chosen.taskId,
          activityId: chosen.activityId,
          homeworkId: chosen.homeworkId,
          planId: n.plan && ((chosen.kind === "appointment" && n.plan.kind === "appointment") ||
            (chosen.kind === "task" && n.plan.taskId === chosen.taskId)) ? n.plan.id : undefined,
          target: chosen.target ?? null,
          location: n.loc,
          observedPeople: [],
          scores: options.map((o) => ({
            action: o.action,
            location: o.loc,
            target: o.target ?? null,
            total: +o.score.toFixed(2),
            needAndGoal: +o.base.toFixed(2),
            habit: o.habit,
            avoidance: +o.avoidance.toFixed(2),
            exhaustion: o.exhaustion,
            urgentMeal: o.urgentMeal,
            noise: +o.noise.toFixed(2),
            commitment: o.commitment,
            switching: o.switching,
          })),
        },
        1,
      );
      this.remember(n, id);
    }
    // Waiting reflects service queues, not seating capacity. Everyone who
    // reaches the queue either eats after waiting or finds another meal.
    const windowChoice = new Map(this.npcs.map((n) => {
      const previous = this.recentWait(n.id, this.tick - 4);
      return [n.id, preferredMealWindow(n, Number(previous?.data.waitMinutes || 0) >= 20)] as const;
    }));
    // Visiting a restaurant to meet someone or for another purpose is not a
    // meal. Only the people who actually chose a meal or a meal appointment
    // enter its queues; the same set is retained if they switch restaurants.
    const diners = new Set(this.npcs.filter((n) => n.intent?.kind === 'appointment' ||
      (!n.intent && /吃饭|吃风味餐/.test(n.action))).map((n) => n.id));
    const queueOrder = (a: AgentState, b: AgentState) => queueRank(a.id, this.tick, this.npcs.length) - queueRank(b.id, this.tick, this.npcs.length);
    const initialQueues = ([2, 6, 13] as const).flatMap((location) => mealWindows.map((window) => ({ location, window, arrivals: this.npcs.filter((n) => diners.has(n.id) && n.loc === location && windowChoice.get(n.id) === window).sort(queueOrder) })));
    // A person can leave a long queue, but cannot know the destination queue
    // until arriving. Resolve all switches before calculating final waits.
    const switched = new Set<number>();
    for (const { location, arrivals } of initialQueues) arrivals.forEach((n, index) => {
      const observedWait = 4 + index * 8;
      // A person who independently chose to honor an appointment remains at
      // the agreed restaurant; a queue does not silently undo that choice.
      if (n.intent?.kind === 'appointment' && active(n.plan) && n.plan.kind === 'appointment' && n.plan.location === location) return;
      if (observedWait < 12 || n.hunger < 65 || this.sample('meal-alternative', this.tick, n.id) >= 0.55) return;
      const other = location === 2 || location === 13 ? 6 : 2;
      n.loc = other; n.action = '换餐厅用餐';
      const event = this.log(`${n.name}看到取餐队伍较长，改去${places[other]}吃饭。`, 'restaurant_alternative', [n.id], [n.last],
        { location: other, observedPeople: [], waitMinutes: observedWait, reason: '饥饿时不愿久等，改去另一家餐厅；到达后仍需排队' }, 2);
      this.remember(n, event); n.interaction = '换了一家餐厅吃饭'; switched.add(n.id);
    });
    const queues = ([2, 6, 13] as const).flatMap((location) => mealWindows.map((window) => ({ location, window, arrivals: this.npcs.filter((n) => diners.has(n.id) && n.loc === location && windowChoice.get(n.id) === window).sort((a, b) => Number(switched.has(a.id)) - Number(switched.has(b.id)) || queueOrder(a, b)) })));
    for (const { location, window, arrivals } of queues) {
      arrivals.forEach((n, index) => {
        const waitMinutes = 4 + index * 8;
        if (waitMinutes >= 12) {
          n.action = '排队后用餐';
          const event = this.log(`${n.name}在${places[location]}排队约 ${waitMinutes} 分钟，随后吃上了饭。`, 'restaurant_wait', [n.id], [n.last],
            { location, observedPeople: [], waitMinutes, reason: '取餐需要排队，最终仍然找到座位并吃饭；等待分钟为虚构估计' }, 2);
          this.remember(n, event); n.interaction = '排队后找地方吃饭';
        }
        n.action += ` · ${window}窗口`;
        const last = this.events[n.last! - 1];
        last.data.mealWindow = window;
        n.hunger = clamp(n.hunger - 65);
      });
    }
    for (const personId of foodFestivalAttendees(this.tick, this.npcs, this.events)) {
      const person = this.npcs[personId];
      const id = this.log(`${person.name}在学生餐厅北侧逛校园美食节，吃了些小吃。`, 'festival_visit', [person.id], [person.last],
        { location: foodFestival.location, observedPeople: [], reason: '本人实际选择参加并留在现场用餐；活动日期、菜品与等待时间为模拟' }, 2);
      this.remember(person, id);
      person.interaction = '逛了校园美食节';
    }
    // Observation is local and timestamped. Old sightings may be wrong later.
    for (const n of this.npcs)
      for (const p of this.npcs) {
        if (
          p.id !== n.id && isOnCampus(n.loc) && isOnCampus(p.loc) &&
          n.intent?.kind !== "delivery_pickup" && p.intent?.kind !== "delivery_pickup" &&
          p.loc === n.loc &&
          (!isPrivateDorm(n.loc) || this.rooms[p.id] === this.rooms[n.id])
        ) {
          this.events[n.last! - 1].data.observedPeople!.push(p.id);
          const sighting = {
            loc: p.loc,
            tick: this.tick,
            event: n.last!,
            missed: false,
          };
          n.known[p.id] = {
            ...sighting,
            routine: { ...n.known[p.id]?.routine, [this.tick % 4]: sighting },
          };
        }
      }
    // At the activity center a student may choose a small errand between
    // periods. It consumes time; it does not manufacture an extra movement.
    if (this.tick % 4 === 1) for (const n of this.npcs) {
      if (!isOnCampus(n.loc)) continue;
      const upcoming = courseAt(this.tick + 1, n.id, this.enrollments.find(e => e.owner === n.id)?.courseIds || []);
      if (!upcoming) continue;
      const minutes = travelMinutes(n.loc, 1);
      const waited = Number(this.recentWait(n.id, this.tick)?.data.waitMinutes || 0);
      const available = Math.max(0, 20 - minutes - waited);
      const choice = n.loc === 4 ? chooseBreakErrand(n, available, this.sample('break-errand-delay', this.tick, n.id)) : null;
      const moment = choice?.name || '整理课本';
      const errandMinutes = choice?.actualMinutes || 0;
      const peer = this.npcs.find((person) => person.id !== n.id && person.previousLoc === n.previousLoc &&
        person.loc === n.loc && !isPrivateDorm(n.previousLoc));
      const companion = peer ? `，与${peer.name}从同一地点来到这里` : '';
      if (errandMinutes) { n.action += ` · 课间${moment}`; n.interaction = `课间${moment}，耗时约 ${errandMinutes} 分钟`; }
      const event = this.log(`${n.name}课间${moment}${errandMinutes ? `，耗时约 ${errandMinutes} 分钟` : ''}${companion}，准备接下来的${upcoming.name}。`, 'between_classes', [n.id, ...(peer ? [peer.id] : [])], [n.last],
        { location: n.loc, travelMinutes: minutes, availableMinutes: available, errand: moment, estimatedMinutes: choice?.estimatedMinutes || 0, errandMinutes,
          reason: '先按已知路程和等待估算课间余量再选择；办事耗时包含事后才知道的模拟等待' }, 2);
      this.remember(n, event);
    }
    if (this.tick === 64) for (const n of this.npcs) {
      if (n.loc !== 1 || n.action.indexOf('高等数学') < 0) continue;
      const score = Math.round(40 + n.ambition * 30 + this.sample('quiz', n.id) * 30);
      const event = this.log(`${n.name}参加了高等数学模拟阶段测验，得到 ${score} 分。`, 'quiz_result', [n.id], [n.last],
        { score, courseId: 'math', reason: '仅实际到课者参加；成绩属于虚构练习，不直接决定期末分数' }, 2);
      this.remember(n, event);
    }
    resolveExams(this);
    resolveLibrary(this);
    resolveClubChoices(this);
    resolveResearchMeetings(this);
    workTasks(this);
    workHomework(this);
    if (this.tick < 112 && this.tick % 28 === 0) this.homework.push(...assignHomework(this));
    workActivities(this);
    resolveActivities(this);
    resolveDorm(this);
    resolveParcelLaundry(this);
    for (const n of this.npcs) {
      if (n.loc !== dormLocation(this.rooms[n.id])) continue;
      const previous = [...this.deliveries].reverse().find((item) => item.owner === n.id);
      const order = considerMealDelivery({ owner: n.id, tick: this.tick, loc: n.loc, hunger: n.hunger,
        currentOrder: previous, lastOrderTick: previous?.orderedTick, endTick: TOTAL_TICKS }, (purpose, ...keys) => this.sample(purpose, ...keys));
      if (!order) continue;
      if (this.livingEnabled && this.living[n.id].balance < order.simulatedPrice) continue;
      const id = this.log(`${n.name}向食堂下了一份送到宿舍楼下的模拟订餐。`, 'delivery_ordered', [n.id], [n.last],
        { orderId: order.id, location: order.dorm, dueTick: order.dueTick, simulatedPrice: order.simulatedPrice, estimatedMinutes: order.estimatedMinutes,
          reason: '本人在宿舍且感到饥饿时自主下单；价格和耗时为模拟值，预计本时段内送达' }, 2);
      order.lastEvent = id; this.remember(n, id); n.interaction = '订了一份送到楼下的饭';
      if (this.livingEnabled) {
        this.living[n.id].balance -= order.simulatedPrice;
        const paid = this.log(`${n.name}为订餐支付了 ${order.simulatedPrice} 点模拟预算。`, 'living_delivery_paid', [n.id], [id], { orderId: order.id, location: n.loc, reason: '本人实际下单并支付，模拟余额不会为负' }, 1);
        this.remember(n, paid);
      }
      // A period spans hours, so a 25–45 minute delivery can arrive during
      // the same dorm activity. Arrival alone does not satisfy hunger.
      let result = advanceMealDelivery(order, this.tick, n.id, n.loc, false);
      if (result.notices.some((notice) => notice.type === 'ready')) {
        const readyId = this.log(`${n.name}收到订餐送达通知，餐食放在宿舍楼下取餐点。`, 'delivery_ready', [n.id], [id],
          { orderId: order.id, location: order.dorm, reason: '模拟配送在本时段内送到楼下，仍需本人决定是否取餐' }, 2);
        result.order.lastEvent = readyId; this.remember(n, readyId);
      }
      const pickupChosen = this.sample('delivery-same-period-pickup', this.tick, n.id, order.id) < (n.energy < 20 ? 0.5 : 0.8);
      result = advanceMealDelivery(result.order, this.tick, n.id, n.loc, pickupChosen);
      if (result.hungerDelta) {
        n.hunger = clamp(n.hunger + result.hungerDelta);
        const pickupId = this.log(`${n.name}到宿舍楼下取到订餐并吃了饭。`, 'delivery_collected', [n.id], [result.order.lastEvent, n.last],
          { orderId: order.id, location: n.loc, hungerDelta: result.hungerDelta, reason: '本人在对应宿舍并自主决定下楼取餐，实际取到后才减少饥饿' }, 2);
        result.order.lastEvent = pickupId; this.remember(n, pickupId); n.interaction = '取到订餐并吃了饭';
      }
      this.deliveries.push(result.order);
    }
    resolveLiving(this, diners);
    runSocial(this);
    this.tick++;
    if (this.tick % 4 === 0) this.summarize();
    return true;
  }
  summarize() {
    const stories = this.events.filter(
      (e) =>
        e.tick >= this.tick - 4 &&
        e.tick < this.tick &&
        [
          "friendship",
          "crush",
          "misunderstanding",
          "repair",
          "rivalry",
          "task_completed",
          "task_expired",
          "plan_fulfilled",
          "activity_proposed",
          "activity_held",
          "activity_cancelled",
          "explanation",
        ].includes(e.type),
    );
    const pairs = new Set<string>(),
      highlights: number[] = [];
    for (const e of [...stories].sort(
      (a, b) => b.importance - a.importance || b.tick - a.tick || b.id - a.id,
    )) {
      const pair = [...e.people].sort((a, b) => a - b).join("-");
      if (pairs.has(pair)) continue;
      pairs.add(pair);
      highlights.push(e.id);
      if (highlights.length === 3) break;
    }
    const counts = {
      meetings: stories.filter((e) =>
        [
          "friendship",
          "crush",
          "misunderstanding",
          "repair",
          "rivalry",
        ].includes(e.type),
      ).length,
      tasksCompleted: stories.filter((e) => e.type === "task_completed").length,
      plansFulfilled: stories.filter(
        (e) =>
          e.type === "plan_fulfilled" && e.data.planId?.startsWith("meal-"),
      ).length,
      activitiesHeld: stories.filter((e) => e.type === "activity_held").length,
      explanations: stories.filter((e) => e.type === "explanation").length,
      crushes: stories.filter((e) => e.type === "crush").length,
      misunderstandings: stories.filter((e) => e.type === "misunderstanding")
        .length,
      invitations: this.events.filter(
        (e) =>
          e.tick >= this.tick - 4 &&
          e.tick < this.tick &&
          e.type === "invitation",
      ).length,
    };
    this.log(
      `第 ${this.tick / 4} 天，有些关系悄悄近了，也有人还在等下一次解释的机会。`,
      "summary",
      [],
      highlights,
      { day: this.tick / 4, highlights, counts },
      2,
    );
  }
  replay() {
    const world = new World(this.seed, { livingEnabled: this.livingEnabled });
    while (world.tick < this.tick) {
      for (const input of this.inputs.filter((x) => x.tick === world.tick))
        world.intervene(input.kind);
      world.step();
    }
    for (const input of this.inputs.filter((x) => x.tick === this.tick))
      world.intervene(input.kind);
    return world;
  }
  checksum() {
    return hash(JSON.stringify(this)).toString(16).padStart(8, "0");
  }
  toSave(): SaveData {
    return {
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      seed: this.seed,
      tick: this.tick,
      inputs: this.inputs.map((x) => ({ ...x })),
      checksum: this.checksum(),
      livingEnabled: this.livingEnabled,
    };
  }
  static fromSave(input: unknown) {
    const save = input as SaveData;
    if (
      !save ||
      typeof save !== "object" ||
      save.schemaVersion !== SCHEMA_VERSION
    )
      throw new Error(`存档格式不兼容，请使用 v${ENGINE_VERSION} 导出的记录。`);
    if (save.engineVersion !== ENGINE_VERSION)
      throw new Error(
        `存档来自引擎 ${String(save.engineVersion).slice(0, 24)}，当前为 ${ENGINE_VERSION}，暂不支持跨版本重放。`,
      );
    if (
      typeof save.seed !== "string" ||
      typeof save.livingEnabled !== "boolean" ||
      !save.seed.length ||
      save.seed.length > 128 ||
      !Number.isInteger(save.tick) ||
      save.tick < 0 ||
      save.tick > TOTAL_TICKS ||
      !Array.isArray(save.inputs) ||
      save.inputs.length > MAX_INPUTS ||
      !/^[a-f0-9]{8}$/.test(save.checksum)
    )
      throw new Error("存档内容不完整或超出了允许范围。");
    let previous = -1;
    for (const input of save.inputs) {
      if (
        !input ||
        !Number.isInteger(input.tick) ||
        input.tick < previous ||
        input.tick < 0 ||
        input.tick >= TOTAL_TICKS ||
        input.tick > save.tick ||
        !kinds.includes(input.kind)
      )
        throw new Error("存档中的干预顺序或内容无效。");
      previous = input.tick;
    }
    // Reconstruct from validated inputs rather than trusting imported NPC state.
    const world = new World(save.seed, { livingEnabled: save.livingEnabled });
    for (let tick = 0; tick <= save.tick; tick++) {
      for (const input of save.inputs.filter((x) => x.tick === tick))
        world.intervene(input.kind);
      if (tick < save.tick) world.step();
    }
    if (world.checksum() !== save.checksum)
      throw new Error("重放校验失败，文件可能被修改或来自不同的规则版本。");
    return world;
  }
}
