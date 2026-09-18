# Serialization / Binary Codec Cube v0.1

A deterministic bounded binary serialization format owned by Sovereign Library.

## Wire format

```text
SLBC magic (4 bytes)
version (1 byte)
value
```

Value tags cover null, booleans, finite IEEE-754 numbers, UTF-8 strings, arrays, and plain objects. Object keys are UTF-8 encoded in deterministic lexical order.

## Safety

- bounded encoded payload size
- bounded string size
- bounded collection item count
- bounded nesting depth
- duplicate-key rejection
- invalid tag/version/header rejection
- no executable decoding
- no arbitrary class reconstruction
- zero runtime third-party dependencies
