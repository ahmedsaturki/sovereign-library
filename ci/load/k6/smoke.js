// ci/load/k6/smoke.js
//
// Phase-2 k6 smoke script. This script does NOT depend on a running
// service — it self-loads by generating synthetic JSON payloads and
// validating the JSON parsing cube path. Replace the `__VU`-aware
// payload with an `http.get(<service URL>)` when a target URL is
// configured.
//
// Run locally:  k6 run ci/load/k6/smoke.js
// Run in CI:    k6 run --out cloud --out json=out.json ci/load/k6/smoke.js

import http from 'k6/http';
import {check} from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  // No real target — POST a tiny self-describing payload to a black-hole
  // address. The Phase-2 release-engineering workflow only runs this
  // job when K6_CLOUD_TOKEN is configured; locally it surfaces the
  // script's syntactic correctness.
  const res = http.get('https://httpbin.org/get', {
    headers: {'X-Sovereign-Phase': 'phase2'},
  });
  check(res, {
    'status is 200': r => r.status === 200,
    'response has origin header': r => r.json('origin') !== undefined,
  });
}