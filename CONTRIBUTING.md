# Contributing

```sh
pnpm install
pnpm generate  # src/generated, from the ESPHome schema pinned in package.json
pnpm typecheck
pnpm test
pnpm pack      # the release tarball
```

`pnpm generate` downloads the schema release for `esphome.version` in package.json,
and caches it under `~/.cache/esphome-config`.
`ESPHOME_SCHEMA` names a schema directory to use instead.

`pnpm generate` also writes the fixture's external types into `test/consumer/generated/external`,
from the schema dump in `test/external-fixture/schema`.
`test/consumer` is a project of devices as a consumer writes them,
importing `esphome-config`, which resolves to `src` through the `esphome-config-source` condition.
To refresh the fixture's dump after an ESPHome update, run
`python3 src/gen/dump-external.py <build_language_schema.py> test/external-fixture/components <dir>`
with ESPHome's Python, and copy `<dir>/my_sensor.json` into it.
`test/roode` needs Roode's types, so only the Nix `external` check builds it.

Needs Node 24 or newer and pnpm.

Never commit real secrets, API keys or personal paths.

## Releases

Releases are automated with release-please.
Commit messages (or squash-merged PR titles) follow [Conventional Commits](https://www.conventionalcommits.org):
`fix:` makes a patch release, `feat:` a minor one, and `feat!:` or a `BREAKING CHANGE:` footer a major one.
`chore:`, `docs:` and `ci:` do not trigger a release.

A bot keeps one release PR open with the version bump and changelog.
Merging it tags the release.
The release workflow then attaches the package tarball, `esphome-config-<version>.tgz`,
to the GitHub release.

## Nix

Nix is optional.
`nix develop` has Node, pnpm and the matching ESPHome,
and points `ESPHOME_SCHEMA` at the pinned schema.
`nix build` builds the package with its tests, and `nix flake check` also validates each test device
with `esphome config`.
The flake fails to evaluate if nixpkgs' ESPHome differs from `esphome.version` in package.json.

`nix/pnpm-deps.hash` follows `pnpm-lock.yaml`: the dev shell's pre-commit hook updates it,
as does a workflow on pull requests; by hand, run `scripts/update-pnpm-hash.sh`.
