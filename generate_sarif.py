
import json
import sys

def convert_bandit_to_sarif(bandit_json_path, output_path):
    with open(bandit_json_path, "r") as f:
        data = json.load(f)
    
    results = []
    rules = {}
    for item in data.get("results", []):
        issue_text = item.get("issue_text", "")
        test_id = item.get("test_id", "B000")
        severity = item.get("issue_severity", "MEDIUM")
        line = item.get("line_number", 1)
        file_path = item.get("filename", "unknown")
        
        # إنشاء rule
        rules[test_id] = {
            "id": test_id,
            "name": test_id,
            "shortDescription": {"text": issue_text},
            "defaultConfiguration": {"level": "warning" if severity in ["LOW", "MEDIUM"] else "error"}
        }
        
        results.append({
            "ruleId": test_id,
            "ruleIndex": len(rules) - 1,
            "level": "warning" if severity in ["LOW", "MEDIUM"] else "error",
            "message": {"text": issue_text},
            "locations": [{
                "physicalLocation": {
                    "artifactLocation": {"uri": file_path},
                    "region": {"startLine": line}
                }
            }]
        })
    
    sarif = {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {
                "driver": {
                    "name": "bandit",
                    "version": "1.9.4",
                    "informationUri": "https://github.com/PyCQA/bandit",
                    "rules": list(rules.values())
                }
            },
            "results": results,
            "artifacts": [{"location": {"uri": r.get("filename", "unknown")}} for r in data.get("results", [])]
        }]
    }
    
    with open(output_path, "w") as f:
        json.dump(sarif, f, indent=2)
    print(f"SARIF written to {output_path}")

if __name__ == "__main__":
    convert_bandit_to_sarif(sys.argv[1], sys.argv[2])
