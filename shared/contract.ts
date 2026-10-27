import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

/** Agent ids are UUIDs and mode ids are provider slugs (`build`, `plan`,
 * `acceptEdits`, ...). Both cross into `execFile` argv, so keep them strict;
 * the process is spawned without a shell either way. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export const changeModeRpc = defineRpc({
  name: "change-mode.set",
  input: z.object({
    agentId: z.string().regex(ID_PATTERN),
    modeId: z.string().regex(ID_PATTERN),
  }),
  output: z.object({
    ok: z.boolean(),
    /** Human-readable failure reason; null on success. */
    error: z.string().nullable().default(null),
  }),
});

/** User-facing options for the change-mode plugin. */
export const preferences = defineSettings({
  id: "preferences",
  scope: "host",
  version: 1,
  schema: z.object({
    /** The pill targets the mobile app, where the mode selector hides in a
     * menu; on web/desktop it is on-screen already. Opt in to see it there. */
    showOnDesktop: z.boolean().default(false),
    /** Absolute path to the `paseo` CLI the daemon should call. Empty means
     * auto-detect: PASEO_CLI, PATH, ~/.local/bin/paseo, standard installs. */
    cliPath: z.string().default(""),
  }),
});

export type Preferences = z.output<typeof preferences.schema>;

export const DEFAULT_PREFERENCES: Preferences = preferences.schema.parse({});
