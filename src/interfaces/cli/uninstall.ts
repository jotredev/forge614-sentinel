import { z } from "zod";
import { InstallerActionError, uninstallSentinel } from "../../app/installer-actions";
import { issuesOf, parseMixed } from "./args";
import { printVersionIfRequested } from "./version";

const USAGE = "uninstall [--json] [--self]";
const Args = z.object({ help: z.literal(true).optional(), json: z.literal(true).optional(), self: z.literal(true).optional() }).strict();

/** Output callbacks used by the uninstall command and its tests. */
export interface UninstallCommandIO {
  /** Write one successful output line. */
  writeLine(line: string): void;
  /** Write one structured error line. */
  writeError(line: string): void;
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
  try {
    await uninstallSentinel({ env });
    if (parsed.data.json) io.writeLine(JSON.stringify({ schemaVersion: 1, result: { removed: true } }));
    else io.writeLine("forge614-sentinel se desinstaló.");
    return 0;
  } catch (error) {
    io.writeError(JSON.stringify({ schemaVersion: 1, code: "UNINSTALL_FAILED", error: "No se pudo desinstalar Forge614 Sentinel." }));
    return error instanceof InstallerActionError && error.exitCode === 130 ? 130 : 1;
  }
}
