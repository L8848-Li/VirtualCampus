import type { World } from "../engine.ts";
import type { CampusTask } from "./types.ts";
import { active, finishPlan } from "./plans.ts";
export function createTasks(world: World): CampusTask[] {
  return [0, 1, 2].map((group) => {
    const members = world.npcs
      .filter((n) => world.groups[n.id] === group)
      .map((n) => n.id);
    const title = `第 ${group + 1} 组的校园观察报告`;
    const id = world.log(
      `${title}发布了：小组需要在第五天结束前完成资料整理。`,
      "task_announced",
      members,
      [],
      {
        reason: "课程公开安排提供共同目标；参加整理仍由每个人自己选择",
        taskId: `report-${group}`,
        deadline: 19,
        location: 3,
      },
      2,
    );
    for (const n of world.npcs.filter((n) => members.includes(n.id)))
      world.remember(n, id);
    return {
      id: `report-${group}`,
      title,
      members,
      location: 3,
      progress: 0,
      required: 26,
      deadline: 19,
      status: "open",
      lastEvent: id,
      contributions: {},
    };
  });
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
    if (t.status !== "open") continue;
    const workers = world.npcs.filter(
      (n) =>
        n.intent?.kind === "task" &&
        n.intent.taskId === t.id &&
        n.loc === t.location &&
        t.members.includes(n.id),
    );
    if (!workers.length) continue;
    let gain = workers.length >= 2 ? 2 : 0;
    for (const n of workers) {
      const contribution = 2 + Math.round(n.ambition * 2);
      gain += contribution;
      t.contributions[n.id] = (t.contributions[n.id] || 0) + contribution;
      n.progress += 2;
    }
    t.progress = Math.min(t.required, t.progress + gain);
    const id = world.log(
      `${workers.map((n) => n.name).join("、")}整理了${t.title}的资料，进度变为 ${t.progress}/${t.required}。`,
      "task_progress",
      workers.map((n) => n.id),
      [t.lastEvent, ...workers.map((n) => n.last)],
      {
        reason:
          workers.length > 1
            ? "同组成员自主来到图书馆，共同整理带来协作加成"
            : "一位组员自主开始整理资料，积累实际进度",
        taskId: t.id,
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
          finishPlan(world, n, "fulfilled", "小组已完成这份共同事务");
      }
    }
  }
}
