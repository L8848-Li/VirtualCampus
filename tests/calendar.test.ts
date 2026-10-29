import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { chooseAction } from '../src/core/decision.ts';
import { springCampusDay, isSpringCampusDay } from '../src/core/calendar.ts';

test('the fictional spring event occurs at the documented day and afternoon', () => {
  expect(Math.floor(springCampusDay.tick / 4) + 1).toBe(springCampusDay.day);
  expect(springCampusDay.tick % 4).toBe(2);
  expect(isSpringCampusDay(springCampusDay.tick - 1)).toBe(false);
  expect(isSpringCampusDay(springCampusDay.tick)).toBe(true);
  expect(isSpringCampusDay(springCampusDay.tick + 1)).toBe(false);
});

test('the open afternoon is an option, with decisions still depending on personal needs', () => {
  const world = new World('spring-day');
  const person = world.npcs[0];
  const context = { tick: springCampusDay.tick, slot: 2, party: true, memories: [], roommates: [] };
  person.energy = 100; person.hunger = 0; person.social = 100; person.ext = 1;
  const willing = chooseAction(person, context, () => 0);
  expect(willing.chosen.action).toBe(`逛${springCampusDay.name}`);
  expect(willing.chosen.loc).toBe(springCampusDay.location);
  person.hunger = 100; person.social = 0; person.ext = 0;
  const hungry = chooseAction(person, context, () => 0);
  expect(hungry.chosen.action).not.toBe(`逛${springCampusDay.name}`);
  expect(hungry.options.some((option) => option.action === `逛${springCampusDay.name}`)).toBe(true);
  expect(chooseAction(person, { ...context, party: false }, () => 0).options.some((option) => option.action === `逛${springCampusDay.name}`)).toBe(false);
});
