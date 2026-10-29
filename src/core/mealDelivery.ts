import type { LocationId } from './types.ts';
import { isPrivateDorm } from './campusLife.ts';

// The locations correspond to the game's three dormitory areas. The pickup point
// is downstairs, not the student's room; all times and prices are game values.
export type DormLocation = 0 | 5 | 20 | 21;
export type DeliveryStatus = 'ordered' | 'ready' | 'collected' | 'expired';
export interface MealDelivery {
  id: string;
  owner: number;
  dorm: DormLocation;
  orderedTick: number;
  dueTick: number;
  expiresTick: number;
  estimatedMinutes: number;
  simulatedPrice: number;
  status: DeliveryStatus;
  lastEvent?: number;
}
export interface DeliveryNotice {
  type: 'ordered' | 'ready' | 'collected' | 'expired';
  tick: number;
  orderId: string;
  owner: number;
}
export type DeliverySample = (purpose: string, ...keys: (string | number)[]) => number;
export interface DeliveryChoice {
  owner: number;
  tick: number;
  loc: LocationId;
  hunger: number;
  // Only this person's order history is passed to the decision.
  currentOrder?: MealDelivery;
  lastOrderTick?: number;
  endTick: number;
}

/** A personal decision, never a guaranteed order or a read of others' needs. */
export function considerMealDelivery(choice: DeliveryChoice, sample: DeliverySample): MealDelivery | undefined {
  const { owner, tick, loc, hunger, currentOrder, lastOrderTick, endTick } = choice;
  if (!isPrivateDorm(loc) || hunger < 65 || tick + 1 >= endTick ||
      (currentOrder && (currentOrder.status === 'ordered' || currentOrder.status === 'ready')) ||
      (lastOrderTick !== undefined && tick - lastOrderTick < 4)) return;
  const probability = Math.min(0.7, 0.2 + (hunger - 65) / 70);
  if (sample('delivery-choice', tick, owner) >= probability) return;
  const estimate = Math.max(0, Math.min(0.999999, sample('delivery-time', tick, owner)));
  const price = Math.max(0, Math.min(0.999999, sample('delivery-price', tick, owner)));
  return { id: `delivery-${tick}-${owner}`, owner, dorm: loc, orderedTick: tick,
    dueTick: tick, expiresTick: Math.min(tick + 1, endTick - 1), estimatedMinutes: 25 + Math.floor(estimate * 21),
    simulatedPrice: 14 + Math.floor(price * 9), status: 'ordered' };
}

/**
 * Advance one order using the owner's actual choice and location only.
 * A ready order can be picked up in either the arrival or next period. A late
 * caller cannot retroactively collect an expired order. The caller applies the
 * hunger delta once, only if a new collection notice is returned.
 */
export function advanceMealDelivery(order: MealDelivery, tick: number, actorId: number, loc: LocationId, pickupChosen: boolean): {
  order: MealDelivery; notices: DeliveryNotice[]; hungerDelta: number;
} {
  const next = { ...order };
  const notices: DeliveryNotice[] = [];
  let hungerDelta = 0;
  const notice = (type: DeliveryNotice['type'], at: number) => notices.push({ type, tick: at, orderId: next.id, owner: next.owner });
  if (next.status === 'ordered' && tick >= next.dueTick) {
    next.status = 'ready';
    notice('ready', next.dueTick);
  }
  if (next.status === 'ready' && tick > next.expiresTick) {
    next.status = 'expired';
    notice('expired', tick);
  } else if (next.status === 'ready' && tick >= next.dueTick && actorId === next.owner && loc === next.dorm && pickupChosen) {
    next.status = 'collected';
    hungerDelta = -55;
    notice('collected', tick);
  }
  return { order: next, notices, hungerDelta };
}
