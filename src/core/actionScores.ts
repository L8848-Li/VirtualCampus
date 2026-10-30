import type { ActionScore, ScoredAction } from './types.ts';
import { hash } from './random.ts';

export const scoreColumns = ['total', 'needAndGoal', 'habit', 'avoidance', 'exhaustion', 'urgentMeal', 'noise', 'commitment', 'switching'] as const;
const WIDTH = 3 + scoreColumns.length;
interface Trace { names: readonly string[]; values: Int32Array; digest: number }
export interface EncodedScores { names: readonly string[]; values: number[] }
const NO_NAMES: readonly string[] = Object.freeze([]);

// Scores are a fixed-width sequence of signed 32-bit integers. Hash each
// little-endian byte directly instead of materializing their JSON every tick.
function traceDigest(names: readonly string[], values: Int32Array): number {
  let result = hash(JSON.stringify([names, values.length]));
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    result = Math.imul(result ^ (value & 255), 16777619);
    result = Math.imul(result ^ ((value >>> 8) & 255), 16777619);
    result = Math.imul(result ^ ((value >>> 16) & 255), 16777619);
    result = Math.imul(result ^ (value >>> 24), 16777619);
  }
  return result >>> 0;
}
const cents = (value: number) => Number.isInteger(value * 100) ? value * 100 : Math.round(Number(value.toFixed(2)) * 100);

/** The numeric buffers never escape this store. Only a requested table is decoded. */
export class ActionScoreStore {
  #names: string[] = [];
  #nameIds = new Map<string, number>();
  #traces = new Map<number, Trace>();

  #nameId(name: string, names: string[]) {
    let id = this.#nameIds.get(name);
    if (id === undefined) { id = this.#names.length; this.#names.push(name); this.#nameIds.set(name, id); names.push(name); }
    return id;
  }
  #store(eventId: number, names: string[], values: Int32Array) {
    this.#traces.set(eventId, { names: names.length ? Object.freeze(names) : NO_NAMES, values, digest: traceDigest(names, values) });
  }

  add(eventId: number, scores: readonly ActionScore[]) {
    if (this.#traces.has(eventId)) throw new Error('Duplicate action trace.');
    const names: string[] = [], values = new Int32Array(scores.length * WIDTH);
    scores.forEach((score, row) => {
      const offset = row * WIDTH;
      values[offset] = this.#nameId(score.action, names); values[offset + 1] = score.location; values[offset + 2] = score.target ?? -1;
      scoreColumns.forEach((key, column) => {
        const value = Math.round(score[key] * 100);
        if (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647) throw new Error('Invalid action score.');
        values[offset + 3 + column] = value;
      });
    });
    this.#store(eventId, names, values);
  }

  /** Preserve toFixed(2) display semantics without allocating one score object
   * per candidate. Integer-valued components do not need string formatting. */
  addOptions(eventId: number, options: readonly ScoredAction[]) {
    if (this.#traces.has(eventId)) throw new Error('Duplicate action trace.');
    const names: string[] = [], values = new Int32Array(options.length * WIDTH);
    for (let row = 0; row < options.length; row++) {
      const o = options[row], offset = row * WIDTH;
      values[offset] = this.#nameId(o.action, names); values[offset + 1] = o.loc; values[offset + 2] = o.target ?? -1;
      values[offset + 3] = cents(o.score); values[offset + 4] = cents(o.base); values[offset + 5] = o.habit * 100;
      values[offset + 6] = cents(o.avoidance); values[offset + 7] = o.exhaustion * 100; values[offset + 8] = o.urgentMeal * 100;
      values[offset + 9] = cents(o.noise); values[offset + 10] = o.commitment * 100; values[offset + 11] = o.switching * 100;
    }
    this.#store(eventId, names, values);
  }
  digest(eventId: number) { return this.#traces.get(eventId)?.digest ?? null; }
  recomputeDigest(eventId: number) {
    const trace = this.#traces.get(eventId);
    return trace ? traceDigest(trace.names, trace.values) : null;
  }

  encoded(eventId: number): EncodedScores | undefined {
    const trace = this.#traces.get(eventId);
    return trace ? { names: trace.names, values: Array.from(trace.values) } : undefined;
  }

  get(eventId: number): readonly Readonly<ActionScore>[] | undefined {
    const trace = this.#traces.get(eventId);
    if (!trace) return undefined;
    const scores: ActionScore[] = [];
    for (let offset = 0; offset < trace.values.length; offset += WIDTH) {
      const score = { action: this.#names[trace.values[offset]], location: trace.values[offset + 1], target: trace.values[offset + 2] === -1 ? null : trace.values[offset + 2] } as ActionScore;
      scoreColumns.forEach((key, column) => { score[key] = trace.values[offset + 3 + column] / 100; });
      scores.push(Object.freeze(score));
    }
    return Object.freeze(scores);
  }
}
