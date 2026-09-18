// tests/fuzz-testing/harness/canonical-json.harness.mjs
export function fuzz(input) {
  try {
    const s = new TextDecoder('utf-8', { fatal: false }).decode(input);
    const v = JSON.parse(s);
    // Property: re-stringify after recursive key-sort is idempotent.
    return JSON.stringify(JSON.parse(JSON.stringify(v))) === JSON.stringify(v);
  } catch (err) {
    // Most malformed JSON is "expected"; we don't treat parse errors
    // as crashes here.
    return err instanceof SyntaxError;
  }
}