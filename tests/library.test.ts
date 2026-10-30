import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { resolveLibrary } from '../src/core/library.ts';

const act = (world: World, id: number, kind: 'library_borrow' | 'library_return' | 'library_book_room' | 'task', taskId?: string) => {
  const person = world.npcs[id];
  person.loc = 3;
  person.intent = { kind, taskId, evidence: [] };
};

test('borrowing has finite copies and only the borrower can return the book', () => {
  const world = new World('library-copies');
  world.library.books[0].copies = 1;
  act(world, 0, 'library_borrow');
  act(world, 3, 'library_borrow');
  resolveLibrary(world);
  expect(world.library.loans).toHaveLength(1);
  expect(world.library.loans[0].owner).toBe(0);
  expect(world.events.some((event) => event.type === 'library_unavailable' && event.people[0] === 3)).toBe(true);
  world.tick++;
  act(world, 0, 'library_return');
  world.npcs[3].intent = null;
  resolveLibrary(world);
  expect(world.library.loans[0].returnedTick).toBe(1);
  expect(world.events.some(event => event.type === 'library_return' && event.people[0] === 0 && event.tick === 1)).toBe(true);
});

test('one room cannot be double booked and an appointment does not force attendance', () => {
  const world = new World('library-room');
  act(world, 0, 'library_book_room', 'report-0');
  act(world, 1, 'library_book_room', 'report-1');
  resolveLibrary(world);
  expect(world.library.reservations.map((room) => room.status)).toEqual(['reserved', 'rejected']);
  world.npcs[0].intent = null;
  world.npcs[1].intent = null;
  world.tick++;
  resolveLibrary(world);
  expect(world.library.reservations[0].status).toBe('missed');
  expect(world.library.reservations[0].attendees).toEqual([]);
});

test('only people who actually choose the relevant group task are counted as attendees', () => {
  const world = new World('library-attendees');
  act(world, 0, 'library_book_room', 'report-0');
  resolveLibrary(world);
  world.tick++;
  act(world, 0, 'task', 'report-0');
  act(world, 3, 'task', 'report-0');
  act(world, 1, 'task', 'report-1');
  resolveLibrary(world);
  expect(world.library.reservations[0].status).toBe('used');
  expect(world.library.reservations[0].attendees).toEqual([0, 3]);
});
