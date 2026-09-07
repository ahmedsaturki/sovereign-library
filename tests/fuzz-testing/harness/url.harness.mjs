// tests/fuzz-testing/harness/url.harness.mjs
export function fuzz(input) {
  try {
    const s = new TextDecoder('utf-8', { fatal: false }).decode(input);
    const u = new URL(s);
    return u.protocol.length > 0;
  } catch (err) {
    return err instanceof TypeError;
  }
}