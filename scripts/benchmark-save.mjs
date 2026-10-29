// Same-process benchmark: one cold run, one warm-up, then five runs per seed.
// Each run measures only step, snapshot and save in that order; output is JSONL.
import { World } from '../src/engine.ts';
import { createSnapshotCapture } from '../src/controller/snapshot.ts';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function sourceDigest() {
  const hash = createHash('sha256');
  function addDirectory(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) addDirectory(path);
      else if (entry.isFile()) { hash.update(path); hash.update(readFileSync(path)); }
    }
  }
  addDirectory('src');
  for (const path of ['package.json', 'scripts/benchmark-save.mjs']) { hash.update(path); hash.update(readFileSync(path)); }
  return hash.digest('hex');
}
const initialDigest = sourceDigest();
console.log(JSON.stringify({ phase: 'metadata', node: process.version, platform: process.platform, arch: process.arch, sourceDigest: initialDigest }));
const pct = (values, p) => values.slice().sort((a,b) => a-b)[Math.floor((values.length-1)*p)];
function run(seed, phase, repeat) {
  const world = new World(seed), capture = createSnapshotCapture();
  const step = [], snapshot = [], save = [];
  while (world.tick < 168) {
    let start = performance.now(); world.step(); step.push(performance.now()-start);
    start = performance.now(); capture(world); snapshot.push(performance.now()-start);
    start = performance.now(); world.toSave(); save.push(performance.now()-start);
  }
  const synchronousTotal = step.map((value, i) => value + snapshot[i] + save[i]);
  console.log(JSON.stringify({ phase, seed, repeat, events: world.events.length,
    step, snapshot, save, synchronousTotal, rss: process.memoryUsage().rss, heapUsed: process.memoryUsage().heapUsed,
    summary: Object.fromEntries(Object.entries({step, snapshot, save, synchronousTotal}).map(([name, xs]) => [name, {median: pct(xs,.5), p95: pct(xs,.95)}])) }));
}
run(0, 'cold', 0);
run(1, 'warmup', 0);
const seeds = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [0,1,2];
for (const seed of seeds) for (let repeat=0; repeat<5; repeat++) run(seed, 'sample', repeat);
const finalDigest = sourceDigest();
console.log(JSON.stringify({ phase: 'complete', sourceDigest: finalDigest, sourceUnchanged: finalDigest === initialDigest }));
