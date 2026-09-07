// tests/static-analysis/custom-rules/rules.mjs
//
// Sovereign custom static-analysis rules.
//
// Each rule is { id, severity, message, pattern, exclude }.
// `pattern` is a JS RegExp (not a full AST matcher - Sovereign cubes
// are small enough that grep-equivalence is acceptable for these
// spot checks).
// `exclude` is an array of substrings; if any substring matches the
// file path, the rule is skipped for that file. Used to whitelist
// detection rules that legitimately reference forbidden patterns.

export const rules = [
  { id: 'sov-001', severity: 'blocker',  message: 'eval / new Function is forbidden', pattern: /\beval\s*\(|\bnew\s+Function\s*\(/, exclude: ['verify-security-boundaries', 'custom-rules'] },
  { id: 'sov-002', severity: 'blocker',  message: 'hardcoded credential suspected',   pattern: /(?:password|secret|token|api[_-]?key)\s*[:=]\s*["'`][A-Za-z0-9_\-]{16,}/i, exclude: ['custom-rules', 'post-quantum/configs'] },
  { id: 'sov-003', severity: 'major',    message: 'atomic-write via fs.writeFileSync',pattern: /fs\.writeFileSync\s*\([^)]*\)\s*;?\s*$/m },
  { id: 'sov-004', severity: 'major',    message: 'untrusted input not LIMIT-checked',pattern: /\b(?:req|input|argv|args|param)\b[^\n]{0,80}\n(?![^\n]*LIMIT_EXCEEDED)/m, exclude: ['tests', 'examples'] },
  { id: 'sov-005', severity: 'critical', message: 'path traversal candidate',          pattern: /path\.(?:join|resolve)\s*\(\s*[^,]+,\s*(?:req|input|argv|args|user[_-]?input)/ },
  { id: 'sov-006', severity: 'critical', message: 'innerHTML / outerHTML write',      pattern: /\.(?:innerHTML|outerHTML)\s*=/ },
  { id: 'sov-007', severity: 'major',    message: 'exec instead of spawn',            pattern: /\bchild_process\.exec\b/ },
  { id: 'sov-008', severity: 'major',    message: 'plain http - prefer https',        pattern: /["'`]http:\/\/(?!example\.com|localhost)/ },
  { id: 'sov-009', severity: 'major',    message: 'Math.random in security context',   pattern: /Math\.random\s*\(/ },
  { id: 'sov-010', severity: 'minor',    message: '== instead of === (avoid loose equality)', pattern: /(?<![=!<>])==(?![=])/, exclude: ['tests', 'examples', 'verify-browser', 'pen-testing'] },
  { id: 'sov-011', severity: 'minor',    message: 'I/O without try/catch',            pattern: /\bfs\.(?:readFile|writeFile|appendFile|unlink|rename)\s*\([^)]*\)\s*;(?![^\n]*catch)/m },
  { id: 'sov-012', severity: 'major',    message: 'full request/response logging',     pattern: /console\.(?:log|info|debug)\s*\(\s*(?:req|res|response|request)\b/i },
  { id: 'sov-013', severity: 'major',    message: 'setTimeout with string argument',  pattern: /set(?:Timeout|Interval)\s*\(\s*["'`]/ },
  { id: 'sov-014', severity: 'major',    message: 'unbounded user loop',              pattern: /for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+(?:req|input|argv|args)/ },
  { id: 'sov-015', severity: 'minor',    message: 'declared throw shape mismatch',    pattern: /throw\s+new\s+\w+Error\s*\(/ },
];