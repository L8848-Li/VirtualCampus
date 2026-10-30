import { World } from '../../src/engine.ts';
import assert from 'node:assert/strict';

export function evaluateLiving() {
  type Row = { seed: number; enabled: boolean; crises: number; personSteps: number; rest: number; jobs: number; paidMeals: number; freeMeals: number; support: number; completedTasks: number; social: number; minBalance: number | null; maxStress: number | null; highStressSteps: number; finalHighStress: number; maxHighStreak: number; replay: boolean };
  const rows: Row[] = [];
  for (const enabled of [false, true]) for (let seed=0; seed<30; seed++) {
    const w = new World(`living-quality-${seed}`, { livingEnabled: enabled }); let crises=0, rest=0, maxStress=0, minBalance=Infinity, highStressSteps=0, maxHighStreak=0; const streaks = w.npcs.map(() => 0);
    while (w.tick < 168) {
      if (w.tick === 50) w.intervene('rooms');
      w.step();
      for (const n of w.npcs) { if (n.energy < 10 || n.hunger > 95) crises++; if (n.action === '休息') rest++; }
      for (const s of w.living) { if (s.stress >= 90) { highStressSteps++; streaks[s.owner]++; maxHighStreak = Math.max(maxHighStreak, streaks[s.owner]); } else streaks[s.owner]=0; minBalance = Math.min(minBalance, s.balance); maxStress = Math.max(maxStress, s.stress); if(s.balance<0 || s.stress<0 || s.stress>100) throw Error(`invalid state ${seed}`); }
    }
    const count=(type:string)=>w.events.filter(e=>e.type===type).length;
    rows.push({seed, enabled, crises, personSteps:168*w.npcs.length, rest, jobs:count('living_work'), paidMeals:w.events.filter(e=>e.type==='living_meal' && !e.text.includes('免费')).length, freeMeals:w.events.filter(e=>e.type==='living_meal' && e.text.includes('免费')).length, support:count('living_support_accepted'), completedTasks:count('task_completed'), social:w.events.filter(e=>['friendship','crush','repair'].includes(e.type)).length, minBalance: enabled ? minBalance : null, maxStress:enabled ? maxStress : null, highStressSteps, finalHighStress:w.living.filter(s=>s.stress>=90).length, maxHighStreak, replay:World.fromSave(w.toSave()).checksum()===w.checksum()});
  }
  const summary = [false,true].map(enabled=>{const group=rows.filter(r=>r.enabled===enabled), sum=(f:(r:Row)=>number)=>group.reduce((v,r)=>v+f(r),0); return {enabled,seeds:group.length,crisisRate:sum(r=>r.crises)/sum(r=>r.personSteps),restRate:sum(r=>r.rest)/sum(r=>r.personSteps),jobs:sum(r=>r.jobs),paidMeals:sum(r=>r.paidMeals),freeMeals:sum(r=>r.freeMeals),support:sum(r=>r.support),completedTasks:sum(r=>r.completedTasks),social:sum(r=>r.social),minBalance:enabled ? Math.min(...group.map(r=>r.minBalance!)) : null,maxStress:enabled ? Math.max(...group.map(r=>r.maxStress!)) : null,highStressSteps:sum(r=>r.highStressSteps),finalHighStress:sum(r=>r.finalHighStress),maxHighStreak:Math.max(...group.map(r=>r.maxHighStreak)),replayFailures:group.filter(r=>!r.replay).map(r=>r.seed)};});
  for (const result of summary) assert.equal(result.replayFailures.length, 0);
  return { definition: '30 paired living-quality seeds, 168 ticks, rooms intervention at tick 50; crisis energy <10 or hunger >95 after step; fictional game values', summary, rows };

}
