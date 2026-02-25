#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_DIR="$ROOT/patches"

if [[ ! -d "$PATCH_DIR" ]]; then
  echo "ERROR: missing patch directory: $PATCH_DIR" >&2
  exit 1
fi

cd "$ROOT"

shopt -s nullglob
patches=("$PATCH_DIR"/*.patch)
shopt -u nullglob

if (( ${#patches[@]} == 0 )); then
  echo "ERROR: no patch files found in $PATCH_DIR" >&2
  exit 1
fi

for patch in "${patches[@]}"; do
  if git apply --check "$patch" >/dev/null 2>&1; then
    git apply "$patch"
    echo "Applied patch: $(basename "$patch")"
  else
    echo "Patch already applied or does not apply cleanly; skipping: $(basename "$patch")"
  fi
done

if command -v pnpm >/dev/null 2>&1; then
  pnpm build
else
  npm run build
fi

echo "Done. Review changes with: git status --short"
