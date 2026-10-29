import { spawnSync } from "node:child_process";

const started = performance.now();
console.log("Full replay: 100 seeds (0–99), every tick, with rooms/groups/party interventions.");
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--no-file-parallelism", "tests/engine.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, VIRTUAL_CAMPUS_FULL_REPLAY: "1" },
});
console.log(`Full replay elapsed: ${((performance.now() - started) / 1000).toFixed(1)} s`);
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
