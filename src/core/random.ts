// FNV-1a seeds the Mulberry32 stream. Wall-clock and animation never enter it.
export function hash(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // The original code iterated Unicode code points and hashed the first
    // UTF-16 unit. Preserve that behavior, including unpaired surrogates.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    value = Math.imul(value ^ code, 16777619);
  }
  return value >>> 0;
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
