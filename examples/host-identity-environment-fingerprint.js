import { fingerprintHost, compareHostFingerprints } from '../cubes/host-identity-environment-fingerprint/src/index.js';

const fingerprint = await fingerprintHost({
  environment: {
    allowlist: ['APP_MODE'],
    values: { APP_MODE: 'demo' },
  },
});

console.log(JSON.stringify({
  format: fingerprint.format,
  identity: fingerprint.identity,
  stable: fingerprint.stable,
  comparison: compareHostFingerprints(fingerprint, fingerprint),
}, null, 2));
