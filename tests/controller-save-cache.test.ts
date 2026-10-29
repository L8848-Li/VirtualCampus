import { afterEach, expect, test, vi } from 'vitest';
import { World } from '../src/engine.ts';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('view-only updates reuse a save and world changes invalidate it', async () => {
  const contents = new Map<string, string>();
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('localStorage', { getItem: (key: string) => contents.get(key) ?? null,
    setItem: (key: string, value: string) => contents.set(key, value) });
  const { createSimulation } = await import('../src/controller/simulation.ts');
  const spy = vi.spyOn(World.prototype, 'toSave');
  const sim = createSimulation();
  sim.select(1); expect(spy).toHaveBeenCalledTimes(1);
  sim.select(2); sim.watch(2); sim.setFollow(); expect(spy).toHaveBeenCalledTimes(1);
  sim.singleStep(); expect(spy).toHaveBeenCalledTimes(2);
  const payload = JSON.parse([...contents.values()][0]);
  expect(World.fromSave(payload.world).tick).toBe(1);
  sim.intervene('party'); expect(spy).toHaveBeenCalledTimes(3);
  sim.select(3); expect(spy).toHaveBeenCalledTimes(3);
});
