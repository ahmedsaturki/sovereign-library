// Common pattern shared by every Phase-2 script. Flags (--dry-run,
// --reverse, --warn-only, ...) are keys whose presence is the value;
// their next argv is only consumed if it does not start with `--`.
//
// We centralize this so script authors don't have to remember to
// special-case every flag.
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const key = k.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

export const parseArgsDefault = parseArgs;