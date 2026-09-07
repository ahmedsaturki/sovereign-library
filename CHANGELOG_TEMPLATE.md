# CHANGELOG_TEMPLATE

The template below mirrors the canonical `CHANGELOG.md` structure. Phase-2
release-engineering auto-generates the per-release body via
`scripts/changelog.mjs`; this template is the rendering target.

```markdown
# Changelog

## Unreleased

## <TAG> (<YYYY-MM-DD>)

### Added
- <feature descriptions>

### Changed
- <behavior changes>

### Deprecated
- <soon-to-be-removed features>

### Removed
- <removed features>

### Fixed
- <bug fixes>

### Security
- <security-relevant changes>
```

`scripts/changelog.mjs` outputs the bucket-style (feat / fix / perf / etc.)
view that aligns with the Conventional-Commits commit log. Human authors
may re-categorize entries during release prep, but the buckets themselves
are the contract.