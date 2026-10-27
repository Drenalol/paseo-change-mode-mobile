import type { ComponentType } from "react";
import { useState } from "react";
import { Text, View } from "react-native";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useSettings } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsSection,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { preferences, type Preferences } from "../shared/contract";

export function makeSettingsScreen(onSaved: () => void): ComponentType<PluginSurfaceProps> {
  return function ModeSettings({ layout }: PluginSurfaceProps) {
    const settings = useSettings(preferences);
    const [cliDraft, setCliDraft] = useState("");

    const muted = { color: layout.compact ? "#8a8a8a" : "#8a8a8a", fontSize: 12 };
    const error = { color: "#e05252", fontSize: 12 };

    if (settings.status === "loading") {
      return <Text style={muted}>Loading settings…</Text>;
    }
    if (settings.status === "error" || settings.status === "invalid") {
      return (
        <View style={{ gap: 12 }}>
          <Text style={error}>{settings.error}</Text>
          <SettingsAction
            label="Retry"
            actionLabel="Reload settings"
            onPress={() => void settings.reload()}
          />
        </View>
      );
    }

    const values = settings.values;
    const save = (patch: Partial<Preferences>) => {
      void settings.save({ ...values, ...patch }, settings.revision).then((ok) => {
        if (ok) onSaved();
      });
    };

    return (
      <View style={{ gap: layout.compact ? 16 : 24 }}>
        <SettingsSection title="Pill">
          <SettingsCard>
            <SettingsSwitch
              label="Show the pill on desktop too"
              hint="Off keeps the pill to the mobile app, where the mode selector hides in a menu. Desktop and web already show it near the composer."
              value={values.showOnDesktop}
              onValueChange={(v) => save({ showOnDesktop: v })}
            />
          </SettingsCard>
        </SettingsSection>
        <SettingsSection title="paseo CLI">
          <SettingsCard>
            <Text style={muted}>
              Switching runs {`paseo agent mode <agent> <mode>`} on the daemon machine.
              Auto-detection checks PASEO_CLI, PATH, ~/.local/bin/paseo, and the standard
              install locations. Set a path only when the daemon cannot find the CLI.
            </Text>
            <SettingsInput
              label="CLI path (optional)"
              hint="Absolute path on the daemon machine, e.g. /usr/local/bin/paseo"
              initialValue={values.cliPath}
              placeholder="/usr/local/bin/paseo"
              onChangeText={setCliDraft}
            />
            <SettingsAction
              label="Apply path"
              actionLabel="Save"
              onPress={() => save({ cliPath: cliDraft.trim() })}
            />
            {settings.saveError ? <Text style={error}>{settings.saveError}</Text> : null}
          </SettingsCard>
        </SettingsSection>
      </View>
    );
  };
}
