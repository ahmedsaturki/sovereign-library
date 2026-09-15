from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, pattern: str, replacement: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    new, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE | re.DOTALL)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    path.write_text(new, encoding="utf-8")


release = ROOT / ".github/workflows/release-engineering.yml"
replace_once(
    release,
    r'^      - name: Chaos probe suite\n.*?^          retention-days: 14\n',
    '''      - name: Chaos probe suite
        shell: bash
        run: |
          set -Eeuo pipefail
          node scripts/chaos.mjs --suite ci/chaos/suite.json --out "$PHASE2_OUTPUT_DIR/chaos.json"
          test -s "$PHASE2_OUTPUT_DIR/chaos.json"
          cp "$PHASE2_OUTPUT_DIR/chaos.json" "$GITHUB_WORKSPACE/chaos.json"
          test -s "$GITHUB_WORKSPACE/chaos.json"
      - uses: actions/upload-artifact@65c4c4a1ddee5b72f698fdd19549f0f0fb45cf08 # v4.6.0
        if: always()
        with:
          name: chaos
          path: chaos.json
          if-no-files-found: error
          retention-days: 14
''',
    "release chaos block",
)

android = ROOT / ".github/workflows/android.yml"
replace_once(
    android,
    r'^(\s*)SEP=\$\(java -XshowSettings:properties -version 2>&1 \| tr -d \'\\r\' \| awk -F\'= \' \'/path\.separator =/\{print \$2; exit\}\'\)\n\s*test -n "\$SEP"\n\s*javac -cp "\$TMP_DIR/classes\.jar\$\{SEP\}\$STDLIB" "\$TMP_DIR/Consumer\.java"\n\s*java -cp "\$TMP_DIR\$\{SEP\}\$TMP_DIR/classes\.jar\$\{SEP\}\$STDLIB" Consumer\n',
    r'''\1if [ "${RUNNER_OS:-}" = "Windows" ]; then
\1  JAVA_TMP=$(cygpath -w "$TMP_DIR")
\1  JAVA_CLASSES=$(cygpath -w "$TMP_DIR/classes.jar")
\1  JAVA_STDLIB=$(cygpath -w "$STDLIB")
\1  JAVA_CONSUMER=$(cygpath -w "$TMP_DIR/Consumer.java")
\1  javac -cp "$JAVA_CLASSES;$JAVA_STDLIB" "$JAVA_CONSUMER"
\1  java -cp "$JAVA_TMP;$JAVA_CLASSES;$JAVA_STDLIB" Consumer
\1else
\1  SEP=$(java -XshowSettings:properties -version 2>&1 | tr -d '\\r' | awk -F'= ' '/path.separator =/{print $2; exit}')
\1  test -n "$SEP"
\1  javac -cp "$TMP_DIR/classes.jar${SEP}$STDLIB" "$TMP_DIR/Consumer.java"
\1  java -cp "$TMP_DIR${SEP}$TMP_DIR/classes.jar${SEP}$STDLIB" Consumer
\1fi
''',
    "android windows classpath block",
)
replace_once(
    android,
    r'(?m)^(\s*)"system-images;android-34;google_apis;x86_64"$',
    r'\1"system-images;android-34;google_apis;x86_64" \\\n\1"system-images;android-34;google_apis;arm64-v8a"',
    "android SDK image list",
)
replace_once(
    android,
    r'(?ms)^          "\$AVDMGR" create avd \\\n            --name sovereign-android-api34-ubuntu \\\n            --package "system-images;android-34;google_apis;x86_64" \\\n            --device "pixel_2" \\\n            --force\n',
    '''          SYSTEM_IMAGE="system-images;android-34;google_apis;x86_64"
          if [ ! -r /dev/kvm ] || [ ! -w /dev/kvm ]; then
            SYSTEM_IMAGE="system-images;android-34;google_apis;arm64-v8a"
            echo "KVM unavailable; using API-34 ARM64 system image."
          fi
          "$AVDMGR" create avd \\
            --name sovereign-android-api34-ubuntu \\
            --package "$SYSTEM_IMAGE" \\
            --device "pixel_2" \\
            --force
''',
    "android Ubuntu AVD block",
)
