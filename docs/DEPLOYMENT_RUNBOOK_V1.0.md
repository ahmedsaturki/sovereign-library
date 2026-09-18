# Sovereign Library — Deployment Runbook v1.0

> Authoritative, step-by-step instructions for the next authorised
> release wave on `feat/continuity-hardening`. Targets the canonical
> GitHub Releases channel per `GOVERNANCE.md` ("GITHUB IS CANONICAL")
> and the optional free-registry wave documented there.

## Pre-flight checklist

Before invoking the deployment workflow, verify every item below.
Each item is a guard against the failure modes that have bitten the
project historically (PR #111, the staged-but-not-released
`safe-path-resolver` package, the locally-only first-run APK).

- [ ] **All five workflows green on the exact commit being released.**
  Confirm via the GitHub Actions UI; do not trust local rerun results.
- [ ] **`security-pipeline.yml` is green on the exact commit.**
  Especially: Trivy fs/rootfs SARIF uploaded, Safety audit pass, cosign
  reachability probe OK, conformance vector SHA-256 pins match.
- [ ] **No `actions:` or `permissions:` scope changes since the last
  green run.** Re-confirm by reviewing the diff of
  `.github/workflows/*.yml` between the green commit and the release
  commit.
- [ ] **`PROJECT_CONTROL.md` records the wave as the current
  active task.** If it does not, update `PROJECT_CONTROL.md` *before*
  the release, in a separate PR; per AGENTS.md, never update the
  control plane as a side effect of a release.
- [ ] **AGENTS.md, GOVERNANCE.md, ROADMAP.md still match reality.**
  If not, update them first.
- [ ] **The Android cube is `TECHNICALLY_READY` (not `IN_PROGRESS`).**
  Per `PROJECT_CONTROL.md` line 37, the cube is currently
  `IN_PROGRESS, not TECHNICALLY_READY until SDK + emulator evidence`.
  If you are deploying the Android cube, that gate must be cleared in
  a separate commit *before* invoking this runbook. For the Node
  cubes, this gate does not apply.

## Step-by-step

### Step 1 — Verify the source

```bash
git fetch origin
git checkout feat/continuity-hardening
git status
git rev-parse HEAD
git rev-parse origin/feat/continuity-hardening
```

`HEAD` and `origin/feat/continuity-hardening` MUST match. If they
do not, STOP and resolve the divergence before proceeding — the
release artefacts will be derived from whatever `HEAD` is, and the
provenance attestation will record that hash.

### Step 2 — Trigger the authorized-release workflow

Navigate to GitHub Actions → `prepare-authorized-release-artifacts`
→ Run workflow → branch `feat/continuity-hardening` → Run.

The workflow will:

1. Verify the source contracts (`verify-package-tooling.mjs`,
   `verify-reproducible-package.mjs`, `verify-security-boundaries.mjs`).
2. Run the `prepare-authorized-release-artifacts.mjs` Node script to
   emit the actual artefacts under `.artifacts/authorized-release-v0.1/`.
3. Install cosign and sign each artefact keylessly via the OIDC token
   minted for this workflow run.
4. Verify each signature with `cosign verify-blob` (in-job; this
   proves the tooling works end-to-end before the artefact is
   uploaded).
5. Generate an SLSA Level-3 provenance attestation via
   `slsa-framework/slsa-github-generator` v2.0.
6. Upload everything as the `sovereign-authorized-release-v0.1`
   artifact with a 14-day retention.

### Step 3 — Promote artefacts to a GitHub Release

