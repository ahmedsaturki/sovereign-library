# Stream / Pipeline Cube v0.1

Native lazy AsyncIterable pipeline helpers with bounded chunk sizing, ordered transforms, backpressure through pull-based consumption, cancellation propagation, typed failures, and sink cleanup.

Built from ECMAScript and Node.js stream primitives only. No runtime third-party dependencies.

## Included

- lazy `AsyncIterable` pipelines
- ordered sync/async transforms
- bounded chunk sizes
- bounded collection count
- pull-based backpressure
- AbortSignal propagation
- typed source/transform/sink failures
- sink finalization and failure cleanup
