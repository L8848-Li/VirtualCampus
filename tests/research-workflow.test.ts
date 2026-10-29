import { expect, it, vi } from 'vitest';
import { World } from '../src/engine.ts';
import { resolveResearchMeetings, workTasks } from '../src/core/tasks.ts';

it('requires actual work, retries failed experiments, and advances each stage once', () => {
  const w = new World('research-workflow');
  const t = w.tasks.find(task => task.research)!;
  const n = w.npcs[t.members[0]];
  n.intent = { kind: 'task', taskId: t.id, evidence: [] };
  n.loc = 3; workTasks(w); expect(t.progress).toBe(0);
  n.loc = t.location; n.intent = null; workTasks(w); expect(t.progress).toBe(0);
  n.intent = { kind: 'task', taskId: t.id, evidence: [] };
  t.progress = t.required - 1; workTasks(w);
  expect(t.research!.stage).toBe('实验'); expect(t.progress).toBe(0);
  const sample = vi.spyOn(w, 'sample').mockReturnValue(0);
  workTasks(w); expect(t.progress).toBe(0);
  expect(w.events.some(e => e.type === 'research_experiment_failed')).toBe(true);
  sample.mockReturnValue(1); t.progress = t.required - 1; workTasks(w);
  expect(t.research!.stage).toBe('整理'); expect(t.progress).toBe(0);
  t.progress = t.required - 1; workTasks(w); expect(t.status).toBe('completed');
  const progress = t.progress; workTasks(w); expect(t.progress).toBe(progress);
  const other = w.tasks.find(task => task.research && task !== t)!;
  const owner = w.npcs[other.members[0]];
  owner.loc = other.location; owner.intent = { kind: 'task', taskId: other.id, evidence: [] };
  w.tick = other.deadline + 1; workTasks(w); expect(other.progress).toBe(0);
});

it('records feedback only for an attendee and records absence separately', () => {
  const w = new World('meetings'); w.tick = 10;
  const tasks = w.tasks.filter(t => t.research);
  const [a, b] = tasks.map(t => w.npcs[t.members[0]]);
  a.loc = a.id % 2 === 0 ? 12 : 18; a.intent = { kind: 'seminar', evidence: [] };
  b.loc = b.id % 2 === 0 ? 12 : 18; b.intent = null;
  resolveResearchMeetings(w);
  expect(tasks[0].research!.feedback).toBe('建议复核');
  expect(tasks[1].research!.feedback).toBe('未参加');
  expect(w.events[tasks[1].research!.meetingEvent! - 1].type).toBe('research_meeting_missed');
});
