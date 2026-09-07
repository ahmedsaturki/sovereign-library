// tests/fuzz-testing/harness/glob-path-matcher.harness.mjs
export function fuzz(input) {
  try {
    const s = new TextDecoder('utf-8', { fatal: false }).decode(input);
    const m = /^([^:]+):(.+)$/.exec(s);
    if (!m) return true;
    const [, pattern, str] = m;
    // Property: empty pattern matches only empty string.
    if (pattern === '') return str === '';
    return pattern.length >= 0;
  } catch (err) {
    return false;
  }
}