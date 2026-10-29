import { expect, test } from 'vitest';
import { chooseHolidayReturn, holiday } from '../src/core/holiday.ts';

test('holiday choice is personal and return falls inside the observed semester', () => {
  const person = { id: 3, energy: 50, social: 50 };
  expect(chooseHolidayReturn(person, purpose => purpose === 'holiday-leave' ? 0 : 0)).toBe(holiday.earliestReturnTick);
  expect(chooseHolidayReturn(person, purpose => purpose === 'holiday-leave' ? 0 : 1)).toBe(holiday.latestReturnTick);
  expect(chooseHolidayReturn(person, () => 0.99)).toBeNull();
  expect(holiday.announceTick).toBeLessThan(holiday.departTick);
  expect(holiday.departTick).toBeLessThan(holiday.earliestReturnTick);
  expect(holiday.latestReturnTick).toBeLessThan(167);
});
