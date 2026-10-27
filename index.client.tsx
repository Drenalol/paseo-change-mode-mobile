import { Platform } from "react-native";
import type {
  PluginButton,
  PluginButtonBehavior,
  PluginButtonRegistration,
  PluginClientContext,
} from "@getpaseo/plugin/client";
import { settingsRpc } from "@getpaseo/plugin";
import { changeModeRpc, preferences, DEFAULT_PREFERENCES, type Preferences } from "./shared/contract";
import { makeSettingsScreen } from "./client/settings";

// Structural type derivation keeps `@getpaseo/client` out of the client
// bundle: only types provided through the plugin context are used.
type AgentsApi = PluginClientContext["paseo"]["agents"];
type AgentHandle = ReturnType<AgentsApi["ref"]>;
type AgentUpdate = Parameters<Parameters<AgentHandle["subscribe"]>[0]>[0];
type AgentSnapshot = Extract<AgentUpdate, { kind: "upsert" }>["agent"];
type AgentEntry = Awaited<ReturnType<AgentsApi["list"]>>["entries"][number];
type ModeInfo = NonNullable<AgentSnapshot["availableModes"]>[number];

const ERROR_FLASH_MS = 2500;

/** Lucide names for the modes Paseo providers ship; a mode carrying its own
 * icon (mode.icon) wins over the heuristics. */
function iconForMode(mode: ModeInfo | null, currentId: string | null): string {
  if (mode?.icon) return mode.icon;
  const id = currentId ?? "";
  if (/plan|read|ask|spec/i.test(id)) return "ShieldCheck";
  if (/build|code|edit|auto|default|implement/i.test(id)) return "Hammer";
  return "SlidersHorizontal";
}

function modeLabel(modes: readonly ModeInfo[], currentId: string | null): string {
  const current = modes.find((mode) => mode.id === currentId) ?? null;
  return current?.label ?? currentId ?? "Mode";
}

interface Attachment {
  agentId: string;
  workspaceId: string;
  releaseAgentUpdates: () => void;
  registration: PluginButtonRegistration | null;
  snapshot: AgentSnapshot | null;
  /** modeId currently being applied, null when idle. */
  pending: string | null;
  error: string | null;
  errorTimer: ReturnType<typeof setTimeout> | null;
}

