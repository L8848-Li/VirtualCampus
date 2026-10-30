// Shared public configuration has no dependency on selection or decision rules.
export const courses = [
  { id: 'math', name: '高等数学（模拟课程）', credits: 4, days: [0, 2, 4] },
  { id: 'programming', name: '程序设计基础（模拟课程）', credits: 3, days: [1, 3] },
  { id: 'english', name: '大学英语（模拟课程）', credits: 2, days: [0, 3] },
  { id: 'physics', name: '大学物理（模拟课程）', credits: 3, days: [1, 4] },
] as const;
export const coursePeriods: Record<string, readonly number[]> = {
  math: [0, 8, 16], programming: [4, 12, 6, 14], english: [2, 14], physics: [6, 18],
};
export const courseCapacity: Record<string, number> = { math: 10, programming: 5, english: 8, physics: 8 };
export const courseTags: Record<string, string> = { math: '数学、逻辑', programming: '编程、机器人', english: '语言、阅读', physics: '科学、实验' };
