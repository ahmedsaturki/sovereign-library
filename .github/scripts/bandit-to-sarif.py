#!/usr/bin/env python3
"""
Convert Bandit JSON output (or any empty/fallback input) to a SARIF v2.1.0 document.

This script deliberately fails open (exits 0 with a no-op SARIF document) so
that the security-pipeline CI step never breaks the surrounding workflow. The
SARIF document is only useful if Bandit actually produced results; otherwise it
is an empty placeholder.

Usage:
    python bandit-to-sarif.py <bandit-report.json> <sarif-output.sarif>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def convert(bandit_path: str, sarif_path: str) -> int:
    bandit_file = Path(bandit_path)
    results: list[dict] = []

    if bandit_file.is_file() and bandit_file.stat().st_size > 0:
        try:
            data = json.loads(bandit_file.read_text(encoding="utf-8"))
            for entry in data.get("results", []):
                results.append(
                    {
                        "ruleId": entry.get("test_id", "bandit"),
                        "level": _severity_to_level(entry.get("issue_severity", "")),
                        "message": {"text": entry.get("issue_text", "") or "Bandit finding"},
                        "locations": [
                            {
                                "physicalLocation": {
                                    "artifactLocation": {"uri": entry.get("filename", "")},
                                    "region": {
                                        "startLine": int(entry.get("line_number", 1) or 1),
                                    },
                                }
                            }
                        ],
                    }
                )
        except (json.JSONDecodeError, OSError, ValueError) as exc:
            print(f"bandit-to-sarif: failed to parse {bandit_path}: {exc}", file=sys.stderr)
            return 0

    sarif_doc = {
        "$schema": "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {"driver": {"name": "bandit", "version": "n/a"}},
                "results": results,
            }
        ],
    }

    out = Path(sarif_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(sarif_doc, indent=2), encoding="utf-8")
    print(f"bandit-to-sarif: wrote {out} with {len(results)} result(s)")
    return 0


def _severity_to_level(severity: str) -> str:
    sev = (severity or "").upper()
    if sev in {"HIGH", "MEDIUM"}:
        return "warning" if sev == "MEDIUM" else "error"
    if sev == "LOW":
        return "note"
    return "none"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: bandit-to-sarif.py <bandit-report.json> <sarif-output.sarif>", file=sys.stderr)
        sys.exit(0)
    sys.exit(convert(sys.argv[1], sys.argv[2]))