# deploy/chaos/ — Live-cluster chaos runbooks (Phase-2)

Sovereign Library's canonical distribution channel is GitHub Releases;
in-process chaos probes run on every PR via `scripts/chaos.mjs`. The
files in this directory are **runbooks for downstream operators** that
deploy Sovereign Cubes into live Kubernetes clusters and want to wire
in real-cluster chaos engineering.

We do NOT trigger live-cluster chaos from CI on a self-hosted runner.
Per `AGENTS.md` and `GOVERNANCE.md`, any action that can affect
external systems must be authorized explicitly. The manifests here are
**referenced** by the Phase-2 release-engineering workflow (the
`chaos-probes` job can run against a target cluster when the operator
opts in via a `CHAOS_TARGET` repository variable) but never executed
on PRs from forks.

---

## Files

- `litmus-experiments/` — copy-paste-ready Litmus experiment YAMLs for
  pod-kill, network-loss, dns-error, and disk-fill scenarios. Apply
  with `kubectl apply -f` after installing Litmus via the ChaosCenter
  or `helm install litmus` from [litmuschaos/litmus](https://github.com/litmuschaos/litmus).

- `chaos-mesh-experiments/` — equivalent manifests for Chaos Mesh
  (CNCF Incubating project). Apply via the Chaos Mesh dashboard or
  `kubectl apply -f`.

- `runbook-pod-kill.md` — step-by-step playbook: preflight, blast
  radius, abort criteria, post-validation.

- `runbook-network-partition.md` — step-by-step playbook for a 30-second
  network partition between two color deployments (blue-green or canary).

---

## How to invoke from CI (authorized operators only)

```yaml
# .github/workflows/chaos-live.yml (not committed; lives per-deploy)
on: workflow_dispatch
jobs:
  pod-kill:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Apply Litmus pod-kill
        env:
          KUBECONFIG: ${{ secrets.KUBECONFIG }}
        run: |
          echo "$KUBECONFIG" > kubeconfig
          KUBECONFIG=./kubeconfig kubectl apply -f deploy/chaos/litmus-experiments/pod-kill.yaml
          KUBECONFIG=./kubeconfig kubectl wait --for=condition=Completed experimentengine/litmus/pod-kill --timeout=300s
```

---

## Why this directory is empty by default

The `chaos-probes` job in `.github/workflows/release-engineering.yml`
runs deterministic, hermetic probes (process-kill, network-failure,
disk-full, clock-jump, signal-storm). These probe the cubes themselves,
not the deployment topology. Live-cluster chaos is a separate concern
and is documented here for operators, not executed from CI.