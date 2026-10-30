import { evaluateLiving } from './lib/livingEvaluation.ts';
import { writeLivingReport } from './lib/semesterEvaluation.ts';
console.log(JSON.stringify(writeLivingReport(evaluateLiving())));
