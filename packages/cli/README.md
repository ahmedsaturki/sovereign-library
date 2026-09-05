# CLI / Command Runtime Cube v0.1

Standalone native command-line parsing and dispatch runtime with no runtime third-party dependencies.

## API

```js
import { createCli } from './src/index.js';

const cli = createCli({
  name: 'demo',
  version: '1.0.0',
  commands: [{
    name: 'greet',
    options: [{ name: 'name', short: 'n', type: 'string', required: true }],
    handler: ({ options }) => ({ code: 0, stdout: `Hello ${options.name}\n` }),
  }],
});

const result = await cli.run(['greet', '--name', 'Ada']);
console.log(result.code, result.stdout);
```

The core is shell-agnostic and does not execute command strings. It parses already-tokenized argv, validates command definitions, dispatches handlers, and returns structured results.

See `specs/cli-command-runtime-v0.1.md` for the contract and scope.
