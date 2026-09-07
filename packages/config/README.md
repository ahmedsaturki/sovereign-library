# Configuration / Environment Cube v0.1

Standalone configuration primitives using Node.js runtime features only.

## Contract

The cube separates configuration **sources** from schema **definitions** and produces a deeply immutable snapshot.

Precedence is deterministic: later sources override earlier sources when a value is present.

Supported v0.1 types:

- `string`
- `integer`
- `number`
- `boolean`
- `url`
- `json`

Definitions may specify `required`, `defaultValue`, and an optional namespace used to locate the source key.

## Security boundary

Configuration values that look secret-bearing (`token`, `password`, `secret`, `apiKey`, credentials, etc.) can be redacted for diagnostics without changing the actual snapshot.

The cube does not persist secrets, contact remote secret stores, encrypt configuration, or provide a configuration UI.

## Example

```js
import { ConfigBuilder, EnvironmentSource } from './src/index.js';

const config = new ConfigBuilder({
  sources: [new EnvironmentSource()]
})
  .define('PORT', { type: 'integer', defaultValue: '3000' })
  .define('BASE_URL', { type: 'url', required: true })
  .build();
```

## Out of scope

Remote configuration, hot reload, secret vaults, persistence, schema compiler frameworks, and third-party configuration packages are intentionally outside v0.1.
