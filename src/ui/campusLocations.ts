import { places } from "../core/config.ts";
import type { LocationId } from "../core/types.ts";

// Percentages are relative to the complete 1824 × 1368 campus illustration.
export const campusLocations: { id: LocationId; name: string; x: number; y: number }[] = [
  { id: 0, name: places[0], x: 34.2, y: 77.1 },
  { id: 1, name: places[1], x: 48.4, y: 67.1 },
  { id: 2, name: places[2], x: 45.3, y: 87.4 },
  { id: 3, name: places[3], x: 65.9, y: 46.6 },
  { id: 4, name: places[4], x: 52.6, y: 50.5 },
  { id: 5, name: places[5], x: 34.6, y: 40.4 },
  { id: 6, name: places[6], x: 44, y: 41 },
  { id: 7, name: places[7], x: 24.1, y: 45 },
  { id: 8, name: places[8], x: 65.6, y: 67 },
  { id: 9, name: places[9], x: 81.3, y: 62 },
  { id: 10, name: places[10], x: 82, y: 88 },
  { id: 11, name: places[11], x: 52.5, y: 40 },
  { id: 12, name: places[12], x: 57, y: 16 },
  { id: 13, name: places[13], x: 34.7, y: 23.8 },
  { id: 14, name: places[14], x: 82, y: 28 },
  { id: 15, name: places[15], x: 14.5, y: 43 },
  { id: 16, name: places[16], x: 18.8, y: 89.8 },
  { id: 17, name: places[17], x: 34.7, y: 13 },
  { id: 18, name: places[18], x: 82, y: 14 },
  { id: 19, name: places[19], x: 18.5, y: 72.8 },
  { id: 20, name: places[20], x: 36.5, y: 17.3 },
  { id: 21, name: places[21], x: 20.8, y: 92.2 },
];
