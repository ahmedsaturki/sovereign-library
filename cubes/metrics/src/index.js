import { hrtime } from 'node:process';

const DEFAULT_MAX_METRICS = 256;
const DEFAULT_MAX_SERIES_PER_METRIC = 1024;
const DEFAULT_MAX_LABELS = 8;
const DEFAULT_MAX_LABEL_VALUE_BYTES = 128;
const DEFAULT_MAX_NAME_BYTES = 128;
const DEFAULT_HISTOGRAM_BUCKETS = Object.freeze([0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);
const NAME_RE = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const LABEL_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const lexicalCompare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export class MetricsError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'MetricsError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new MetricsError('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
}

function utf8Bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDeep(nested);
    Object.freeze(value);
  }
  return value;
}

function cloneLabels(labels, config) {
  if (labels === undefined) return Object.freeze({});
  if (labels === null || typeof labels !== 'object' || Array.isArray(labels)) throw new MetricsError('INVALID_LABELS', 'Labels must be a plain object');
  const entries = Object.entries(labels);
  if (entries.length > config.maxLabels) throw new MetricsError('TOO_MANY_LABELS', `A metric may have at most ${config.maxLabels} labels`);
  const output = {};
  for (const [key, value] of entries.sort(([a], [b]) => lexicalCompare(a, b))) {
    if (!LABEL_RE.test(key)) throw new MetricsError('INVALID_LABEL_KEY', `Invalid label key: ${key}`);
    if (typeof value !== 'string') throw new MetricsError('INVALID_LABEL_VALUE', `Label value for ${key} must be a string`);
    if (utf8Bytes(value) > config.maxLabelValueBytes) throw new MetricsError('LABEL_VALUE_TOO_LARGE', `Label value for ${key} exceeds ${config.maxLabelValueBytes} bytes`);
    output[key] = value;
  }
  return Object.freeze(output);
}

function labelsKey(labels) {
  return JSON.stringify(labels);
}

function normalizeName(name, config) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) throw new MetricsError('INVALID_METRIC_NAME', `Invalid metric name: ${String(name)}`);
  if (utf8Bytes(name) > config.maxNameBytes) throw new MetricsError('METRIC_NAME_TOO_LARGE', `Metric name exceeds ${config.maxNameBytes} bytes`);
  return name;
}

function normalizeBuckets(buckets) {
  const values = buckets ?? DEFAULT_HISTOGRAM_BUCKETS;
  if (!Array.isArray(values) || values.length === 0 || values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
    throw new MetricsError('INVALID_BUCKETS', 'Histogram buckets must be a non-empty array of finite positive numbers');
  }
  const unique = [...new Set(values)].sort((a, b) => a - b);
  return Object.freeze(unique);
}

