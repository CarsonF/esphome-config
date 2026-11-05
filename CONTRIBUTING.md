# Contributing

```sh
pnpm install
pnpm typecheck
```

Needs Node 24 or newer and pnpm.

Never commit real secrets, API keys or personal paths.

## Releases

Releases are automated with release-please.
Commit messages (or squash-merged PR titles) follow [Conventional Commits](https://www.conventionalcommits.org):
`fix:` makes a patch release, `feat:` a minor one, and `feat!:` or a `BREAKING CHANGE:` footer a major one.
`chore:`, `docs:` and `ci:` do not trigger a release.

A bot keeps one release PR open with the version bump and changelog.
Merging it tags the release.
