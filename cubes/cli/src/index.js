const DEFAULTS = Object.freeze({
  maxArgs: 1024,
  maxTokenBytes: 64 * 1024,
  maxOptions: 128,
  maxSubcommands: 128,
  maxOutputBytes: 1024 * 1024,
  maxEnvKeyBytes: 256,
  maxEnvValueBytes: 64 * 1024,
});

const isObject = (value) => value !== null && typeof value === 'object';
const utf8Bytes = (value) => Buffer.byteLength(value, 'utf8');

export class CliError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'CliError';
    this.code = code;
    this.path = options.path ?? null;
    this.exitCode = options.exitCode ?? 2;
    Object.freeze(this);
  }
}

function fail(code, message, options = {}) {
  throw new CliError(code, message, options);
}

function assertLimit(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
}

function normalizeLimits(input = {}) {
  const limits = { ...DEFAULTS, ...input };
  for (const [name, value] of Object.entries(limits)) assertLimit(value, name);
  return Object.freeze(limits);
}

function cloneDefinition(value, path = 'config') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (!isObject(value)) fail('INVALID_CONFIG', 'Unsupported configuration value', { path });
  if (Array.isArray(value)) return Object.freeze(value.map((item, i) => cloneDefinition(item, `${path}[${i}]`)));
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_CONFIG', 'Accessor properties are not supported', { path: `${path}.${key}` });
    out[key] = cloneDefinition(descriptor.value, `${path}.${key}`);
  }
  return Object.freeze(out);
}

function assertName(name, kind) {
  if (typeof name !== 'string' || name.length === 0 || /[\s=]/u.test(name)) fail('INVALID_CONFIG', `Invalid ${kind} name`);
  if (utf8Bytes(name) > 256) fail('INVALID_CONFIG', `${kind} name exceeds limit`);
}

function createOptionTable(options, limits, commandPath) {
  if (!Array.isArray(options) || options.length > limits.maxOptions) fail('INVALID_CONFIG', 'Invalid option definition', { path: commandPath });
  const byLong = new Map();
  const byShort = new Map();
  const normalized = [];
  for (const option of options) {
    if (!isObject(option)) fail('INVALID_CONFIG', 'Option must be an object', { path: commandPath });
    assertName(option.name, 'option');
    if (option.short !== undefined) {
      if (typeof option.short !== 'string' || option.short.length !== 1 || option.short === '-') fail('INVALID_CONFIG', 'Invalid short option', { path: commandPath });
      if (byShort.has(option.short)) fail('AMBIGUOUS_CONFIG', 'Duplicate short option', { path: commandPath });
    }
    if (byLong.has(option.name)) fail('AMBIGUOUS_CONFIG', 'Duplicate option', { path: commandPath });
    const type = option.type ?? 'boolean';
    if (!['string', 'boolean', 'integer', 'number', 'enum'].includes(type)) fail('INVALID_CONFIG', 'Unsupported option type', { path: commandPath });
    const repeatable = option.repeatable === true;
    if (repeatable && option.default !== undefined && !Array.isArray(option.default)) fail('INVALID_CONFIG', 'Repeatable default must be an array', { path: commandPath });
    const normalizedOption = Object.freeze({
      name: option.name,
      short: option.short,
      type,
      required: option.required === true,
      repeatable,
      enum: type === 'enum' ? Object.freeze([...(option.enum ?? [])]) : undefined,
      default: cloneDefinition(option.default, `${commandPath}.${option.name}.default`),
    });
    if (type === 'enum' && (!Array.isArray(normalizedOption.enum) || normalizedOption.enum.length === 0)) fail('INVALID_CONFIG', 'Enum option requires values', { path: commandPath });
    byLong.set(normalizedOption.name, normalizedOption);
    if (normalizedOption.short) byShort.set(normalizedOption.short, normalizedOption);
    normalized.push(normalizedOption);
  }
  return Object.freeze({ byLong, byShort, options: Object.freeze(normalized) });
}

