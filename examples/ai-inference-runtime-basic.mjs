import { createRuntime } from '../cubes/ai-inference-runtime/src/index.js';

const runtime = createRuntime({
  adapter: {
    async infer(request) {
      const prompt = request.messages.at(-1).content;
      return { text: prompt.toUpperCase(), usage: { demo: true } };
    },
  },
});

const result = await runtime.infer({
  messages: [{ role: 'user', content: 'sovereign runtime' }],
});

console.log(result.text);
