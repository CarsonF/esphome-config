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
