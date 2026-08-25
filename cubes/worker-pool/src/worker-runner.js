import { parentPort, workerData } from 'node:worker_threads';

let execute;
let bootError = null;
try {
  const moduleUrl = workerData?.moduleUrl;
  if (typeof moduleUrl !== 'string' || moduleUrl.length === 0) throw new TypeError('workerData.moduleUrl must be a non-empty string');
  const module = await import(moduleUrl);
  if (typeof module.execute !== 'function') throw new TypeError('Worker handler module must export execute(payload)');
  execute = module.execute;
} catch (cause) {
  bootError = { name: cause?.name ?? 'Error', message: cause?.message ?? String(cause), stack: cause?.stack ?? null, code: cause?.code ?? null };
}

function serializeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
    code: error?.code ?? null,
  };
}

if (bootError) {
  parentPort?.postMessage({ type: 'boot-error', error: bootError });
} else {
  parentPort?.on('message', async message => {
    if (message?.type !== 'run') return;
    try {
      const result = await execute(message.payload);
      parentPort?.postMessage({ type: 'result', id: message.id, result });
    } catch (error) {
      parentPort?.postMessage({ type: 'error', id: message.id, error: serializeError(error) });
    }
  });
}
