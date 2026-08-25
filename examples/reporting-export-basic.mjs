import { createReportEngine } from '../cubes/reporting-export/src/index.js';

const engine = createReportEngine();
const report = engine.build(
  [
    { team: 'A', amount: 2 },
    { team: 'A', amount: 4 },
    { team: 'B', amount: 3 },
  ],
  {
    id: 'summary',
    columns: [{ id: 'team' }, { id: 'amount' }],
    groupBy: ['team'],
    aggregates: [{ column: 'amount', op: 'sum', as: 'total' }],
    order: [{ column: 'team', direction: 'asc' }],
  },
);

console.log(engine.toJson(report));
console.log(engine.toCsv(report));
