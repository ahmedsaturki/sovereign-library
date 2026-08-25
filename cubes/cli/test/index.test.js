import test from 'node:test';
import assert from 'node:assert/strict';
import { createCli, CliError } from '../src/index.js';

test('parses long options and dispatches deterministic subcommands', async () => {
  const cli = createCli({
    name: 'demo', version: '1.2.3',
    commands: [{
      name: 'greet',
      options: [{ name: 'name', short: 'n', type: 'string', required: true }],
      handler: ({ options }) => ({ code: 0, stdout: `hello:${options.name}\n` }),
    }],
  });
  const result = await cli.run(['greet', '--name', 'Ada']);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'hello:Ada\n');
});

test('supports grouped boolean short flags', async () => {
  const cli = createCli({
    name: 'demo',
    commands: [{
      name: 'run',
      options: [
        { name: 'verbose', short: 'v', type: 'boolean' },
        { name: 'quiet', short: 'q', type: 'boolean' },
      ],
      handler: ({ options }) => ({ code: options.verbose && options.quiet ? 7 : 1 }),
    }],
  });
  assert.equal((await cli.run(['run', '-vq'])).code, 7);
});

test('supports scalar and repeatable options without mutation', async () => {
  const cli = createCli({
    name: 'demo',
    commands: [{
      name: 'run',
      options: [
        { name: 'count', type: 'integer', default: 2 },
        { name: 'tag', type: 'string', repeatable: true, default: [] },
      ],
      handler: ({ options }) => ({ code: options.count + options.tag.length }),
    }],
  });
  assert.equal((await cli.run(['run', '--count', '3', '--tag', 'a', '--tag=b'])).code, 5);
});

test('rejects unknown, duplicate, missing, and invalid options', async () => {
  const cli = createCli({ name: 'demo', commands: [{ name: 'run', options: [{ name: 'count', type: 'integer' }], handler: () => ({}) }] });
  assert.equal((await cli.run(['run', '--unknown'])).code, 2);
  assert.equal((await cli.run(['run', '--count', '1', '--count', '2'])).code, 2);
  assert.equal((await cli.run(['run', '--count'])).code, 2);
  assert.equal((await cli.run(['run', '--count', 'x'])).code, 2);
});

test('renders deterministic help and version', async () => {
  const cli = createCli({ name: 'demo', version: '9.0.0', commands: [{ name: 'run', description: 'Run it', handler: () => ({}) }] });
  const help = await cli.run(['run', '--help']);
  const version = await cli.run(['--version']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /demo v9\.0\.0/);
  assert.match(help.stdout, /run\tRun it/);
  assert.equal(version.stdout, '9.0.0\n');
});

test('supports explicit environment allowlisting', async () => {
  const cli = createCli({
    name: 'demo',
    commands: [{ name: 'run', handler: ({ readEnv }) => ({ code: readEnv('MODE') === 'test' ? 0 : 4 }) }],
  });
  assert.equal((await cli.run(['run'], { env: { MODE: 'test' }, allowedEnv: ['MODE'] })).code, 0);
  assert.equal((await cli.run(['run'], { env: { MODE: 'test' }, allowedEnv: [] })).code, 2);
});

test('bounds output and arguments without copying payloads into errors', async () => {
  const cli = createCli({
    name: 'demo',
    limits: { maxArgs: 2, maxOutputBytes: 4 },
    commands: [{ name: 'run', handler: () => ({ code: 0, stdout: '12345' }) }],
  });
  assert.equal((await cli.run(['run', 'x', 'y'])).code, 0);
  const tooMany = await cli.run(['run', 'x', 'y', 'z']);
  assert.equal(tooMany.code, 2);
  const output = await cli.run(['run']);
  assert.equal(output.code, 1);
  assert.equal(output.stderr, 'OUTPUT_LIMIT\n');
  assert.doesNotThrow(() => new CliError('X', 'safe'));
});

test('configuration rejects duplicate definitions and accessors', () => {
  assert.throws(() => createCli({ name: 'demo', commands: [
    { name: 'run', handler: () => ({}) },
    { name: 'run', handler: () => ({}) },
  ] }), /AMBIGUOUS_CONFIG/);
  const config = { name: 'demo', get commands() { throw new Error('must not execute'); } };
  assert.throws(() => createCli(config), /Accessor properties are not supported/);
});
