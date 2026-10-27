# Release process

How to ship a new version of this plugin and keep the three listings in sync.

## Listings

| Where | Source of truth | How it updates |
| --- | --- | --- |
| GitHub | `main` + version tags | push |
| npm [`paseo-change-mode-mobile`](https://www.npmjs.com/package/paseo-change-mode-mobile) | `npm publish` | manual |
| Official [paseo.sh/plugins](https://paseo.sh/plugins) | Git artifact pinned to a commit ([submission #1289](https://github.com/getpaseo/plugins/issues/1289), merged via PR #1290) | **manual**: `bump.yml` only reviews new npm versions, Git updates are submitted by hand |
| Community [paseo.cafe](https://paseo.cafe) | `registry/change-mode-mobile.json` ([submission #419](https://github.com/paseo-cafe/paseo-cafe/issues/419), PR [#420](https://github.com/paseo-cafe/paseo-cafe/pull/420)) | scans refresh ~every 6 h; no action needed |

Local development stays on the directory source (`paseo plugin install "$PWD"`);
public installs use `npm:paseo-change-mode-mobile`.

The official listing is deliberately left on the Git pin. Step 8 is one issue
per release, and in exchange the review sees the exact commit users get. To
switch later, file a submission whose Source is the npm package: the listing is
rebuilt with `kind: npm` and the bump bot starts opening PRs on its own.

## Cutting a release

1. Bump `version` in `package.json` (semver; the npm version is the update
   identity both registries track).
2. `npm run verify` — typecheck plus the Hermes-safe client bundle check. This
   plugin has no unit tests, so `verify` is deliberately shorter than
   turn-speed's.
3. `git commit`, then `git tag vX.Y.Z`.
4. `git push origin main --follow-tags` — and also `git push origin vX.Y.Z`,
   because `--follow-tags` skips lightweight tags.
5. Publish with the npm 11 binary (see the gotchas):
   `/usr/local/bin/npm publish --access public --auth-type=web`.
6. Wait out the staged publish: `npm view paseo-change-mode-mobile@latest
   version` answers `0.0.0-stage` for a couple of minutes, then the new version.
7. Smoke-test both install sources and remove the temporary instances:
   ```bash
   paseo plugin add npm:paseo-change-mode-mobile --id change-mode-smoke        # expect: running
   paseo plugin remove change-mode-smoke
   paseo plugin add github:Drenalol/paseo-change-mode-mobile --id change-mode-smoke-git
   paseo plugin remove change-mode-smoke-git
   ```
8. Registry follow-up: cafe re-scans by itself. The official listing stays on
   the commit it reviewed — a release only appears there after a new
   submission (or a PR) resolves the new commit, which is also the reason an
   npm-sourced listing is worth its while.

## npm gotchas (shared with turn-speed, learned there the hard way)

- The account publishes with a passkey. `npm login --auth-type=web` prints
  `…/login/cli/<id>` and `npm publish --auth-type=web` prints **its own**
  `…/auth/cli/<id>`; each needs a browser confirmation within minutes. In a
  non-interactive shell drive each command through `expect` and scrape the URL
  out of the expect `log_file`.
- The token in `~/.npmrc` is a web session and expires. `npm publish` then
  fails with a misleading `404 PUT` rather than 401, before any prompt — check
  `npm whoami` first and re-login.
- `~/.local/bin/npm` is 10.9.8 (Hermes bundle) and fails with `EOTP`; publish
  with `/usr/local/bin/npm` (11.x).
- npm is retiring 2FA-bypassing automation tokens for direct publishing, so a
  per-release browser confirmation is the expected flow, not a regression.
- `"private": true` in `package.json` refuses `npm publish` outright. It came
  from the initial scaffold here, not from a decision, and was removed before
  v1.0.0.

## What the cafe scanner accepts

- `paseo-plugin.json` may carry `id`, `requirements`, `description` and, since
  Paseo 0.11, `name`, `icon` and `media` — the
  [static scanner](https://github.com/paseo-cafe/paseo-cafe/blob/main/scripts/plugin-security/static-scan.ts)
  allow-list caught up, so `assets/icon.png` and `images/pill-build-mobile.png`
  are declared in the manifest rather than trimmed out of it.
- A submission issue must come from the cafe form **with both Confirmations
  ticked**. GitHub omits an all-unchecked checkbox section from the body, and
  barista intake recognises a submission by all nine `### <field>` headings —
  without `### Confirmations` the issue is ignored silently: no label, no PR,
  and a green workflow run that did nothing.
- The `npm package` field takes the exact unscoped name. `_No response_`
  becomes `package: ""` in the generated entry and fails the npm-name pattern,
  so the form cannot submit a Git-only plugin; a Git-only listing needs a
  hand-written `registry/<id>.json` PR.
- `OVERVIEW.md` must not contain `paseo plugin add`, `npm install` or `npm i` —
  install instructions belong to the README, which keeps an `## Install` and a
  `## Known limitations` section because cafe lifts both into the listing.

## History

- 2026-10-27 — v1.0.0. The official registry accepted the plugin from Git the
  same day (getpaseo/plugins#1289 → PR #1290), pinned to `d25df5b`; the two
  earlier issues were our own mis-submissions. Published to npm as
  `paseo-change-mode-mobile@1.0.0`, both install sources smoke-tested.
- 2026-10-27 — cafe admission went green on the first run once the issue
  carried the npm package and the Confirmations block (paseo-cafe#419 → PR
  #420, merged 10:32 UTC); the first submission had sat unread for an hour for
  the missing checkbox section — barista matched none of the nine form
  headings and left no trace but a green, empty workflow run.
