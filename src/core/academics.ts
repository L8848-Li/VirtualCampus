import type { CampusEvent } from './types.ts';

// Fictional teaching-week courses. A scheduled class is an opportunity, not an order.
export const courses = [
  { id: 'math', name: '高等数学（模拟课程）', credits: 4, days: [0, 2, 4] },
  { id: 'programming', name: '程序设计基础（模拟课程）', credits: 3, days: [1, 3] },
] as const;
export function courseAt(tick: number) {
  if (tick % 4 !== 0) return undefined;
  return courses.find((course) => (course.days as readonly number[]).includes(Math.floor(tick / 4)));
}
export function attendance(events: CampusEvent[], person: number, tick: number) {
  const attendedTicks = new Set(events.filter((event) => event.type === 'action' && event.people[0] === person && event.data.courseId).map((event) => `${event.tick}:${event.data.courseId}`));
  return Array.from({ length: tick }, (_, t) => ({ tick: t, course: courseAt(t) }))
    .filter((item) => item.course)
    .map((item) => ({ ...item, attended: attendedTicks.has(`${item.tick}:${item.course?.id}`) }));
}
