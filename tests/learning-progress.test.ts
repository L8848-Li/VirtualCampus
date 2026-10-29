import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { isLearningAction } from '../src/core/academics.ts';
import type { CampusActivity } from '../src/core/types.ts';

const project = [{ id: 'project', kind: 'project' }, { id: 'party', kind: 'gathering' }] as CampusActivity[];

test('learning progress depends on the activity, not the building', () => {
  for (const action of ['上高等数学（模拟课程）', '整理课堂笔记', '自习', '在科研楼查阅资料', '在学院实验楼练习', '在学生宿舍 IV 区公共空间学习'])
    expect(isLearningAction({ action }, [])).toBe(true);
  for (const kind of ['lab', 'homework', 'task', 'retake_study'] as const)
    expect(isLearningAction({ action: '学习任务', kind }, [])).toBe(true);
  expect(isLearningAction({ action: '筹备项目', kind: 'activity_prepare', activityId: 'project' }, project)).toBe(true);
  expect(isLearningAction({ action: '筹备聚会', kind: 'activity_prepare', activityId: 'party' }, project)).toBe(false);
  expect(isLearningAction({ action: '找熟人一起度过时段', kind: 'seek' }, [])).toBe(false);
  expect(isLearningAction({ action: '尝试把话说开', kind: 'repair' }, [])).toBe(false);
  expect(isLearningAction({ action: '借阅图书', kind: 'library_borrow' }, [])).toBe(false);
  expect(isLearningAction({ action: '参加考试', kind: 'exam' }, [])).toBe(false);
});

test('meeting friends in learning buildings never awards study progress', () => {
  const learningBuildings = new Set([1, 3, 8, 9, 10, 12, 14, 16, 17, 18]);
  const locations = new Set<number>();
  let meetings = 0, learning = 0;
  for (let seed = 0; seed < 12; seed++) {
    const world = new World(`study-audit-${seed}`);
    while (world.tick < 168) {
      const before = world.npcs.map((person) => person.progress);
      world.step();
      for (const n of world.npcs) {
        if (learningBuildings.has(n.loc) && n.intent?.kind === 'seek') {
          meetings++; locations.add(n.loc);
          expect(n.progress).toBe(before[n.id]);
        }
        if (n.intent?.kind === 'homework' || n.intent?.kind === 'lab') {
          learning++;
          expect(n.progress).toBeGreaterThan(before[n.id]);
        }
      }
    }
    if (seed === 4) expect(World.fromSave(world.toSave())).toEqual(world);
  }
  expect(meetings).toBeGreaterThan(0);
  expect(locations.size).toBeGreaterThan(1);
  expect(learning).toBeGreaterThan(0);
}, 15000);
