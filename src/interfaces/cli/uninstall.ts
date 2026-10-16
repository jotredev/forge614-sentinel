import { z } from "zod";
import { createInterface } from "node:readline/promises";
import { InstallerActionError, uninstallSentinel } from "../../app/installer-actions";
import { issuesOf, parseMixed } from "./args";
import { printVersionIfRequested } from "./version";

const USAGE = "uninstall [--json] [--self]";
const Args = z.object({ help: z.literal(true).optional(), json: z.literal(true).optional(), self: z.literal(true).optional() }).strict();

/** Identify readline cancellation and end-of-input errors as a user's negative answer. */
function isConfirmationCancellation(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || (error as NodeJS.ErrnoException).code === "ERR_USE_AFTER_CLOSE");
}

/** Output callbacks used by the uninstall command and its tests. */
export interface UninstallCommandIO {
  /** Write one successful output line. */
  writeLine(line: string): void;
  /** Write one structured error line. */
  writeError(line: string): void;
  /** Whether the caller is attached to an interactive terminal. */
  isTerminal?(): boolean;
  /** Ask the confirmation question and return the user's response. */
  confirm?(prompt: string): Promise<string>;
}

/** Parse and run `uninstall`, keeping `--self` local because Sentinel has no assistant integrations. */
export async function uninstallMain(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
  io: UninstallCommandIO = { writeLine: (line) => process.stdout.write(`${line}\n`), writeError: (line) => process.stderr.write(`${line}\n`) },
): Promise<number> {
  if (printVersionIfRequested(argv)) return 0;
  const { flags, positionals } = parseMixed(argv, []);
  const parsed = Args.safeParse(flags);
  if (!parsed.success || positionals.length > 0) {
    io.writeError(JSON.stringify({ schemaVersion: 1, code: "INVALID_ARGUMENTS", error: parsed.success ? `unexpected argument '${positionals[0] ?? ""}'` : issuesOf(parsed.error) }));
    return 2;
  }
  if (parsed.data.help) {
    io.writeLine(JSON.stringify({ schemaVersion: 1, usage: USAGE }));
    return 0;
  }
  if (parsed.data.self) {
    if (parsed.data.json) io.writeLine(JSON.stringify({ schemaVersion: 1, result: { integrationsRemoved: true } }));
    else io.writeLine("forge614-sentinel no tiene integraciones de asistentes que retirar.");
    return 0;
  }
  const isTerminal = io.isTerminal?.() ?? process.stdin.isTTY === true;
  if (isTerminal && !parsed.data.json) {
    const prompt = "¿Desinstalar forge614-sentinel? [s/N]";
    const confirm = io.confirm ?? (async (message: string) => {
      const terminal = createInterface({ input: process.stdin, output: process.stdout });
      try { return await terminal.question(message); } finally { terminal.close(); }
    });
    let response: string;
    try {
      response = await confirm(prompt);
    } catch (error) {
      if (isConfirmationCancellation(error)) return 130;
      throw error;
    }
    const answer = response.trim().toLocaleLowerCase("en-US");
    if (answer !== "s" && answer !== "y") return 130;
  }
  try {
    await uninstallSentinel({ env });
    if (parsed.data.json) io.writeLine(JSON.stringify({ schemaVersion: 1, result: { removed: true } }));
    else io.writeLine("forge614-sentinel se desinstaló.");
    return 0;
  } catch (error) {
    const detail = error instanceof InstallerActionError ? error.message : "";
    io.writeError(JSON.stringify({ schemaVersion: 1, code: "UNINSTALL_FAILED", error: `No se pudo desinstalar Forge614 Sentinel.${detail ? ` ${detail}` : ""}` }));
    return error instanceof InstallerActionError && error.exitCode === 130 ? 130 : 1;
  }
}