The `prepare-authorized-release-artifacts.yml` workflow is
intentionally **not** allowed to create a GitHub Release on its own
(GOVERNANCE rule: "Do not publish automatically merely because a
package has a manifest"). Promotion to a Release is a human-authorized
step. To do it:

```bash
gh release create v0.1.0 \
  --target feat/continuity-hardening \
  --title "v0.1.0 (hardened)" \
  --notes-file ./RELEASE_NOTES_v0.1.0.md \
  .artifacts/authorized-release-v0.1/*
```

Then attach the SLSA attestation and cosign signatures:

```bash
gh release upload v0.1.0 .artifacts/authorized-release-v0.1/*.sig
gh attestation verify .artifacts/authorized-release-v0.1/<artifact>.tar.gz \
  --owner ahmedsaturki \
  --repo sovereign-library
```

### Step 4 — Optional free-registry wave

Only proceed with this step if the optional free-registry wave has
been explicitly selected for this release (see `GOVERNANCE.md` §
"Distribution policy — CURRENT"). For each target registry:

#### npm

```bash
# The artefacts include an npm-ready tarball produced by
# prepare-authorized-release-artifacts.mjs. Verify its provenance first:
npm view @sovereign/<cube> dist.signature  # populated by `npm publish --provenance`
npm publish --provenance .artifacts/authorized-release-v0.1/<cube>-npm.tgz
```

`--provenance` is mandatory — npm will publish with the GitHub
Actions OIDC attestation embedded in the package metadata.

#### PyPI

```bash
python -m pip install --upgrade twine
twine check .artifacts/authorized-release-v0.1/<cube>-py3-none-any.whl
# Use the GitHub Actions Trusted Publisher configured per
# https://docs.pypi.org/trusted-publishers/ — NO long-lived API token
# is permitted in this repo.
```

#### Maven Central (future)

Not in scope for v0.1.0. When the optional wave selects it, use
the central-publishing Gradle plugin with a Sonatype account
configured as a GitHub Actions Trusted Publisher. Sign artefacts
with GPG (key published to a keyserver) and attach the
`.asc` files to the Maven coordinates.

### Step 5 — Post-distribution verification

After the artefacts are visible on the chosen channels:

1. Re-run `verify.yml` against the release tag.
2. Re-run `security-pipeline.yml` against the release tag.
3. Open a PR that:
   - Bumps the version in the relevant `package.json` /
     `build.gradle` / `pyproject.toml` to `v0.2.0-dev`.
   - Updates `PROJECT_CONTROL.md` with the actual release commit
     SHA, the GitHub Release URL, and the registry coordinates.
   - Updates `docs/release/` with the new release record.
4. After the PR merges, mark the released components as `FROZEN` per
   GOVERNANCE rule 5 ("Never modify released/frozen components without
   a dedicated authorized maintenance task").

### Step 6 — Rollback

If the post-distribution verification fails:

1. **npm / PyPI:** `npm unpublish @sovereign/<cube>@0.1.0` is
   permitted within 72 hours of publish per npm policy; PyPI
   requires a support ticket and is intentionally hard to remove
   from. Document the rationale.
2. **GitHub Release:** `gh release delete v0.1.0 --yes` (does not
   delete the tag; do that separately with `git push --delete
   origin v0.1.0`).
3. **In repo:** revert the merge commit (do not rewrite history;
   the revert commit records the rollback in `git log`).
4. **Communication:** post the rollback reason in
   `docs/release/ROLLBACK_v0.1.0_<reason>.md` and link it from
   `PROJECT_CONTROL.md`.
5. **Incident response:** trigger the playbook at
   `docs/INCIDENT_RESPONSE_PLAYBOOK_V1.0.md`.

## Operational contacts

- Release engineering: `gh release` access requires the
  `Maintainers` team. New maintainers are added via the standard
  two-reviewer flow on a dedicated PR.
- On-call rotation: not yet established for v0.1.0. Use the GitHub
  Issues on-call label as a placeholder.

## Reference: hash & signing verification commands

```bash
# Verify a downloaded tarball against the recorded SHA-256:
sha256sum -c <(grep <artefact>.tar.gz .artifacts/SHA256SUMS)

# Verify a cosign signature:
cosign verify-blob \
  --signature <artefact>.tar.gz.sig \
  --certificate-identity-regexp 'https://github.com/ahmedsaturki/sovereign-library' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
  <artefact>.tar.gz

# Verify the SLSA attestation:
gh attestation verify <artefact>.tar.gz \
  --owner ahmedsaturki \
  --repo sovereign-library
```
