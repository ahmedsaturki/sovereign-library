import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HISTOGRAM_BUCKETS,
  DEFAULT_MAX_LABELS,
  DEFAULT_MAX_LABEL_VALUE_BYTES,
  DEFAULT_MAX_METRICS,
  DEFAULT_MAX_NAME_BYTES,
  DEFAULT_MAX_SERIES_PER_METRIC,
  MetricsError,
  createMetricsRegistry,
} from '../src/index.js';

test('counter is monotonic and supports independent labelled series', () => {
  const registry = createMetricsRegistry();
  assert.equal(registry.incrementCounter('requests_total'), 1);
  assert.equal(registry.incrementCounter('requests_total', 4), 5);
  assert.equal(registry.incrementCounter('requests_total', 2, { method: 'GET', route: '/health' }), 2);
  assert.equal(registry.incrementCounter('requests_total', 1, { route: '/health', method: 'GET' }), 3);
  assert.throws(() => registry.incrementCounter('requests_total', -1), error => error instanceof MetricsError && error.code === 'INVALID_COUNTER_INCREMENT');
});

test('gauge supports set and delta semantics', () => {
  const registry = createMetricsRegistry();
  assert.equal(registry.setGauge('queue_depth', 10), 10);
  assert.equal(registry.addGauge('queue_depth', -3), 7);
  assert.equal(registry.setGauge('queue_depth', 4, { queue: 'default' }), 4);
});

test('histogram uses deterministic cumulative buckets', () => {
  const registry = createMetricsRegistry();
  registry.observeHistogram('latency_ms', 0.003);
  registry.observeHistogram('latency_ms', 0.2);
  registry.observeHistogram('latency_ms', 3);
  const metric = registry.snapshot().metrics.find(entry => entry.name === 'latency_ms');
  assert.deepEqual(metric.buckets, [...DEFAULT_HISTOGRAM_BUCKETS]);
  assert.deepEqual(metric.series[0].buckets, [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
  assert.equal(metric.series[0].count, 3);
  assert.equal(metric.series[0].sum, 3.203);
});

test('metric names and label keys/values are deterministic and bounded', () => {
  const registry = createMetricsRegistry({ maxNameBytes: 10, maxLabels: 2, maxLabelValueBytes: 4 });
  assert.throws(() => registry.incrementCounter('bad-name!'), error => error.code === 'INVALID_METRIC_NAME');
  assert.throws(() => registry.incrementCounter('valid', 1, { 'bad-key!': 'x' }), error => error.code === 'INVALID_LABEL_KEY');
  assert.throws(() => registry.incrementCounter('valid', 1, { a: '12345' }), error => error.code === 'LABEL_VALUE_TOO_LARGE');
  assert.throws(() => registry.incrementCounter('valid', 1, { a: '1', b: '2', c: '3' }), error => error.code === 'TOO_MANY_LABELS');
  assert.throws(() => registry.incrementCounter('a12345678901'), error => error.code === 'METRIC_NAME_TOO_LARGE');
});

test('label order does not change series identity', () => {
  const registry = createMetricsRegistry();
  registry.incrementCounter('requests_total', 1, { b: '2', a: '1' });
  registry.incrementCounter('requests_total', 2, { a: '1', b: '2' });
  const series = registry.snapshot().metrics[0].series;
  assert.equal(series.length, 1);
  assert.equal(series[0].value, 3);
  assert.deepEqual(series[0].labels, { a: '1', b: '2' });
});

test('cardinality and metric-count limits are enforced without partial writes', () => {
  const registry = createMetricsRegistry({ maxMetrics: 1, maxSeriesPerMetric: 1 });
  registry.incrementCounter('one', 1, { series: 'a' });
  assert.throws(() => registry.incrementCounter('one', 1, { series: 'b' }), error => error.code === 'CARDINALITY_LIMIT');
  assert.throws(() => registry.incrementCounter('two'), error => error.code === 'METRIC_LIMIT');
  const snapshot = registry.snapshot();
  assert.equal(snapshot.metrics.length, 1);
  assert.equal(snapshot.metrics[0].series[0].value, 1);
});

test('immutable snapshots prevent caller mutation', () => {
  const registry = createMetricsRegistry();
  registry.incrementCounter('requests_total', 2, { route: '/x' });
  const snapshot = registry.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.config), true);
  assert.equal(Object.isFrozen(snapshot.metrics[0]), true);
  assert.equal(Object.isFrozen(snapshot.metrics[0].series[0]), true);
  assert.throws(() => { snapshot.metrics[0].series[0].value = 99; }, TypeError);
  assert.equal(registry.snapshot().metrics[0].series[0].value, 2);
});

