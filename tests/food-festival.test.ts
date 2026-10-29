import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { foodFestival, foodFestivalAttendees, foodFestivalOption } from '../src/core/foodFestival.ts';

test('the fictional afternoon activity is an optional personal choice', () => {
  const world = new World('food-festival');
  const hungry = { ...world.npcs[0], hunger: 90 };
  const fed = { ...hungry, hunger: 10 };
  expect(foodFestivalOption(hungry, foodFestival.tick - 1)).toBeUndefined();
  const hungryChoice = foodFestivalOption(hungry, foodFestival.tick)!;
  const fedChoice = foodFestivalOption(fed, foodFestival.tick)!;
  expect(hungryChoice.loc).toBe(2);
  expect(hungryChoice.base).toBeGreaterThan(fedChoice.base);
  expect(foodFestivalOption({ ...fed, interest: '甜点与食谱' }, foodFestival.tick)!.base).toBeGreaterThan(fedChoice.base);
});

test('a festival attendee must choose the festival and still be present after queue diversion', () => {
  const world = new World('food-festival-presence');
  world.tick = foodFestival.tick;
  const [present, diverted, passer] = world.npcs;
  present.loc = 2; diverted.loc = 6; passer.loc = 2;
  world.log(`${present.name}前往学生餐厅逛校园美食节。`, 'action', [present.id], [], { location: 2 });
  world.log(`${diverted.name}前往学生餐厅逛校园美食节。`, 'action', [diverted.id], [], { location: 2 });
  world.log(`${passer.name}前往学生餐厅吃饭。`, 'action', [passer.id], [], { location: 2 });
  expect(foodFestivalAttendees(world.tick, world.npcs, world.events)).toEqual([present.id]);
  expect(foodFestivalAttendees(world.tick + 1, world.npcs, world.events)).toEqual([]);
});

test('real simulations only record festival visits after choosing the event and remaining on site', () => {
  let visits = 0;
  for (let seed = 0; seed < 12; seed++) {
    const world = new World(`festival-${seed}`);
    while (world.tick <= foodFestival.tick) world.step();
    const events = world.events.filter((event) => event.type === 'festival_visit');
    for (const event of events) {
      visits++;
      const person = event.people[0];
      expect(event.tick).toBe(foodFestival.tick);
      expect(event.data.location).toBe(foodFestival.location);
      expect(world.events.some((action) => action.tick === event.tick && action.type === 'action' &&
        action.people[0] === person && action.text.includes('逛校园美食节并吃饭'))).toBe(true);
      expect(world.npcs[person].loc).toBe(foodFestival.location);
    }
    expect(World.fromSave(world.toSave())).toEqual(world);
  }
  expect(visits).toBeGreaterThan(0);
});
