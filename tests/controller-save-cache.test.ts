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

test('legacy saves are preserved and storage failure never reports success', async () => {
  const legacy = '{"old":"untouched"}', contents = new Map([['virtualcampus.save.v16.0', legacy]]);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => contents.get(key) ?? null,
    setItem: () => { throw new Error('quota'); },
  });
  const { createSimulation } = await import('../src/controller/simulation.ts');
  const sim = createSimulation();
  expect(sim.legacyAvailable.value).toBe(true);
  sim.singleStep();
  expect(sim.snapshot.value.tick).toBe(1);
  expect(sim.saveState.value).toContain('不可用');
  expect(contents.get('virtualcampus.save.v16.0')).toBe(legacy);
  sim.stop();
});

test('the selected score cache follows event and world identity across reset, replay and import', async () => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
  const { createSimulation } = await import('../src/controller/simulation.ts');
  const sim = createSimulation();
  sim.singleStep();
  const id = sim.snapshot.value.events.find(e => e.type === 'action')!.id;
  sim.detailId.value = id;
  const first = sim.actionScores.value;
  expect(first?.length).toBeGreaterThan(0);
  sim.singleStep();
  expect(sim.actionScores.value).toBe(first);
  sim.replay();
  expect(sim.actionScores.value).toEqual(first);
  expect(sim.actionScores.value).not.toBe(first);
  sim.detailId.value = null;
  expect(sim.actionScores.value).toBeUndefined();
  sim.reset();
  expect(sim.snapshot.value.tick).toBe(0);
  const world = new World('import-cache'); world.step();
  await sim.importFile({ size: 100, text: async () => JSON.stringify({ world: world.toSave() }) } as File);
  sim.detailId.value = world.events.find(e => e.type === 'action')!.id;
  expect(sim.actionScores.value).toEqual(world.getActionScores(sim.detailId.value));
  sim.stop();
});
