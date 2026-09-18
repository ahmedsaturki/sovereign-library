# deploy/chaos/runbook-pod-kill.md

## Goal

Verify that the Sovereign deployment recovers gracefully when a single
pod is killed mid-traffic. Targets: `Deployment/sovereign`.

## Pre-flight

1. Confirm `kubectl get deploy/sovereign` shows all replicas Ready.
2. Confirm the live deployment is on the release under test (annotation
   `sovereign/release == <tag>`).
3. Confirm chaos authorization is in force (operator ACKed in #incidents).
4. Set the abort deadline: `ABORT_DEADLINE=10m`.

## Experiment (Litmus)

```bash
kubectl apply -f deploy/chaos/litmus-experiments/pod-kill.yaml
kubectl wait --for=condition=Completed experimentengine/litmus/pod-kill --timeout=10m
```

Expected observations:

- The targeted pod is killed and rescheduled within the deployment's
  `progressDeadlineSeconds` (default 600s; Sovereign sets 300s).
- No 5xx responses for more than 30 consecutive seconds.
- No P0 incident is opened automatically.

## Abort criteria (immediate rollback)

- Sustained error rate > 1% for > 60 seconds.
- p99 latency > 2s for > 60 seconds.
- Any data-loss log line (`filesystem-recovery-journal` or
  `atomic-batch-file-transaction` recovery-required state).

## Post-validation

1. Confirm `kubectl get pods -l app=sovereign` shows the rescheduled pod
   Ready.
2. Run `scripts/perf-bench.mjs` and `scripts/chaos.mjs` locally to
   verify in-process invariants still hold.
3. Open or update an incident ticket per `templates/incident-response.md`.

## Rollback

If any abort criterion triggers, run `scripts/rollback.mjs
--manifest ci/deploy/manifest.json`. The generated commands revert the
image tag and disable the feature flags listed in the manifest.