import type { World } from '../engine.ts';
import type { AgentState } from './types.ts';
import { TOTAL_TICKS, places } from './config.ts';
import { clamp } from './math.ts';
import { chooseAction } from './decision.ts';
import { holiday, chooseHolidayReturn, isOnCampus } from './holiday.ts';
import { advanceMealDelivery, considerMealDelivery } from './mealDelivery.ts';
import { notifyParcels, resolveParcelLaundry } from './parcelLaundry.ts';
import { advanceLibraryWaitlist, resolveLibrary } from './library.ts';
import { isClubMember, scheduleClubMeetings, resolveClubChoices } from './clubs.ts';
import { createTasks, expireTasks, workTasks, resolveResearchMeetings } from './tasks.ts';
import { springCampusDay } from './calendar.ts';
import { foodFestival, foodFestivalAttendees } from './foodFestival.ts';
import { weatherAt } from './weather.ts';
import { travelMinutes, mealWindows, queueRank, preferredMealWindow, lateness, chooseBreakErrand, dormLocation, isPrivateDorm } from './campusLife.ts';
import { expireHomework, assignHomework, workHomework } from './homework.ts';
import { active, preparePlans, finishPlan } from './plans.ts';
import { courseAt, labAt, isLearningAction } from './academics.ts';
import { resolveExams } from './assessment.ts';
import { workActivities, resolveActivities } from './activities.ts';
import { resolveDorm } from './dorm.ts';
import { resolveLiving } from './livingExperiment.ts';
import { runSocial } from './social.ts';
import { eventsDuring } from './eventIndex.ts';

