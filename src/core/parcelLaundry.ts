import type { World } from '../engine.ts';
import type { LocationId } from './types.ts';
import { dormLocation, queueRank } from './campusLife.ts';

export interface Parcel { owner: number; arrivedTick: number; deadline: number; status: 'waiting' | 'overdue' | 'collected'; lastEvent: number }
export interface Laundry { owner: number; dorm: LocationId; startedTick: number; status: 'washing' | 'collected'; lastEvent: number }
export const LAUNDRY_CAPACITY = 2;

/** Notifications are private; overdue parcels remain available at the pickup point. */
export function notifyParcels(world: World) {
  for (const n of world.npcs) {
    if (world.tick % 56 === 4 + n.id * 2 && !world.parcels.some(p => p.owner === n.id && p.status !== 'collected')) {
      const id = world.log(`${n.name}收到包裹到达通知，可前往活动中心取件。`, 'parcel_arrived', [n.id], [], { location: 4, dueTick: world.tick + 20, reason: '虚构包裹已到达，仍需本人到场领取' }, 2);
      world.parcels.push({ owner: n.id, arrivedTick: world.tick, deadline: world.tick + 20, status: 'waiting', lastEvent: id }); world.remember(n, id);
    }
  }
  for (const parcel of world.parcels) if (parcel.status === 'waiting' && world.tick > parcel.deadline) {
    parcel.status = 'overdue'; const n = world.npcs[parcel.owner];
    parcel.lastEvent = world.log(`${n.name}的包裹已逾期，仍在取件点等待处理。`, 'parcel_overdue', [n.id], [parcel.lastEvent], { location: 4, reason: '逾期不会自动领取' }, 2); world.remember(n, parcel.lastEvent);
  }
}

/** Resolve actual choices in a rotating deterministic order; uncollected laundry keeps its machine. */
export function resolveParcelLaundry(world: World) {
  for (const n of world.npcs) {
    if (n.intent?.kind === 'parcel_pickup' && n.loc === 4) {
      const parcel = world.parcels.find(p => p.owner === n.id && p.status !== 'collected');
      if (parcel) { parcel.status = 'collected'; parcel.lastEvent = world.log(`${n.name}到取件点领取了自己的包裹。`, 'parcel_collected', [n.id], [parcel.lastEvent, n.last], { location: 4, reason: '本人自主选择并到场领取' }, 2); world.remember(n, parcel.lastEvent); }
    }
    if (n.intent?.kind === 'laundry_pickup') {
      const laundry = world.laundry.find(l => l.owner === n.id && l.status === 'washing' && l.dorm === n.loc && world.tick > l.startedTick);
      if (laundry) { laundry.status = 'collected'; laundry.lastEvent = world.log(`${n.name}回到原宿舍楼取回洗好的衣物。`, 'laundry_collected', [n.id], [laundry.lastEvent, n.last], { location: laundry.dorm, reason: '本人实际回到原楼领取，机器释放' }, 2); world.remember(n, laundry.lastEvent); }
    }
  }
  const candidates = world.npcs.filter(n => n.intent?.kind === 'laundry_start').sort((a,b) => queueRank(a.id, world.tick, world.npcs.length) - queueRank(b.id, world.tick, world.npcs.length));
  for (const n of candidates) {
    const dorm = dormLocation(world.rooms[n.id]);
    if (n.loc !== dorm || world.laundry.some(l => l.owner === n.id && l.status === 'washing')) continue;
    const available = world.laundry.filter(l => l.dorm === dorm && l.status === 'washing').length < LAUNDRY_CAPACITY;
    const id = world.log(available ? `${n.name}在宿舍楼使用了一台洗衣机。` : `${n.name}到宿舍楼洗衣，但机器已满，暂时等待。`, available ? 'laundry_started' : 'laundry_waiting', [n.id], [n.last], { location: dorm, reason: available ? '本人到场且机器有空位，下一时段起可取' : '机器容量已满，本次未开始洗衣' }, 2);
    world.remember(n, id);
    if (available) world.laundry.push({ owner: n.id, dorm, startedTick: world.tick, status: 'washing', lastEvent: id });
  }
}
