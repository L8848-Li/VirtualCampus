/** Club state and room reservations. Operations are explicit: a membership,
 * reservation, or invitation never implies physical attendance or work. */
export interface ClubMember { person: number; joinedTick: number; leftTick: number | null }
export interface ClubReservation { id: string; clubId: string; tick: number; location: number; status: 'reserved' | 'cancelled' }
export interface Club {
  id: string;
  name: string;
  description: string;
  meetingLocation: 4 | 16;
  meetingSlot: number;
  members: ClubMember[];
}
export interface ClubState { clubs: Club[]; reservations: ClubReservation[] }

export function createClubs(): ClubState {
  return { clubs: [
    { id: 'creation', name: '创作社', description: '以虚构作品和创作为主题的开放社团', meetingLocation: 4, meetingSlot: 20, members: [] },
    { id: 'making', name: '造物社', description: '以动手制作和交流为主题的开放社团', meetingLocation: 16, meetingSlot: 24, members: [] },
  ], reservations: [] };
}
export function isClubMember(club: Club, person: number): boolean {
  return club.members.some(m => m.person === person && m.leftTick === null);
}
/** Applications are accepted only during the public recruitment window. */
export function joinClub(club: Club, person: number, tick: number): boolean {
  if (tick < 0 || tick >= 168 || tick % 28 >= 8 || isClubMember(club, person)) return false;
  club.members.push({ person, joinedTick: tick, leftTick: null });
  return true;
}
export function leaveClub(club: Club, person: number, tick: number): boolean {
  const member = club.members.find(m => m.person === person && m.leftTick === null);
  if (!member || tick < member.joinedTick) return false;
  member.leftTick = tick;
  return true;
}
/** Caller chooses stable proposal order, so collisions have a reproducible winner. */
export function reserveClubRoom(state: ClubState, reservation: ClubReservation): boolean {
  if (reservation.status !== 'reserved' || state.reservations.some(r => r.id === reservation.id) ||
      state.reservations.some(r => r.status === 'reserved' && r.location === reservation.location && r.tick === reservation.tick)) return false;
  state.reservations.push({ ...reservation });
  return true;
}

import type { World } from '../engine.ts';
import { isOnCampus } from './holiday.ts';
import { inviteToActivity } from './activities.ts';

/** Publish room bookings before choices. Weekly events use separate rooms. */
export function scheduleClubMeetings(world: World) {
  if (world.tick !== 0) return;
  for (let week = 0; week < 6; week++) for (const club of world.clubs.clubs) reserveClubRoom(world.clubs, {
    id: `meeting-${club.id}-${week}`, clubId: club.id,
    tick: week * 28 + club.meetingSlot, location: club.meetingLocation, status: 'reserved',
  });
}
export function resolveClubChoices(world: World) {
  for (const person of world.npcs) {
    const intent = person.intent;
    if (!intent?.activityId || !['club_join', 'club_leave', 'club_propose'].includes(intent.kind)) continue;
    const club = world.clubs.clubs.find(c => c.id === intent.activityId);
    if (!club || person.loc !== 4) continue;
    if (intent.kind === 'club_join' && joinClub(club, person.id, world.tick)) {
      const id = world.log(`${person.name}申请加入${club.name}，申请获得通过。`, 'club_joined', [person.id], [person.last],
        { clubId: club.id, location: 4, reason: '在公开招新窗口内本人到场申请' }, 3);
      world.remember(person, id);
    } else if (intent.kind === 'club_leave' && leaveClub(club, person.id, world.tick)) {
      const id = world.log(`${person.name}退出了${club.name}。`, 'club_left', [person.id], [person.last],
        { clubId: club.id, location: 4, reason: '本人自主退出，历史贡献保留' }, 3);
      world.remember(person, id);
    } else if (intent.kind === 'club_propose' && isClubMember(club, person.id)) {
      if (world.activities.some(a => a.clubId && a.status === 'preparing')) {
        const rejected = world.log(`${person.name}的社团作品提议未能启动：已有跨周作品在筹备。`, 'club_project_rejected', [person.id], [person.last],
          { clubId: club.id, location: 4, reason: '游戏中同一时间仅支持一个社团跨周作品' }, 3);
        world.remember(person, rejected);
        continue;
      }
      // One cross-week project at a time, sharing the activity center venue.
      const dueTick = world.tick + 30 + ((2 - (world.tick + 30) % 4 + 4) % 4);
      if (dueTick >= 168) continue;
      const activityId = `club-project-${world.tick}-${person.id}`;
      const reserved = reserveClubRoom(world.clubs, { id: activityId, clubId: club.id, tick: dueTick, location: 4, status: 'reserved' });
      const event = world.log(reserved ? `${person.name}提议为${club.name}筹备一个跨周作品。` : `${person.name}的作品展示场地预约失败：该时段已占用。`,
        reserved ? 'activity_proposed' : 'club_project_rejected', [person.id], [person.last],
        { clubId: club.id, activityId, dueTick, location: 4, reason: reserved ? '本人提议，展示场地已独立预约；参与者仍须自主选择' : '同一场地同一时段已有预约' }, 3);
      world.remember(person, event);
      if (!reserved) continue;
      const title = `${club.name}跨周兴趣作品`;
      world.activities.push({ id: activityId, clubId: club.id, kind: 'project', title, organizer: person.id,
        preparationLocation: 4, location: 4, createdTick: world.tick, dueTick, status: 'preparing', progress: 0,
        required: 6, invited: [], members: [person.id], attendees: [], contributions: {}, lastEvent: event });
      person.activityInvitations.push({ activityId, title, organizer: person.id, dueTick, accepted: true,
        sourceEvent: event, preparationGoal: 6, preparationLocation: 4 });
    }
  }
  for (const project of world.activities.filter(a => a.clubId && a.status === 'preparing')) {
    const organizer = world.npcs[project.organizer];
    for (const guest of world.npcs) if (isOnCampus(organizer.loc) && isOnCampus(guest.loc) && guest.id !== organizer.id && guest.loc === organizer.loc)
      inviteToActivity(world, project, guest, organizer.last!);
  }
  for (const booking of world.clubs.reservations.filter(r => r.id.startsWith('meeting-') && r.tick === world.tick && r.status === 'reserved')) {
    const club = world.clubs.clubs.find(c => c.id === booking.clubId)!;
    const attendees = world.npcs.filter(n => n.loc === booking.location && n.intent?.kind === 'club_meeting' && n.intent.activityId === club.id && isClubMember(club, n.id));
    const held = attendees.length >= 2;
    const event = world.log(held ? `${attendees.map(n => n.name).join('、')}参加了${club.name}的每周活动。` : `${club.name}的每周活动因实际到场人数不足而取消。`,
      held ? 'club_meeting' : 'club_meeting_cancelled', attendees.map(n => n.id), attendees.map(n => n.last),
      { clubId: club.id, location: club.meetingLocation, reason: held ? '成员自主选择且实际到场' : '少于两位成员到场' }, 3);
    for (const person of attendees) world.remember(person, event);
  }
}
