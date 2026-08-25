import test from 'node:test';
import assert from 'node:assert/strict';
import { MimeError, buildMultipart, parseMimeType, parseMultipart } from '../src/index.js';

function splitBuffer(buffer, sizes) {
  return (async function* () {
    let offset = 0;
    for (const size of sizes) {
      if (offset >= buffer.length) break;
      yield buffer.subarray(offset, Math.min(buffer.length, offset + size));
      offset += size;
    }
    if (offset < buffer.length) yield buffer.subarray(offset);
  })();
}

test('parseMimeType normalizes type and parameters', () => {
  const parsed = parseMimeType('Application/JSON; Charset="utf-8"');
  assert.equal(parsed.type, 'application/json');
  assert.equal(parsed.parameters.charset, 'utf-8');
  assert.equal(Object.isFrozen(parsed), true);
});

test('multipart parser handles text and binary parts across chunk boundaries', async () => {
  const built = buildMultipart([
    { name: 'title', value: 'hello', contentType: 'text/plain; charset=utf-8' },
    { name: 'file', filename: 'a.bin', value: Buffer.from([1, 2, 3, 4]), contentType: 'application/octet-stream' },
  ], { boundary: 'sov-test' });
  const parts = await parseMultipart(splitBuffer(built.body, [1, 2, 3, 5, 8, 13, 21]), { boundary: built.boundary });
  assert.equal(parts.length, 2);
  assert.equal(parts[0].disposition.name, 'title');
  assert.equal(parts[0].text, 'hello');
  assert.equal(parts[1].disposition.filename, 'a.bin');
  assert.deepEqual(parts[1].data, Buffer.from([1, 2, 3, 4]));
});

test('multipart parser preserves immutable part metadata', async () => {
  const built = buildMultipart([{ name: 'x', value: 'y' }], { boundary: 'meta' });
  const [part] = await parseMultipart(built.body, { boundary: built.boundary });
  assert.equal(Object.isFrozen(part), true);
  assert.equal(Object.isFrozen(part.headers), true);
  assert.equal(Object.isFrozen(part.disposition), true);
});

test('total and per-part size limits fail deterministically', async () => {
  const built = buildMultipart([{ name: 'x', value: '123456' }], { boundary: 'limits' });
  await assert.rejects(parseMultipart(built.body, { boundary: built.boundary, maxPartBytes: 3 }), error => error instanceof MimeError && error.code === 'PART_TOO_LARGE');
  await assert.rejects(parseMultipart(built.body, { boundary: built.boundary, maxTotalBytes: 4 }), error => error instanceof MimeError && error.code === 'BODY_TOO_LARGE');
});

test('malformed and incomplete multipart input is rejected', async () => {
  await assert.rejects(parseMultipart(Buffer.from('--x\r\nBroken\r\n\r\nbody'), { boundary: 'x' }), error => error instanceof MimeError && error.code === 'MALFORMED_HEADERS');
  await assert.rejects(parseMultipart(Buffer.from('--x\r\n'), { boundary: 'x' }), error => error instanceof MimeError && error.code === 'INCOMPLETE_MULTIPART');
});

test('abort signal cancels multipart parsing', async () => {
  const controller = new AbortController();
  controller.abort(new Error('stop'));
  await assert.rejects(parseMultipart(Buffer.from('x'), { boundary: 'x', signal: controller.signal }), error => error.message === 'stop');
});

test('builder returns usable content type and content length', () => {
  const built = buildMultipart([{ name: 'x', value: 'abc' }], { boundary: 'builder' });
  assert.equal(built.contentType, 'multipart/form-data; boundary=builder');
  assert.equal(built.contentLength, built.body.length);
  assert.match(built.body.toString(), /Content-Disposition: form-data; name="x"/);
});

test('invalid boundaries and parts fail early', async () => {
  await assert.rejects(parseMultipart(Buffer.from('x'), { boundary: '' }), error => error instanceof MimeError && error.code === 'INVALID_BOUNDARY');
  assert.throws(() => buildMultipart([], { boundary: '*bad*' }), MimeError);
  assert.throws(() => buildMultipart([{}], { boundary: 'x' }), MimeError);
});
