# Contributing

```sh
nix develop    # Node, pnpm, ESPHome, and ESPHOME_SCHEMA
pnpm install
pnpm generate  # src/generated, from ESPHome's schema
pnpm typecheck
pnpm test
pnpm pack      # the release tarball
```

`pnpm generate` reads ESPHome's language schema from `ESPHOME_SCHEMA`, which `nix develop` sets
to `nix build .#schema`.
The flake builds it from pinned sources, as esphome-schema's releases are built:
the structure from ESPHome's own script, run with nixpkgs' ESPHome,
and the docs from esphome.io's docs script at the release's tag,
whose hash is in `nix/docs-hashes.json`.
The docs script's npm packages are this repo's dev dependencies, at esphome.io's versions.
The package ships that schema beside the core types, for generating external components' types.

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
`fix:` and `feat:` make a release, while `chore:`, `docs:` and `ci:` do not.

A version is `<year>.<month>.<n>`, after the ESPHome release its types are for:
`2026.9.n` is for ESPHome 2026.9.x, and every release bumps `n`.
The commit that moves to a new ESPHome month carries a `Release-As: 2026.10.0` footer.
Breaking changes wait for such a commit, so they come at most once a month.

A bot keeps one release PR open with the version bump and changelog.
Merging it tags the release.
The release workflow then attaches the package tarball, `esphome-config-<version>.tgz`,
to the GitHub release.

## ESPHome updates

The types follow the ESPHome that nixpkgs ships, so the flake's ESPHome is nixpkgs' own package.
A scheduled workflow, or `scripts/bump-esphome.sh` by hand, updates `flake.lock` to the latest
nixpkgs, and if its ESPHome is newer, moves package.json's `esphome.version`, the esphome.io hash
and the fixture's schema dump to it.

The workflow runs `nix flake check` and opens a PR on `esphome/<version>`,
a draft if a check failed.
It never merges: review it, fix what the new schema broke on its branch, and merge.
A new ESPHome month's commit carries `Release-As: <year>.<month>.0`; keep it when squash-merging.

## Nix

Nix is optional.
`nix develop` has Node, pnpm and the matching ESPHome,
and points `ESPHOME_SCHEMA` at the flake's schema.
`nix build` builds the package with its tests, and `nix flake check` also validates each test device
with `esphome config`.
The flake fails to evaluate if nixpkgs' ESPHome differs from `esphome.version` in package.json.

`nix/pnpm-deps.hash` follows `pnpm-lock.yaml`: the dev shell's pre-commit hook updates it,
as does a workflow on pull requests; by hand, run `scripts/update-pnpm-hash.sh`.
