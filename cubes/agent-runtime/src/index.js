const DEFAULT_LIMITS = Object.freeze({
  maxMessages: 1000,
  maxMessageBytes: 64 * 1024,
  maxSteps: 100,
  maxToolCalls: 50,
  maxToolResultBytes: 256 * 1024,
  maxOutputBytes: 256 * 1024,
  maxDiagnosticsBytes: 8 * 1024,
  maxRetries: 3,
});

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'timed_out']);
const TRANSITIONS = Object.freeze({
  created: new Set(['running', 'cancelled', 'failed']),
  running: new Set(['waiting_tool', 'completed', 'failed', 'cancelled', 'timed_out']),
  waiting_tool: new Set(['running', 'failed', 'cancelled', 'timed_out']),
  completed: new Set(), failed: new Set(), cancelled: new Set(), timed_out: new Set(),
});

class AgentError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'AgentError';
    this.code = code;
    this.path = options.path ?? null;
    Object.freeze(this);
  }
}

const fail = (code, message, options = {}) => { throw new AgentError(code, message, options); };
const isObject = value => value !== null && typeof value === 'object';
const bytes = value => Buffer.byteLength(String(value), 'utf8');

function validatePlainObject(value, label) {
  if (!isObject(value) || Array.isArray(value)) fail('INVALID_DEFINITION', `${label} must be an object`);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_DEFINITION', `${label} contains accessor property`);
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

function immutableClone(value, depth = 0, seen = new Set()) {
  if (depth > 32) fail('LIMIT_EXCEEDED', 'Value nesting exceeds agent limit');
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) fail('INVALID_INPUT', 'Circular values are not supported');
  seen.add(value);
  if (Array.isArray(value)) {
    const result = Object.freeze(value.map(item => immutableClone(item, depth + 1, seen)));
    seen.delete(value);
    return result;
  }
  validatePlainObject(value, 'value');
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = immutableClone(value[key], depth + 1, seen);
  seen.delete(value);
  return Object.freeze(result);
}

function normalizeMessage(message, limits) {
  validatePlainObject(message, 'message');
  if (!['system', 'user', 'assistant'].includes(message.role)) fail('INVALID_INPUT', 'Invalid message role');
  if (typeof message.content !== 'string') fail('INVALID_INPUT', 'Message content must be text');
  if (bytes(message.content) > limits.maxMessageBytes) fail('LIMIT_EXCEEDED', 'Message exceeds size limit');
  return Object.freeze({ role: message.role, content: message.content });
}

function normalizeDefinition(definition, limits) {
  validatePlainObject(definition, 'definition');
  if (typeof definition.id !== 'string' || !definition.id) fail('INVALID_DEFINITION', 'Agent id is required');
  if (!Array.isArray(definition.tools) || definition.tools.length > 256) fail('INVALID_DEFINITION', 'Invalid tools definition');
  const toolNames = new Set();
  const tools = definition.tools.map(tool => {
    validatePlainObject(tool, 'tool');
    if (typeof tool.name !== 'string' || !tool.name) fail('INVALID_DEFINITION', 'Tool name is required');
    if (toolNames.has(tool.name)) fail('INVALID_DEFINITION', `Duplicate tool ${tool.name}`);
    toolNames.add(tool.name);
    return Object.freeze({
      name: tool.name,
      description: typeof tool.description === 'string' ? tool.description : '',
      handler: tool.handler,
    });
  });
  return Object.freeze({ id: definition.id, version: String(definition.version ?? '1'), tools: Object.freeze(tools) });
}

function createToolRegistry(definition, limits) {
  const handlers = new Map();
  for (const tool of definition.tools) {
    if (typeof tool.handler !== 'function') fail('INVALID_DEFINITION', `Tool ${tool.name} handler must be a function`);
    handlers.set(tool.name, tool.handler);
  }

  async function invoke(request, signal) {
    validatePlainObject(request, 'toolRequest');
    if (typeof request.name !== 'string' || !handlers.has(request.name)) fail('TOOL_NOT_ALLOWED', `Tool ${request.name ?? '<unknown>'} is not allowed`);
    const input = immutableClone(request.input ?? null);
    const result = await handlers.get(request.name)(input, { signal });
    const snapshot = immutableClone(result);
    if (bytes(JSON.stringify(snapshot)) > limits.maxToolResultBytes) fail('LIMIT_EXCEEDED', 'Tool result exceeds limit');
    return Object.freeze({ name: request.name, ok: true, result: snapshot });
  }

  return Object.freeze({
    names: Object.freeze([...handlers.keys()].sort()),
    invoke,
  });
}

function nextState(current, next) {
  if (!TRANSITIONS[current]?.has(next)) fail('INVALID_STATE', `Cannot transition from ${current} to ${next}`);
  return next;
}

