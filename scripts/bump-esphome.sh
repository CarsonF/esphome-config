#!/usr/bin/env bash
# Moves the package to the ESPHome of the latest nixpkgs: flake.lock, package.json's version,
# the schema hash and the fixture's schema dump.
# Usage: scripts/bump-esphome.sh
# Prints `status=` bumped, or current when nixpkgs has no newer ESPHome,
# also to $GITHUB_OUTPUT with `version=` and `release_as=`.
set -euo pipefail
cd "$(dirname "$0")/.."

fake=sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
current=$(jq -r .esphome.version package.json)

output() {
  echo "$1"
  if [[ -n ${GITHUB_OUTPUT:-} ]]; then echo "$1" >>"$GITHUB_OUTPUT"; fi
}

# the hash after `got:` when a build fails on a fake one
got_hash() {
  nix build "$1" --no-link 2>&1 | grep -oP 'got:\s+\Ksha256-\S+' | head -n1 || true
}

# `2026.10` for `2026.10.1`
series() { cut -d. -f1,2 <<<"$1"; }

set_json() {
  jq "$2" "$1" >"$1.tmp"
  mv "$1.tmp" "$1"
}

nix flake update nixpkgs
rev=$(jq -r .nodes.nixpkgs.locked.rev flake.lock)
version=$(nix eval --raw "github:NixOS/nixpkgs/$rev#esphome.version")
output "version=$version"
newest=$(printf '%s\n%s\n' "$current" "$version" | sort -V | tail -n1)
if [[ $version == "$current" || $newest == "$current" ]]; then
  # flake.lock only moves with ESPHome
  git checkout -- flake.lock
  output "status=current"
  exit 0
fi

set_json package.json ".esphome.version = \"$version\""
set_json nix/schema-hashes.json "{ \"$version\": \"$fake\" }"
schema=$(got_hash .#schema)
[[ -n $schema ]] || { echo "no schema hash for ESPHome $version" >&2; exit 1; }
set_json nix/schema-hashes.json "{ \"$version\": \"$schema\" }"

# the fixture's schema, as this ESPHome dumps it
# built, not just evaluated, so the source is on disk
script="$(nix build .#esphome.src --no-link --print-out-paths)/script/build_language_schema.py"
dump=$(mktemp -d)
nix develop --command env PYTHONDONTWRITEBYTECODE=1 \
  python3 src/gen/dump-external.py "$script" test/external-fixture/components "$dump" >/dev/null
cp "$dump/my_sensor.json" test/external-fixture/schema/my_sensor.json
rm -rf "$dump"

if [[ $(series "$version") != $(series "$current") ]]; then
  output "release_as=$(series "$version").0"
fi
output "status=bumped"
