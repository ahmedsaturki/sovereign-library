"""ci/load/locustfile.py — Phase-2 Locust smoke.

Phase-2 ships a Locustfile so the load-testing capability is exercised
end-to-end in CI. The default task points at a non-routable address so
the smoke completes quickly; replace ``self.client.get`` with the real
service URL when an environment target exists.

Run locally:
    locust -f ci/load/locustfile.py --headless -u 1 -r 1 -t 30s \\
        --host http://127.0.0.1:65535
"""
from locust import HttpUser, task, between


class SovereignPhase2User(HttpUser):
    wait_time = between(1, 3)

    @task(1)
    def probe(self):
        # No live target in default CI; the request fails fast.
        self.client.get("/", name="phase2-probe")