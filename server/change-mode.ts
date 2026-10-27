import { homedir } from "node:os";
import process from "node:process";
import { execCommand } from "@getpaseo/plugin/server";

/** Command-level failure with the CLI's own message, reported to the client. */
export class CliError extends Error {}

interface ExecErrorLike extends Error {
  code?: string | number | null;
  killed?: boolean;
  stderr?: string;
}

const isMissingBinary = (error: ExecErrorLike): boolean => error.code === "ENOENT";

/** Binary candidates, most specific first. The list is deduplicated and
 * each entry is tried until one runs; ENOENT advances, anything else is a
 * real answer from a real CLI. */
export function cliCandidates(cliPath: string): string[] {
  const candidates: string[] = [];
  const push = (value: string | undefined): void => {
    const trimmed = value?.trim();
    if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
  };
  push(cliPath);
  push(process.env.PASEO_CLI);
  push("paseo");
  if (process.platform === "win32") push("paseo.cmd");
  push(`${homedir()}/.local/bin/paseo`);
  push("/usr/local/bin/paseo");
  push("/opt/homebrew/bin/paseo");
  return candidates;
}

const EXEC_OPTIONS = {
  timeout: 15000,
  // Windows .cmd shims cannot be spawned without a shell; the arguments are
  // zod-validated identifier patterns, so the shell never sees metacharacters.
  shell: process.platform === "win32",
} as const;

/** The CLI reports daemon errors as JSON on stdout/stderr with a nonzero
 * exit; unwrap it so the pill's failure flash carries one readable line. */
function cliFailureMessage(failure: ExecErrorLike & { stdout?: string }): string {
  for (const raw of [failure.stderr, failure.stdout, failure.message]) {
    const text = raw?.trim();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) return parsed.error.message;
    } catch {
      // Not JSON: fall through to the plain text.
    }
    return text.split("\n")[0].replace(/^Error:\s*/, "").slice(0, 400);
  }
  return "paseo CLI failed";
}

/** Runs `paseo agent mode <agentId> <modeId>` on the first CLI that starts.
 * The resolved binary is cached so later switches skip the probing order. */
async function runCli(
  cliPath: string,
  agentId: string,
  modeId: string,
  cache: { binary: string | null },
): Promise<void> {
  const candidates = cliCandidates(cliPath);
  const start = candidates.indexOf(cache.binary ?? "");
  const order = start > 0 ? [candidates[start], ...candidates.filter((_, i) => i !== start)] : candidates;
  const missing: string[] = [];
  for (const bin of order) {
    try {
      await execCommand(bin, ["agent", "mode", agentId, modeId, "--json"], EXEC_OPTIONS);
      cache.binary = bin;
      return;
    } catch (error) {
      const failure = error as ExecErrorLike;
      if (isMissingBinary(failure)) {
        missing.push(bin);
        continue;
      }
      cache.binary = null;
      if (failure.killed) throw new CliError("the paseo CLI timed out");
      throw new CliError(cliFailureMessage(failure));
    }
  }
  throw new CliError(`paseo CLI not found on the daemon (tried: ${missing.join(", ") || "none"})`);
}

export function makeChangeMode(
  cache: { binary: string | null },
  getPrefs: () => { cliPath: string },
) {
  return async (input: {
    agentId: string;
    modeId: string;
  }): Promise<{ ok: boolean; error: string | null }> => {
    try {
      await runCli(getPrefs().cliPath, input.agentId, input.modeId, cache);
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}
