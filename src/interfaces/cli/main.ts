import { checkMain, CHECK_USAGE } from "./check";
import { SENTINEL_ERROR_CODES } from "./codes";
import { printError, printJson, runCli } from "./output";
import { FETCH_USAGE, standardFetchMain } from "./standard-fetch";
import { printVersionIfRequested } from "./version";

export const USAGE = `forge614-sentinel <command>: ${CHECK_USAGE} | ${FETCH_USAGE} | --help | --version`;

export async function main(argv: string[]): Promise<number> {
  if (printVersionIfRequested(argv)) return 0;
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help") {
    printJson({ schemaVersion: 1, usage: USAGE, commands: ["check", "standard fetch"], errorCodes: SENTINEL_ERROR_CODES });
    return 0;
  }
  if (command === "check") return checkMain(rest);
  if (command === "standard" && rest[0] === "fetch") return standardFetchMain(rest.slice(1));
  printError("INVALID_ARGUMENTS", `unknown command '${[command, ...rest].join(" ")}'; usage: ${USAGE}`);
  return 2;
}

if (import.meta.main) process.exit(await runCli("SENTINEL_FAILED", () => main(process.argv.slice(2))));
