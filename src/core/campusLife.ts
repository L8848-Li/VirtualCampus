import type { LocationId } from './types.ts';
import { isOnCampus } from './holiday.ts';
// Five fictional two-person rooms: 0–1 south, 2–3 north, 4 in IV.
// Location 17 remains public space; 20 represents private rooms in the same complex.
export function dormLocation(room: number): 0 | 5 | 20 | 21 { return room >= 5 ? 21 : room >= 4 ? 20 : room >= 2 ? 5 : 0; }
export function isPrivateDorm(location: LocationId): location is 0 | 5 | 20 | 21 { return location === 0 || location === 5 || location === 20 || location === 21; }
// Relative travel estimates for the prototype, not surveyed walking times.
const points: [number, number][] = [[34,77],[48,67],[45,87],[66,47],[53,51],[34,40],[44,41],[24,45],[66,67],[81,62],[82,88],[53,40],[57,16],[35,24],[82,28],[14,43],[19,90],[35,14],[82,14],[19,73],[35,17],[20,92]];
export function travelMinutes(from: LocationId, to: LocationId) {
  // Off-campus travel is deliberately abstract and has no map distance.
  if (!isOnCampus(from) || !isOnCampus(to)) return 0;
  if (from === to) return 0;
  if ((from === 16 && to === 21) || (from === 21 && to === 16)) return 1;
  if ((from === 17 && to === 20) || (from === 20 && to === 17)) return 1;
  const [x1,y1] = points[from], [x2,y2] = points[to];
  return Math.max(3, Math.round(Math.hypot(x2-x1,y2-y1) / 5));
}
// Rotate fairly at every tick, including beyond one complete cycle.
export const queueRank = (id: number, tick: number, size: number) => (id - tick % size + size) % size;
export const mealWindows = ['家常饭', '面食', '简餐'] as const;
const menuTags = ['甜点', '面食', '清淡', '家常'] as const;
/** Fictional, public weekly menu; independent of live queues. */
export function weeklyMenu(tick: number, location: 2 | 6 | 13) {
  return menuTags[(Math.floor(tick / 28) + [2, 6, 13].indexOf(location)) % menuTags.length];
}
export function menuPreference(person: { id: number; interest: string; hunger: number }, tick: number, location: 2 | 6 | 13) {
  const tag = weeklyMenu(tick, location);
  const favorite = person.interest.includes('甜点') ? '甜点' : person.interest.includes('篮球') ? '面食' : person.interest.includes('机器人') ? '清淡' : menuTags[person.id % menuTags.length];
  return tag === favorite ? 8 + Math.min(4, person.hunger / 25) : 0;
}

// Stable preference belongs to the person; a recent first-hand long wait may
// cause a one-time switch on the next visit. It never reads others' choices.
export function preferredMealWindow(person: { id: number; interest: string }, recentlyWaited: boolean) {
  const interest = person.interest;
  const preferred = interest.includes('甜点') ? 0 : interest.includes('篮球') ? 1 : interest.includes('机器人') ? 2 : person.id % mealWindows.length;
  return mealWindows[(preferred + (recentlyWaited ? 1 : 0)) % mealWindows.length];
}
export function lateness(travel: number, previousWait: number, isAfterLunch: boolean, errandMinutes = 0) {
  // A coarse lunch-break budget, explicitly a fictional approximation.
  return isAfterLunch ? Math.min(25, Math.max(0, travel + previousWait + errandMinutes - 20)) : 0;
}

// A student weighs only the time and needs they know now. Service delays are
// sampled after the decision; they may run longer than the estimate.
export function chooseBreakErrand(person: { id: number; energy: number; ambition: number }, availableMinutes: number, delaySample: number) {
  const options = [
    { name: '整理课本' as const, estimatedMinutes: 0, value: 20 },
    { name: '买水' as const, estimatedMinutes: 4, value: 17 + (100 - person.energy) * 0.14 + (person.id % 2 ? 5 : 0) },
    { name: '打印资料' as const, estimatedMinutes: 6, value: 16 + person.ambition * 14 + (person.id % 2 ? 0 : 5) },
  ].filter((option) => option.estimatedMinutes <= availableMinutes).sort((a, b) => b.value - a.value);
  const choice = options[0];
  const delay = choice.estimatedMinutes ? 1 + Math.floor(delaySample * 15) : 0;
  return { ...choice, actualMinutes: choice.estimatedMinutes + delay };
}
