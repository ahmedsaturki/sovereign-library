# Reporting / Export Cube v0.1

Standalone deterministic local report engine with immutable snapshots, stable JSON/CSV output, bounded async CSV streaming, deterministic grouping/aggregation/order, cancellation-compatible streaming, and zero runtime third-party dependencies.

```js
import { createReportEngine } from './src/index.js';

const engine = createReportEngine();
const report = engine.build(
  [{ name: 'A', amount: 2 }, { name: 'B', amount: 3 }],
  { columns: [{ id: 'name' }, { id: 'amount' }], order: [{ column: 'name' }] },
);

console.log(engine.toJson(report));
console.log(engine.toCsv(report));
```

Scope is local in-process reporting and deterministic JSON/CSV export. PDF, charts, proprietary spreadsheets, remote BI, and third-party reporting engines are outside v0.1.
