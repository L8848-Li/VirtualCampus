export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
export function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}
export function clampPan(pan: Point, zoom: number, size: Size): Point {
  const bounded = clampZoom(zoom);
  return {
    x: Math.min(0, Math.max(size.width * (1 - bounded), pan.x)),
    y: Math.min(0, Math.max(size.height * (1 - bounded), pan.y)),
  };
}
export function zoomAround(pan: Point, current: number, next: number, size: Size, pivot: Point): Point {
  const oldZoom = clampZoom(current), newZoom = clampZoom(next);
  const ratio = newZoom / oldZoom;
  return clampPan({ x: pivot.x - (pivot.x - pan.x) * ratio, y: pivot.y - (pivot.y - pan.y) * ratio }, newZoom, size);
}
