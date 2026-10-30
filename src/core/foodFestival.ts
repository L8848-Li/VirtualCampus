import type { ActionOption, AgentState, CampusEvent } from './types.ts';

// Fictional activity inspired by a campus food fair. Timing, dishes and
// quantities belong to the game; this is not a real event announcement.
export const foodFestival = {
  name: '校园美食节',
  tick: 106, // Day 27, afternoon; within the six-week fictional scenario.
  location: 2 as const,
  description: '学生餐厅北侧有校园风味小摊，想吃东西或逛逛的人可以自行参加。',
};

export function foodFestivalOption(person: AgentState, tick: number): ActionOption | undefined {
  if (tick !== foodFestival.tick) return undefined;
  // This is one candidate alongside meals, plans, classes, and rest; no one is
  // teleported or required to participate. No other person's state is read.
  const enjoysFood = /甜点|食谱|美食/.test(person.interest);
  return {
    loc: foodFestival.location,
    action: `逛${foodFestival.name}并吃饭`,
    base: 29 + person.hunger * 0.62 + person.social * 0.15 + person.ext * 10 + (enjoysFood ? 18 : 0),
    reason: enjoysFood ? '自己对美食感兴趣，也考虑饥饿与其他安排；活动属于虚构日历' : '校园美食节提供尝试风味小吃的机会，是否参加由本人决定',
  };
}

/** Actual attendees must have chosen the festival and still be at its location
 * after any meal-queue diversion. Merely agreeing, knowing, or passing by does
 * not make someone an attendee. This function does not create relationships. */
export function foodFestivalAttendees(tick: number, people: AgentState[], events: readonly CampusEvent[]): number[] {
  if (tick !== foodFestival.tick) return [];
  const chosen = new Set(events.filter((event) => event.tick === tick && event.type === 'action' &&
    event.data.location === foodFestival.location && event.text.includes(`逛${foodFestival.name}`))
    .map((event) => event.people[0]));
  return people.filter((person) => person.loc === foodFestival.location && chosen.has(person.id)).map((person) => person.id);
}
