import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { chooseAction } from '../src/core/decision.ts';
import { activeDormLoans, resolveDorm } from '../src/core/dorm.ts';
import { runSocial } from '../src/core/social.ts';
import { advanceMealDelivery, considerMealDelivery } from '../src/core/mealDelivery.ts';
import { dormLocation, travelMinutes } from '../src/core/campusLife.ts';
import { campusLocations } from '../src/ui/campusLocations.ts';

test('IV dorm and public space are separate accessible locations in the same complex', () => {
  const world = new World('iv-layout');
  expect(world.npcs.filter((n) => n.loc === 20).map((n) => n.id)).toEqual([8, 9]);
  expect(world.rooms[8]).toBe(world.rooms[9]);
  expect(dormLocation(world.rooms[8])).toBe(20);
  const common = campusLocations.find((p) => p.id === 17)!;
  const privateRoom = campusLocations.find((p) => p.id === 20)!;
  expect(common.name).toContain('公共空间');
  expect(privateRoom.name).toContain('私人宿舍');
  expect(common.x).not.toBe(privateRoom.x);
  expect(privateRoom.y).toBeGreaterThan(common.y);
  expect(travelMinutes(17, 20)).toBe(1);
});

test('different rooms cannot meet in IV private rooms but can meet in its public space', () => {
  for (const location of [20, 17] as const) {
    const world = new World(`iv-privacy-${location}`);
    for (const n of world.npcs) { n.loc = 4; n.intent = null; }
    const [a, b] = [world.npcs[8], world.npcs[2]];
    a.loc = b.loc = location;
    a.intent = { kind: 'seek', target: b.id, evidence: [] };
    runSocial(world);
    const invitations = world.events.filter((event) => event.type === 'invitation' && event.people.includes(a.id) && event.people.includes(b.id));
    if (location === 20) {
      expect(invitations).toHaveLength(0);
      expect(world.events.some((event) => event.type === 'missed' && event.people[0] === a.id)).toBe(true);
    } else {
      expect(invitations).toHaveLength(1);
      expect(invitations[0].text).not.toContain('undefined');
    }
  }
});

test('IV roommates can borrow, but moving rooms does not erase or silently return the item', () => {
  const world = new World('iv-loan'); world.tick = 3;
  for (const n of world.npcs) n.loc = 4;
  const [borrower, owner] = [world.npcs[8], world.npcs[9]];
  borrower.loc = owner.loc = 20;
  borrower.action = '整理宿舍和洗衣'; owner.action = '整理物品';
  resolveDorm(world, () => 0);
  expect(activeDormLoans(world.events).some((loan) => loan.people[0] === 8 && loan.people[1] === 9)).toBe(true);
  world.rooms[9] = 0; world.tick = 6;
  resolveDorm(world, () => 0);
  expect(activeDormLoans(world.events)).toHaveLength(1);
  borrower.loc = owner.loc = 17;
  resolveDorm(world, () => 0);
  expect(activeDormLoans(world.events)).toHaveLength(0);
});

test('stale IV sightings cannot route former roommates into private rooms', () => {
  const world = new World('iv-sighting');
  const person = world.npcs[8]; person.rel[9].aff = 50;
  person.known[9] = { loc: 20, tick: 0, event: 1, missed: false };
  const options = chooseAction(person, { tick: 1, slot: 1, party: false, memories: [], roommates: [], dorm: 5 }, () => 0).options;
  expect(options.some((option) => option.target === 9 && option.loc === 20)).toBe(false);
});

test('a delivery remains at its original building after reassignment, and requires pickup there', () => {
  const world = new World('iv-move');
  const person = world.npcs[8]; person.hunger = 90;
  const order = considerMealDelivery({ owner: 8, tick: 0, loc: 20, hunger: 90, endTick: 168 }, () => 0)!;
  const ready = advanceMealDelivery(order, 0, 8, 20, false).order;
  world.deliveries.push(ready);
  world.shuffle = <T>(items: T[]) => items.reverse();
  expect(world.intervene('rooms')).toBe(true);
  expect(world.deliveries[0].dorm).toBe(20);
  const newDorm = dormLocation(world.rooms[8]);
  expect(newDorm).not.toBe(20);
  expect(advanceMealDelivery(world.deliveries[0], 0, 8, newDorm, true).hungerDelta).toBe(0);
  expect(advanceMealDelivery(world.deliveries[0], 0, 8, 20, true).hungerDelta).toBe(-55);
});

test('IV allocation and later room changes replay deterministically', () => {
  const world = new World('iv-replay');
  for (let tick = 0; tick < 35; tick++) {
    if (tick % 7 === 0) world.intervene('rooms');
    world.step();
  }
  expect(World.fromSave(world.toSave())).toEqual(world);
});


test('a relocated student can choose to travel to the original pickup point', () => {
  const world = new World('iv-pickup-after-move');
  const person = world.npcs[8];
  world.rooms[8] = 0;
  Object.assign(person, { loc: 0, previousLoc: 0, energy: 95, hunger: 90, ambition: 0.1 });
  const order = considerMealDelivery({ owner: 8, tick: 0, loc: 20, hunger: 90, endTick: 168 }, () => 0)!;
  world.deliveries.push(advanceMealDelivery(order, 0, 8, 20, false).order);
  world.rand = () => 0;
  world.step();
  expect(person.intent?.kind).toBe('delivery_pickup');
  expect(person.loc).toBe(20);
  expect(world.deliveries[0].status).toBe('collected');
  expect(world.events.some(event => event.type === 'delivery_collected' && event.people[0] === 8 && event.data.location === 20)).toBe(true);
  const action = world.events.find(event => event.type === 'action' && event.people[0] === 8)!;
  expect(action.data.observedPeople).toEqual([]);
});
