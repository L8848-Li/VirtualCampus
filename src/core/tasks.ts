import type { World } from "../engine.ts";
import type { CampusTask } from "./types.ts";
import { active, finishPlan } from "./plans.ts";
export function createTasks(world: World): CampusTask[] {
  const reports: CampusTask[] = [0, 1, 2].map((group) => {
    const members = world.npcs
      .filter((n) => n.education === "undergraduate" && world.groups[n.id] === group)
      .map((n) => n.id);
    const week = Math.floor(world.tick / 28);
    const title = `第 ${week + 1} 周 · 第 ${group + 1} 组的校园观察报告`;
    const taskId = week ? `report-${group}-week-${week + 1}` : `report-${group}`;
    const deadline = world.tick + 27;
    const id = world.log(
      `${title}发布了：小组需要在本周结束前完成资料整理。`,
      "task_announced",
      members,
      [],
      {
        reason: "课程公开安排提供共同目标；参加整理仍由每个人自己选择",
        taskId,
        deadline,
        location: 3,
      },
      2,
    );
    for (const n of world.npcs.filter((n) => members.includes(n.id)))
      world.remember(n, id);
    return {
      id: taskId,
      title,
      members,
      location: 3,
      progress: 0,
      required: 18,
      deadline,
      status: "open",
      lastEvent: id,
      contributions: {},
    };
  });
  const week = Math.floor(world.tick / 28);
  const research: CampusTask[] = world.npcs.filter((n) => n.education === "graduate").map((person) => {
    const id = `research-${person.id}-week-${week + 1}`;
    const location = person.id % 2 === 0 ? 12 : 18;
    const title = `第 ${week + 1} 周 · ${person.name}的科研课题`;
    const deadline = world.tick + 27;
    const event = world.log(`${person.name}制定了本周的虚构科研课题，计划前往指定研究场所推进。`, "task_announced", [person.id], [],
      { taskId: id, deadline, location, reason: "研究计划由本人自主安排投入" }, 2);
    world.remember(person, event);
    return { id, title, members: [person.id], location, progress: 0, required: 3, deadline, status: "open", lastEvent: event, contributions: {}, research: { stage: "资料", attempts: 0, feedback: null } };
  });
  return [...reports, ...research];
}
export function expireTasks(world: World) {
  for (const t of world.tasks)
    if (t.status === "open" && world.tick > t.deadline) {
      t.status = "expired";
      t.lastEvent = world.log(
        `${t.title}到了截止时间，资料还没全部整理完。`,
        "task_expired",
        t.members,
        [t.lastEvent],
        {
          reason: "达到公开截止时间，实际进度不足；任务没有被系统强制完成",
          taskId: t.id,
          progress: t.progress,
          required: t.required,
        },
        4,
      );
      for (const n of world.npcs.filter((n) => t.members.includes(n.id)))
        world.remember(n, t.lastEvent);
    }
}
export function workTasks(world: World) {
  for (const t of world.tasks) {
    if (t.status !== "open" || world.tick > t.deadline) continue;
    const workers = world.npcs.filter(
      (n) =>
        n.intent?.kind === "task" &&
        n.intent.taskId === t.id &&
        n.loc === t.location &&
        t.members.includes(n.id),
    );
    if (!workers.length) continue;
    if (t.research?.stage === "实验") {
      t.research.attempts++;
      if (world.sample("research-experiment", t.id, t.research.attempts) < 0.3) {
        const id = world.log(`${workers[0].name}的实验需要重试：模拟测量未通过复核。`, "research_experiment_failed", [workers[0].id], [t.lastEvent, workers[0].last],
          { taskId: t.id, location: t.location, reason: "模拟测量未通过复核；本次没有推进，需再次实际工作" }, 3);
        t.lastEvent = id; world.remember(workers[0], id);
        continue;
      }
    }
    let gain = workers.length >= 2 ? 2 : 0;
    for (const n of workers) {
      const contribution = 2 + Math.round(n.ambition * 2);
      gain += contribution;
      t.contributions[n.id] = (t.contributions[n.id] || 0) + contribution;
      n.progress += 2;
    }
    t.progress = Math.min(t.required, t.progress + gain);
    const id = world.log(
      `${workers.map((n) => n.name).join("、")}推进了${t.title}的${t.research?.stage || "资料"}，进度变为 ${t.progress}/${t.required}。`,
      "task_progress",
      workers.map((n) => n.id),
      [t.lastEvent, ...workers.map((n) => n.last)],
      {
        reason:
          workers.length > 1
            ? "成员自主到达指定地点，共同整理带来协作加成"
            : "一位组员自主开始整理资料，积累实际进度",
        taskId: t.id,
        stage: t.research?.stage,
        progress: t.progress,
        required: t.required,
        location: t.location,
        gain,
      },
      3,
    );
    t.lastEvent = id;
    for (const n of workers) {
      world.remember(n, id);
      n.interaction =
        workers.length > 1 ? "正在和组员整理资料" : "专注整理小组资料";
      if (active(n.plan) && n.plan.kind === "task" && n.plan.taskId === t.id) {
        n.plan.worked++;
        n.plan.stage = "working";
        n.plan.lastEvent = id;
        if (n.plan.worked >= 2)
          finishPlan(world, n, "fulfilled", "连续整理了两个时段，先告一段落");
      }
    }
    if (t.progress >= t.required && t.research && t.research.stage !== "整理") {
      t.research.stage = t.research.stage === "资料" ? "实验" : "整理";
      t.progress = 0;
      t.lastEvent = world.log(`${t.title}进入${t.research.stage}阶段。`, "research_stage", workers.map(n => n.id), [id],
        { taskId: t.id, stage: t.research.stage, location: t.location, reason: "上一阶段的实际工作达到要求" }, 3);
      for (const n of workers) world.remember(n, t.lastEvent);
      continue;
    }
    if (t.progress >= t.required) {
      t.status = "completed";
      t.lastEvent = world.log(
        `${t.title}完成了。每一段实际整理过的时间，都留在了这份共同作品里。`,
        "task_completed",
        t.members,
        [t.lastEvent],
        {
          reason: "累计实际工作达到目标，任务状态从开放变为完成",
          taskId: t.id,
          progress: t.progress,
          required: t.required,
        },
        4,
      );
      for (const n of world.npcs.filter((n) => t.members.includes(n.id))) {
        world.remember(n, t.lastEvent);
        if (active(n.plan) && n.plan.taskId === t.id)
          finishPlan(world, n, "cancelled", "小组已完成共同事务，自己的工作计划未继续完成");
      }
    }
  }
}

// A meeting is resolved after movement: the choice alone is not attendance.
export function resolveResearchMeetings(world: World) {
  if (world.tick >= 112 || world.tick % 28 !== 10) return;
  for (const t of world.tasks) {
    if (!t.research || Math.floor(t.deadline / 28) !== Math.floor(world.tick / 28)) continue;
    const n = world.npcs[t.members[0]];
    const attended = n.intent?.kind === "seminar" && n.loc === (n.id % 2 === 0 ? 12 : 18);
    t.research.feedback = attended ? "建议复核" : "未参加";
    const id = world.log(attended ? `${n.name}实际参加组会，收到复核研究记录的建议。` : `${n.name}没有参加本周组会，未收到反馈。`,
      attended ? "research_feedback" : "research_meeting_missed", [n.id], [t.lastEvent, n.last],
      { taskId: t.id, location: n.id % 2 === 0 ? 12 : 18, reason: attended ? "本人选择并实际到场" : "本人未选择或未到场，不能获得反馈" }, 3);
    t.research.meetingEvent = id; world.remember(n, id);
  }
}
