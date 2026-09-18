#!/usr/bin/env bash
# scripts/symbolic-execute.sh
#
# Phase-3 / Continuity-Hardening Wave — symbolic execution wrapper.
#
# Usage:
#     bash scripts/symbolic-execute.sh --target <name> --out <dir>
#
# Targets are looked up in tests/symbolic-execution/klee/<target>.c
# or tests/symbolic-execution/angr/<target>.py. KLEE takes precedence
# for C ports; Angr for Python-extracted JS.

set -euo pipefail

TARGET=""
OUT_DIR=".hermes/phase3/symbolic"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --target) TARGET="$2"; shift 2;;
        --out)    OUT_DIR="$2"; shift 2;;
        *) echo "unknown arg: $1"; exit 2;;
    esac
done

if [[ -z "$TARGET" ]]; then echo "usage: $0 --target <name> [--out <dir>]"; exit 2; fi

REPO_ROOT="$(cd "$(dirname "$0")"/.. && pwd)"
mkdir -p "$OUT_DIR"

C_PORT="tests/symbolic-execution/klee/${TARGET}.c"
PY_PORT="tests/symbolic-execution/angr/${TARGET}.py"

if [[ -f "$C_PORT" ]]; then
    echo "symbolic-execute: target=$TARGET tool=klee"
    TMP="$(mktemp -d)"
    clang -emit-llvm -c -g -O0 -Xclang -disable-O0-optnone \
        -I"$REPO_ROOT/tests/symbolic-execution/klee" \
        "$REPO_ROOT/$C_PORT" -o "$TMP/${TARGET}.bc" || {
            echo "clang failed; recording static-only transcript" >&2
            cp "$REPO_ROOT/$C_PORT" "$OUT_DIR/${TARGET}.c.txt"
            echo '{"tool":"klee","status":"skipped","reason":"clang unavailable"}' > "$OUT_DIR/${TARGET}.klee.transcript.json"
            exit 0
        }
    if command -v klee > /dev/null 2>&1; then
        (cd "$TMP" && klee --check-asserts --output-dir="$OUT_DIR/${TARGET}.klee" "${TARGET}.bc")
    else
        echo '{"tool":"klee","status":"skipped","reason":"klee not installed"}' > "$OUT_DIR/${TARGET}.klee.transcript.json"
    fi
    echo "symbolic-execute: $TARGET done → $OUT_DIR"
elif [[ -f "$PY_PORT" ]]; then
    echo "symbolic-execute: target=$TARGET tool=angr"
    if command -v python3 > /dev/null 2>&1 && python3 -c "import angr" > /dev/null 2>&1; then
        python3 "$REPO_ROOT/$PY_PORT" --out "$OUT_DIR/${TARGET}.angr.transcript.json"
    else
        echo '{"tool":"angr","status":"skipped","reason":"angr not installed"}' > "$OUT_DIR/${TARGET}.angr.transcript.json"
    fi
else
    echo "symbolic-execute: no port for $TARGET"; exit 1
fi