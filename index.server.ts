import type { PluginServerContext } from "@getpaseo/plugin/server";
import { changeModeRpc, preferences, DEFAULT_PREFERENCES, type Preferences } from "./shared/contract";
import { makeChangeMode } from "./server/change-mode";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(preferences);
  let prefs: Preferences = DEFAULT_PREFERENCES;
  const apply = (state: Awaited<ReturnType<typeof settings.read>>): void => {
    if (state.status === "ready") {
      const parsed = preferences.schema.safeParse(state.values);
      if (parsed.success) prefs = parsed.data;
    }
  };
  void settings.read().then(apply).catch(() => undefined);
  const watch = settings.subscribe(apply);

  const cliCache = { binary: null as string | null };
  server.handle(changeModeRpc, makeChangeMode(cliCache, () => prefs));

  return () => {
    void watch();
  };
}
