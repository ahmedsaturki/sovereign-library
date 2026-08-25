export async function execute(payload) {
  if (payload?.type === 'sleep') await new Promise(resolve => setTimeout(resolve, payload.ms));
  if (payload?.type === 'fail') throw Object.assign(new Error(payload.message ?? 'worker failure'), { code: payload.code ?? 'WORKER_TASK_FAILED' });
  if (payload?.type === 'throw-array') throw payload.value;
  if (payload?.type === 'multiply') return payload.value * payload.factor;
  return payload;
}
