// FNV-1a seeds the Mulberry32 stream. Wall-clock and animation never enter it.
export function hash(text: string) {
  let value = 2166136261;
  for (const c of text)
    value = Math.imul(value ^ c.charCodeAt(0), 16777619) >>> 0;
  return value;
}
export class Random {
  declare state: number;
  constructor(seed: string | number) {
    this.state = hash(String(seed));
  }
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