function normalizeCommands(commands, limits, parent = '') {
  if (!Array.isArray(commands) || commands.length > limits.maxSubcommands) fail('INVALID_CONFIG', 'Invalid commands definition', { path: parent || 'commands' });
  const byName = new Map();
  const normalized = [];
  for (const command of commands) {
    if (!isObject(command)) fail('INVALID_CONFIG', 'Command must be an object', { path: parent || 'commands' });
    assertName(command.name, 'command');
    if (byName.has(command.name)) fail('AMBIGUOUS_CONFIG', 'Duplicate command name', { path: parent || 'commands' });
    const path = parent ? `${parent}.${command.name}` : command.name;
    const optionTable = createOptionTable(command.options ?? [], limits, path);
    if (typeof command.handler !== 'function') fail('INVALID_CONFIG', 'Command handler must be a function', { path });
    const children = normalizeCommands(command.commands ?? [], limits, path);
    const normalizedCommand = Object.freeze({
      name: command.name,
      description: command.description ?? '',
      positional: Object.freeze({ min: command.positional?.min ?? 0, max: command.positional?.max ?? Number.MAX_SAFE_INTEGER }),
      options: optionTable,
      commands: children,
      handler: command.handler,
    });
    if (!Number.isSafeInteger(normalizedCommand.positional.min) || normalizedCommand.positional.min < 0 || !Number.isSafeInteger(normalizedCommand.positional.max) || normalizedCommand.positional.max < normalizedCommand.positional.min) fail('INVALID_CONFIG', 'Invalid positional bounds', { path });
    for (const child of children) if (byName.has(child.name)) fail('AMBIGUOUS_CONFIG', 'Duplicate subcommand name', { path });
    byName.set(command.name, normalizedCommand);
    normalized.push(normalizedCommand);
  }
  return Object.freeze({ byName, commands: Object.freeze(normalized) });
}

function convertValue(option, raw, path) {
  if (option.type === 'string') return raw;
  if (option.type === 'boolean') {
    if (raw === true || raw === undefined) return true;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    fail('INVALID_VALUE', 'Invalid boolean option value', { path });
  }
  if (option.type === 'integer') {
    if (!/^[+-]?\d+$/u.test(raw)) fail('INVALID_VALUE', 'Invalid integer option value', { path });
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) fail('INVALID_VALUE', 'Integer option value is out of range', { path });
    return value;
  }
  if (option.type === 'number') {
    const value = Number(raw);
    if (!Number.isFinite(value)) fail('INVALID_VALUE', 'Invalid number option value', { path });
    return value;
  }
  if (option.type === 'enum') {
    if (!option.enum.includes(raw)) fail('INVALID_VALUE', 'Invalid enum option value', { path });
    return raw;
  }
  fail('INVALID_VALUE', 'Unsupported option type', { path });
}

