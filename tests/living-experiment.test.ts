import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { resolveLiving } from '../src/core/livingExperiment.ts';
import { chooseAction } from '../src/core/decision.ts';

test('experiment is off by default and disabled worlds create no living events', () => {
  const w = new World('living-off'); for (let i=0;i<40;i++) w.step();
  expect(w.livingEnabled).toBe(false); expect(w.living).toEqual([]);
  expect(w.events.some(e=>e.type.startsWith('living_'))).toBe(false);
  expect(World.fromSave(w.toSave()).checksum()).toBe(w.checksum());
});
test('only actual work earns money and basic food remains affordable', () => {
  const w = new World('living-work',{livingEnabled:true}), n=w.npcs[0], state=w.living[0];
  state.balance=0; n.loc=0; n.action='图书整理兼职'; n.intent={kind:'part_time',evidence:[]};
  resolveLiving(w,new Set()); expect(state.balance).toBe(0);
  n.loc=3; const energy=n.energy; resolveLiving(w,new Set()); expect(state.balance).toBe(18); expect(n.energy).toBe(energy-10);
  state.balance=0; n.intent=null; n.loc=2; resolveLiving(w,new Set([0])); expect(state.balance).toBe(0);
  expect(w.events.some(e=>e.type==='living_meal' && e.text.includes('免费'))).toBe(true);
});
test('support requires meeting and agreement', () => {
  const w = new World('living-help',{livingEnabled:true}), a=w.npcs[0], b=w.npcs[1];
  a.intent={kind:'living_support',target:b.id,evidence:[]}; a.loc=3; b.loc=4; w.living[0].stress=80;
  resolveLiving(w,new Set()); expect(w.living[0].stress).toBe(79);
  b.loc=3; w.sample=()=>0.99; resolveLiving(w,new Set()); expect(w.living[0].stress).toBe(78);
  w.sample=()=>0; resolveLiving(w,new Set()); expect(w.living[0].stress).toBe(57);
  const event = w.events.at(-1)!;
  expect(event.type).toBe('living_support_accepted');
  expect(b.memory).toContain(event.id);
  expect(JSON.stringify(event.data)).not.toContain('stress');
  expect(JSON.stringify(event.data)).not.toContain('balance');
});
test('private states of other people never enter a personal decision', () => {
  const w=new World('living-private',{livingEnabled:true}), n=w.npcs[0];
  const context={tick:5,slot:1,party:false,memories:[],roommates:[],living:w.living[0]};
  const first=chooseAction(n,context,()=>0.5);
  w.living[1].balance=0; w.living[1].stress=100;
  expect(chooseAction(n,context,()=>0.5)).toEqual(first);
});
test('away people cannot work, pay a campus meal or request in-person help', () => {
  const w=new World('living-away',{livingEnabled:true}), n=w.npcs[0];
  n.loc=22; n.action='图书整理兼职'; n.intent={kind:'part_time',evidence:[]};
  const before={...w.living[0]}; resolveLiving(w,new Set([0]));
  expect(w.living[0]).toEqual(before); expect(w.events.some(e=>e.type.startsWith('living_'))).toBe(false);
});
test('older versions and edited experiment settings cannot be imported', () => {
  const w=new World('living-version'); w.step(); const save=w.toSave();
  expect(()=>World.fromSave({...save,engineVersion:'0.15.1'})).toThrow(/跨版本/);
  expect(()=>World.fromSave({...save,livingEnabled:true})).toThrow(/重放校验失败/);
  const { livingEnabled: _removed, ...missing }=save;
  expect(()=>World.fromSave(missing)).toThrow();
});
test('enabled configuration and world survive interventions and save replay', () => {
  const w=new World('living-replay',{livingEnabled:true}); for(let i=0;i<70;i++){if(i===10)w.intervene('rooms');w.step();}
  expect(w.living.every(s=>s.balance>=0 && s.stress>=0 && s.stress<=100)).toBe(true);
  expect(World.fromSave(w.toSave()).checksum()).toBe(w.checksum());
  expect(w.replay().checksum()).toBe(w.checksum());
});
