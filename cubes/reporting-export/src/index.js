const DEFAULT_LIMITS = Object.freeze({
  maxRows: 100_000,
  maxColumns: 256,
  maxGroups: 10_000,
  maxCellBytes: 64 * 1024,
  maxOutputBytes: 4 * 1024 * 1024,
  maxPageSize: 10_000,
  maxBufferedChunks: 64,
});

class ReportError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'ReportError';
    this.code = code;
    this.path = options.path ?? null;
    Object.freeze(this);
  }
}

const fail = (code, message, options = {}) => { throw new ReportError(code, message, options); };
const isObject = (v) => v !== null && typeof v === 'object';

function validatePlainObject(value, label) {
  if (!isObject(value) || Array.isArray(value)) fail('INVALID_DEFINITION', `${label} must be an object`);
  for (const key of Object.keys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d)) fail('INVALID_DEFINITION', `${label} contains accessor property`);
  }
}

function validateLimits(input = {}) {
  validatePlainObject(input, 'limits');
  const limits = Object.freeze({ ...DEFAULT_LIMITS, ...input });
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_DEFINITION', `${key} must be a positive safe integer`);
  }
  return limits;
}

function cloneValue(value, depth, limits, seen = new Set()) {
  if (depth > 32) fail('LIMIT_EXCEEDED', 'Value nesting exceeds reporting limit');
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) fail('UNSUPPORTED_VALUE', 'Circular report values are not supported');
  seen.add(value);
  if (Array.isArray(value)) {
    const out = value.map(v => cloneValue(v, depth + 1, limits, seen));
    seen.delete(value);
    return Object.freeze(out);
  }
  validatePlainObject(value, 'row');
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = cloneValue(value[key], depth + 1, limits, seen);
  seen.delete(value);
  return Object.freeze(out);
}

function stringBytes(value) {
  return Buffer.byteLength(String(value), 'utf8');
}

function stableKey(value) {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isNaN(value) ? 'number:NaN' : `number:${Object.is(value, -0) ? '-0' : value}`;
  if (typeof value === 'boolean') return `boolean:${value}`;
  return `${typeof value}:${String(value)}`;
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : 1;
}

function normalizeColumn(column) {
  if (!isObject(column)) fail('INVALID_DEFINITION', 'Column must be an object');
  validatePlainObject(column, 'column');
  if (typeof column.id !== 'string' || !column.id) fail('INVALID_DEFINITION', 'Column id is required');
  const key = column.key ?? column.id;
  if (typeof key !== 'string' || !key) fail('INVALID_DEFINITION', `Column ${column.id} key is invalid`);
  return Object.freeze({ id: column.id, key, label: column.label ?? column.id, type: column.type ?? 'text' });
}

function normalizeDefinition(definition, limits) {
  validatePlainObject(definition, 'definition');
  if (!Array.isArray(definition.columns) || definition.columns.length < 1 || definition.columns.length > limits.maxColumns) fail('INVALID_DEFINITION', 'Invalid report columns');
  const columns = definition.columns.map(normalizeColumn);
  const ids = new Set();
  for (const c of columns) {
    if (ids.has(c.id)) fail('INVALID_DEFINITION', `Duplicate column ${c.id}`);
    ids.add(c.id);
  }
  const order = Array.isArray(definition.order) ? definition.order : [];
  for (const spec of order) {
    if (!isObject(spec) || typeof spec.column !== 'string' || !['asc', 'desc'].includes(spec.direction ?? 'asc')) fail('INVALID_DEFINITION', 'Invalid order specification');
    if (!ids.has(spec.column)) fail('INVALID_DEFINITION', `Unknown order column ${spec.column}`);
  }
  const groups = Array.isArray(definition.groupBy) ? definition.groupBy.slice() : [];
  for (const id of groups) if (!ids.has(id)) fail('INVALID_DEFINITION', `Unknown group column ${id}`);
  const aggregates = Array.isArray(definition.aggregates) ? definition.aggregates : [];
  for (const spec of aggregates) {
    if (!isObject(spec) || !ids.has(spec.column) || !['count', 'sum', 'min', 'max', 'avg'].includes(spec.op) || typeof spec.as !== 'string' || !spec.as) fail('INVALID_DEFINITION', 'Invalid aggregate specification');
  }
  return Object.freeze({
    id: definition.id ?? 'report',
    version: definition.version ?? '1',
    columns: Object.freeze(columns),
    order: Object.freeze(order.map(s => Object.freeze({ column: s.column, direction: s.direction ?? 'asc' }))),
    groupBy: Object.freeze(groups),
    aggregates: Object.freeze(aggregates.map(s => Object.freeze({ column: s.column, op: s.op, as: s.as }))),
    filter: typeof definition.filter === 'function' ? definition.filter : null,
  });
}

