import { expect, test } from 'vitest';
import { hash } from '../src/core/random.ts';

function originalHash(text: string) {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  return value;
}

test('optimized hash preserves seed and save checksums including Unicode edge cases', () => {
  for (const text of ['', '邮邮大学', '𠮷😀', 'A\ud800B', '\udc00', '\ud800\udc00\udfff', '校园😀'.repeat(3000)]) {
    expect(hash(text)).toBe(originalHash(text));
  }
});
