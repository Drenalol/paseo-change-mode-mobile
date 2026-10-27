Paseo's agent mode selector (Build and Plan on OpenCode; the permission modes on other providers) lives in the composer's overflow menu. On a phone that costs several taps to read the current mode and several more to change it.

This plugin puts the mode next to the composer input, in a pill beside the send box. The pill's title is the agent's current mode and its icon distinguishes Build from Plan at a glance. With exactly two selectable modes — the Build/Plan case — one tap switches to the other immediately. When a provider offers three or more modes, a tap opens a labeled menu with the current mode checked. During a switch the pill shows the target mode and locks; if the daemon refuses, it flashes a brief warning and returns to the real state.

## How it works

The client contribution subscribes to the daemon's agent list and keeps one pill per live agent, redrawn from every agent snapshot. A tap sends an RPC to the plugin's daemon-side handler, which runs `paseo agent mode <agent> <mode>` with the local paseo CLI — the daemon's own control plane, the same path Paseo's built-in selector uses. The daemon then broadcasts the updated agent snapshot, so every connected client shows the new mode, whether the change came from this pill, Paseo's own menu, another device, or the command line.

The plugin SDK exposes no client-side mode setter, so the daemon-side handler is the bridge; if the SDK grows a setter, this becomes an internal detail with no user-visible change.

## Setup

- Paseo 0.12 or newer on the daemon and clients.
- The paseo CLI must exist on the daemon machine. The desktop app bundles one and the daemon tells plugins where it is; plain-daemon installs are auto-detected via `PASEO_CLI`, `PATH`, `~/.local/bin/paseo`, and the standard install locations. Settings → Plugins → Change mode has an optional path override when auto-detection misses.
- The pill appears on mobile clients by default. On web and desktop the built-in selector is already on screen, so the pill stays hidden there; a setting turns it on everywhere.

## Details

- Agents with fewer than two selectable modes get no pill; providers without dynamic mode support are left alone.
- Nothing leaves the daemon machine. The plugin reads agent snapshots (mode, labels, workspace) through the connected daemon and stores only its two settings.
- The only command the plugin runs is `paseo agent mode`, on the daemon, spawned without a shell; both arguments are validated against an identifier pattern first.
- Switching mid-turn is forwarded to the daemon and behaves as the built-in selector does for the current provider.