function sameBuckets(a, b) {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

function snapshotMetric(metric) {
  if (metric.type === 'counter' || metric.type === 'gauge') {
    return { name: metric.name, type: metric.type, series: [...metric.series.values()].map(series => ({ labels: { ...series.labels }, value: series.value })) };
  }
  return {
    name: metric.name,
    type: metric.type,
    buckets: [...metric.buckets],
    series: [...metric.series.values()].map(series => ({ labels: { ...series.labels }, count: series.count, sum: series.sum, buckets: [...series.buckets] })),
  };
}

export function createMetricsRegistry(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new MetricsError('INVALID_OPTIONS', 'Metrics options must be an object');
  const config = Object.freeze({
    maxMetrics: options.maxMetrics ?? DEFAULT_MAX_METRICS,
    maxSeriesPerMetric: options.maxSeriesPerMetric ?? DEFAULT_MAX_SERIES_PER_METRIC,
    maxLabels: options.maxLabels ?? DEFAULT_MAX_LABELS,
    maxLabelValueBytes: options.maxLabelValueBytes ?? DEFAULT_MAX_LABEL_VALUE_BYTES,
    maxNameBytes: options.maxNameBytes ?? DEFAULT_MAX_NAME_BYTES,
  });
  assertPositiveInteger(config.maxMetrics, 'maxMetrics');
  assertPositiveInteger(config.maxSeriesPerMetric, 'maxSeriesPerMetric');
  assertPositiveInteger(config.maxLabels, 'maxLabels');
  assertPositiveInteger(config.maxLabelValueBytes, 'maxLabelValueBytes');
  assertPositiveInteger(config.maxNameBytes, 'maxNameBytes');

  const metrics = new Map();
  let closed = false;

  function ensureOpen() {
    if (closed) throw new MetricsError('REGISTRY_CLOSED', 'Metrics registry is closed');
  }

  function ensureMetric(name, type, optionsForMetric = {}) {
    ensureOpen();
    const normalized = normalizeName(name, config);
    const existing = metrics.get(normalized);
    if (existing) {
      if (existing.type !== type) throw new MetricsError('METRIC_TYPE_CONFLICT', `Metric ${normalized} is already registered as ${existing.type}`);
      if (type === 'histogram' && optionsForMetric.buckets !== undefined) {
        const requested = normalizeBuckets(optionsForMetric.buckets);
        if (!sameBuckets(existing.buckets, requested)) throw new MetricsError('HISTOGRAM_BUCKET_CONFLICT', `Metric ${normalized} already has a different bucket definition`);
      }
      return existing;
    }
    if (metrics.size >= config.maxMetrics) throw new MetricsError('METRIC_LIMIT', `Metric registry is full at ${config.maxMetrics} metrics`);
    const metric = { name: normalized, type, series: new Map() };
    if (type === 'histogram') metric.buckets = normalizeBuckets(optionsForMetric.buckets);
    metrics.set(normalized, metric);
    return metric;
  }

  function ensureSeries(metric, labels) {
    const frozenLabels = cloneLabels(labels, config);
    const key = labelsKey(frozenLabels);
    let series = metric.series.get(key);
    if (series) return series;
    if (metric.series.size >= config.maxSeriesPerMetric) throw new MetricsError('CARDINALITY_LIMIT', `Metric ${metric.name} exceeded ${config.maxSeriesPerMetric} series`);
    series = metric.type === 'histogram'
      ? { labels: frozenLabels, count: 0, sum: 0, buckets: new Array(metric.buckets.length).fill(0) }
      : { labels: frozenLabels, value: 0 };
    metric.series.set(key, series);
    return series;
  }

  function incrementCounter(name, amount = 1, labels) {
    ensureOpen();
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) throw new MetricsError('INVALID_COUNTER_INCREMENT', 'Counter increment must be a finite number >= 0');
    const series = ensureSeries(ensureMetric(name, 'counter'), labels);
    series.value += amount;
    return series.value;
  }

  function setGauge(name, value, labels) {
    ensureOpen();
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new MetricsError('INVALID_GAUGE_VALUE', 'Gauge value must be finite');
    const series = ensureSeries(ensureMetric(name, 'gauge'), labels);
    series.value = value;
    return value;
  }

  function addGauge(name, delta, labels) {
    ensureOpen();
    if (typeof delta !== 'number' || !Number.isFinite(delta)) throw new MetricsError('INVALID_GAUGE_VALUE', 'Gauge delta must be finite');
    const series = ensureSeries(ensureMetric(name, 'gauge'), labels);
    series.value += delta;
    return series.value;
  }

  function observeHistogram(name, value, labels, optionsForMetric = {}) {
    ensureOpen();
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new MetricsError('INVALID_HISTOGRAM_VALUE', 'Histogram value must be a finite number >= 0');
    const metric = ensureMetric(name, 'histogram', optionsForMetric);
    const series = ensureSeries(metric, labels);
    series.count += 1;
    series.sum += value;
    for (let index = 0; index < metric.buckets.length; index += 1) {
      if (value <= metric.buckets[index]) series.buckets[index] += 1;
    }
    return series.count;
  }

  function safe(operation) {
    try {
      operation();
      return true;
    } catch (error) {
      if (error instanceof MetricsError && ['REGISTRY_CLOSED', 'CARDINALITY_LIMIT', 'METRIC_LIMIT'].includes(error.code)) return false;
      throw error;
    }
  }

  async function timeHistogram(name, fn, labels, optionsForMetric = {}) {
    if (typeof fn !== 'function') throw new MetricsError('INVALID_TIMED_FUNCTION', 'Timed operation must be a function');
    const start = hrtime.bigint();
    try {
      return await fn();
    } finally {
      const elapsedMs = Number(hrtime.bigint() - start) / 1_000_000;
      safe(() => observeHistogram(name, elapsedMs, labels, optionsForMetric));
    }
  }

  function snapshot() {
    const result = { config: { ...config }, closed, metrics: [...metrics.values()].map(snapshotMetric) };
    result.metrics.sort((a, b) => lexicalCompare(a.name, b.name));
    return freezeDeep(result);
  }

  function exportJSON() {
    return JSON.stringify(snapshot());
  }

  function reset(name) {
    ensureOpen();
    if (name === undefined) {
      metrics.clear();
      return;
    }
    const normalized = normalizeName(name, config);
    metrics.delete(normalized);
  }

  function close() {
    closed = true;
  }

  return Object.freeze({
    config,
    incrementCounter,
    setGauge,
    addGauge,
    observeHistogram,
    safe,
    timeHistogram,
    snapshot,
    exportJSON,
    reset,
    close,
    isClosed: () => closed,
  });
}

export {
  DEFAULT_MAX_METRICS,
  DEFAULT_MAX_SERIES_PER_METRIC,
  DEFAULT_MAX_LABELS,
  DEFAULT_MAX_LABEL_VALUE_BYTES,
  DEFAULT_MAX_NAME_BYTES,
  DEFAULT_HISTOGRAM_BUCKETS,
};
