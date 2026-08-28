# Metrics / Telemetry Cube v0.1

A standalone native instrumentation product for counters, gauges, bounded histograms, immutable snapshots, deterministic JSON export, safe recording, and high-resolution timing.

## Contract

- Uses Node.js timing primitives only; no runtime third-party dependencies.
- Metric names and label keys are explicitly validated and byte-bounded.
- Label values are bounded by UTF-8 byte length.
- Each metric has a bounded number of label series to prevent accidental cardinality explosions.
- Counters are monotonic and reject negative increments.
- Gauges support explicit set and delta operations.
- Histograms use deterministic sorted cumulative buckets.
- Histogram bucket definitions are immutable for an already-registered metric.
- Snapshots are deeply immutable and JSON-safe.
- `exportJSON()` is deterministic for the same registry state.
- `safe()` swallows only expected operational capacity/closed-state rejections; programmer/configuration errors remain visible.
- `timeHistogram()` uses high-resolution native timing and records duration even when the timed operation rejects.
- `reset()` and `close()` provide explicit lifecycle boundaries.

## Example

```js
import { createMetricsRegistry } from './src/index.js';

const metrics = createMetricsRegistry({
  maxSeriesPerMetric: 500,
});

metrics.incrementCounter('requests_total', 1, { method: 'GET', route: '/health' });
metrics.setGauge('queue_depth', 3, { queue: 'default' });
metrics.observeHistogram('latency_ms', 12.4, { route: '/health' });

const value = await metrics.timeHistogram('work_duration_ms', async () => 42);
console.log(value, metrics.exportJSON());
```

## Product boundary

This cube intentionally does not ship network exporters, Prometheus/OpenTelemetry protocol clients, persistence, tracing, dashboards, or alerting. Those are separate products/contracts.
