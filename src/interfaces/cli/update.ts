import { z } from "zod";
import { updateSentinel } from "../../app/installer-actions";
import { issuesOf, parseMixed } from "./args";
import { printVersionIfRequested, SENTINEL_VERSION } from "./version";

const USAGE = "update [--json]";
const Args = z.object({ help: z.literal(true).optional(), json: z.literal(true).optional() }).strict();

/** Output callbacks used by the update command and its tests. */
export interface UpdateCommandIO {
  /** Write one successful output line. */
  writeLine(line: string): void;
  /** Write one structured error line. */
  writeError(line: string): void;
}

/** Parse and run `update`, returning the CLI exit status. */
export async function updateMain(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
  io: UpdateCommandIO = { writeLine: (line) => process.stdout.write(`${line}\n`), writeError: (line) => process.stderr.write(`${line}\n`) },
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
  try {
    const result = await updateSentinel(SENTINEL_VERSION, { env });
    if (parsed.data.json) io.writeLine(JSON.stringify({ schemaVersion: 1, ...result }));
    else io.writeLine(result.updated
      ? `forge614-sentinel se actualizó de ${result.previousVersion} a ${result.installedVersion}.`
      : `forge614-sentinel ya está al día (${result.installedVersion}).`);
    return 0;
  } catch {
    io.writeError(JSON.stringify({ schemaVersion: 1, code: "UPDATE_FAILED", error: "No se pudo actualizar Forge614 Sentinel." }));
    return 1;
  }
}
