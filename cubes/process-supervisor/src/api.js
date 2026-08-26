import { createProcessSupervisor as createRuntime, ProcessSupervisorError, defaultCapabilities } from './runtime.js';

export { ProcessSupervisorError, defaultCapabilities };

export function createProcessSupervisor(options, capabilities) {
  const runtime = createRuntime(options, capabilities);
  return Object.freeze({
    supervisorId: runtime.supervisorId,
    config: runtime.config,
    inspect: () => runtime.inspect(),
    snapshot: () => runtime.snapshot(),
    async start(options = {}) { return runtime.start(options); },
    async stop(options = {}) { return runtime.stop(options); },
    async restart(options = {}) { return runtime.restart(options); },
    async close() { return runtime.close(); },
  });
}
