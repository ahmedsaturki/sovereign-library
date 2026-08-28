#!/usr/bin/env python3
"""Language-neutral conformance runner for Sovereign Library Python native ports.

Reads the SAME canonical vector files (contracts/conformance/vectors.<cube>.json)
that the Node runner uses, and executes them against a staged Python implementation.
A native port MUST satisfy the canonical contract exactly.

Usage:
  python3 scripts/run_conformance.py <vectorFile> <pythonModulePath>
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import traceback

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def fail(message: str) -> "None":
    raise RuntimeError(f"[conformance] {message}")


def load_module(path: str):
    spec = importlib.util.spec_from_file_location("conformance_target", path)
    if spec is None or spec.loader is None:
        fail(f"cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def deep_equal(a, b) -> bool:
    if a is b:
        return True
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return False
        return all(deep_equal(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        return all(deep_equal(x, y) for x, y in zip(a, b))
    if isinstance(a, float) and isinstance(b, float):
        return a == b
    return a == b


def get_path(obj, path: str):
    cur = obj
    for part in path.split("."):
        if cur is None:
            return None
        cur = cur.get(part) if isinstance(cur, dict) else None
    return cur


def resolve_bindings(value, bindings):
    if isinstance(value, str) and value.startswith("$"):
        return get_path(bindings, value[1:])
    if isinstance(value, dict) and "$build" in value:
        builder = value["$build"]
        if builder == "circular":
            o = {}
            o["self"] = o
            return o
        if builder == "nan":
            return float("nan")
        if builder == "infinity":
            return float("inf")
        if builder == "map":
            # A non-plain mapping (subclass of dict) exercises the contract's
            # UNSUPPORTED_OBJECT rejection for objects that are not plain objects.
            return type("NonPlain", (dict,), {})()
        fail(f"unknown $build directive: {builder}")
    if isinstance(value, list):
        return [resolve_bindings(v, bindings) for v in value]
    if isinstance(value, dict):
        return {k: resolve_bindings(v, bindings) for k, v in value.items()}
    return value


def call_export(mod, call_spec, bindings):
    name, args = call_spec
    resolved = [resolve_bindings(a, bindings) for a in (args or [])]
    fn = mod
    for part in name.split("."):
        fn = getattr(fn, part, None)
        if fn is None:
            fail(f"export not accessible: {name}")
    if callable(fn):
        return fn(*resolved)
    if not args:
        return fn
    fail(f"export not callable/accessible: {name}")


def shape_check(value, required_keys) -> "str | None":
    if not isinstance(value, dict):
        return "value is not an object"
    missing = [k for k in required_keys if k not in value]
    if missing:
        return f"missing keys: {', '.join(missing)}"
    return None


def deep_equal_pick(a, pick) -> bool:
    return all(deep_equal(a.get(k), v) for k, v in pick.items())


def run_vector(mod, vector) -> dict:
    bindings = {}
    if "setup" in vector:
        bindings["snapshot"] = call_export(mod, vector["setup"]["call"], bindings)
    subject = vector["call"]
    if "serializeFirst" in vector:
        serialized = call_export(mod, vector["serializeFirst"]["call"], bindings)
        bindings["serialized"] = serialized
    expect = vector["expect"]
    try:
        actual = call_export(mod, subject, bindings)
        if expect["kind"] == "throws":
            return {"ok": False, "message": f"expected throw {expect.get('errorName')} but returned value"}
        if expect["kind"] == "value":
            if "pick" in expect:
                ok = deep_equal_pick(actual, expect["pick"])
            else:
                ok = deep_equal(actual, expect["value"])
            if not ok:
                return {"ok": False, "message": f"value mismatch\n  expected: {expect.get('pick', expect.get('value'))}\n  actual:   {actual}"}
            if "expectFailuresContains" in expect:
                failures = (actual or {}).get("failures", []) if isinstance(actual, dict) else []
                found = any(shape_check(f, list(expect["expectFailuresContains"].keys())) is None
                            and deep_equal_pick(f, expect["expectFailuresContains"]) for f in failures)
                if not found:
                    return {"ok": False, "message": f"failures missing {expect['expectFailuresContains']} in {failures}"}
            return {"ok": True}
        if expect["kind"] == "shape":
            err = shape_check(actual, expect["requiredKeys"])
            if err:
                return {"ok": False, "message": err}
            return {"ok": True}
        return {"ok": False, "message": f"unknown expectation kind: {expect['kind']}"}
    except Exception as err:  # noqa: BLE001
        if expect["kind"] == "throws":
            if expect.get("errorName") and type(err).__name__ != expect["errorName"]:
                return {"ok": False, "message": f"threw {type(err).__name__}, expected {expect['errorName']}"}
            return {"ok": True}
        return {"ok": False, "message": f"unexpected throw: {type(err).__name__}: {err}"}


def main() -> int:
    if len(sys.argv) < 3:
        fail("usage: run_conformance.py <vectorFile> <pythonModulePath>")
    vector_file = sys.argv[1]
    module_path = sys.argv[2]
    with open(vector_file, "r", encoding="utf-8") as fh:
        suite = json.load(fh)
    mod = load_module(module_path)
    passed = failed = 0
    failures = []
    for vector in suite["vectors"]:
        result = run_vector(mod, vector)
        if result["ok"]:
            passed += 1
            print(f"  PASS  {suite['contract']} :: {vector['id']}")
        else:
            failed += 1
            failures.append({"id": vector["id"], "message": result["message"]})
            print(f"  FAIL  {suite['contract']} :: {vector['id']}\n        {result['message']}")
    print(f"\n[conformance] {suite['contract']} ({suite['format']}): {passed} passed, {failed} failed")
    if failed:
        print(f"[conformance] FAILED {len(failures)} vector(s)")
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as err:  # noqa: BLE001
        print(f"[conformance] ERROR: {err}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
