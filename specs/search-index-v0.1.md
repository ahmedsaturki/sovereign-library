# Search / Index Cube v0.1

## Product goal

Provide a standalone native in-memory text-search and inverted-index engine for local document collections. The cube must be deterministic, bounded, immutable at public snapshot/result boundaries, recoverable after rejected mutations, cross-platform, and dependency-free at runtime.

## Supported document model

A document is:

```js
{
  id: string,
  fields: { title: string, body: string, ... }
}
```

The `id` is unique and stable. Field names are bounded UTF-8 strings. Indexed field values are strings only.

## Tokenization and normalization

- Unicode strings are scanned without locale-specific external packages.
- Letter/number runs become tokens; punctuation and separators delimit tokens.
- Tokens are normalized with `String.prototype.normalize('NFKC')` and lower-cased with the default JavaScript Unicode case conversion.
- Empty tokens are ignored.
- Original source strings are never modified.
- Tokenization is deterministic across supported platforms.

## Index structure

- Per-field inverted postings: `field -> term -> document -> positions/frequency`.
- Document metadata tracks original field lengths and bounded token counts.
- Updates replace the previous postings for the same document id atomically.
- Remove deletes all postings for the document id.
- Rebuild constructs a fresh index and swaps it only after complete validation succeeds.

## Queries

### Exact term

`term(field, value)` returns documents containing the normalized term.

### Boolean terms

- `and(field, [terms])`: intersection semantics.
- `or(field, [terms])`: union semantics.
- Empty term sets are invalid.

### Prefix

`prefix(field, prefix)` matches terms beginning with the normalized prefix. Expansion is bounded by a maximum number of matched terms and postings.

### Phrase

`phrase(field, [terms])` matches adjacent normalized tokens in order. Phrase length and candidate postings are bounded.

## Scoring

The v0.1 scorer is deterministic TF-IDF-like scoring:

- term contribution is `tf * idf`, where `tf` is bounded term frequency and `idf = log(1 + N / (1 + df)) + 1`.
- boolean OR sums matched term contributions.
- AND sums all required term contributions.
- prefix uses the sum of matched-term contributions with a bounded term expansion cap.
- phrase adds a bounded adjacency bonus derived from matched phrase spans.

Scores are deterministic IEEE-754 finite numbers. Ties are broken by document id ascending.

## Results

Each result is:

```js
{ id: string, score: number, matches: number }
```

Results are immutable and ordered by descending score then ascending id. The caller never receives mutable internal maps or postings.

## Bounds

The implementation must enforce finite safe integer limits for:

- documents
- fields per document
- field string bytes
- tokens per field/document
- unique terms
- postings per term
- query bytes/terms
- prefix expansion
- phrase candidate documents
- maximum returned results

Bounds are checked before expensive work where practical.

## Error model

Typed fail-closed `SearchError` errors with stable codes, including:

- `INVALID_CONFIG`
- `INVALID_DOCUMENT`
- `DUPLICATE_DOCUMENT`
- `UNKNOWN_DOCUMENT`
- `INDEX_LIMIT`
- `INVALID_QUERY`
- `QUERY_LIMIT`
- `INTERNAL_INVARIANT`

Diagnostics may contain safe field/document identifiers and bounded counts, but never copy arbitrary source field values or entire payloads.

## Immutability and recovery

- Configuration is deeply immutable.
- Input documents and query arrays are never mutated.
- Query results and snapshots are deeply immutable.
- Rejected add/update/remove/query operations leave the previous valid index unchanged.
- Rebuild is transactional: a failed rebuild leaves the prior index active.

## Public API target

```js
const index = createSearchIndex({ limits });
index.add(document);
index.update(document);
index.remove(id);
index.rebuild(documents);
index.term({ field, value, limit });
index.and({ field, terms, limit });
index.or({ field, terms, limit });
index.prefix({ field, value, limit });
index.phrase({ field, terms, limit });
index.snapshot();
index.stats();
```

No API may expose a mutable internal index structure.

## Runtime dependency policy

Zero third-party runtime dependencies. Use only ECMAScript/Node standard-library primitives.

## Definition of done

- standalone README and API documentation
- runnable example
- unit tests for tokenization and scoring
- contract tests for lifecycle/query semantics
- failure/recovery tests for every bound and mutation path
- deterministic ordering tests
- source immutability tests
- cross-platform GitHub Actions matrix
- repository real-browser smoke gate remains green
- no known blocking defect
