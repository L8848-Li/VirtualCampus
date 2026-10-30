import { ActionScoreStore } from './actionScores.ts';
import { hash } from './random.ts';
import type { CampusEvent, CommittedEvent, ScoredAction } from './types.ts';

function freezeTree(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) freezeTree(child);
  Object.freeze(value);
}
const EMPTY_DIGEST = hash('VirtualCampus/event-log/1');

export class EventLog {
  #events: CampusEvent[] = [];
  #sealed = 0;
  #digest = EMPTY_DIGEST;
  #scores = new ActionScoreStore();

  get events(): readonly CampusEvent[] { return this.#events; }
  append(event: CampusEvent) {
    if (event.id !== this.#events.length + 1) throw new Error('Non-contiguous event ID.');
    if (event.data.scores) {
      this.#scores.add(event.id, event.data.scores);
      const { scores: _scores, ...data } = event.data;
      event = { ...event, data };
    }
    this.#events.push(event);
  }
  draft(id: number): CampusEvent {
    if (id <= this.#sealed || id > this.#events.length) throw new Error('Only pending events can be edited.');
    return this.#events[id - 1];
  }
  attachOptions(id: number, options: readonly ScoredAction[]) {
    this.draft(id); // Scores belong to the same pending operation as the action.
    this.#scores.addOptions(id, options);
  }
  seal(): void {
    if (this.#sealed === this.#events.length) return;
    // Detach once: event data can refer to live task/character arrays.
    const copies: CampusEvent[] = JSON.parse(JSON.stringify(this.#events.slice(this.#sealed)));
    for (const event of copies) {
      freezeTree(event);
      this.#events[this.#sealed++] = event;
      this.#digest = hash(JSON.stringify([this.#digest, event, this.#scores.digest(event.id)]));
    }
  }
  committed(): CommittedEvent[] { this.seal(); return this.#events.slice(); }
  get digest(): number { this.seal(); return this.#digest; }
  getActionScores(eventId: number) { return this.#scores.get(eventId); }
  encodedScores(eventId: number) { return this.#scores.encoded(eventId); }
  /** Independent full rebuild for regression and benchmark validation only. */
  recomputeDigest(): number {
    this.seal();
    let result = EMPTY_DIGEST;
    for (const event of this.#events) result = hash(JSON.stringify([result, event, this.#scores.recomputeDigest(event.id)]));
    return result;
  }
  encodedBytes(): number {
    this.seal();
    // UTF-8 size works in Node and browsers without importing Node APIs.
    let bytes = 0;
    const encoder = new TextEncoder();
    for (const event of this.#events) bytes += encoder.encode(JSON.stringify([event, this.#scores.encoded(event.id) ?? null])).byteLength;
    return bytes;
  }
}
