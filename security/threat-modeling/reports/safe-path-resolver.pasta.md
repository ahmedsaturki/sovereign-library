# PASTA — safe-path-resolver

**Cube:** safe-path-resolver
**Last reviewed:** '2026-09-07'

## Business objective


## Technical scope


## Threats
[
  {
    "name": "\"Resolve user-supplied paths under a fixed root.\""
  },
  {
    "name": "\"Reject any path that escapes the root.\""
  },
  {
    "name": "\"Never leak path information to untrusted callers.\""
  },
  {
    "name": "\"cubes/safe-path-resolver-containment-boundary/src/index.js\""
  },
  {
    "name": "\"specs/safe-path-resolver-containment-boundary-v0.1.md\""
  },
  {
    "name": "component: \"resolve(root, candidate)\""
  },
  {
    "name": "component: 'validatePlain(options)'",
    "attacker_profiles": ""
  },
  {
    "name": "profile: 'Internal operator (trusted but fallible)'"
  },
  {
    "name": "profile: 'External user (untrusted)'"
  },
  {
    "name": "profile: 'Supply-chain attacker (compromised dependency)'",
    "threats": ""
  },
  {
    "name": "id: 'PASTA-SPR-1'"
  },
  {
    "name": "id: 'PASTA-SPR-2'"
  },
  {
    "name": "'static-analyse: rule sov-005 covers path.join(path) usage'"
  },
  {
    "name": "'fuzz-testing: harness/safe-path-resolver.harness.mjs'",
    "residual_risk": "'low'",
    "rationale": "'Containment invariant is formally verified (TLA+).'"
  }
]

## Residual risk
unknown
