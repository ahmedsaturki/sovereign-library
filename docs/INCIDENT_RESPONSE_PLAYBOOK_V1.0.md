# Sovereign Library — Incident Response Playbook v1.0

> Authoritative playbook for production incidents affecting the
> `feat/continuity-hardening` wave artefacts. Paired with
> `docs/DEPLOYMENT_RUNBOOK_V1.0.md` (rollback) and
> `docs/SECURITY_AUDIT_V1.0.md` (supply-chain attestations).

## Severity model

| Sev | Impact | Response time | Example |
|-----|--------|---------------|---------|
| SEV-1 | Release artefact integrity broken; supply-chain compromise | < 1 h | cosign verification fails on a downstream consumer; SLSA attestation mismatch |
| SEV-2 | CI broken on `main`; no artefact integrity loss | < 4 h | All `verify.yml` runs red for > 30 min |
| SEV-3 | Single workflow broken; bypass available | < 1 d | `security-pipeline.yml` `vuln-trivy-rootfs` job fails because the runner image changed |
| SEV-4 | Non-blocking; informational | Next sprint | A new CVE published against a transitive dep |

## SEV-1: Release artefact integrity broken

### Symptoms

- Downstream consumer reports `cosign verify-blob` failure.
- GitHub's `gh attestation verify` returns a non-zero exit code.
- The SHA-256 recorded in `.artifacts/SHA256SUMS` does not match
  the digest inside the SLSA provenance attestation.
- An external auditor reports the SLSA provenance does not match
  the recorded `repository` / `workflow` identity.

### Immediate containment

1. Open an incident channel: `gh issue create --label incident \
   --title "SEV-1: release integrity incident" --body "..."`.
2. Mark the release as compromised via:
   ```bash
   gh release edit v0.1.0 --draft
   ```
   This hides the release from the GitHub Releases page but does
   not delete it (deletion is irreversible from the API; download
   URLs remain valid until the release is explicitly deleted).
3. Stop any in-flight `prepare-authorized-release-artifacts` runs:
   ```bash
   gh run list --workflow=prepare-authorized-release-artifacts \
     --status=in_progress --json databaseId -q '.[] | .databaseId' \
     | xargs -r gh run cancel
   ```
4. If npm / PyPI were already updated:
   - npm: `npm unpublish @sovereign/<cube>@0.1.0` (within 72 h)
   - PyPI: open a support ticket; do not try to push a "fixed"
     version that bumps to 0.1.1 (the compromised version is
     already cached downstream).
5. Do NOT delete the Git tag. The tag's existence is the audit
   trail.

### Investigation

1. Pull the full GitHub Actions log for the affected workflow run:
   `gh run view <run-id> --log`.
2. Cross-reference every step against the expected sequence in
   `docs/DEPLOYMENT_RUNBOOK_V1.0.md`.
3. Check the OIDC token's `sub` and `aud` claims in the cosign
   signature (download the certificate from the Rekor log entry).
4. Inspect the SLSA attestation payload via
   `gh attestation verify --bundle-from-oci` and trace the
   materials / subjects to the workflow inputs.
5. If the root cause is a compromised GitHub Actions runner
   image, file an issue with GitHub support (`?report_abuse`) and
   freeze all workflow activity until the runner image is
   refreshed.
6. If the root cause is a compromised upstream action, the
   SHA-pin model should prevent re-execution — but verify by
   re-checking every `uses:` reference in the affected commit
   against the upstream commit history.

### Recovery

1. Push a revert commit that removes the affected artefact URLs
   from the GitHub Release. Do NOT force-push — the original
   history must remain visible.
2. Re-run `prepare-authorized-release-artifacts.yml` from the
   last green commit. Verify every cosign signature and SLSA
   attestation before promotion.
3. Update `docs/release/` with an explicit `SECURITY_INCIDENT_*.md`
   record, including:
   - The compromise window (first bad publish → containment).
   - The set of consumers known to have downloaded the
     compromised artefact.
   - The fix that prevents re-occurrence.
