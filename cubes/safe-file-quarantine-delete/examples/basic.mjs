import { quarantineItem, restoreQuarantined } from '../src/index.js';

const receipt = await quarantineItem('/tmp/sovereign-demo.txt', {
  quarantineRoot: '/tmp/sovereign-quarantine',
});

console.log(receipt);
await restoreQuarantined(receipt);
