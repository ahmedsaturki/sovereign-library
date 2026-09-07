// tests/fuzz-testing/harness/digest.harness.mjs
import { createHash } from 'node:crypto';

export function fuzz(input) {
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(input).digest();
  if (a.length !== 32 || b.length !== 32) return false;
  return a.equals(b);
}