4. If npm / PyPI were affected, re-publish as `<cube>@0.1.1`
   after a clean rebuild; the `0.1.0` version is left in place
   but is documented as compromised in the registry metadata.

### Post-mortem

- Within 5 working days, publish
  `docs/POSTMORTEM_<incident-id>_v1.0.md` with the timeline,
  root cause, contributing factors, and the explicit list of
  preventive measures implemented (or scheduled).
- Update `docs/SECURITY_AUDIT_V1.0.md` and
  `docs/HARDENING_FINDINGS_V1.0.md` if the incident reveals a
  previously-undocumented threat vector.

## SEV-2: CI broken on `main`

### Symptoms

- All `verify.yml` runs red for > 30 min on the default branch.
- Or: all `android.yml`, `kotlin-jvm.yml`, and `python-ports.yml`
  runs red simultaneously.

### Immediate containment

1. Check the GitHub status page (`githubstatus.com`) for runner
   outages. If active, the incident is external and the runbook
   reduces to "wait + post a status comment on the red PRs".
2. Check the upstream action vendors for reported outages
   (especially `gradle/actions/setup-gradle`,
   `android-actions/setup-android`).
3. Open an incident issue; assign to the on-call.

### Investigation

- If the failure is in `lint-workflows` (actionlint / yamllint /
  markdownlint): a recent commit likely introduced a real lint
  error. Bisect with `git bisect` against `verify.yml`.
5. If the failure is in `vuln-trivy-*`: a new advisory may have
   been published for a transitive dep. The hardening wave
   deliberately sets `exit-code: "0"` for the scan jobs, so a
   new advisory should be informational only. If it is fatal,
   fix the underlying dep.
6. If the failure is in `gradle/actions/setup-gradle`: check
   the action's GitHub repo for reported issues. The wave uses
   a SHA pin, so a tag-rollback by the upstream vendor cannot
   silently change behaviour.

### Recovery

- Land a follow-up PR with the fix (or a documented `skip-ci`
  annotation if the failure is known and acceptable).
- For transient external failures, comment on the red PRs with
  the GitHub status link and re-run once GitHub signals green.

## SEV-3: Single workflow broken

Same playbook as SEV-2, but the urgency is lower because the
other workflows still provide coverage. Document the bypass
in `docs/KNOWN_ISSUES_V1.0.md` so the next agent does not
re-discover it.

## SEV-4: New CVE published

1. Capture the CVE in `docs/CVE_FEED_V1.0.md` with the affected
   dependency and the Sovereign surface area.
2. If the dep is direct, file a tracking issue with the
   `security` label and the remediation plan.
3. If the dep is transitive, verify Trivy actually flags the
   reachability path (false positives are common; the wave
   surfaces them so an analyst can review, not so they
   auto-block).
4. The hardening wave deliberately does not auto-bump
   dependencies because that would violate
   `GOVERNANCE.md` §"Do not publish automatically merely because
   a package has a manifest". Bumps are a separate, human-
   authorized task.

## Communication

- Internal: `gh issue` with the `incident` label is the source
  of truth. Slack / email mirrors the issue.
- External (downstream consumers of the published artefacts):
  - For SEV-1: a GitHub Discussions post in
    `Announcements` category, linking to the
    `POSTMORTEM_*.md` record once published.
  - For SEV-2/3: comment on the affected PR / Release.
  - For SEV-4: no external communication required unless the
    CVE actually reaches a Sovereign artefact.

## Roles

- **Incident commander**: the engineer who first declares the
  SEV level. They own the incident until hand-off.
- **Comms**: the maintainer who posts the external
  announcement. May be the same person as the IC for SEV-3/4.
- **Auditor**: an engineer not directly involved in the
  release who reviews the post-mortem for completeness.
- All roles default to the on-call rotation once it is
  established; until then, they default to the engineer who
  raised the incident.
