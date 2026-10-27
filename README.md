# Change mode

One-tap agent mode switching for Paseo, right above the composer.

The agent's current mode (Build / Plan for OpenCode, the permission modes of
other providers) sits in a **composer pill** next to the input field: its
title is the current mode, one tap switches it. On the mobile app this
replaces the "open menu, read menu, tap menu item" dance with a single tap;
on desktop and web the pill is hidden by default because the built-in
selector is already on screen there.

Part of the same toolbox as [turn-speed](https://github.com/Drenalol/paseo-turn-speed).

## What you see

| Pill | Meaning |
| --- | --- |
| `Build` (hammer icon) | the agent is in `build`; tap → switches to `plan` |
| `Plan` (shield icon) | the agent is in `plan`; tap → switches to `build` |
| `Plan ✓ / Build` menu | providers with 3+ modes get a menu instead of a toggle |
| `Plan` + spinner | a switch is in flight; the pill locks until it lands |
| `⚠ failed` | the daemon refused or the CLI failed; clears after ~2.5 s |

- The pill **tracks every change**: switching from Paseo's own menu, from
  another device, or from the `paseo` CLI repaints every connected client's
  pill instantly (it follows the agent snapshot, which the daemon pushes).
- Agents with fewer than two selectable modes have no pill — nothing to
  switch. Providers without dynamic modes are left alone.

## Install

Requires Paseo 0.12 or newer and the `paseo` CLI on the daemon machine (the
desktop app installs it; `PASEO_CLI`, `PATH`, `~/.local/bin/paseo`,
`/usr/local/bin/paseo` and `/opt/homebrew/bin/paseo` are auto-detected).

```bash
paseo plugin add Drenalol/paseo-change-mode-mobile
```

Or install from a checkout:

```bash
git clone https://github.com/Drenalol/paseo-change-mode-mobile
paseo plugin install /absolute/path/to/paseo-change-mode-mobile
```

The pill appears on every live agent of every connected client. Enable
plugins first if you haven't: Settings → Plugins → Enable plugins.

## Settings

Settings → Plugins → Change mode:

- **Show the pill on desktop too** — off by default; the pill is for the
  mobile app, where the selector hides in a menu.
- **CLI path** — only when auto-detection misses your `paseo` binary.

## How it works

- The plugin client contribution subscribes to the agent list and keeps one
  `addComposerPill` registration per agent. The pill title, icon, and
  behavior are recomputed from each agent snapshot (`currentModeId`,
  `availableModes`).
- A tap sends an RPC to the plugin's daemon-side handler, which runs
  `paseo agent mode <agent> <mode> --json` — the daemon's own control plane,
  the same path Paseo's UI uses internally. The plugin SDK exposes no
  client-side mode setter, so this is the sanctioned way across the
  boundary; when the SDK grows one, the switch becomes a one-line change.
- The daemon then broadcasts the updated agent snapshot, and every client's
  pill follows.

**Privacy:** nothing leaves the daemon machine. The only command ever run is
`paseo agent mode`, with both arguments validated against an identifier
pattern and spawned without a shell.

## Development

```bash
npm install
npm run verify   # typecheck + Hermes-safe client bundle check
paseo plugin install "$PWD"
```

Layout: `index.client.tsx` (pills + subscriptions), `index.server.ts` (RPC +
settings), `server/change-mode.ts` (CLI resolution and execution),
`shared/contract.ts` (RPC + settings schemas), `client/settings.tsx` (the
settings screen).

## License

MIT
