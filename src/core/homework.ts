import type { World } from '../engine.ts';
import type { Homework } from './types.ts';

// The first fictional maths class publishes the same assignment to all enrolled students.
export function assignHomework(world: World): Homework[] {
  const week = Math.floor(world.tick / 28);
  return world.npcs.filter((person) => person.education === 'undergraduate' && world.enrollments.some(e => e.owner === person.id && e.courseIds.includes('math'))).map((person) => {
    const id = `math-homework-${person.id}${week ? `-week-${week + 1}` : ""}`;
    const deadline = world.tick + 23;
    const event = world.log(`${person.name}收到第 ${week + 1} 周高等数学练习，将在本周第六天夜晚截止。`, 'homework_assigned', [person.id], [],
      { homeworkId: id, reason: '课程统一发布作业；是否腾出时间完成由本人决定', dueTick: deadline }, 2);
    world.remember(person, event);
    return { id, owner: person.id, title: `第 ${week + 1} 周高等数学练习`, courseId: 'math', deadline,
      progress: 0, required: 2, status: 'open', lastEvent: event };
  });
}
export function expireHomework(world: World) {
  for (const homework of world.homework) if (homework.status === 'open' && world.tick > homework.deadline) {
    const person = world.npcs[homework.owner];
    homework.status = 'expired';
    homework.lastEvent = world.log(`${person.name}的${homework.title}到了截止时间，尚未完成。`, 'homework_expired', [person.id], [homework.lastEvent],
      { homeworkId: homework.id, progress: homework.progress, required: homework.required, reason: '截止时实际完成的练习不足，没有自动补齐' }, 3);
    world.remember(person, homework.lastEvent);
  }
}
export function workHomework(world: World) {
  for (const homework of world.homework) {
    const person = world.npcs[homework.owner];
    if (homework.status !== 'open' || world.tick > homework.deadline || person.loc !== (person.id % 2 ? 8 : 3) || person.intent?.kind !== 'homework' || person.intent.homeworkId !== homework.id) continue;
    homework.progress++;
    const complete = homework.progress >= homework.required;
    if (complete) homework.status = 'completed';
    homework.lastEvent = world.log(complete ? `${person.name}完成并提交了${homework.title}。` : `${person.name}在${person.loc === 8 ? '实验楼' : '图书馆'}做了${homework.title}，还需要继续。`,
      complete ? 'homework_completed' : 'homework_progress', [person.id], [homework.lastEvent, person.last],
      { homeworkId: homework.id, location: person.loc, progress: homework.progress, required: homework.required,
        reason: complete ? '两次实际投入达到完成要求，作业在截止前提交' : '人物自主选择投入一个时段' }, 3);
    world.remember(person, homework.lastEvent);
    person.interaction = complete ? '完成并提交了练习' : '正在完成课程练习';
  }
}
