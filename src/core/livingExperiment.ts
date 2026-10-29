import type { World } from '../engine.ts';
import type { AgentState } from './types.ts';
import { isOnCampus } from './holiday.ts';
const clamp = (value: number) => Math.max(0, Math.min(100, value));

/** Fictional, opt-in game values; never medical judgments or real transactions. */
export interface LivingState { owner: number; balance: number; stress: number }
export const JOBS = [{ name: '图书整理兼职', location: 3 as const, pay: 18 }, { name: '校园事务兼职', location: 11 as const, pay: 18 }] as const;
export function createLivingStates(people: AgentState[]): LivingState[] { return people.map(n => ({ owner: n.id, balance: 60, stress: 0 })); }
export function resolveLiving(world: World, diners: Set<number>) {
  if (!world.livingEnabled) return;
  for (const n of world.npcs) {
    if (!isOnCampus(n.loc)) continue;
    const state = world.living[n.id];
    if (diners.has(n.id)) {
      const paid = state.balance >= 3;
      if (paid) state.balance -= 3;
      const event = world.log(paid ? `${n.name}为这顿模拟餐付了 3 点预算。` : `${n.name}选择了免费的基础餐。`, 'living_meal', [n.id], [n.last], { location: n.loc, reason: paid ? '实际选择并吃饭后支付模拟预算' : '余额不足时基础餐仍可获得，不产生负余额' }, 1); world.remember(n, event);
    }
    if (n.intent?.kind === 'part_time') {
      const job = JOBS.find(j => n.loc === j.location && n.action === j.name);
      if (job) {
        state.balance += job.pay; n.energy = clamp(n.energy - 10);
        const event = world.log(`${n.name}完成${job.name}，获得 ${job.pay} 点模拟预算。`, 'living_work', [n.id], [n.last], { location: n.loc, reason: '本人实际选择并到场工作，结束后获得收入并消耗精力' }, 2); world.remember(n,event);
      }
    }
    if (n.intent?.kind === 'living_support' && n.intent.target !== undefined) {
      const peer = world.npcs[n.intent.target];
      const together = peer && peer.loc === n.loc && n.id !== peer.id && (n.loc !== 0 && n.loc !== 5 && n.loc !== 20 && n.loc !== 21 || world.rooms[n.id] === world.rooms[peer.id]);
      const accepts = together && world.sample('living-support', world.tick, n.id, peer.id) < Math.max(0.15, Math.min(0.85, 0.5 + peer.rel[n.id].trust / 200));
      const event = world.log(accepts ? `${n.name}向${peer.name}求助，得到对方同意和支持。` : together ? `${n.name}向${peer.name}求助，对方暂时婉拒。` : `${n.name}想向熟人求助，但没有遇见对方。`, accepts ? 'living_support_accepted' : 'living_support_unavailable', together ? [n.id, peer.id] : [n.id], [n.last, together ? peer.last : undefined], { location: n.loc, reason: accepts ? '本人主动求助，熟人实际同处且自主同意' : '未遇见或对方没有同意，压力不因此降低' }, 2);
      if (accepts) state.stress = clamp(state.stress - 20); world.remember(n,event); if (together) world.remember(peer,event);
    }
    state.stress = clamp(state.stress + (n.hunger > 85 || n.energy < 20 ? 5 : 0) + (state.balance < 3 ? 2 : 0) - (n.action === '休息' ? 8 : 1));
  }
}