function csvCell(value, nullValue = '') {
  if (value === null || value === undefined) return nullValue;
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function createReportEngine(config = {}) {
  validatePlainObject(config, 'config');
  const limits = validateLimits(config.limits ?? {});

  function build(rows, definition) {
    if (!Array.isArray(rows)) fail('INVALID_INPUT', 'Rows must be an array');
    if (rows.length > limits.maxRows) fail('LIMIT_EXCEEDED', 'Row limit exceeded');
    const def = normalizeDefinition(definition, limits);
    const source = rows.map((row, index) => Object.freeze({ sequence: index, value: cloneValue(row, 0, limits) }));
    let selected = source.filter(item => !def.filter || Boolean(def.filter(item.value)));
    if (def.groupBy.length) {
      const groups = new Map();
      for (const item of selected) {
        const key = def.groupBy.map(col => stableKey(item.value[col] ?? null)).join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
        if (groups.size > limits.maxGroups) fail('LIMIT_EXCEEDED', 'Group limit exceeded');
      }
      selected = [...groups.values()].map(group => Object.freeze({ sequence: group[0].sequence, value: group[0].value, group }));
    }
    const projected = selected.map(item => {
      const row = {};
      for (const col of def.columns) {
        const value = item.value[col.key] ?? null;
        if (stringBytes(value) > limits.maxCellBytes) fail('LIMIT_EXCEEDED', `Cell ${col.id} exceeds limit`);
        row[col.id] = value;
      }
      if (item.group) {
        for (const agg of def.aggregates) {
          const values = item.group.map(entry => entry.value[agg.column]).filter(v => v !== null && v !== undefined);
          let value;
          if (agg.op === 'count') value = item.group.length;
          else if (!values.length) value = null;
          else if (agg.op === 'sum') value = values.reduce((a, b) => a + Number(b), 0);
          else if (agg.op === 'avg') value = values.reduce((a, b) => a + Number(b), 0) / values.length;
          else if (agg.op === 'min') value = values.reduce((a, b) => compareValues(a, b) <= 0 ? a : b);
          else value = values.reduce((a, b) => compareValues(a, b) >= 0 ? a : b);
          row[agg.as] = value;
        }
      }
      return Object.freeze(row);
    });
    projected.sort((a, b) => {
      for (const spec of def.order) {
        const cmp = compareValues(a[spec.column], b[spec.column]);
        if (cmp) return spec.direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
    const snapshot = Object.freeze({
      report: Object.freeze({ id: def.id, version: def.version }),
      columns: Object.freeze(def.columns.map(c => Object.freeze({ id: c.id, label: c.label }))),
      rows: Object.freeze(projected.slice()),
      totalRows: projected.length,
    });
    if (stringBytes(JSON.stringify(snapshot)) > limits.maxOutputBytes) fail('LIMIT_EXCEEDED', 'Report snapshot exceeds output limit');
    return snapshot;
  }

  function toJson(snapshot) {
    const text = JSON.stringify(snapshot);
    if (stringBytes(text) > limits.maxOutputBytes) fail('LIMIT_EXCEEDED', 'JSON output exceeds limit');
    return text;
  }

  function toCsv(snapshot, options = {}) {
    const nullValue = options.nullValue ?? '';
    const headers = snapshot.columns.map(c => csvCell(c.label, nullValue)).join(',');
    const lines = [headers];
    for (const row of snapshot.rows) lines.push(snapshot.columns.map(c => csvCell(row[c.id], nullValue)).join(','));
    const text = lines.join('\r\n') + '\r\n';
    if (stringBytes(text) > limits.maxOutputBytes) fail('LIMIT_EXCEEDED', 'CSV output exceeds limit');
    return text;
  }

  async function* streamCsv(snapshot, options = {}) {
    const nullValue = options.nullValue ?? '';
    const rowsPerChunk = options.rowsPerChunk ?? 100;
    if (!Number.isSafeInteger(rowsPerChunk) || rowsPerChunk < 1 || rowsPerChunk > limits.maxPageSize) fail('INVALID_DEFINITION', 'Invalid rowsPerChunk');
    let chunk = snapshot.columns.map(c => csvCell(c.label, nullValue)).join(',') + '\r\n';
    for (let i = 0; i < snapshot.rows.length; i++) {
      chunk += snapshot.columns.map(c => csvCell(snapshot.rows[i][c.id], nullValue)).join(',') + '\r\n';
      if ((i + 1) % rowsPerChunk === 0 || i === snapshot.rows.length - 1) {
        if (stringBytes(chunk) > limits.maxOutputBytes) fail('LIMIT_EXCEEDED', 'CSV chunk exceeds limit');
        yield chunk;
        chunk = '';
        await Promise.resolve();
      }
    }
  }

  return Object.freeze({ limits, build, toJson, toCsv, streamCsv });
}

export { DEFAULT_LIMITS, ReportError, createReportEngine };
