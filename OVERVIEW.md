# Change mode — overview

Paseo hides the agent mode selector (Build / Plan for OpenCode, the permission
modes for other providers) inside a composer menu. That costs several taps on
a phone, where screen space already makes mode mistakes likely.

This plugin puts the current mode in a composer pill, next to the input, and
switches it in one tap:

- **Title = current mode.** The pill always shows the label of the agent's
  current mode (Build, Plan, ...) and an icon that reads at a glance.
- **One tap toggles.** With exactly two modes (the Build/Plan case) a tap
  switches immediately. Providers with more modes get a labeled menu with the
  current mode checked.
- **Reactive.** The pill repaints from every agent snapshot, so switches made
  from Paseo's own menu, another client, or the `paseo` CLI are reflected
  instantly. During a switch the pill shows the target mode and locks; a
  failure flashes a warning for a moment.
- **Mobile-first.** On web and desktop the pill is hidden by default because
  the built-in selector is already on screen there; a setting turns it on
  everywhere.

Switching goes through the plugin's daemon-side RPC, which runs
`paseo agent mode <agent> <mode>` with the local paseo CLI: the same daemon
API the official clients use, no patched clients and no credentials beyond
the daemon's own local access.

Architecture: `index.client.tsx` subscribes to the agent list and manages one
`addComposerPill` registration per agent; `index.server.ts` handles the RPC
and resolves the CLI binary (setting, `PASEO_CLI`, `PATH`, standard install
locations). Settings live in one shared Zod document.
