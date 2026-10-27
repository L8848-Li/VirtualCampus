import { test } from "vitest";
import assert from "node:assert/strict";
import { clampZoom, clampPan, zoomAround } from "../src/ui/mapViewport.ts";

test("zoom stays within the supported scale", () => {
  assert.equal(clampZoom(0.2), 1);
  assert.equal(clampZoom(7), 5);
  assert.equal(clampZoom(2.5), 2.5);
});
test("panning never moves the scaled map beyond the viewport edges", () => {
  assert.deepEqual(clampPan({ x: 400, y: -2000 }, 2, { width: 800, height: 600 }), { x: 0, y: -600 });
  assert.deepEqual(clampPan({ x: -400, y: -200 }, 1, { width: 800, height: 600 }), { x: 0, y: 0 });
});
test("zooming around a point keeps that point stationary when it is not at an edge", () => {
  const size = { width: 800, height: 600 }, pivot = { x: 400, y: 300 };
  const zoomed = zoomAround({ x: 0, y: 0 }, 1, 2, size, pivot);
  assert.deepEqual(zoomed, { x: -400, y: -300 });
  assert.deepEqual(zoomAround(zoomed, 2, 1, size, pivot), { x: 0, y: 0 });
});
test("zooming near an edge remains bounded even with an extreme pivot", () => {
  assert.deepEqual(zoomAround({ x: 0, y: 0 }, 1, 3, { width: 800, height: 600 }, { x: 5000, y: 5000 }), { x: -1600, y: -1200 });
});
