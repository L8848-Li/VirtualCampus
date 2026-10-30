export const EVENT_PAGE_SIZE = 100;
export const STORY_PAGE_SIZE = 6;
export const HISTORY_PAGE_SIZE = 50;
export function pageIndex(index: number, length: number, size: number) {
  return Math.max(0, Math.min(Math.floor(index), Math.max(0, Math.ceil(length / size) - 1)));
}
export function pageItems<T>(items: readonly T[], index: number, size: number): T[] {
  const page = pageIndex(index, items.length, size);
  return items.slice(page * size, (page + 1) * size);
}
export function pageContaining<T>(items: readonly T[], item: T, size: number): number | undefined {
  const index = items.indexOf(item);
  return index < 0 ? undefined : Math.floor(index / size);
}
