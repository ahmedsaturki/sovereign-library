// tests/mutation-testing/mutators/operators.mjs
//
// Mutation operators for the stdlib-only mutator. Each operator is a
// pure function (source: string) → (source: string, mutated: bool).
// `mutated: false` means the operator chose not to apply.

export const operators = {
  'flip-equality': (src) => {
    if (/===/.test(src)) return { src: src.replace(/===/g, '!=='), mutated: true };
    if (/!==/.test(src)) return { src: src.replace(/!==/g, '==='), mutated: true };
    return { src, mutated: false };
  },
  'flip-bool': (src) => {
    if (/\btrue\b/.test(src)) return { src: src.replace(/\btrue\b/, 'false'), mutated: true };
    if (/\bfalse\b/.test(src)) return { src: src.replace(/\bfalse\b/, 'true'), mutated: true };
    return { src, mutated: false };
  },
  'flip-comparison': (src) => {
    if (/<=/.test(src)) return { src: src.replace(/<=/g, '<'), mutated: true };
    if (/</.test(src))   return { src: src.replace(/</g, '<='), mutated: true };
    return { src, mutated: false };
  },
  'remove-early-return': (src) => {
    const re = /^[ \t]*if[^\n]*\n[ \t]+return[^\n]*\n/m;
    if (re.test(src)) return { src: src.replace(re, ''), mutated: true };
    return { src, mutated: false };
  },
  'invert-condition': (src) => {
    const re = /if \(([^)]+)\)/;
    const m = re.exec(src);
    if (m) return { src: src.replace(re, `if (!(${m[1].trim()}))`), mutated: true };
    return { src, mutated: false };
  },
  'swap-arithmetic': (src) => {
    if (/\+/.test(src)) return { src: src.replace(/\+/g, '-'), mutated: true };
    if (/-/.test(src))  return { src: src.replace(/-/g, '+'), mutated: true };
    return { src, mutated: false };
  },
  'nullify-return': (src) => {
    const re = /return ([^;]+);/;
    const m = re.exec(src);
    if (m) return { src: src.replace(re, `return null;`), mutated: true };
    return { src, mutated: false };
  },
  'invert-logical': (src) => {
    if (/&&/.test(src)) return { src: src.replace(/&&/g, '||'), mutated: true };
    if (/\|\|/.test(src)) return { src: src.replace(/\|\|/g, '&&'), mutated: true };
    return { src, mutated: false };
  },
  'swap-loop-bound': (src) => {
    if (/for \(([^;]+); ([^;]+);/.test(src)) {
      return { src: src.replace(/for (\([^;]+); ([^;]+);/, (m, a, b) => {
        return `for (${a}; ${b.replace(/</, '<=')};`;
      }), mutated: true };
    }
    return { src, mutated: false };
  },
  'remove-throw': (src) => {
    const re = /^[ \t]*throw[^\n]*\n/m;
    if (re.test(src)) return { src: src.replace(re, ''), mutated: true };
    return { src, mutated: false };
  },
  'add-bound': (src) => {
    const re = /\b(\d+)\b/;
    if (re.test(src)) return { src: src.replace(re, (m, n) => `${parseInt(n, 10) + 1}`), mutated: true };
    return { src, mutated: false };
  },
};