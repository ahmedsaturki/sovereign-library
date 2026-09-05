#!/bin/bash
# Create GitHub Releases for all 74 Sovereign Library packages
# Requires: gh CLI authenticated as ahmedsaturki

set -e

REPO_ROOT="/c/Users/powertech/sovereign-library-audit"
STAGING_DIR="/c/Users/powertech/sovereign-releases"

cd "$REPO_ROOT"

# Load package keys from REMAINING_PACKAGES.json
PACKAGES_JSON=$(cat "$REPO_ROOT/REMAINING_PACKAGES.json")
# Convert JSON array to bash array
PACKAGES=($(echo "$PACKAGES_JSON" | jq -r '.[]'))

# Already done packages
ALREADY_DONE=("safe-path-resolver" "runtime-capability-inspector")

# Load catalog for display names
CATALOG=$(cat "$REPO_ROOT/scripts/package-catalog.json")

success_count=0
fail_count=0
total=${#PACKAGES[@]}
# Add the already-done ones
ALL_PACKAGES=("${ALREADY_DONE[@]}" "${PACKAGES[@]}")
total=${#ALL_PACKAGES[@]}

echo "Creating GitHub Releases for $total packages..."
echo "-----------------------------------------------"

for pkg_key in "${ALL_PACKAGES[@]}"; do
    # Get display name from catalog
    display_name=$(echo "$CATALOG" | jq -r ".${pkg_key}.name // \"$pkg_key\"")
    
    # Determine tag name, title, body, and tarball based on package key
    if [ "$pkg_key" = "safe-path-resolver" ]; then
        tag_name="v0.1.0-safe-path-resolver"
        release_title="safe-path-resolver v0.1.0"
        tarball_name="sovereign-safe-path-resolver-0.1.0.tgz"
        release_body="Sovereign Library Phase-0 First Batch

Package: @sovereign/safe-path-resolver
Version: 0.1.0
SHA: c4272f0f71d8e5d33bbd764feb9d63d787cf3f3b
CI Run: #862 (all platforms green)
Exports: 11 (exact declaration surface verified)
Tarball: sovereign-safe-path-resolver-0.1.0.tgz
Distribution: GitHub-only (GITHUB_ONLY policy)
Status: RELEASED per PROJECT_CONTROL.md
"
    elif [ "$pkg_key" = "runtime-capability-inspector" ]; then
        tag_name="v0.1.0-runtime-capability-inspector"
        release_title="runtime-capability-inspector v0.1.0"
        tarball_name="sovereign-runtime-capability-inspector-0.1.0.tgz"
        release_body="Sovereign Library Phase-0 First Batch

Package: @sovereign/runtime-capability-inspector
Version: 0.1.0
SHA: c4272f0f71d8e5d33bbd764feb9d63d787cf3f3b
CI Run: #862 (all platforms green)
Exports: 8 (exact declaration surface verified)
Tarball: sovereign-runtime-capability-inspector-0.1.0.tgz
Distribution: GitHub-only (GITHUB_ONLY policy)
Status: RELEASED per PROJECT_CONTROL.md
"
    else
        # Extract short key for tarball matching
        short_key=$(echo "$pkg_key" | sed 's|/|-|g' | sed 's| |-|g')
        tarball_name="sovereign-${short_key}-0.1.0.tgz"
        
        # Check if tarball exists in staging, try to find it
        if [ ! -f "$STAGING_DIR/$tarball_name" ]; then
            # Try to find by partial match
            found_tarball=$(ls "$STAGING_DIR"/*.tgz 2>/dev/null | grep -i "$short_key" | head -1)
            if [ -n "$found_tarball" ]; then
                tarball_name=$(basename "$found_tarball")
            else
                echo "[$((++fail_count))/] $pkg_key: SKIP - tarball not found ($tarball_name)"
                continue
            fi
        fi
        
        tarball_path="$STAGING_DIR/$tarball_name"
        release_title="${display_name} v0.1.0"
        release_body="Sovereign Library Phase-0 Package

Package: @sovereign/${display_name}
Version: 0.1.0
Source: $pkg_key
Distribution: GitHub-only (GITHUB_ONLY policy)
Status: Technical ready, deferred npm publish
"
        tag_name="v0.1.0-${pkg_key}"
    fi
    
    # Verify tarball exists
    if [ ! -f "$tarball_path" ]; then
        echo "[$((++fail_count))/] $pkg_key: SKIP - tarball missing: $tarball_name"
        continue
    fi
    
    # Create GitHub Release
    echo "[$((++success_count))/] $pkg_key: creating release..." >&2
    
    # Escape quotes in body for shell
    safe_body=$(echo "$release_body" | sed 's/"/\\"/g')
    
    # Create the release
    RESULT=$(gh release create "$tag_name" --title "$release_title" --notes "$safe_body" --clobber "$tarball_path" 2>&1)
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        # Extract URL from output
        RELEASE_URL=$(echo "$RESULT" | grep -o 'https://github.com/[^ ]*' | head -1)
        echo "  OK ($RELEASE_URL)"
    else
        echo "  FAIL: $RESULT"
        fail_count=$((fail_count + 1))
    fi
    
    # Small delay to avoid rate limiting
    sleep 0.5
done

echo "-----------------------------------------------"
echo "DONE: $success_count successful, $fail_count failed out of $total packages"