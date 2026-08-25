# Policy Decision Contract v0.1

A policy decision is an immutable record containing the evaluated action/resource, boolean `allowed`, the winning rule id when present, matched rule ids in deterministic order, and the rule count used for evaluation.

Consumers must treat missing matches as deny-by-default and must not infer authorization from ambient process state.
