import { isPrivateDorm } from './campusLife.ts';
import { isOnCampus } from './holiday.ts';
import type { World } from '../engine.ts';
import type { AgentState, CampusEvent, EventType } from './types.ts';

// Objects are intentionally small, fictional personal belongings. A transfer
// exists only when both people meet and the owner agrees.
const itemFor = (owner: number) => owner % 2 ? '充电线' : '剪刀';
const together = (world: World, a: AgentState, b: AgentState) =>
  isOnCampus(a.loc) && isOnCampus(b.loc) && a.intent?.kind !== 'delivery_pickup' && b.intent?.kind !== 'delivery_pickup' &&
  a.loc === b.loc && (!isPrivateDorm(a.loc) || world.rooms[a.id] === world.rooms[b.id]);
const type = (name: string) => name as EventType;

function discussRoutine(world: World, sample: (purpose: string, ...keys: (string | number)[]) => number) {
  if (world.tick % 4 !== 3) return;
  const spoken = new Set<number>();
  for (const speaker of world.npcs) {
    if (spoken.has(speaker.id) || speaker.intent?.kind === 'delivery_pickup' || !isPrivateDorm(speaker.loc) || speaker.action === '休息') continue;
    const roommate = world.npcs.find((person) => person.id !== speaker.id && !spoken.has(person.id) &&
      person.loc === speaker.loc && person.intent?.kind !== 'delivery_pickup' && person.action !== '休息' && world.rooms[person.id] === world.rooms[speaker.id]);
    if (!roommate) continue;
    // Do not repeat the same conversation for a pair within a week.
    let recentlyDiscussed = false;
    for (let i = world.events.length - 1; i >= 0 && world.events[i].tick >= world.tick - 28; i--) {
      const event = world.events[i];
      if ((event.type === 'dorm_routine_agreed' || event.type === 'dorm_routine_declined') &&
          event.people.includes(speaker.id) && event.people.includes(roommate.id)) { recentlyDiscussed = true; break; }
    }
    if (recentlyDiscussed || sample('dorm-routine-ask', world.tick, speaker.id, roommate.id) >= 0.28) continue;
    const willingness = Math.max(0.15, Math.min(0.85, 0.55 + roommate.rel[speaker.id].trust / 200));
    const accepted = sample('dorm-routine-response', world.tick, speaker.id, roommate.id) < willingness;
    const id = world.log(accepted
      ? `${speaker.name}和${roommate.name}商量了晚上用灯和声音，两人愿意互相留意。`
      : `${speaker.name}想和${roommate.name}商量晚间作息，${roommate.name}暂时不想约定。`,
      accepted ? 'dorm_routine_agreed' : 'dorm_routine_declined', [speaker.id, roommate.id], [speaker.last, roommate.last],
      { location: speaker.loc, reason: accepted ? '同寝室友都在场且清醒，一人提出商量，另一人自主同意' : '同寝室友都在场且清醒，一人提出商量，另一人自主婉拒' }, 3);
    world.remember(speaker, id); world.remember(roommate, id);
    if (accepted) {
      speaker.rel[roommate.id].trust = Math.min(100, speaker.rel[roommate.id].trust + 1);
      roommate.rel[speaker.id].trust = Math.min(100, roommate.rel[speaker.id].trust + 1);
    }
    spoken.add(speaker.id); spoken.add(roommate.id);
  }
}

export function activeDormLoans(events: CampusEvent[]) {
  const returned = new Set(events.filter((event) => event.type === type('dorm_return')).map((event) => event.data.loanEvent));
  return events.filter((event) => event.type === type('dorm_borrow') && !returned.has(event.id));
}

export function resolveDorm(world: World, sample = (purpose: string, ...keys: (string | number)[]) => world.sample(purpose, ...keys)) {
  // Return only on an actual later meeting; a room reshuffle cannot erase a loan.
  let loans = activeDormLoans(world.events);
  const returned = new Set<number>();
  for (const loan of loans) {
    const borrower = world.npcs[loan.people[0]], owner = world.npcs[loan.people[1]];
    if (world.tick <= loan.tick + 1 || !together(world, borrower, owner)) continue;
    const id = world.log(`${borrower.name}把${String(loan.data.item)}还给了${owner.name}。`, type('dorm_return'),
      [borrower.id, owner.id], [loan.id, borrower.last, owner.last],
      { item: loan.data.item, loanEvent: loan.id, location: borrower.loc, reason: '两人再次实际见面，归还先前借用的物品' }, 2);
    world.remember(borrower, id); world.remember(owner, id);
    returned.add(loan.id);
  }
  loans = loans.filter((loan) => !returned.has(loan.id));
  discussRoutine(world, sample);
  if (world.tick % 4 !== 3) return;
  for (const borrower of world.npcs) {
    if (!isPrivateDorm(borrower.loc) || !/洗衣|整理物品/.test(borrower.action)) continue;
    if (loans.some((loan) => loan.people.includes(borrower.id))) continue;
    const candidates = world.npcs.filter((person) => person.id !== borrower.id && person.loc === borrower.loc &&
      world.rooms[person.id] === world.rooms[borrower.id] && !(person.action === '休息' && person.energy < 30) &&
      !loans.some((loan) => loan.people.includes(person.id)));
    if (!candidates.length) continue;
    const owner = candidates[Math.min(candidates.length - 1, Math.floor(sample('dorm-roommate', world.tick, borrower.id) * candidates.length))];
    // The borrower decides whether to ask. The roommate independently decides
    // whether to lend, based only on their own state and relationship.
    if (sample('dorm-ask', world.tick, borrower.id, owner.id) >= 0.38) continue;
    const item = itemFor(owner.id);
    const willingness = Math.max(0.12, Math.min(0.9, 0.58 + owner.rel[borrower.id].trust / 200 + (owner.energy < 30 ? -0.2 : 0)));
    const accepted = sample('dorm-response', world.tick, borrower.id, owner.id) < willingness;
    const id = world.log(accepted ? `${borrower.name}询问后，${owner.name}同意借出${item}。` : `${borrower.name}询问借用${item}，${owner.name}这次没有同意。`,
      type(accepted ? 'dorm_borrow' : 'dorm_declined'), [borrower.id, owner.id], [borrower.last, owner.last],
      { item, location: borrower.loc, reason: accepted ? '室友实际同处一间宿舍，借用者提出请求且物主自主同意' : '室友实际同处一间宿舍，物主自主决定婉拒' }, 3);
    world.remember(borrower, id); world.remember(owner, id);
    if (accepted) loans.push(world.events[id - 1]);
  }
}
