import { resolve } from "node:path";
import { z } from "zod";
import { buildNotionMapForTree, NOTION_MAP_PATH, notionMapIsCurrent, writeNotionMap } from "../../app/build-notion-map";
import { repoRoot } from "../../app/repo";
import { takeSnapshot } from "../../app/take-snapshot";
import { issuesOf, parseFlags } from "./args";
import { printError, printJson, runCli } from "./output";
import { printVersionIfRequested } from "./version";

const USAGE = "notion-map-build [--check]";
const Args = z.object({ help: z.literal(true).optional(), check: z.literal(true).optional() }).strict();

function main(argv: string[]): number {
  if (printVersionIfRequested(argv)) return 0;
  const parsed = Args.safeParse(parseFlags(argv));
  if (!parsed.success) {
    printError("INVALID_ARGUMENTS", issuesOf(parsed.error));
    return 2;
  }
  if (parsed.data.help) {
    printJson({ schemaVersion: 1, usage: USAGE });
    return 0;
  }
  const snapshot = takeSnapshot(repoRoot);
  if (parsed.data.check) {
    if (!notionMapIsCurrent(snapshot)) {
      printError("NOTION_MAP_DRIFT", `${NOTION_MAP_PATH} is out of date; run 'bun run notion-map:build'`);
      return 1;
    }
    printJson({ schemaVersion: 1, ok: true, path: NOTION_MAP_PATH });
    return 0;
  }
  const map = buildNotionMapForTree(snapshot);
  writeNotionMap(map, resolve(repoRoot, NOTION_MAP_PATH));
  printJson({ schemaVersion: 1, path: NOTION_MAP_PATH, pages: map.pages.length });
  return 0;
}

process.exit(await runCli("NOTION_MAP_FAILED", () => main(process.argv.slice(2))));
