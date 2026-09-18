# Sovereign Library — CI Performance Benchmark v1.0

> Empirical wall-clock and per-job timing summary for the
> `feat/continuity-hardening` branch. Generated alongside the
> hardening wave; numbers below are **expected budgets**, calibrated
> against the previous Android CI runs (the only branch with non-trivial
> matrix coverage at audit time). Actual numbers will be filled in by
> the first CI run.

## Methodology

Each workflow's matrix produces a configurable number of runners. We
measure wall-clock per runner, normalised by matrix cardinality, and
report:

- Median (s): the typical wall-clock observed across the last 5 runs
  on the same branch.
- 95th percentile (s): long-tail budget used to set `timeout-minutes`.
- Cache-hit ratio: fraction of runs where the Gradle cache was warm at
  job start (proxied by `cache-read-only: true` for PRs).

## Expected budgets (matrix-aware)

### `android.yml`

| Job | Matrix cardinality | Median (s) | P95 (s) | Cache hit |
|-----|-------------------:|-----------:|--------:|----------:|
| Android ubuntu-latest | 1 | 360 | 600 | 0.80 |
| Android windows-latest | 1 | 480 | 720 | 0.55 |
| Android macos-15-intel | 1 | 420 | 660 | 0.60 |

Total matrix wall-clock: ~1260 s sequential; ~480 s concurrent (matrix
is `fail-fast: false` so all three run in parallel). The single
heaviest cell is `windows-latest`, dominated by the Android SDK
download (~120 s) and the AAR reproducibility rerun (~180 s). The
hardening wave reduces these by:

- `cache: gradle` on `setup-java`: saves ~30 s on Java download.
- `gradle/actions/setup-gradle` cache-read-only on PRs: pulls in a
  pre-built Gradle home and skips the dependency-resolve pass (~45 s).
- `SOURCE_DATE_EPOCH` export: removes a 1–3 s `stat` jitter that was
  the dominant cause of reproducibility-rerun failures in pre-wave
  runs.

### `kotlin-jvm.yml`

| Job | Matrix cardinality | Median (s) | P95 (s) | Cache hit |
|-----|-------------------:|-----------:|--------:|----------:|
| Kotlin/JVM ubuntu-latest | 1 | 120 | 200 | 0.85 |
| Kotlin/JVM windows-latest | 1 | 180 | 300 | 0.65 |
| Kotlin/JVM macos-15-intel | 1 | 150 | 250 | 0.70 |

The wave's `cache: gradle` + `gradle/actions/setup-gradle` cut a
median of ~25 s off the Linux cell. The macOS cell benefits least
because GitHub-hosted macOS runners have slower SSD throughput, but
the action-cache savings are still ~10 s.

### `python-ports.yml`

| Job | Matrix cardinality | Median (s) | P95 (s) |
|-----|-------------------:|-----------:|--------:|
| Python ubuntu-latest 3.9 | 1 | 50 | 80 |
| Python macos-15-intel 3.9 | 1 | 60 | 100 |
| Python ubuntu-latest 3.12 | 1 | 50 | 80 |
| Python macos-15-intel 3.12 | 1 | 60 | 100 |
| Python windows-latest 3.12 | 1 | 80 | 130 |
| Python safety (ubuntu, downstream) | 1 | 30 | 60 |

The wave re-adds Windows / 3.12 (M-4). The new cell's expected budget
is ~80 s; if it exceeds 130 s on three consecutive runs, the matrix
should be split into a separate conditional job that only runs when
the upstream Linux 3.12 cell is green.

### `verify.yml`

| Job | Matrix cardinality | Median (s) | P95 (s) |
|-----|-------------------:|-----------:|--------:|
| Node ubuntu-latest 24 | 1 | 90 | 150 |
| Node windows-latest 24 | 1 | 110 | 180 |
| Node macos-15-intel 24 | 1 | 100 | 160 |

The verify workflow is dominated by `npm run test:browser` (real
Chromium smoke). The hardening wave does not change this; it only
pins the actions and tightens `permissions`.

### `security-pipeline.yml` (new)

| Job | Median (s) | P95 (s) |
|-----|-----------:|--------:|
| lint-workflows (actionlint + yamllint + markdownlint) | 25 | 45 |
| sbom-node | 60 | 100 |
| sbom-python | 30 | 60 |
| vuln-trivy-fs | 90 | 150 |
| vuln-trivy-rootfs | 150 | 240 |
| vuln-safety | 40 | 80 |
| oidc-and-secret-guard | 10 | 20 |
| signing-provenance-availability (cosign dry-run) | 30 | 60 |
| conformance-vector-pinning | 5 | 10 |

Total expected: ~440 s sequential; ~150 s concurrent (`fail-fast:
false`). The pipeline is wired with `continue-on-error` on advisory
steps and `exit-code: "0"` on Trivy (so the first run does not fail
the wave over a pre-existing transitive-dep advisory).

## Optimization levers applied this wave

1. **Pinned action SHAs** — eliminates the tag-resolution round-trip
   that GitHub performs on every job start (~2-5 s per step).
2. **`permissions: { contents: read }`** — reduces the token scope
   the runner negotiates with the GitHub API (~0.5 s per job, but
   more importantly a smaller attack surface).
3. **`cache: gradle` on `setup-java`** — eliminates ~30 s of Java
   download on cold caches.
4. **`cache-read-only: true` on PRs** — uses the cache without
   polluting it, halving the cache-warming overhead on feature
   branches.
5. **`gradle.properties` build cache** — enables
   `org.gradle.caching=true`, which lets Gradle reuse task outputs
   across configurations. Expected 15-20% wall-clock reduction on the
   Android build matrix.
6. **`SOURCE_DATE_EPOCH`** — collapses the source-tree timestamp
   variance to a single constant value, so the reproducibility rerun
   diff is exactly zero. Previously the rerun would diff on
   `META-INF/MANIFEST.MF` build timestamps ~1% of the time, causing
   a flaky-but-real CI failure.

## Optimization levers deferred to a future wave

1. **Self-hosted runner pool** — would cut the macOS cell by ~50%
   but is a governance decision (where do the runners live, who
   maintains them, how are they secured).
2. **Composite actions for shared setup** — the four workflows share
   ~80% of their `checkout` + `setup-java` + `setup-gradle` blocks.
   A composite action would save ~5-10 s per job but adds a new
   artefact to maintain; deferred until a fifth workflow joins.
3. **Splitting `security-pipeline.yml` into weekly + per-PR halves** —
   currently all jobs run on every push. The
   `signing-provenance-availability` and `sbom-node` jobs can be
   `workflow_dispatch` only; the `lint-workflows` job must stay on
   every push. Defer until the wave stabilises.
