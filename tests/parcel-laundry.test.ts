import { describe, expect, it } from 'vitest';
import { World } from '../src/engine.ts';
import { notifyParcels, resolveParcelLaundry, LAUNDRY_CAPACITY } from '../src/core/parcelLaundry.ts';
import { dormLocation } from '../src/core/campusLife.ts';

describe('parcel and laundry', () => {
  it('requires the owner to choose pickup at the pickup point, even after the deadline', () => {
    const w = new World(1); w.tick = 4; notifyParcels(w);
    const p = w.parcels[0], owner = w.npcs[p.owner], other = w.npcs[1];
    other.loc = 4; other.intent = { kind: 'parcel_pickup', evidence: [] }; resolveParcelLaundry(w);
    owner.intent = { kind: 'parcel_pickup', evidence: [] }; owner.loc = 0; resolveParcelLaundry(w);
    expect(p.status).toBe('waiting');
    w.tick = p.deadline + 1; notifyParcels(w); expect(p.status).toBe('overdue');
    owner.loc = 4; resolveParcelLaundry(w); resolveParcelLaundry(w);
    expect(p.status).toBe('collected'); expect(w.events.filter(e => e.type === 'parcel_collected' && e.people[0] === owner.id)).toHaveLength(1);
  });
  it('rotates competition, preserves occupied machines after a room change, and requires a later visit', () => {
    const w = new World(2); w.tick = 12;
    for (let i = 0; i < 4; i++) { w.rooms[i] = 0; w.npcs[i].loc = dormLocation(0); w.npcs[i].intent = { kind: 'laundry_start', evidence: [] }; }
    resolveParcelLaundry(w);
    expect(w.laundry).toHaveLength(LAUNDRY_CAPACITY);
    expect(w.events.filter(e => e.type === 'laundry_waiting')).toHaveLength(2);
    const load = w.laundry[0], owner = w.npcs[load.owner];
    owner.intent = { kind: 'laundry_pickup', evidence: [] }; resolveParcelLaundry(w);
    expect(load.status).toBe('washing');
    w.rooms[owner.id] = 5; owner.loc = dormLocation(5); owner.intent = { kind: 'laundry_pickup', evidence: [] }; w.tick++;
    const other = w.npcs.find(n => n.id !== owner.id && !w.laundry.some(l => l.owner === n.id))!;
    other.loc = load.dorm; other.intent = { kind: 'laundry_pickup', evidence: [] };
    resolveParcelLaundry(w); expect(load.status).toBe('washing');
    owner.loc = load.dorm; resolveParcelLaundry(w); expect(load.status).toBe('collected');
  });
  it('uses a deterministic rotating priority for simultaneous competition', () => {
    const winners = (tick: number) => {
      const w = new World(9); w.tick = tick;
      for (let i = 0; i < 4; i++) { w.rooms[i] = 0; w.npcs[i].loc = dormLocation(0); w.npcs[i].intent = { kind: 'laundry_start', evidence: [] }; }
      resolveParcelLaundry(w);
      return w.laundry.map(l => l.owner);
    };
    expect(winners(0)).toEqual([0, 1]);
    expect(winners(1)).toEqual([1, 2]);
    expect(winners(1)).toEqual(winners(1));
  });
  it('replays parcel and laundry state with interventions', () => {
    const w = new World(3); for (let i = 0; i < 60; i++) { if (i === 20) w.intervene('rooms'); w.step(); }
    expect(World.fromSave(w.toSave()).checksum()).toBe(w.checksum());
    expect(w.events.some(e => e.type === 'parcel_arrived')).toBe(true);
  });
});