export default function contribute(client: PluginClientContext) {
  const lifetime = new AbortController();
  const attached = new Map<string, Attachment>();
  let prefs: Preferences = DEFAULT_PREFERENCES;
  let listSubscription: { release(): Promise<void> } | null = null;

  const aborted = () => lifetime.signal.aborted;
  const logError = (...args: unknown[]) => {
    if (!aborted()) console.error("change-mode:", ...args);
  };

  const refreshPrefs = async (): Promise<void> => {
    try {
      const read = await client.rpc(settingsRpc(preferences.id).read, {});
      if (read.status === "ready") {
        const parsed = preferences.schema.safeParse(read.values);
        if (parsed.success) prefs = parsed.data;
      }
    } catch (error) {
      logError("reading preferences failed", error);
    }
  };

  const platformAllowsPill = (): boolean => Platform.OS !== "web" || prefs.showOnDesktop;

  /** Re-derive title/icon/behavior/visibility from the snapshot. The
   * snapshot is the only source of truth for the current mode, so switches
   * made from Paseo's own menu, other clients, or the CLI repaint too. */
  function paint(att: Attachment): void {
    const snapshot = att.snapshot;
    if (!att.registration || !snapshot) return;
    const modes = snapshot.availableModes ?? [];
    const currentId = snapshot.currentModeId;
    const pending = att.pending;

    const view: Partial<PluginButton> = {};
    if (att.error) {
      view.title = "\u26A0 failed";
      view.icon = "TriangleAlert";
    } else if (pending) {
      view.title = modeLabel(modes, pending);
      view.icon = "LoaderCircle";
    } else {
      view.title = modeLabel(modes, currentId);
      view.icon = iconForMode(modes.find((mode) => mode.id === currentId) ?? null, currentId);
    }
    view.visible = platformAllowsPill() && modes.length >= 2;
    view.disabled = pending !== null;
    view.behavior = behaviorFor(att, modes, currentId);
    att.registration.update(view);
  }

  function behaviorFor(
    att: Attachment,
    modes: readonly ModeInfo[],
    currentId: string | null,
  ): PluginButtonBehavior {
    const apply = (modeId: string) => void applyMode(att, modeId);
    // One tap toggles the common Build/Plan pair; anything wider (Codex and
    // friends expose more modes) opens a labeled menu instead.
    if (modes.length === 2) {
      const other = modes.find((mode) => mode.id !== currentId) ?? modes[0];
      return { kind: "action", onPress: () => apply(other.id) };
    }
    return {
      kind: "menu",
      items: modes.map((mode) => ({
        kind: "item" as const,
        id: mode.id,
        title: mode.id === currentId ? `${mode.label} \u2713` : mode.label,
        disabled: mode.id === currentId,
        behavior: { kind: "action" as const, onPress: () => apply(mode.id) },
      })),
    };
  }

  async function applyMode(att: Attachment, modeId: string): Promise<void> {
    if (att.pending) return;
    att.pending = modeId;
    paint(att);
    try {
      const result = await client.rpc(changeModeRpc, { agentId: att.agentId, modeId });
      if (!result.ok) flashError(att, result.error ?? "the daemon refused the switch");
    } catch (error) {
      flashError(att, String(error));
    } finally {
      att.pending = null;
      paint(att);
      // On success the daemon pushes an agent_update; the subscribe handler
      // repaints from the new snapshot, so there is nothing to correct here.
    }
  }

  function flashError(att: Attachment, text: string): void {
    console.warn(`change-mode: switching ${att.agentId.slice(0, 8)} failed: ${text}`);
    att.error = text;
    if (att.errorTimer !== null) clearTimeout(att.errorTimer);
    att.errorTimer = setTimeout(() => {
      att.errorTimer = null;
      att.error = null;
      paint(att);
    }, ERROR_FLASH_MS);
  }

  function attach(agent: AgentSnapshot): void {
    if (aborted() || attached.has(agent.id) || !agent.workspaceId) return;
    const workspaceId = agent.workspaceId;
    const handle = client.paseo.agents.ref(agent.id);
    const att: Attachment = {
      agentId: agent.id,
      workspaceId,
      releaseAgentUpdates: () => undefined,
      registration: null,
      snapshot: agent,
      pending: null,
      error: null,
      errorTimer: null,
    };
    const first = buttonFor(att);
    try {
      att.registration = client.addComposerPill({
        id: "mode",
        workspaceId,
        agentId: agent.id,
        button: first,
      });
    } catch (error) {
      logError(`pill registration failed for agent ${agent.id}`, error);
      return;
    }
    paint(att);
    att.releaseAgentUpdates = handle.subscribe((update) => {
      if (update.kind === "remove") {
        detach(agent.id);
        return;
      }
      att.snapshot = update.agent;
      paint(att);
    });
    attached.set(agent.id, att);
  }

  /** Complete button for registration; paint() keeps it current afterwards. */
  function buttonFor(att: Attachment): PluginButton {
    const modes = att.snapshot?.availableModes ?? [];
    const currentId = att.snapshot?.currentModeId ?? null;
    return {
      title: modeLabel(modes, currentId),
      icon: iconForMode(null, currentId),
      visible: false,
      behavior: behaviorFor(att, modes, currentId),
    };
  }

  function detach(agentId: string): void {
    const att = attached.get(agentId);
    if (!att) return;
    attached.delete(agentId);
    if (att.errorTimer !== null) clearTimeout(att.errorTimer);
    try {
      att.releaseAgentUpdates();
      att.registration?.remove();
    } catch (error) {
      logError(`detach failed for ${agentId}`, error);
    }
  }

  function repaintAll(): void {
    for (const att of attached.values()) paint(att);
  }

  /** Archive/close removes the pill; every other live agent owns one. */
  function isLive(agent: AgentSnapshot): boolean {
    return !agent.archivedAt && agent.status !== "closed";
  }

  function upsert(agent: AgentSnapshot): void {
    if (!isLive(agent)) {
      detach(agent.id);
      return;
    }
    const att = attached.get(agent.id);
    if (att) {
      att.snapshot = agent;
      paint(att);
    } else {
      attach(agent);
    }
  }

  async function boot(): Promise<void> {
    try {
      await refreshPrefs();
      if (aborted()) return;
      const list = await client.paseo.agents.list({
        subscribe: {},
        page: { limit: 200 },
        signal: lifetime.signal,
      });
      if (aborted()) {
        void list.subscription.release().catch(() => undefined);
        return;
      }
      listSubscription = list.subscription;
      const releaseObserver = list.subscription.subscribe({
        snapshot: (snapshot) => {
          for (const entry of snapshot.entries) upsert(entry.agent);
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const payload = message.payload;
          if (payload.kind === "remove") detach(payload.agentId);
          else upsert(payload.agent);
        },
        error: (error) => logError("agent list subscription failed", error),
      });
      cleanups.push(releaseObserver);
      for (const entry of list.entries) upsert(entry.agent);
    } catch (error) {
      if (!aborted()) logError("bootstrap failed", error);
    }
  }

  const cleanups: Array<() => void> = [];
  cleanups.push(
    client.addSettingsScreen({
      id: "preferences",
      title: "Change mode",
      icon: "ArrowLeftRight",
      Component: makeSettingsScreen(() => {
        void refreshPrefs().then(repaintAll);
      }),
    }),
  );

  void boot();

  return () => {
    lifetime.abort();
    for (const agentId of [...attached.keys()]) detach(agentId);
    if (listSubscription) {
      void listSubscription.release().catch(() => undefined);
      listSubscription = null;
    }
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch {
        // Best-effort teardown.
      }
    }
    cleanups.length = 0;
  };
}
