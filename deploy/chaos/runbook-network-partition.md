# deploy/chaos/runbook-network-partition.md

## Goal

Verify that the canary and the steady-state deployments remain correct
under a 30-second network partition between two color groups.

## Pre-flight

1. Confirm the canary is at 10% traffic weight (or whatever the
   manifest declares).
2. Confirm observability dashboards show green.
3. Confirm abort deadline is set: `ABORT_DEADLINE=10m`.

## Experiment

```bash
# Chaos Mesh example
kubectl apply -f deploy/chaos/chaos-mesh-experiments/network-partition.yaml
sleep 60  # experiment window
```

## Abort criteria

- Sustained error rate > 1% after the partition heals.
- Latency p99 > 2s for > 60 seconds.
- Any unrecovered in-flight batch transaction (see `atomic-batch-file-transaction`).

## Post-validation

1. Run `scripts/chaos.mjs --suite ci/chaos/suite.json` to confirm the
   hermetic probes still pass.
2. Open or update an incident ticket.

## Rollback

`scripts/rollback.mjs --manifest ci/deploy/manifest.json`.