function parseArgv(argv, command, limits) {
  if (!Array.isArray(argv) || argv.length > limits.maxArgs) fail('ARG_LIMIT', 'Argument count exceeds configured limit', { exitCode: 2 });
  for (const token of argv) {
    if (typeof token !== 'string') fail('INVALID_ARGV', 'Arguments must be strings', { exitCode: 2 });
    if (utf8Bytes(token) > limits.maxTokenBytes) fail('ARG_LIMIT', 'Argument token exceeds configured limit', { exitCode: 2 });
  }
  const options = {};
  for (const def of command.options.options) if (def.default !== undefined) options[def.name] = def.repeatable ? [...def.default] : def.default;
  const positionals = [];
  let i = 0;
  let endOptions = false;
  while (i < argv.length) {
    const token = argv[i];
    if (endOptions) { positionals.push(token); i += 1; continue; }
    if (token === '--') { endOptions = true; i += 1; continue; }
    if (token === '-' || !token.startsWith('-')) { positionals.push(token); i += 1; continue; }
    if (token === '--help' || token === '-h') return { help: true, options, positionals };
    if (token === '--version') return { version: true, options, positionals };
    if (token.startsWith('--')) {
      const body = token.slice(2);
      const equals = body.indexOf('=');
      const name = equals >= 0 ? body.slice(0, equals) : body;
      const option = command.options.byLong.get(name);
      if (!option) fail('UNKNOWN_OPTION', 'Unknown option', { exitCode: 2 });
      let raw = true;
      if (option.type !== 'boolean') {
        if (equals >= 0) raw = body.slice(equals + 1);
        else { i += 1; if (i >= argv.length) fail('MISSING_VALUE', 'Option value is required', { exitCode: 2 }); raw = argv[i]; }
      } else if (equals >= 0) raw = body.slice(equals + 1);
      const value = convertValue(option, raw, option.name);
      if (option.repeatable) (options[option.name] ??= []).push(value);
      else if (options[option.name] !== undefined) fail('DUPLICATE_OPTION', 'Duplicate scalar option', { exitCode: 2 });
      else options[option.name] = value;
      i += 1;
      continue;
    }
    const group = token.slice(1);
    for (let p = 0; p < group.length; p += 1) {
      const short = group[p];
      const option = command.options.byShort.get(short);
      if (!option) fail('UNKNOWN_OPTION', 'Unknown option', { exitCode: 2 });
      let raw = true;
      if (option.type !== 'boolean') {
        const attached = group.slice(p + 1);
        if (attached) { raw = attached; p = group.length; }
        else { i += 1; if (i >= argv.length) fail('MISSING_VALUE', 'Option value is required', { exitCode: 2 }); raw = argv[i]; }
      }
      const value = convertValue(option, raw, option.name);
      if (option.repeatable) (options[option.name] ??= []).push(value);
      else if (options[option.name] !== undefined) fail('DUPLICATE_OPTION', 'Duplicate scalar option', { exitCode: 2 });
      else options[option.name] = value;
    }
    i += 1;
  }
  for (const option of command.options.options) if (option.required && options[option.name] === undefined) fail('MISSING_OPTION', 'Required option is missing', { exitCode: 2 });
  if (positionals.length < command.positional.min || positionals.length > command.positional.max) fail('INVALID_POSITIONALS', 'Positional arguments are invalid', { exitCode: 2 });
  return { options: Object.freeze(options), positionals: Object.freeze(positionals) };
}

function renderHelp(config, command) {
  const lines = [`${config.name}${config.version ? ` v${config.version}` : ''}`, command.description || '', 'Usage:'];
  lines.push(`  ${config.name} ${command.name}${command.options.options.length ? ' [options]' : ''}`);
  if (command.commands.commands.length) { lines.push('', 'Commands:'); for (const child of command.commands.commands) lines.push(`  ${child.name}\t${child.description}`); }
  if (command.options.options.length) { lines.push('', 'Options:'); for (const option of command.options.options) lines.push(`  --${option.name}${option.short ? `, -${option.short}` : ''}${option.type === 'boolean' ? '' : ` <${option.type}>`}\t${option.required ? 'required' : 'optional'}`); }
  lines.push('', '  -h, --help\tShow help', '  --version\tShow version');
  return `${lines.join('\n')}\n`;
}

function makeIo(io, maxOutputBytes) {
  const stdout = io?.stdout ?? null;
  const stderr = io?.stderr ?? null;
  let outputBytes = 0;
  const write = async (target, text) => {
    if (typeof text !== 'string') fail('OUTPUT_TYPE', 'Output must be a string', { exitCode: 1 });
    const size = utf8Bytes(text);
    if (outputBytes + size > maxOutputBytes) fail('OUTPUT_LIMIT', 'Command output exceeds configured limit', { exitCode: 1 });
    outputBytes += size;
    if (target && typeof target.write === 'function') await target.write(text);
    return text;
  };
  return Object.freeze({
    get stdin() { return io?.stdin ?? null; },
    writeStdout: (text) => write(stdout, text),
    writeStderr: (text) => write(stderr, text),
  });
}

