(function (root) {
  // FNV-1a seeds the Mulberry32 stream. Wall-clock and animation never enter it.
  function hash(text) {
    let value = 2166136261;
    for (const c of text)
      value = Math.imul(value ^ c.charCodeAt(0), 16777619) >>> 0;
    return value;
  }
  class Random {
    constructor(seed) {
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
  const api = { Random, hash };
  if (typeof module !== "undefined") module.exports = api;
  else root.CampusRandom = api;
})(typeof window !== "undefined" ? window : globalThis);
