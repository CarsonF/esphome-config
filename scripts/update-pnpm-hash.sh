#!/usr/bin/env bash
# Recomputes nix/pnpm-deps.hash after a dependency change (pnpm-lock.yaml).
set -euo pipefail
cd "$(dirname "$0")/.."

hash_file=nix/pnpm-deps.hash
fake="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
current=$(cat "$hash_file")

echo "$fake" >"$hash_file"
log=$(nix build .#default --no-link 2>&1 || true)
new=$(grep -oP 'got:\s+\Ksha256-\S+' <<<"$log" | head -n1 || true)

if [[ -z "$new" ]]; then
  echo "$current" >"$hash_file"
  if grep -q 'error' <<<"$log"; then
    echo "$log" >&2
    echo "Build failed without a hash mismatch" >&2
    exit 1
  fi
  echo "Hash unchanged: $current"
  exit 0
fi

echo "$new" >"$hash_file"
echo "Updated $hash_file: $new"