export function createCli(definition) {
  if (!isObject(definition)) fail('INVALID_CONFIG', 'CLI definition must be an object');
  assertName(definition.name ?? '', 'CLI');
  const limits = normalizeLimits(definition.limits);
  const commands = normalizeCommands(definition.commands ?? [], limits);
  const config = Object.freeze({ name: definition.name, version: definition.version ?? null, limits, commands });

  async function run(argv = [], context = {}) {
    const tokens = [...argv];
    let command = { name: config.name, description: '', options: createOptionTable([], limits, 'root'), commands: normalizeCommands([], limits), positional: { min: 0, max: 0 }, handler: async () => ({ code: 0 }) };
    const consumed = [];
    while (tokens.length && command.commands.byName.has(tokens[0])) {
      const next = command.commands.byName.get(tokens.shift());
      command = next;
      consumed.push(command.name);
    }
    if (consumed.length === 0 && config.commands.commands.length) {
      const first = tokens[0];
      if (first && config.commands.byName.has(first)) { command = config.commands.byName.get(tokens.shift()); consumed.push(command.name); }
      else if (first && first.startsWith('-')) { command = { name: config.name, description: '', options: createOptionTable([], limits, 'root'), commands: config.commands, positional: { min: 0, max: Number.MAX_SAFE_INTEGER }, handler: async () => ({ code: 0 }) }; }
      else fail('UNKNOWN_COMMAND', 'Unknown command', { exitCode: 2 });
    }

    const parsed = parseArgv(tokens, command, limits);
    if (parsed.help) return Object.freeze({ code: 0, stdout: renderHelp(config, command), stderr: '' });
    if (parsed.version) return Object.freeze({ code: 0, stdout: `${config.version ?? ''}\n`, stderr: '' });

    const env = context.env ?? {};
    const allowedEnv = new Set(context.allowedEnv ?? []);
    const readEnv = (key) => {
      if (typeof key !== 'string' || utf8Bytes(key) > limits.maxEnvKeyBytes) fail('INVALID_ENV_KEY', 'Invalid environment key', { exitCode: 2 });
      if (!allowedEnv.has(key)) fail('ENV_DENIED', 'Environment access denied', { exitCode: 2 });
      const value = env[key];
      if (value !== undefined && utf8Bytes(String(value)) > limits.maxEnvValueBytes) fail('ENV_LIMIT', 'Environment value exceeds configured limit', { exitCode: 2 });
      return value;
    };

    const io = makeIo(context.io, limits.maxOutputBytes);
    const commandContext = Object.freeze({
      command: consumed.at(-1) ?? config.name,
      options: parsed.options,
      positionals: parsed.positionals,
      stdin: io.stdin,
      writeStdout: io.writeStdout,
      writeStderr: io.writeStderr,
      readEnv,
      signal: context.signal ?? null,
    });

    try {
      const result = await command.handler(commandContext);
      const code = result?.code === undefined ? 0 : result.code;
      if (!Number.isSafeInteger(code) || code < 0 || code > 255) fail('INVALID_EXIT_CODE', 'Invalid exit code returned by command', { exitCode: 1 });
      const stdout = result?.stdout ?? '';
      const stderr = result?.stderr ?? '';
      await io.writeStdout(stdout);
      await io.writeStderr(stderr);
      return Object.freeze({ code, stdout, stderr });
    } catch (error) {
      if (error instanceof CliError) return Object.freeze({ code: error.exitCode, stdout: '', stderr: `${error.code}\n` , error });
      return Object.freeze({ code: 1, stdout: '', stderr: 'COMMAND_FAILURE\n', error });
    }
  }

  return Object.freeze({
    name: config.name,
    version: config.version,
    limits: config.limits,
    run,
  });
}
