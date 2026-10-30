import { evaluateAcademicSemesters, writeLivingReport } from './lib/semesterEvaluation.ts';
import { evaluateLiving } from './lib/livingEvaluation.ts';
const started = performance.now();
const academic = evaluateAcademicSemesters();
const living = writeLivingReport(evaluateLiving());
console.log(JSON.stringify({ academic, living, elapsedMs: Math.round(performance.now() - started) }));
