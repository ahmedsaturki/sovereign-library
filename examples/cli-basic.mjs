import { createCli } from '../cubes/cli/src/index.js';

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
process.stdout.write(result.stdout);
process.exitCode = result.code;
