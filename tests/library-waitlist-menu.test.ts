import { describe, expect, it } from 'vitest';
import { World } from '../src/engine.ts';
import { advanceLibraryWaitlist, resolveLibrary } from '../src/core/library.ts';
import { weeklyMenu, menuPreference } from '../src/core/campusLife.ts';

describe('library holds', () => {
  it('gives a returned copy to the oldest waiter and requires the notified owner at the library', () => {
    const w = new World(10), book = w.library.books[0]; book.copies = 1;
    w.library.loans.push({owner:0,bookId:book.id,borrowedTick:0,dueTick:2,returnedTick:null,lastEvent:1});
    w.library.waitlist.push({owner:1,bookId:book.id,createdTick:1,status:'waiting',lastEvent:1}, {owner:2,bookId:book.id,createdTick:2,status:'waiting',lastEvent:1});
    w.tick=3; w.npcs[0].loc=3; w.npcs[0].intent={kind:'library_return',evidence:[]};
    w.npcs[3].loc=3; w.npcs[3].intent={kind:'library_borrow',evidence:[]};
    resolveLibrary(w); expect(w.library.waitlist.slice(0,2).map(e=>e.status)).toEqual(['notified','waiting']);
    expect(w.library.loans.filter(l=>l.returnedTick===null)).toHaveLength(0);
    w.npcs[0].intent=null; w.npcs[3].intent=null; w.npcs[1].intent={kind:'library_borrow',evidence:[]}; w.npcs[1].loc=0;
    resolveLibrary(w); expect(w.library.waitlist[0].status).toBe('notified');
    w.npcs[1].loc=3; resolveLibrary(w); expect(w.library.waitlist[0].status).toBe('borrowed');
    expect(w.library.loans.filter(l=>l.returnedTick===null)).toHaveLength(1);
  });
  it('expires or cancels one hold and notifies the next waiter once', () => {
    const w = new World(11), book=w.library.books[0]; book.copies=1; w.tick=3;
    w.library.waitlist.push({owner:0,bookId:book.id,createdTick:1,status:'waiting',lastEvent:1},{owner:1,bookId:book.id,createdTick:2,status:'waiting',lastEvent:1},{owner:2,bookId:book.id,createdTick:3,status:'waiting',lastEvent:1});
    advanceLibraryWaitlist(w); advanceLibraryWaitlist(w); expect(w.events.filter(e=>e.type==='library_hold_notified')).toHaveLength(1);
    w.tick=10; advanceLibraryWaitlist(w); expect(w.library.waitlist.map(e=>e.status)).toEqual(['expired','notified','waiting']);
    w.npcs[1].intent={kind:'library_cancel',evidence:[]}; resolveLibrary(w);
    expect(w.library.waitlist.map(e=>e.status)).toEqual(['expired','cancelled','notified']);
  });
  it('round-trips a full semester with deterministic holds', () => {
    const w=new World('holds'); while(w.tick<168) w.step(); expect(World.fromSave(w.toSave()).checksum()).toBe(w.checksum());
  });
});
it('weekly public menu changes and matches personal interests without causing a meal', () => {
  expect(weeklyMenu(0,2)).not.toEqual(weeklyMenu(28,2));
  expect(menuPreference({id:0,interest:'甜点',hunger:50},0,2)).toBeGreaterThan(0);
  expect(menuPreference({id:0,interest:'甜点',hunger:50},0,6)).toBe(0);
});
