import fs from "node:fs";
import { evaluateSeeds } from "../src/core/evaluation.ts";
import { ENGINE_VERSION } from "../src/core/config.ts";
const seedCount = Number(process.argv[2] || 100);
const metrics = evaluateSeeds(seedCount);
const report = {
  engineVersion: ENGINE_VERSION,
  scenario: "quality-N seeds; one open day at tick 2 vs no intervention",
  definitions: {
    activityDiversity:
      "mean distinct location/action-kind combinations per NPC across 28 steps",
    fourStepRepeatRate:
      "fraction of 4-step windows with exactly the same location/action-kind",
    crisisRate:
      "fraction of NPC steps with energy <10 or hunger >95 after action",
    planFulfillmentRate:
      "unique fulfilled meal agreements / accepted meal agreements",
    taskCompletionRate: "completed reports / all reports",
    interventionChangedWorldRate:
      "final positions/relationships differ from the no-intervention control; RNG cascades may contribute",
    beliefRevisionRate: "revised personal interpretations / all sourced personal interpretations; an explanation is not guaranteed to be accepted",
    beliefSourceErrors: "interpretations whose source event is missing or was not experienced by the owner; must be zero",
    activityFulfillmentRate: "held NPC-organized gatherings / proposed gatherings; requires preparation and actual attendance",
  },
  metrics,
};
fs.mkdirSync("docs/reports", { recursive: true });
fs.writeFileSync(
  "docs/reports/behavior-v06.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.table(
  Object.fromEntries(
    Object.entries(metrics).filter(([key]) => key !== "eventTypes"),
  ),
);
console.log("Saved docs/reports/behavior-v06.json");
