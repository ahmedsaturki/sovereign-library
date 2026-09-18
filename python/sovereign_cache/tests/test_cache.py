"""Native tests for the CACH1 cache Python port (contract-grounded)."""

import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_cache import Cache, CacheCubeError


def test_basic_set_get_has_delete():
    c = Cache()
    assert c.get("missing") is None
    c.set("k", 1)
    assert c.get("k") == 1
    assert c.has("k") is True
    assert c.delete("k") is True
    assert c.has("k") is False


def test_namespace_isolation():
    a = Cache({"namespace": "a"})
    b = Cache({"namespace": "b"})
    a.set("k", "av")
    assert b.get("k") is None
    assert a.get("k") == "av"


def test_ttl_expiry():
    c = Cache()
    c.set("k", "v", {"ttlMs": 20})
    assert c.get("k") == "v"
    time.sleep(0.05)
    assert c.get("k") is None  # expired -> miss + delete


def test_invalid_key():
    import pytest
    c = Cache()
    with pytest.raises(CacheCubeError):
        c.get("")


def test_invalid_ttl():
    import pytest
    c = Cache()
    with pytest.raises(CacheCubeError):
        c.set("k", 1, {"ttlMs": 0})


def test_invalid_namespace():
    import pytest
    with pytest.raises(CacheCubeError):
        Cache({"namespace": ""})


def test_eviction_oldest():
    c = Cache({"maxEntries": 2})
    c.set("a", 1)
    c.set("b", 2)
    c.set("c", 3)  # evicts a (oldest)
    assert c.get("a") is None
    assert c.get("b") == 2
    assert c.get("c") == 3
    assert c.stats()["evictions"] == 1


def test_invalidate_predicate():
    c = Cache()
    c.set("x1", 1)
    c.set("x2", 2)
    c.set("y1", 3)
    removed = c.invalidate(lambda k, v: k.startswith("x"))
    assert removed == 2
    assert c.get("y1") == 3
    assert c.get("x1") is None


def test_invalidate_invalid_predicate():
    import pytest
    c = Cache()
    with pytest.raises(CacheCubeError):
        c.invalidate("not callable")


def test_clear():
    c = Cache()
    c.set("a", 1)
    c.set("b", 2)
    assert c.clear() == 2
    assert c.get("a") is None


def test_stats_and_snapshot():
    c = Cache({"namespace": "n"})
    c.set("a", 1)
    c.get("a")  # hit
    c.get("missing")  # miss
    s = c.stats()
    assert s["hits"] == 1
    assert s["misses"] == 1
    assert s["sets"] == 1
    assert s["size"] == 1
    snap = c.snapshot()
    assert snap["namespace"] == "n"
    assert snap["maxEntries"] == 1000


def test_clock_injection():
    class FixedClock:
        def __init__(self):
            self.t = 1000.0
        def now(self):
            return self.t
    clk = FixedClock()
    c = Cache({"clock": clk})
    c.set("k", "v", {"ttlMs": 100})
    assert c.get("k") == "v"
    clk.t = 2000.0  # advance past expiry
    assert c.get("k") is None


def test_get_or_compute_single_flight():
    c = Cache()
    calls = {"n": 0}

    async def compute():
        calls["n"] += 1
        await asyncio.sleep(0.02)
        return "computed"

    async def go():
        r1, r2 = await asyncio.gather(
            c.getOrCompute("k", compute),
            c.getOrCompute("k", compute),
        )
        return r1, r2

    asyncio.run(go())
    assert calls["n"] == 1  # single flight: only one compute
    assert c.get("k") == "computed"


def test_get_or_compute_cache_hit():
    c = Cache()
    calls = {"n": 0}

    async def compute():
        calls["n"] += 1
        return 42

    async def go():
        await c.getOrCompute("k", compute)
        # second call hits cache, compute not invoked again
        return await c.getOrCompute("k", compute)
    assert asyncio.run(go()) == 42
    assert calls["n"] == 1


def test_get_or_compute_invalid_compute():
    import pytest
    c = Cache()
    with pytest.raises(CacheCubeError):
        asyncio.run(c.getOrCompute("k", "not callable"))
