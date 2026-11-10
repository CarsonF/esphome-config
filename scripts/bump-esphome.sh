#!/usr/bin/env bash
# Moves the package to an ESPHome release: package.json's version, the schema hash, flake.lock,
# an override of nixpkgs' ESPHome while it is behind, and the fixture's schema dump.
# Usage: scripts/bump-esphome.sh [<version>], ESPHome's latest release by default.
# Prints `status=` bumped, current (nothing to do) or waiting (nixpkgs' ESPHome can't be moved),
# also to $GITHUB_OUTPUT with `version=`, `override=` and `release_as=`.
set -euo pipefail
cd "$(dirname "$0")/.."

fake=sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
version=${1:-$(gh api repos/esphome/esphome/releases/latest --jq .tag_name)}
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

output "version=$version"
if [[ $version == "$current" ]]; then
  output "status=current"
  exit 0
fi

set_json package.json ".esphome.version = \"$version\""
set_json nix/schema-hashes.json "{ \"$version\": \"$fake\" }"
schema=$(got_hash .#schema)
[[ -n $schema ]] || { echo "no schema hash for ESPHome $version" >&2; exit 1; }
set_json nix/schema-hashes.json "{ \"$version\": \"$schema\" }"

nix flake update nixpkgs
rev=$(jq -r .nodes.nixpkgs.locked.rev flake.lock)
packaged=$(nix eval --raw "github:NixOS/nixpkgs/$rev#esphome.version")
rm -f nix/esphome-src.json
if [[ $packaged == "$version" ]]; then
  output "override=false"
else
  echo "nixpkgs has ESPHome $packaged: overriding its source to $version"
  echo "{ \"version\": \"$version\", \"hash\": \"$fake\" }" | jq . >nix/esphome-src.json
  # the flake only sees files git knows
  git add --intent-to-add nix/esphome-src.json
  src=$(got_hash .#esphome)
  if [[ -n $src ]]; then
    set_json nix/esphome-src.json ".hash = \"$src\""
  fi
  if [[ -z $src ]] || ! nix build .#esphome --no-link; then
    echo "nixpkgs' ESPHome $packaged doesn't build as $version: waiting for nixpkgs" >&2
    git rm --cached --quiet -f nix/esphome-src.json
    rm -f nix/esphome-src.json
    git checkout -- package.json nix/schema-hashes.json flake.lock
    output "status=waiting"
    exit 0
  fi
  output "override=true"
fi

# the fixture's schema, as this ESPHome dumps it
script="$(nix eval --raw .#esphome.src)/script/build_language_schema.py"
dump=$(mktemp -d)
nix develop --command env PYTHONDONTWRITEBYTECODE=1 \
  python3 src/gen/dump-external.py "$script" test/external-fixture/components "$dump" >/dev/null
cp "$dump/my_sensor.json" test/external-fixture/schema/my_sensor.json
rm -rf "$dump"

if [[ $(series "$version") != $(series "$current") ]]; then
  output "release_as=$(series "$version").0"
fi
output "status=bumped"