function createAgentRuntime(config = {}) {
  validatePlainObject(config, 'config');
  const limits = validateLimits(config.limits ?? {});
  const definition = normalizeDefinition(config.definition, limits);
  const registry = createToolRegistry(definition, limits);

  function createSession(options = {}) {
    validatePlainObject(options, 'session options');
    const sessionId = typeof options.id === 'string' && options.id ? options.id : `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initialMessages = Array.isArray(options.messages) ? options.messages.map(message => normalizeMessage(message, limits)) : [];
    if (initialMessages.length > limits.maxMessages) fail('LIMIT_EXCEEDED', 'Initial message limit exceeded');
    let state = 'created';
    let messages = initialMessages;
    let steps = 0;
    let toolCalls = 0;
    let output = '';
    let retries = 0;

    const snapshot = () => Object.freeze({
      id: sessionId,
      agent: Object.freeze({ id: definition.id, version: definition.version }),
      state,
      messages: Object.freeze(messages.slice()),
      steps,
      toolCalls,
      retries,
      output,
    });

    function appendMessage(message) {
      if (messages.length >= limits.maxMessages) fail('LIMIT_EXCEEDED', 'Message limit exceeded');
      messages = Object.freeze([...messages, normalizeMessage(message, limits)]);
    }

    function transition(next) {
      state = nextState(state, next);
    }

    function addOutput(text) {
      if (typeof text !== 'string') fail('INVALID_INPUT', 'Output delta must be text');
      output += text;
      if (bytes(output) > limits.maxOutputBytes) fail('LIMIT_EXCEEDED', 'Agent output exceeds limit');
    }

    async function runTurn(input, options = {}) {
      if (TERMINAL.has(state)) fail('INVALID_STATE', `Session is terminal: ${state}`);
      if (typeof input === 'string') appendMessage({ role: 'user', content: input });
      else appendMessage(input);
      transition('running');
      steps += 1;
      if (steps > limits.maxSteps) fail('LIMIT_EXCEEDED', 'Step limit exceeded');

      const signal = options.signal;
      if (signal?.aborted) { state = 'cancelled'; fail('CANCELLED', 'Session cancelled'); }
      const timeoutMs = options.timeoutMs;
      let timeoutId = null;
      let timedOut = false;
      if (Number.isSafeInteger(timeoutMs) && timeoutMs > 0) timeoutId = setTimeout(() => { timedOut = true; }, timeoutMs);
      try {
        if (typeof options.execute !== 'function') return snapshot();
        const result = await options.execute(Object.freeze({ messages: messages.slice(), tools: registry.names }), { signal, invokeTool });
        if (timedOut) { state = 'timed_out'; fail('TIMEOUT', 'Turn timed out'); }
        if (result?.output) addOutput(String(result.output));
        if (Array.isArray(result?.messages)) for (const message of result.messages) appendMessage(message);
        transition('completed');
        return snapshot();
      } catch (error) {
        if (timedOut) { state = 'timed_out'; throw new AgentError('TIMEOUT', 'Turn timed out', { cause: error }); }
        if (error instanceof AgentError) {
          if (error.code === 'CANCELLED') state = 'cancelled';
          else if (error.code === 'TIMEOUT') state = 'timed_out';
          else state = 'failed';
          throw error;
        }
        state = 'failed';
        throw new AgentError('EXECUTION_FAILED', 'Agent turn failed', { cause: error });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    async function invokeTool(request, options = {}) {
      if (toolCalls >= limits.maxToolCalls) fail('LIMIT_EXCEEDED', 'Tool-call limit exceeded');
      if (TERMINAL.has(state)) fail('INVALID_STATE', `Session is terminal: ${state}`);
      transition('waiting_tool');
      toolCalls += 1;
      try {
        const result = await registry.invoke(request, options.signal);
        transition('running');
        return result;
      } catch (error) {
        state = 'failed';
        if (error instanceof AgentError) throw error;
        throw new AgentError('TOOL_FAILED', 'Tool execution failed', { cause: error });
      }
    }

    function retry() {
      if (state !== 'failed') fail('INVALID_STATE', 'Retry is only available after failure');
      retries += 1;
      if (retries > limits.maxRetries) fail('LIMIT_EXCEEDED', 'Retry limit exceeded');
      state = 'running';
      return snapshot();
    }

    function cancel() {
      if (!TERMINAL.has(state)) state = 'cancelled';
      return snapshot();
    }

    return Object.freeze({
      snapshot,
      appendMessage,
      transition,
      addOutput,
      runTurn,
      invokeTool,
      retry,
      cancel,
      get limits() { return limits; },
      get state() { return state; },
    });
  }

  return Object.freeze({ definition, limits, tools: registry, createSession });
}

export { AgentError, DEFAULT_LIMITS, createAgentRuntime };
