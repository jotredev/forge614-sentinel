import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snapshotFrom } from "../modules/snapshot";
import { buildNotionMap, buildNotionMapForTree, NotionMapSchema, notionMapIsCurrent, readProductVersion, serializeNotionMap, writeNotionMap, type NotionMap } from "./build-notion-map";

const SHA256_OF_HOLA = "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79";
const docs = { "docs/es/00-a.md": "a", "docs/en/00-a.md": "a", "package.json": JSON.stringify({ version: "0.1.0" }) };
const page = (notionPageId: string | null) => ({ es: "docs/es/00-a.md", en: "docs/en/00-a.md", sha256Es: "0".repeat(64), sha256En: "0".repeat(64), notionPageId });

describe("buildNotionMap", () => {
  test("pairs es/en by number, hashes both and lists pages in number order", () => {
    const map = buildNotionMap(snapshotFrom({ "docs/es/01-b.md": "b", "docs/en/01-b.md": "b", "docs/es/00-a.md": "hola", "docs/en/00-b.md": "hello" }), "0.1.0");
    expect(map.pages.map((p) => [p.es, p.en])).toEqual([["docs/es/00-a.md", "docs/en/00-b.md"], ["docs/es/01-b.md", "docs/en/01-b.md"]]);
    expect(map.pages[0]?.sha256Es).toBe(SHA256_OF_HOLA);
    expect(map.pages[0]?.notionPageId).toBeNull();
    expect(NotionMapSchema.safeParse(map).success).toBe(true);
  });

  test("throws when a pair is incomplete; ignores unnumbered files", () => {
    expect(() => buildNotionMap(snapshotFrom({ "docs/es/01-x.md": "x" }), "0.1.0")).toThrow("docs/es/01-x.md has no en twin");
    expect(buildNotionMap(snapshotFrom({ "docs/es/README.md": "i", "docs/es/00-a.md": "a", "docs/en/00-a.md": "a" }), "0.1.0").pages).toHaveLength(1);
  });

  test("keeps notionPageId from a previous map for pages that still exist and drops the rest", () => {
    const previous: NotionMap = { schemaVersion: 1, productVersion: "0.0.9", pages: [page("page-123"), { ...page("gone"), es: "docs/es/09-gone.md", en: "docs/en/09-gone.md" }] };
    const map = buildNotionMap(snapshotFrom({ "docs/es/00-a.md": "a", "docs/en/00-a.md": "a" }), "0.1.0", previous);
    expect(map.pages.map((p) => p.notionPageId)).toEqual(["page-123"]);
    expect(map.pages[0]?.sha256Es).not.toBe("0".repeat(64));
  });
});

describe("buildNotionMapForTree and notionMapIsCurrent", () => {
  test("reads productVersion from package.json and carries notionPageId from a valid previous map", () => {
    expect(buildNotionMapForTree(snapshotFrom(docs)).productVersion).toBe("0.1.0");
    const previous: NotionMap = { schemaVersion: 1, productVersion: "0.0.9", pages: [page("page-123")] };
    expect(buildNotionMapForTree(snapshotFrom({ ...docs, "docs/notion-map.json": serializeNotionMap(previous) })).pages[0]?.notionPageId).toBe("page-123");
  });

  test("an invalid previous map or package.json throws (the CLI's NOTION_MAP_FAILED)", () => {
    expect(() => buildNotionMapForTree(snapshotFrom({ ...docs, "docs/notion-map.json": JSON.stringify({ schemaVersion: 2, productVersion: "0.1.0", pages: [] }) }))).toThrow("docs/notion-map.json is not a valid notion map");
    expect(() => readProductVersion(snapshotFrom({}))).toThrow("package.json not found");
    expect(() => readProductVersion(snapshotFrom({ "package.json": "{ nope" }))).toThrow("package.json: invalid JSON");
    expect(() => readProductVersion(snapshotFrom({ "package.json": JSON.stringify({ version: "v1" }) }))).toThrow("package.json: version");
  });

  test("the committed map is current only when it equals a fresh build", () => {
    const current = serializeNotionMap(buildNotionMapForTree(snapshotFrom(docs)));
    expect(notionMapIsCurrent(snapshotFrom({ ...docs, "docs/notion-map.json": current }))).toBe(true);
    expect(notionMapIsCurrent(snapshotFrom(docs))).toBe(false);
    expect(notionMapIsCurrent(snapshotFrom({ ...docs, "docs/es/00-a.md": "changed", "docs/notion-map.json": current }))).toBe(false);
  });
});

describe("writeNotionMap", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "notion-map-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("writes the file and a second run leaves it byte-identical", () => {
    const out = join(dir, "docs", "notion-map.json");
    writeNotionMap(buildNotionMapForTree(snapshotFrom(docs)), out);
    const first = readFileSync(out, "utf8");
    writeNotionMap(buildNotionMapForTree(snapshotFrom({ ...docs, "docs/notion-map.json": first })), out);
    expect(readFileSync(out, "utf8")).toBe(first);
  });
});
