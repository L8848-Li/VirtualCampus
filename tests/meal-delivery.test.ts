import { expect, test } from 'vitest';
import { advanceMealDelivery, considerMealDelivery, type DeliveryChoice } from '../src/core/mealDelivery.ts';

const base: DeliveryChoice = { owner: 2, tick: 7, loc: 0, hunger: 90, endTick: 168 };
const pick = () => 0;

test('ordering is a reproducible personal choice with eligibility and cooldown', () => {
  const order = considerMealDelivery(base, pick)!;
  expect(order).toEqual(considerMealDelivery(base, pick));
  expect(order).toMatchObject({ owner: 2, dorm: 0, dueTick: 7, expiresTick: 8, status: 'ordered' });
  expect(considerMealDelivery({ ...base, hunger: 40 }, pick)).toBeUndefined();
  expect(considerMealDelivery({ ...base, loc: 3 }, pick)).toBeUndefined();
  expect(considerMealDelivery({ ...base, currentOrder: order }, pick)).toBeUndefined();
  expect(considerMealDelivery({ ...base, lastOrderTick: 4 }, pick)).toBeUndefined();
  expect(considerMealDelivery({ ...base, tick: 167 }, pick)).toBeUndefined();
  expect(considerMealDelivery(base, () => 0.99)).toBeUndefined();
});

test('arrival does not feed anyone; pickup requires an actual choice at the ordered dorm', () => {
  const order = considerMealDelivery(base, pick)!;
  const arriving = advanceMealDelivery(order, 7, 2, 0, false);
  expect(arriving.order.status).toBe('ready');
  expect(arriving.notices.map((n) => n.type)).toEqual(['ready']);
  expect(arriving.hungerDelta).toBe(0);
  const wrongDorm = advanceMealDelivery(arriving.order, 7, 2, 5, true);
  expect(wrongDorm.order.status).toBe('ready');
  expect(wrongDorm.hungerDelta).toBe(0);
  expect(advanceMealDelivery(wrongDorm.order, 8, 3, 0, true).hungerDelta).toBe(0);
  const pickup = advanceMealDelivery(wrongDorm.order, 8, 2, 0, true);
  expect(pickup.order.status).toBe('collected');
  expect(pickup.notices.map((n) => n.type)).toEqual(['collected']);
  expect(pickup.hungerDelta).toBe(-55);
  expect(advanceMealDelivery(pickup.order, 8, 2, 0, true).hungerDelta).toBe(0);
});

test('uncollected food expires and cannot be collected retroactively', () => {
  const order = considerMealDelivery(base, pick)!;
  const late = advanceMealDelivery(order, 9, 2, 0, true);
  expect(late.notices.map((n) => n.type)).toEqual(['ready', 'expired']);
  expect(late.order.status).toBe('expired');
  expect(late.hungerDelta).toBe(0);
  expect(advanceMealDelivery(late.order, 10, 2, 0, true).notices).toEqual([]);
  expect(order.status).toBe('ordered');
});

test('retrieving a ready meal is not penalized as going out hungry or tired', async () => {
  const { World } = await import('../src/engine.ts');
  const { chooseAction } = await import('../src/core/decision.ts');
  const world = new World('delivery-option');
  const person = world.npcs[2];
  person.loc = 0; person.hunger = 95; person.energy = 15;
  const order = considerMealDelivery({ ...base, owner: person.id }, pick)!;
  const ready = advanceMealDelivery(order, order.dueTick, person.id, 0, false).order;
  const result = chooseAction(person, { tick: ready.dueTick, slot: ready.dueTick % 4,
    party: false, memories: [], roommates: [], delivery: ready }, () => 0);
  const pickup = result.options.find((option) => option.kind === 'delivery_pickup');
  expect(pickup).toBeDefined();
  expect(pickup!.exhaustion).toBe(0);
  expect(pickup!.urgentMeal).toBe(0);
});

test('real six-week simulations generate private orders and actual pickups without duplicate meals', async () => {
  const { World } = await import('../src/engine.ts');
  let ordered = 0, collected = 0, expired = 0, ivOrdered = 0, ivCollected = 0;
  for (let seed = 0; seed < 12; seed++) {
    const world = new World(`delivery-integration-${seed}`);
    while (world.step());
    for (const order of world.deliveries) {
      ordered++;
      if (order.dorm === 20) ivOrdered++;
      const events = world.events.filter((event) => event.data.orderId === order.id);
      expect(events.filter((event) => event.type === 'delivery_ordered')).toHaveLength(1);
      expect(events.filter((event) => event.type === 'delivery_ready')).toHaveLength(1);
      const meals = events.filter((event) => event.type === 'delivery_collected');
      expect(meals.length).toBeLessThanOrEqual(1);
      expect(meals.length).toBe(order.status === 'collected' ? 1 : 0);
      for (const event of events) {
        expect(event.people).toEqual([order.owner]);
        expect(world.npcs.filter((n) => n.id !== order.owner).every((n) => !n.memory.includes(event.id))).toBe(true);
      }
      if (meals.length) {
        collected++;
        if (order.dorm === 20) ivCollected++;
        expect(meals[0].data.location).toBe(order.dorm);
        expect(meals[0].data.hungerDelta).toBe(-55);
        expect(meals[0].tick).toBeGreaterThanOrEqual(order.dueTick);
        expect(meals[0].tick).toBeLessThanOrEqual(order.expiresTick);
      }
      if (order.status === 'expired') expired++;
    }
    expect(World.fromSave(world.toSave())).toEqual(world);
  }
  expect(ordered).toBeGreaterThan(0);
  expect(collected).toBeGreaterThan(0);
  expect(expired).toBeGreaterThan(0);
  expect(ivOrdered).toBeGreaterThan(0);
  expect(ivCollected).toBeGreaterThan(0);
});
