// Fictional short break within the six-week simulation; no real calendar or
// destination is implied. Return happens before the final observation period.
export const holiday = {
  announceTick: 152,
  departTick: 156,
  earliestReturnTick: 162,
  latestReturnTick: 166,
  offCampusLocation: 22,
} as const;
export const isOnCampus = (location: number) => location !== holiday.offCampusLocation;

/** A personal, deterministic choice. It does not inspect other people's plans. */
export function chooseHolidayReturn(
  person: { id: number; energy: number; social: number },
  sample: (purpose: string, ...keys: (number | string)[]) => number,
): number | null {
  const leaveProbability = Math.max(0.2, Math.min(0.8, 0.45 + (50 - person.energy) / 200 + (50 - person.social) / 400));
  if (sample('holiday-leave', person.id) >= leaveProbability) return null;
  const choices = holiday.latestReturnTick - holiday.earliestReturnTick + 1;
  const value = Math.max(0, Math.min(0.999999, sample('holiday-return', person.id)));
  return holiday.earliestReturnTick + Math.floor(value * choices);
}
