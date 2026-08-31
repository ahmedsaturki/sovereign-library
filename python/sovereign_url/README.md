# sovereign-url — Python v0.1

Native, dependency-free Python implementation of the Sovereign URL / Query / Encoding contract.

## API

- `UrlError`
- `parse_url`
- `encode_uri_component_safe` / `decode_uri_component_strict` / `decode_uri_component_tolerant`
- `parse_query` / `build_query`
- `form_encode` / `form_decode`
- `utf8_encode` / `utf8_decode`
- `base64_encode` / `base64_decode`
- `base64url_encode` / `base64url_decode`
- `encode_path_segment` / `decode_path_segment`
- `DEFAULT_MAX_BYTES`

The runtime implementation uses only the Python standard library. It does not depend on the Node.js cube at runtime.

## Safety

Inputs are bounded by a 1 MiB default UTF-8 size limit. Percent decoding has explicit strict and tolerant modes. Base64/Base64URL decoding validates its alphabet and padding before decoding. URL metadata and parsed query snapshots are exposed as immutable mappings.

## Development

```bash
python -m pytest tests -q
```

Requires Python 3.9+.