test('JSON export is deterministic and JSON-safe', () => {
  const registry = createMetricsRegistry();
  registry.setGauge('temperature', 22.5, { unit: 'c' });
  registry.incrementCounter('requests_total', 3);
  const first = registry.exportJSON();
  const second = registry.exportJSON();
  assert.equal(first, second);
  const parsed = JSON.parse(first);
  assert.deepEqual(parsed.metrics.map(metric => metric.name), ['requests_total', 'temperature']);
});

test('safe recording swallows only bounded operational rejections', () => {
  const registry = createMetricsRegistry({ maxSeriesPerMetric: 1 });
  registry.incrementCounter('requests_total', 1, { route: '/a' });
  assert.equal(registry.safe(() => registry.incrementCounter('requests_total', 1, { route: '/b' })), false);
  assert.equal(registry.safe(() => registry.incrementCounter('requests_total', 1, { route: '/a' })), true);
  assert.throws(() => registry.safe(() => registry.incrementCounter('requests_total', -1)), error => error.code === 'INVALID_COUNTER_INCREMENT');
});

test('timing helper records elapsed milliseconds and preserves return/rejection', async () => {
  const registry = createMetricsRegistry();
  const result = await registry.timeHistogram('work_duration_ms', async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return 42;
  });
  assert.equal(result, 42);
  const metric = registry.snapshot().metrics.find(entry => entry.name === 'work_duration_ms');
  assert.equal(metric.type, 'histogram');
  assert.equal(metric.series[0].count, 1);
  assert.ok(metric.series[0].sum >= 0);

  const failing = registry.timeHistogram('failed_duration_ms', async () => {
    throw new Error('expected failure');
  });
  await assert.rejects(failing, { message: 'expected failure' });
  const failedMetric = registry.snapshot().metrics.find(entry => entry.name === 'failed_duration_ms');
  assert.equal(failedMetric.series[0].count, 1);
});

test('reset removes selected metrics or all metrics', () => {
  const registry = createMetricsRegistry();
  registry.incrementCounter('a');
  registry.incrementCounter('b');
  registry.reset('a');
  assert.deepEqual(registry.snapshot().metrics.map(metric => metric.name), ['b']);
  registry.reset();
  assert.deepEqual(registry.snapshot().metrics, []);
});

test('close is idempotent and blocks mutation', () => {
  const registry = createMetricsRegistry();
  registry.incrementCounter('a');
  registry.close();
  registry.close();
  assert.equal(registry.isClosed(), true);
  assert.throws(() => registry.incrementCounter('b'), error => error.code === 'REGISTRY_CLOSED');
  assert.equal(registry.safe(() => registry.incrementCounter('b')), false);
  assert.equal(registry.snapshot().closed, true);
});

test('metric type conflicts and invalid histogram values are deterministic', () => {
  const registry = createMetricsRegistry();
  registry.incrementCounter('same_name');
  assert.throws(() => registry.setGauge('same_name', 1), error => error.code === 'METRIC_TYPE_CONFLICT');
  assert.throws(() => registry.observeHistogram('latency', -1), error => error.code === 'INVALID_HISTOGRAM_VALUE');
  assert.throws(() => registry.observeHistogram('custom', 1, undefined, { buckets: [0] }), error => error.code === 'INVALID_BUCKETS');
  registry.observeHistogram('custom', 1, undefined, { buckets: [1, 2] });
  assert.throws(() => registry.observeHistogram('custom', 1, undefined, { buckets: [1, 3] }), error => error.code === 'HISTOGRAM_BUCKET_CONFLICT');
  assert.throws(() => createMetricsRegistry({ maxMetrics: 0 }), error => error.code === 'INVALID_LIMIT');
});

test('defaults are finite and explicit', () => {
  assert.equal(DEFAULT_MAX_METRICS, 256);
  assert.equal(DEFAULT_MAX_SERIES_PER_METRIC, 1024);
  assert.equal(DEFAULT_MAX_LABELS, 8);
  assert.equal(DEFAULT_MAX_LABEL_VALUE_BYTES, 128);
  assert.equal(DEFAULT_MAX_NAME_BYTES, 128);
});