// Stage order is part of the deterministic simulation contract. All agents
// choose before anybody moves; service and social settlement follow movement.
export function advanceWorld(world: World): void {
  prepareTick(world);
  const decisions = chooseActions(world);
  applyActions(world, decisions);
  const diners = resolveMeals(world);
  observeAndRunErrands(world);
  resolveCampusServices(world);
  resolveDormMeals(world);
  resolveLiving(world, diners);
  runSocial(world);
  world.tick++;
  if (world.tick % 4 === 0) world.summarize();
}
function recentWait(world: World, person: number, earliestTick: number) {
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i];
    if (event.tick < earliestTick) break;
    if (event.type === 'restaurant_wait' && event.people[0] === person) return event;
  }
  return undefined;
}
function previousBreak(world: World, person: number) {
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i];
    if (event.tick < world.tick - 1) break;
    if (event.tick === world.tick - 1 && event.type === 'between_classes' && event.people[0] === person) return event;
  }
  return undefined;
}
function prepareTick(world: World) {
  if (world.tick === holiday.announceTick) world.log(
    '模拟短假期即将开始；同学可以自行决定留校或暂时离校，资源仍按原期限处理。',
    'system', [], [], { reason: '虚构短假期，不对应现实校历' }, 3,
  );
  for (const n of world.npcs) {
    if (n.holidayReturnTick !== undefined && world.tick >= n.holidayReturnTick) {
      n.loc = dormLocation(world.rooms[n.id]);
      n.previousLoc = n.loc;
      delete n.holidayReturnTick;
      const event = world.log(`${n.name}结束短假期，回到校园。`, 'holiday_returned', [n.id], [n.last],
        { location: n.loc, reason: '本人按预计时段返校；不模拟校外行程' }, 2);
      world.remember(n, event);
    }
    if (world.tick !== holiday.departTick) continue;
    const returnTick = chooseHolidayReturn(n, (purpose, ...keys) => world.sample(purpose, ...keys));
    if (returnTick === null) continue;
    n.holidayReturnTick = returnTick;
    n.loc = holiday.offCampusLocation;
    n.intent = null;
    const event = world.log(`${n.name}选择短暂离校，计划稍后返校。`, 'holiday_departed', [n.id], [n.last],
      { dueTick: returnTick, reason: '本人自主选择离校；不记录或向他人推测私人目的地' }, 2);
    world.remember(n, event);
  }
  // Decay all needs first. Decisions then use the same pre-movement phase;
  // no earlier agent can leak its new location to the following agent.
  for (const n of world.npcs) {
    if (!isOnCampus(n.loc)) continue;
    n.hunger = clamp(n.hunger + 17);
    n.energy = clamp(n.energy - 12);
    n.social = clamp(n.social + 11);
  }
  // Arrival and expiry happen before choices. A notification is known only
  // by the order owner; it never automatically feeds them.
  for (let i = 0; i < world.deliveries.length; i++) {
    const order = world.deliveries[i];
    if (order.status !== 'ordered' && order.status !== 'ready') continue;
    const person = world.npcs[order.owner];
    const result = advanceMealDelivery(order, world.tick, person.id, person.loc, false);
    world.deliveries[i] = result.order;
    for (const notice of result.notices) {
      const id = world.log(notice.type === 'ready' ? `${person.name}收到订餐送达通知，餐食放在宿舍楼下取餐点。` : `${person.name}的订餐超过领取时段，没能取到。`,
        notice.type === 'ready' ? 'delivery_ready' : 'delivery_expired', [person.id], [result.order.lastEvent],
        { orderId: order.id, location: order.dorm, reason: notice.type === 'ready' ? '送达到楼下不等于已用餐，本人仍需选择取餐' : '超过模拟领取时限，未取餐不会降低饥饿' }, 2);
      result.order.lastEvent = id; world.remember(person, id);
    }
  }
  notifyParcels(world);
  advanceLibraryWaitlist(world);
  scheduleClubMeetings(world);
  if (world.tick > 0 && world.tick < 112 && world.tick % 28 === 0) world.tasks.push(...createTasks(world));
  if (world.tick === springCampusDay.tick) {
    world.party = world.tick;
    world.log('邮邮大学的春日校园开放午后开始了，学生活动中心有社团兴趣展示与作品，大家可以自行决定是否参加。', 'system', [], [],
      { reason: '虚构校园活动；不改变课程安排，也不强制参与', location: 4 }, 3);
  }
  if (world.tick === foodFestival.tick) {
    world.log('学生餐厅北侧举办模拟校园美食节，想逛逛的同学可以自主选择参加。', 'system', [], [],
      { location: foodFestival.location, reason: '虚构学期中的校园活动，开放参加但不强制人物到场' }, 3);
  }
  expireTasks(world);
  expireHomework(world);
  preparePlans(world);
}
function chooseActions(world: World) {
  const weather = weatherAt(world.seed, world.tick);
  const crowding = { 2: world.npcs.filter(n => n.loc === 2).length, 6: world.npcs.filter(n => n.loc === 6).length, 13: world.npcs.filter(n => n.loc === 13).length };
  return world.npcs.map((n) =>
    isOnCampus(n.loc) ? chooseAction(
      n,
      {
        tick: world.tick,
        weather,
        crowding,
        slot: world.tick % 4,
        party: world.party === world.tick,
        clubs: world.clubs.clubs.map(c => ({ id: c.id, name: c.name, meetingLocation: c.meetingLocation, meetingSlot: c.meetingSlot, member: isClubMember(c, n.id), canPropose: true })),
        courseIds: world.enrollments.find(e => e.owner === n.id)?.courseIds || [],
        tasks: world.tasks.filter((t) => t.members.includes(n.id)),
        homework: world.homework.filter((h) => h.owner === n.id),
        assessments: world.assessments.filter((item) => item.owner === n.id),
        dorm: dormLocation(world.rooms[n.id]),
        delivery: world.deliveries.find((item) => item.owner === n.id && (item.status === 'ready' || item.status === 'ordered')),
        living: world.livingEnabled ? world.living[n.id] : undefined,
        parcel: world.parcels.find((item) => item.owner === n.id && item.status !== 'collected'),
        laundry: world.laundry.find((item) => item.owner === n.id && item.status === 'washing'),
        library: { books: world.library.books, loans: world.library.loans.filter((item) => item.owner === n.id), waitlist: world.library.waitlist.filter((item) => item.owner === n.id), reservations: world.library.reservations.filter((item) => item.organizer === n.id || item.attendees.includes(n.id)) },
        activities: n.activityInvitations.filter(invitation => { const activity = world.activities.find(a => a.id === invitation.activityId); return !activity?.clubId || world.clubs.clubs.some(c => c.id === activity.clubId && isClubMember(c, n.id)); }).map((invitation) => ({ ...invitation,
          ownPreparation: world.activities.find((a) => a.id === invitation.activityId)?.contributions[n.id] || 0 })),
        memories: n.memory.map((id) => world.events[id - 1]),
        roommates: world.npcs
          .filter((p) => world.rooms[p.id] === world.rooms[n.id])
          .map((p) => p.id),
      },
      () => world.rand(),
    ) : null,
  );
}
function applyActions(world: World, decisions: (ReturnType<typeof chooseAction> | null)[]) {
  for (const n of world.npcs) {
    const decision = decisions[n.id];
    if (!decision) {
      n.action = '短暂离校'; n.why = '短假期自主离校，校外活动不模拟';
      n.interaction = '不在校园'; n.intent = null;
      const event = world.log(`${n.name}暂时不在校园。`, 'action', [n.id], [n.last],
        { location: holiday.offCampusLocation, observedPeople: [], reason: n.why }, 1);
      world.remember(n, event);
      continue;
    }
    const { chosen, options } = decision;
    if (active(n.plan) && world.tick >= n.plan.dueTick) {
      const matches =
        n.plan.kind === "appointment"
          ? chosen.kind === "appointment" && chosen.target === n.plan.target
          : chosen.kind === "task" && chosen.taskId === n.plan.taskId;
      if (!matches)
        finishPlan(
          world,
          n,
          "cancelled",
          `想先${chosen.action}：${chosen.reason}`,
        );
    }
    if (chosen.kind === "task" && !active(n.plan)) {
      const planId = `work-${world.tick}-${n.id}`;
      const id = world.log(
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
      world.remember(n, id);
      n.plan = {
        id: planId,
        kind: "task",
        taskId: chosen.taskId,
        location: chosen.loc,
        createdTick: world.tick,
        dueTick: world.tick,
        untilTick: world.tick + 1,
        stage: "working",
        attempts: 0,
        worked: 0,
        lastEvent: id,
      };
    }
    // Picking up a meal downstairs can be a short stop before the main
    // period's activity. It requires that the owner is already at the dorm;
    // a personal draw may still leave the order waiting or missed.
    const deliveryIndex = world.deliveries.findIndex((item) => item.owner === n.id && item.status === 'ready');
    if (deliveryIndex >= 0) {
      const order = world.deliveries[deliveryIndex];
      const leavingForMeal = [2, 6, 13].includes(chosen.loc);
      const takeOnWay = n.loc === order.dorm && !leavingForMeal &&
        world.sample('delivery-pickup-choice', world.tick, n.id, order.id) < (chosen.kind === 'exam' ? 0.4 : 0.8);
      const result = advanceMealDelivery(order, world.tick, n.id, n.loc, chosen.kind === 'delivery_pickup' || takeOnWay);
      world.deliveries[deliveryIndex] = result.order;
      if (result.hungerDelta) {
        n.hunger = clamp(n.hunger + result.hungerDelta);
        const id = world.log(`${n.name}到宿舍楼下取到订餐并吃了饭。`, 'delivery_collected', [n.id], [result.order.lastEvent, n.last],
          { orderId: result.order.id, location: n.loc, hungerDelta: result.hungerDelta, reason: '本人已在对应宿舍并自主决定取餐，实际取到后才减少饥饿；作为时段内短暂停留' }, 2);
        result.order.lastEvent = id; world.remember(n, id);
      }
    }
    n.previousLoc = n.loc;
    const travel = travelMinutes(n.previousLoc, chosen.loc);
    const priorWait = recentWait(world, n.id, world.tick - 1);
    const priorBreak = world.tick % 4 === 2 ? previousBreak(world, n.id) : undefined;
    const errandMinutes = Number(priorBreak?.data.errandMinutes || 0);
    const lateMinutes = chosen.action.startsWith('上') ? lateness(travel, Number(priorWait?.data.waitMinutes || 0), world.tick % 4 === 2, errandMinutes) : 0;
    n.loc = chosen.loc;
    // A deliberate pickup can include travel to the original building.
    // This represents the pickup point downstairs, not access to its rooms.
    if (chosen.kind === 'delivery_pickup' && deliveryIndex >= 0 && world.deliveries[deliveryIndex].status === 'ready') {
      const result = advanceMealDelivery(world.deliveries[deliveryIndex], world.tick, n.id, n.loc, true);
      world.deliveries[deliveryIndex] = result.order;
      if (result.hungerDelta) {
        n.hunger = clamp(n.hunger + result.hungerDelta);
        const event = world.log(`${n.name}到宿舍楼下取到订餐并吃了饭。`, 'delivery_collected', [n.id], [result.order.lastEvent, n.last],
          { orderId: result.order.id, location: n.loc, hungerDelta: result.hungerDelta, reason: '本人自主前往原取餐点，实际取到后才减少饥饿' }, 2);
        result.order.lastEvent = event; world.remember(n, event);
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

    if (isLearningAction(chosen, world.activities))
      n.progress += 4 + Math.round(n.ambition * 5);
    const id = world.log(
      `${n.name}前往${places[n.loc]}${chosen.kind ? `，${chosen.action}` : chosen.action}${lateMinutes ? `，迟到约 ${lateMinutes} 分钟` : ""}。`,
      "action",
      [n.id],
      [n.last, ...chosen.evidence, ...(lateMinutes ? [priorWait?.id, priorBreak?.id] : []), ...world.environmentParents(n.loc)],
      {
        reason: n.why,
        lateMinutes,
        travelMinutes: travel,
        errandMinutes,
        nextCourse: courseAt(world.tick + 1, n.id, world.enrollments.find(e => e.owner === n.id)?.courseIds || [])?.name,
        courseId: chosen.action.startsWith("上") ? courseAt(world.tick, n.id, world.enrollments.find(e => e.owner === n.id)?.courseIds || [])?.id : undefined,
        labCourseId: chosen.kind === "lab" ? labAt(world.tick, n.id, world.enrollments.find(e => e.owner === n.id)?.courseIds || [])?.id : undefined,
        taskId: chosen.taskId,
        activityId: chosen.activityId,
        homeworkId: chosen.homeworkId,
        planId: n.plan && ((chosen.kind === "appointment" && n.plan.kind === "appointment") ||
          (chosen.kind === "task" && n.plan.taskId === chosen.taskId)) ? n.plan.id : undefined,
        target: chosen.target ?? null,
        location: n.loc,
        observedPeople: [],
      },
      1,
    );
    world.recordActionScores(id, options);
    world.remember(n, id);
  }
}
function resolveMeals(world: World) {
  // Waiting reflects service queues, not seating capacity. Everyone who
  // reaches the queue either eats after waiting or finds another meal.
  const windowChoice = new Map(world.npcs.map((n) => {
    const previous = recentWait(world, n.id, world.tick - 4);
    return [n.id, preferredMealWindow(n, Number(previous?.data.waitMinutes || 0) >= 20)] as const;
  }));
  // Visiting a restaurant to meet someone or for another purpose is not a
  // meal. Only the people who actually chose a meal or a meal appointment
  // enter its queues; the same set is retained if they switch restaurants.
  const diners = new Set(world.npcs.filter((n) => n.intent?.kind === 'appointment' ||
    (!n.intent && /吃饭|吃风味餐/.test(n.action))).map((n) => n.id));
  const queueOrder = (a: AgentState, b: AgentState) => queueRank(a.id, world.tick, world.npcs.length) - queueRank(b.id, world.tick, world.npcs.length);
  const initialQueues = ([2, 6, 13] as const).flatMap((location) => mealWindows.map((window) => ({ location, window, arrivals: world.npcs.filter((n) => diners.has(n.id) && n.loc === location && windowChoice.get(n.id) === window).sort(queueOrder) })));
  // A person can leave a long queue, but cannot know the destination queue
  // until arriving. Resolve all switches before calculating final waits.
  const switched = new Set<number>();
  for (const { location, arrivals } of initialQueues) arrivals.forEach((n, index) => {
    const observedWait = 4 + index * 8;
    // A person who independently chose to honor an appointment remains at
    // the agreed restaurant; a queue does not silently undo that choice.
    if (n.intent?.kind === 'appointment' && active(n.plan) && n.plan.kind === 'appointment' && n.plan.location === location) return;
    if (observedWait < 12 || n.hunger < 65 || world.sample('meal-alternative', world.tick, n.id) >= 0.55) return;
    const other = location === 2 || location === 13 ? 6 : 2;
    n.loc = other; n.action = '换餐厅用餐';
    const event = world.log(`${n.name}看到取餐队伍较长，改去${places[other]}吃饭。`, 'restaurant_alternative', [n.id], [n.last],
      { location: other, observedPeople: [], waitMinutes: observedWait, reason: '饥饿时不愿久等，改去另一家餐厅；到达后仍需排队' }, 2);
    world.remember(n, event); n.interaction = '换了一家餐厅吃饭'; switched.add(n.id);
  });
  const queues = ([2, 6, 13] as const).flatMap((location) => mealWindows.map((window) => ({ location, window, arrivals: world.npcs.filter((n) => diners.has(n.id) && n.loc === location && windowChoice.get(n.id) === window).sort((a, b) => Number(switched.has(a.id)) - Number(switched.has(b.id)) || queueOrder(a, b)) })));
  for (const { location, window, arrivals } of queues) {
    arrivals.forEach((n, index) => {
      const waitMinutes = 4 + index * 8;
      if (waitMinutes >= 12) {
        n.action = '排队后用餐';
        const event = world.log(`${n.name}在${places[location]}排队约 ${waitMinutes} 分钟，随后吃上了饭。`, 'restaurant_wait', [n.id], [n.last],
          { location, observedPeople: [], waitMinutes, reason: '取餐需要排队，最终仍然找到座位并吃饭；等待分钟为虚构估计' }, 2);
        world.remember(n, event); n.interaction = '排队后找地方吃饭';
      }
      n.action += ` · ${window}窗口`;
      const last = world.pendingEvent(n.last!);
      last.data.mealWindow = window;
      n.hunger = clamp(n.hunger - 65);
    });
  }
  for (const personId of foodFestivalAttendees(world.tick, world.npcs, world.events)) {
    const person = world.npcs[personId];
    const id = world.log(`${person.name}在学生餐厅北侧逛校园美食节，吃了些小吃。`, 'festival_visit', [person.id], [person.last],
      { location: foodFestival.location, observedPeople: [], reason: '本人实际选择参加并留在现场用餐；活动日期、菜品与等待时间为模拟' }, 2);
    world.remember(person, id);
    person.interaction = '逛了校园美食节';
  }
  return diners;
}
function observeAndRunErrands(world: World) {
  // Observation is local and timestamped. Old sightings may be wrong later.
  for (const n of world.npcs)
    for (const p of world.npcs) {
      if (
        p.id !== n.id && isOnCampus(n.loc) && isOnCampus(p.loc) &&
        n.intent?.kind !== "delivery_pickup" && p.intent?.kind !== "delivery_pickup" &&
        p.loc === n.loc &&
        (!isPrivateDorm(n.loc) || world.rooms[p.id] === world.rooms[n.id])
      ) {
        world.pendingEvent(n.last!).data.observedPeople!.push(p.id);
        const sighting = {
          loc: p.loc,
          tick: world.tick,
          event: n.last!,
          missed: false,
        };
        n.known[p.id] = {
          ...sighting,
          routine: { ...n.known[p.id]?.routine, [world.tick % 4]: sighting },
        };
      }
    }
  // At the activity center a student may choose a small errand between
  // periods. It consumes time; it does not manufacture an extra movement.
  if (world.tick % 4 === 1) for (const n of world.npcs) {
    if (!isOnCampus(n.loc)) continue;
    const upcoming = courseAt(world.tick + 1, n.id, world.enrollments.find(e => e.owner === n.id)?.courseIds || []);
    if (!upcoming) continue;
    const minutes = travelMinutes(n.loc, 1);
    const waited = Number(recentWait(world, n.id, world.tick)?.data.waitMinutes || 0);
    const available = Math.max(0, 20 - minutes - waited);
    const choice = n.loc === 4 ? chooseBreakErrand(n, available, world.sample('break-errand-delay', world.tick, n.id)) : null;
    const moment = choice?.name || '整理课本';
    const errandMinutes = choice?.actualMinutes || 0;
    const peer = world.npcs.find((person) => person.id !== n.id && person.previousLoc === n.previousLoc &&
      person.loc === n.loc && !isPrivateDorm(n.previousLoc));
    const companion = peer ? `，与${peer.name}从同一地点来到这里` : '';
    if (errandMinutes) { n.action += ` · 课间${moment}`; n.interaction = `课间${moment}，耗时约 ${errandMinutes} 分钟`; }
    const event = world.log(`${n.name}课间${moment}${errandMinutes ? `，耗时约 ${errandMinutes} 分钟` : ''}${companion}，准备接下来的${upcoming.name}。`, 'between_classes', [n.id, ...(peer ? [peer.id] : [])], [n.last],
      { location: n.loc, travelMinutes: minutes, availableMinutes: available, errand: moment, estimatedMinutes: choice?.estimatedMinutes || 0, errandMinutes,
        reason: '先按已知路程和等待估算课间余量再选择；办事耗时包含事后才知道的模拟等待' }, 2);
    world.remember(n, event);
  }
  if (world.tick === 64) for (const n of world.npcs) {
    if (n.loc !== 1 || n.action.indexOf('高等数学') < 0) continue;
    const score = Math.round(40 + n.ambition * 30 + world.sample('quiz', n.id) * 30);
    const event = world.log(`${n.name}参加了高等数学模拟阶段测验，得到 ${score} 分。`, 'quiz_result', [n.id], [n.last],
      { score, courseId: 'math', reason: '仅实际到课者参加；成绩属于虚构练习，不直接决定期末分数' }, 2);
    world.remember(n, event);
  }
}
function resolveCampusServices(world: World) {
  resolveExams(world);
  resolveLibrary(world);
  resolveClubChoices(world);
  resolveResearchMeetings(world);
  workTasks(world);
  workHomework(world);
  if (world.tick < 112 && world.tick % 28 === 0) world.homework.push(...assignHomework(world));
  workActivities(world);
  resolveActivities(world);
  resolveDorm(world);
  resolveParcelLaundry(world);
}
function resolveDormMeals(world: World) {
  for (const n of world.npcs) {
    if (n.loc !== dormLocation(world.rooms[n.id])) continue;
    const previous = [...world.deliveries].reverse().find((item) => item.owner === n.id);
    const order = considerMealDelivery({ owner: n.id, tick: world.tick, loc: n.loc, hunger: n.hunger,
      currentOrder: previous, lastOrderTick: previous?.orderedTick, endTick: TOTAL_TICKS }, (purpose, ...keys) => world.sample(purpose, ...keys));
    if (!order) continue;
    if (world.livingEnabled && world.living[n.id].balance < order.simulatedPrice) continue;
    const id = world.log(`${n.name}向食堂下了一份送到宿舍楼下的模拟订餐。`, 'delivery_ordered', [n.id], [n.last],
      { orderId: order.id, location: order.dorm, dueTick: order.dueTick, simulatedPrice: order.simulatedPrice, estimatedMinutes: order.estimatedMinutes,
        reason: '本人在宿舍且感到饥饿时自主下单；价格和耗时为模拟值，预计本时段内送达' }, 2);
    order.lastEvent = id; world.remember(n, id); n.interaction = '订了一份送到楼下的饭';
    if (world.livingEnabled) {
      world.living[n.id].balance -= order.simulatedPrice;
      const paid = world.log(`${n.name}为订餐支付了 ${order.simulatedPrice} 点模拟预算。`, 'living_delivery_paid', [n.id], [id], { orderId: order.id, location: n.loc, reason: '本人实际下单并支付，模拟余额不会为负' }, 1);
      world.remember(n, paid);
    }
    // A period spans hours, so a 25–45 minute delivery can arrive during
    // the same dorm activity. Arrival alone does not satisfy hunger.
    let result = advanceMealDelivery(order, world.tick, n.id, n.loc, false);
    if (result.notices.some((notice) => notice.type === 'ready')) {
      const readyId = world.log(`${n.name}收到订餐送达通知，餐食放在宿舍楼下取餐点。`, 'delivery_ready', [n.id], [id],
        { orderId: order.id, location: order.dorm, reason: '模拟配送在本时段内送到楼下，仍需本人决定是否取餐' }, 2);
      result.order.lastEvent = readyId; world.remember(n, readyId);
    }
    const pickupChosen = world.sample('delivery-same-period-pickup', world.tick, n.id, order.id) < (n.energy < 20 ? 0.5 : 0.8);
    result = advanceMealDelivery(result.order, world.tick, n.id, n.loc, pickupChosen);
    if (result.hungerDelta) {
      n.hunger = clamp(n.hunger + result.hungerDelta);
      const pickupId = world.log(`${n.name}到宿舍楼下取到订餐并吃了饭。`, 'delivery_collected', [n.id], [result.order.lastEvent, n.last],
        { orderId: order.id, location: n.loc, hungerDelta: result.hungerDelta, reason: '本人在对应宿舍并自主决定下楼取餐，实际取到后才减少饥饿' }, 2);
      result.order.lastEvent = pickupId; world.remember(n, pickupId); n.interaction = '取到订餐并吃了饭';
    }
    world.deliveries.push(result.order);
  }
}
export function publishSummary(world: World) {
  const recent = eventsDuring(world.events, world.tick - 4, world.tick);
  const stories = recent.filter(
    (e) =>
      e.tick >= world.tick - 4 &&
      e.tick < world.tick &&
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
    invitations: recent.filter(
      (e) =>
        e.tick >= world.tick - 4 &&
        e.tick < world.tick &&
        e.type === "invitation",
    ).length,
  };
  world.log(
    `第 ${world.tick / 4} 天，有些关系悄悄近了，也有人还在等下一次解释的机会。`,
    "summary",
    [],
    highlights,
    { day: world.tick / 4, highlights, counts },
    2,
  );
}
