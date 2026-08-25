import { createWatcher } from '../cubes/filesystem-watcher-change-stream/src/index.js';

const watcher = createWatcher({
  roots: [process.cwd()],
  recursive: false,
  queueCapacity: 128,
  overflow: 'reject_new',
});

await watcher.start();
console.log('watching:', process.cwd());

setTimeout(async () => {
  await watcher.close();
}, 5000);

while (true) {
  const item = await watcher.next();
  if (item.done) break;
  console.log(item.value);
}
