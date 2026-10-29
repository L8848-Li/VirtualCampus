import { expect, it } from 'vitest';
import { coursePeriods } from '../src/core/enrollment.ts';
import { createClubs, isClubMember, joinClub, leaveClub, reserveClubRoom } from '../src/core/clubs.ts';

it('preserves membership history and requires a recruitment window to rejoin', () => {
  const c = createClubs().clubs[0];
  expect(joinClub(c, 1, 2)).toBe(true);
  expect(joinClub(c, 1, 2)).toBe(false);
  expect(leaveClub(c, 1, 9)).toBe(true);
  expect(isClubMember(c, 1)).toBe(false);
  expect(joinClub(c, 1, 10)).toBe(false);
  expect(joinClub(c, 1, 28)).toBe(true);
  expect(c.members).toEqual([{ person: 1, joinedTick: 2, leftTick: 9 }, { person: 1, joinedTick: 28, leftTick: null }]);
});

it('allows only one active booking for a location and time', () => {
  const state = createClubs();
  const first = { id: 'a', clubId: 'creation', tick: 34, location: 4, status: 'reserved' as const };
  expect(reserveClubRoom(state, first)).toBe(true);
  expect(reserveClubRoom(state, { ...first, id: 'b', clubId: 'making' })).toBe(false);
  state.reservations[0].status = 'cancelled';
  expect(reserveClubRoom(state, { ...first, id: 'b', clubId: 'making' })).toBe(true);
});

import { World } from '../src/engine.ts';
import { resolveClubChoices, scheduleClubMeetings } from '../src/core/clubs.ts';
import { inviteToActivity, workActivities, resolveActivities } from '../src/core/activities.ts';

it('requires actual choices and presence for joining and club activities', () => {
  const w = new World('clubs-presence');
  const c = w.clubs.clubs[0]; const a = w.npcs[0]; const b = w.npcs[1];
  a.intent = { kind: 'club_join', activityId: c.id, evidence: [] }; a.loc = 3;
  resolveClubChoices(w); expect(isClubMember(c, a.id)).toBe(false);
  a.loc = 4; resolveClubChoices(w); expect(isClubMember(c, a.id)).toBe(true);
  joinClub(c, b.id, 0); scheduleClubMeetings(w);
  w.tick = c.meetingSlot; a.loc = 4; b.loc = 4;
  a.intent = { kind: 'club_meeting', activityId: c.id, evidence: [] }; b.intent = null;
  resolveClubChoices(w);
  expect(w.events.at(-1)?.type).toBe('club_meeting_cancelled');
  expect(w.events.at(-1)?.people).toEqual([a.id]);
});

it('excludes nonmembers and preserves contributions after leaving a project', () => {
  const w = new World('clubs-project'); const c = w.clubs.clubs[0];
  const a = w.npcs[0]; const b = w.npcs[1]; const outsider = w.npcs[2];
  joinClub(c, a.id, 0); joinClub(c, b.id, 0);
  a.loc = b.loc = outsider.loc = 4;
  a.intent = { kind: 'club_propose', activityId: c.id, evidence: [] };
  resolveClubChoices(w); const project = w.activities.find(item => item.clubId === c.id)!;
  expect(project.dueTick).toBeGreaterThan(28);
  inviteToActivity(w, project, outsider, a.last!);
  expect(project.invited).not.toContain(outsider.id);
  project.members.push(b.id);
  b.intent = { kind: 'activity_prepare', activityId: project.id, evidence: [] };
  workActivities(w); expect(project.contributions[b.id]).toBe(2);
  leaveClub(c, b.id, 1); workActivities(w); expect(project.contributions[b.id]).toBe(2);
  w.tick = project.dueTick; a.intent = null;
  b.intent = { kind: 'activity_attend', activityId: project.id, evidence: [] };
  resolveActivities(w); expect(project.status).toBe('cancelled'); expect(project.attendees).toEqual([]);
});

it('schedules the public weekly meetings outside undergraduate teaching periods', () => {
  const state = createClubs();
  for (const club of state.clubs) {
    expect(club.meetingSlot % 4).toBe(0);
    expect(Math.floor(club.meetingSlot / 4)).toBeGreaterThanOrEqual(5);
    expect(Object.values(coursePeriods).every(periods => !periods.includes(club.meetingSlot))).toBe(true);
  }
});
