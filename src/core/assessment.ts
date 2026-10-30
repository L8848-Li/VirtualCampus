import type { World } from '../engine.ts';
import type { Assessment, AgentState } from './types.ts';
import { courses, attendance, TEACHING_TICKS } from './academics.ts';
import type { Enrollment } from './enrollment.ts';
import { profiles } from './config.ts';
import { queryEvents } from './eventIndex.ts';

// A compact four-week scenario. All course weights and timing are fictional.
export function createAssessments(enrollments?: Enrollment[]): Assessment[] {
  return profiles.flatMap((profile, owner) => profile.education === 'graduate' ? [] : courses.filter((course) => enrollments ? enrollments.some(e => e.owner === owner && e.courseIds.includes(course.id)) : course.id !== 'programming' || owner % 2 === 0)
    .map((course) => ({ owner, courseId: course.id, title: course.name, credits: course.credits,
      retakeTick: ({ math: 156, programming: 158, english: 160, physics: 162 } as const)[course.id], retakeWork: 0,
      examTick: ({ math: 116, programming: 120, english: 124, physics: 128 } as const)[course.id],
      makeupTick: ({ math: 140, programming: 142, english: 144, physics: 146 } as const)[course.id],
      status: 'scheduled' as const, score: null, earnedCredits: 0, examScore: null, publishedTick: null, lastEvent: null })) );
}
export function examFor(records: Assessment[], tick: number, owner: number) {
  return records.find((record) => record.owner === owner && ((record.status === 'scheduled' && record.examTick === tick) ||
    ((record.status === 'failed' || record.status === 'deferred') && record.makeupTick === tick) || (['retake_needed', 'missed'].includes(record.status) && record.retakeTick === tick)));
}
function calculate(world: World, person: AgentState, record: Assessment, attempt: 'first' | 'makeup' | 'deferred' | 'retake') {
  const history = attendance(world.events, person.id, Math.min(world.tick, TEACHING_TICKS), world.enrollments.find(e => e.owner === person.id)?.courseIds || []).filter((entry) => entry.course?.id === record.courseId);
  const classRatio = history.length ? history.reduce((total, entry) => total + (entry.attended ? (entry.lateMinutes ? 0.8 : 1) : 0), 0) / history.length : 0;
  const homework = world.homework.filter((item) => item.owner === person.id && item.courseId === record.courseId);
  const homeworkRatio = homework.length ? homework.reduce((total, item) => total + item.progress / item.required, 0) / homework.length : 0;
  const lab = queryEvents(world.events, { type: 'action', person: person.id }).filter(event => event.people[0] === person.id && event.data.labCourseId === record.courseId).length;
  const process = attempt === 'retake' ? Math.min(100, record.retakeWork * 35) : record.courseId === 'math' ? Math.round(60 * classRatio + 40 * homeworkRatio)
    : record.courseId === 'programming' ? Math.round(60 * classRatio + 40 * Math.min(4, lab) / 4) : Math.round(100 * classRatio);
  const exam = Math.max(0, Math.min(100, Math.round(20 + person.ambition * 40 + person.energy * 0.2 + world.sample('exam', person.id, record.courseId, attempt) * 30)));
  return { process, exam, score: Math.round(process * 0.4 + exam * 0.6) };
}
export function resolveExams(world: World) {
  for (const record of world.assessments) {
    const person = world.npcs[record.owner];
    if (record.status === 'pending' && record.publishedTick === world.tick) {
      record.status = record.score! >= 60 ? 'passed' : 'failed';
      record.earnedCredits = record.status === 'passed' ? record.credits : 0;
      const event = world.log(`${person.name}的${record.title}模拟成绩已公布：${record.score} 分。`, 'exam_result', [person.id], [record.lastEvent],
        { courseId: record.courseId, score: record.score, reason: `模拟考核：过程 40% 与考试 60%（迟到按 0.8 次出勤计算）；过程 ${record.processScore}，考试 ${record.examScore}。仅本人获知` }, 3);
      record.lastEvent = event; world.remember(person, event);
    }
    if (['makeup_pending', 'deferred_pending', 'retake_pending'].includes(record.status) && record.publishedTick === world.tick) {
      const kind = record.status === 'deferred_pending' ? '缓考' : record.status === 'retake_pending' ? '重修考试' : '补考';
      record.status = record.score! >= 60 ? 'passed' : 'retake_needed';
      record.earnedCredits = record.status === 'passed' ? record.credits : 0;
      const event = world.log(`${person.name}的${record.title}模拟${kind}结果已公布：${record.score} 分。`, 'exam_result', [person.id], [record.lastEvent],
        { courseId: record.courseId, score: record.score, reason: '模拟缓考、补考与重修按游戏规则单独结算' }, 3);
      record.lastEvent = event; world.remember(person, event);
    }
    const isFirst = record.status === 'scheduled' && record.examTick === world.tick;
    const isMakeup = record.status === 'failed' && record.makeupTick === world.tick;
    const isDeferred = record.status === 'deferred' && record.makeupTick === world.tick;
    const needsRetake = record.status === 'retake_needed' || record.status === 'missed';
    const isRetake = needsRetake && record.retakeTick === world.tick;
    if (needsRetake && world.tick >= 152 && world.tick < record.retakeTick && person.loc === 3 && person.intent?.kind === 'retake_study' && person.intent.courseId === record.courseId) record.retakeWork++;
    if (!isFirst && !isMakeup && !isDeferred && !isRetake) continue;
    if (isFirst && person.intent?.kind === 'defer_exam' && person.intent.courseId === record.courseId) {
      record.status = 'deferred';
      const event = world.log(`${person.name}因精力不足申请模拟缓考并获准。`, 'exam_deferred', [person.id], [person.last],
        { courseId: record.courseId, reason: '虚构场景中精力不足时可申请；批准规则不代表现实学校流程' }, 3);
      record.lastEvent = event; world.remember(person, event); continue;
    }
    const attended = person.loc === 1 && person.intent?.kind === 'exam' && person.intent.courseId === record.courseId;
    if (!attended) {
      record.status = isFirst || isDeferred ? 'missed' : 'retake_needed';
      const event = world.log(`${person.name}没有参加${record.title}的模拟${isRetake ? '重修考试' : isDeferred ? '缓考' : isMakeup ? '补考' : '考试'}。`, 'exam_missed', [person.id], [person.last],
        { courseId: record.courseId, reason: '本人没有选择并到达考试地点；缺考不自动等同于获批缓考' }, 3);
      record.lastEvent = event; world.remember(person, event); continue;
    }
    const attempt = isRetake ? 'retake' : isDeferred ? 'deferred' : isMakeup ? 'makeup' : 'first';
    const result = calculate(world, person, record, attempt);
    record.processScore = result.process; record.examScore = result.exam; record.score = result.score;
    record.status = isRetake ? 'retake_pending' : isDeferred ? 'deferred_pending' : isMakeup ? 'makeup_pending' : 'pending'; record.publishedTick = world.tick + 1;
    const event = world.log(`${person.name}参加了${record.title}的模拟${isRetake ? '重修考试' : isDeferred ? '缓考' : isMakeup ? '补考' : '考试'}，等待成绩公布。`, 'exam_taken', [person.id], [person.last],
      { courseId: record.courseId, reason: '实际选择并到达考试地点，成绩在下一时段公布' }, 2);
    record.lastEvent = event; world.remember(person, event);
  }
}
