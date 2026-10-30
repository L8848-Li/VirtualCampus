import { courses, coursePeriods, courseCapacity } from './courseCatalog.ts';
export { coursePeriods, courseCapacity, courseTags } from './courseCatalog.ts';
import type { World } from '../engine.ts';

export interface Enrollment { owner: number; courseIds: string[]; events: number[] }

/** Selection takes place before the first class. Only each student's interests,
 * public course information and remaining capacity enter the choice. */
export function enrollStudents(world: World): Enrollment[] {
  const enrollments: Enrollment[] = [];
  const counts = new Map(courses.map(course => [course.id, 0]));
  const students = world.npcs.filter(n => n.education === 'undergraduate').sort((a, b) =>
    world.sample('enrollment-order', a.id) - world.sample('enrollment-order', b.id) || a.id - b.id);
  const announcement = world.log('虚构课程公布了选课时间、地点和容量，本科生可自主选择两至三门。', 'course_catalog', [], [],
    { location: 1, reason: '游戏中的公开课程信息；研究生不参与本科选课' }, 2);
  for (const student of students) {
    const desired = world.sample('enrollment-count', student.id) < 0.5 ? 2 : 3;
    const ranking = [...courses].sort((a,b) => {
      const interest = (id: string) => (id === 'programming' && student.interest.includes('机器人') || id === 'math' && student.interest.includes('数学')) ? 0.4 : 0;
      return (world.sample('enrollment-interest', student.id, b.id) + interest(b.id)) - (world.sample('enrollment-interest', student.id, a.id) + interest(a.id));
    });
    const item: Enrollment = { owner: student.id, courseIds: [], events: [] };
    for (const course of ranking) {
      if (item.courseIds.length >= desired) break;
      const conflict = item.courseIds.some(id => coursePeriods[id].some(period => coursePeriods[course.id].includes(period)));
      const full = (counts.get(course.id) || 0) >= courseCapacity[course.id];
      const accepted = !conflict && !full;
      const event = world.log(accepted ? `${student.name}选入${course.name}。` : `${student.name}未能选入${course.name}：${full ? '课程已满' : '时间与已选课程冲突'}。`,
        accepted ? 'course_selected' : 'course_selection_failed', [student.id], [announcement],
        { courseId: course.id, location: 1, reason: accepted ? '本人依据兴趣选择，课程尚有名额且时间不冲突' : full ? '课程达到公开容量' : '本人已有安排与该课程冲突' }, 2);
      item.events.push(event); world.remember(student, event);
      if (accepted) { item.courseIds.push(course.id); counts.set(course.id, (counts.get(course.id) || 0) + 1); }
    }
    enrollments.push(item);
  }
  return enrollments;
}
