import { z } from "zod";
import { writeTextAtomic } from "../infrastructure/fs-write";
import { sha256Text } from "../infrastructure/hashing";
import { SemVer, Sha256 } from "../modules/schemas/common";
import { listUnder, read, type RepoSnapshot } from "../modules/snapshot";

// docs/notion-map.json: one row per es/en documentation pair with the
// sha256 of each side, so a mirror (a page kept outside the repository) can
// tell whether the source it copied is still the current one. The schema
// lives in app: the map is this repository's own bookkeeping, not part of
// the standard's content.
const NotionPageSchema = z
  .object({
    es: z.string().min(1),
    en: z.string().min(1),
    sha256Es: Sha256,
    sha256En: Sha256,
    notionPageId: z.string().nullable(),
  })
  .strict();

export const NotionMapSchema = z
  .object({
    schemaVersion: z.literal(1),
    productVersion: SemVer,
    pages: z.array(NotionPageSchema),
  })
  .strict();

export type NotionMap = z.infer<typeof NotionMapSchema>;

export const NOTION_MAP_PATH = "docs/notion-map.json";
const ES_NUMBERED = /^docs\/es\/(\d{2})-/;
const PackageVersion = z.object({ version: SemVer }).passthrough();

function issuesOf(error: z.ZodError): string {
  return error.issues.map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("; ");
}

// Pairs every numbered docs/es/NN-*.md with its docs/en/NN-*.md twin (the
// pairing rule of docs-parity) and fingerprints both. notionPageId is the
// only thing carried over from the previous map, and only while its es file
// still exists; fingerprints are always recomputed.
export function buildNotionMap(snapshot: RepoSnapshot, productVersion: string, previous?: NotionMap): NotionMap {
  const pages: NotionMap["pages"] = [];
  for (const es of listUnder(snapshot, "docs/es/")) {
    const num = ES_NUMBERED.exec(es)?.[1];
    if (num === undefined) continue;
    const en = listUnder(snapshot, `docs/en/${num}-`)[0];
    if (en === undefined) throw new Error(`${es} has no en twin`);
    const prev = previous?.pages.find((p) => p.es === es);
    pages.push({ es, en, sha256Es: sha256Text(read(snapshot, es) ?? ""), sha256En: sha256Text(read(snapshot, en) ?? ""), notionPageId: prev?.notionPageId ?? null });
  }
  return { schemaVersion: 1, productVersion, pages };
}

// The previous map goes through the same strict schema: a map that does not
// parse is an error, never ignored, because ignoring it would drop every
// notionPageId a person recorded.
function previousMapOf(snapshot: RepoSnapshot): NotionMap | undefined {
  const raw = read(snapshot, NOTION_MAP_PATH);
  if (raw === undefined) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${NOTION_MAP_PATH} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const parsed = NotionMapSchema.safeParse(data);
  if (!parsed.success) throw new Error(`${NOTION_MAP_PATH} is not a valid notion map: ${issuesOf(parsed.error)}`);
  return parsed.data;
}

export function readProductVersion(snapshot: RepoSnapshot): string {
  const raw = read(snapshot, "package.json");
  if (raw === undefined) throw new Error("package.json not found");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`package.json: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const parsed = PackageVersion.safeParse(data);
  if (!parsed.success) throw new Error(`package.json: ${issuesOf(parsed.error)}`);
  return parsed.data.version;
}

export function buildNotionMapForTree(snapshot: RepoSnapshot): NotionMap {
  const previous = previousMapOf(snapshot);
  const productVersion = readProductVersion(snapshot);
  return previous === undefined ? buildNotionMap(snapshot, productVersion) : buildNotionMap(snapshot, productVersion, previous);
}

export function serializeNotionMap(map: NotionMap): string {
  return `${JSON.stringify(map, null, 2)}\n`;
}

export function writeNotionMap(map: NotionMap, outPath: string): void {
  writeTextAtomic(outPath, serializeNotionMap(map));
}

// True when the committed docs/notion-map.json is byte-identical to what a
// fresh build would write (`notion-map:build --check`, a verify step).
export function notionMapIsCurrent(snapshot: RepoSnapshot): boolean {
  const committed = read(snapshot, NOTION_MAP_PATH);
  if (committed === undefined) return false;
  return committed === serializeNotionMap(buildNotionMapForTree(snapshot));
}
