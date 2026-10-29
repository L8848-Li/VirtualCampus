import { test, expect } from 'vitest';
import { World } from '../src/engine.ts';
import { activeDormLoans, resolveDorm } from '../src/core/dorm.ts';

test('sharing requires a real roommate meeting and independent consent', () => {
  const w = new World('dorm'); w.tick = 3;
  const [borrower, owner, outsider] = w.npcs;
  borrower.loc = owner.loc = outsider.loc = 0;
  borrower.action = '整理宿舍和洗衣'; owner.action = '整理物品';
  resolveDorm(w, () => 0);
  const loan = activeDormLoans(w.events)[0];
  expect(loan.people).toEqual([0, 1]);
  expect(borrower.memory).toContain(loan.id);
  expect(owner.memory).toContain(loan.id);
  expect(outsider.memory).not.toContain(loan.id);
  w.tick = 4; resolveDorm(w, () => 0);
  expect(activeDormLoans(w.events)).toHaveLength(1);
  w.tick = 6; owner.loc = 3; resolveDorm(w, () => 0);
  expect(activeDormLoans(w.events)).toHaveLength(1);
  borrower.loc = 3; resolveDorm(w, () => 0);
  expect(activeDormLoans(w.events)).toHaveLength(0);
  expect(w.events.at(-1)?.data.loanEvent).toBe(loan.id);
});

test('a refusal does not create an object transfer', () => {
  const w = new World('dorm-refusal'); w.tick = 3;
  w.npcs[0].loc = w.npcs[1].loc = 0;
  w.npcs[0].action = '整理宿舍和洗衣';
  w.npcs[1].action = '整理物品';
  resolveDorm(w, (purpose) => purpose === 'dorm-ask' ? 0 : 1);
  expect(w.events.at(-1)?.type).toBe('dorm_declined');
  expect(activeDormLoans(w.events)).toHaveLength(0);
});

test('different rooms cannot borrow and room changes do not lose an existing loan', () => {
  const w = new World('room-change'); w.tick = 3;
  w.npcs[0].loc = w.npcs[1].loc = 0;
  w.npcs[0].action = '整理宿舍和洗衣';
  w.npcs[1].action = '整理物品';
  w.rooms[1] = 99;
  resolveDorm(w, () => 0);
  expect(activeDormLoans(w.events)).toHaveLength(0);
  w.rooms[1] = w.rooms[0]; resolveDorm(w, () => 0);
  expect(activeDormLoans(w.events)).toHaveLength(1);
  w.rooms[1] = 99; w.tick = 6; resolveDorm(w, () => 0);
  expect(activeDormLoans(w.events)).toHaveLength(1);
  w.npcs[0].loc = w.npcs[1].loc = 3; resolveDorm(w, () => 0);
  expect(activeDormLoans(w.events)).toHaveLength(0);
});

test('roommates can discuss evening routines only while awake and together', () => {
  const w = new World('room-routine'); w.tick = 3;
  for (const person of w.npcs) person.loc = 3;
  const [speaker, listener, outsider] = w.npcs;
  speaker.loc = listener.loc = 0;
  speaker.action = '在宿舍整理物品'; listener.action = '休息';
  const sample = (purpose: string) => purpose === 'dorm-ask' ? 1 : 0;
  resolveDorm(w, sample);
  expect(w.events.filter((event) => event.type.startsWith('dorm_routine'))).toHaveLength(0);
  listener.action = '整理物品'; w.rooms[listener.id] = 99;
  resolveDorm(w, sample);
  expect(w.events.filter((event) => event.type.startsWith('dorm_routine'))).toHaveLength(0);
  w.rooms[listener.id] = w.rooms[speaker.id];
  const before = speaker.rel[listener.id].trust;
  resolveDorm(w, sample);
  const discussion = w.events.find((event) => event.type === 'dorm_routine_agreed')!;
  expect(discussion.people).toEqual([speaker.id, listener.id]);
  expect(speaker.memory).toContain(discussion.id);
  expect(listener.memory).toContain(discussion.id);
  expect(outsider.memory).not.toContain(discussion.id);
  expect(speaker.rel[listener.id].trust).toBe(Math.min(100, before + 1));
  w.tick = 7; resolveDorm(w, sample);
  expect(w.events.filter((event) => event.type.startsWith('dorm_routine'))).toHaveLength(1);
});

test('a roommate can decline discussing routines without a relationship penalty', () => {
  const w = new World('room-routine-no'); w.tick = 3;
  for (const person of w.npcs) person.loc = 3;
  const [speaker, listener] = w.npcs;
  speaker.loc = listener.loc = 0;
  speaker.action = listener.action = '整理物品';
  const before = speaker.rel[listener.id].trust;
  resolveDorm(w, (purpose) => purpose === 'dorm-routine-ask' ? 0 : 1);
  expect(w.events.some((event) => event.type === 'dorm_routine_declined')).toBe(true);
  expect(speaker.rel[listener.id].trust).toBe(before);
  expect(listener.action).toBe('整理物品');
});
