# Sovereign Library — Search / Index Cube v0.1

Standalone deterministic in-memory text search over local structured documents.

## Features

- deterministic NFKC + Unicode lower-case tokenization
- field-aware inverted index with token positions
- add/update/remove/rebuild lifecycle
- exact, AND, OR, prefix, and phrase queries
- bounded TF-IDF-like relevance scoring
- deterministic score/id ordering
- immutable results and snapshots
- transactional rebuild and copy-on-write mutations
- typed fail-closed errors
- zero runtime third-party dependencies

## Example

```js
import { createSearchIndex } from './src/index.js';

const index = createSearchIndex();
index.add({ id: '1', fields: { body: 'Fast deterministic search' } });
index.add({ id: '2', fields: { body: 'Local deterministic tools' } });

console.log(index.term({ field: 'body', value: 'deterministic' }));
console.log(index.and({ field: 'body', terms: ['fast', 'search'] }));
```

## Guarantees

Input documents are not mutated. Rejected mutations do not partially update the index. Rebuild is transactional. Public result arrays, result objects, statistics, and snapshots are frozen.

## Out of scope

No persistence, distributed search, network services, semantic/vector search, fuzzy matching, crawling, learned ranking, or external search engines.
