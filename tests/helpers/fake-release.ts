import { gzipSync } from "fflate";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extractTarGz } from "../../src/infrastructure/archive";
import { sha256Hex } from "../../src/infrastructure/hashing";
import { buildUstarArchive } from "../../src/modules/tar";
import type { TarMember } from "../../src/modules/tar-reader";

const FIXTURE = resolve(import.meta.dir, "../../fixtures/standard/standard-v1.0.0/standard-1.0.0.tar.gz");

// Writes <tmp>/standard-v<version>/{standard-<version>.tar.gz, SHA256SUMS}
// from the real 1.0.0 members after `mutate`, and returns the file:// base.
export function writeFakeRelease(version: string, mutate: (members: TarMember[]) => TarMember[]): { base: string; sha256: string } {
  const members = mutate(extractTarGz(new Uint8Array(readFileSync(FIXTURE))));
  const withVersion = members.map((m) => (m.path === "VERSION" ? { ...m, content: new TextEncoder().encode(`${version}\n`) } : m));
  const tar = buildUstarArchive(withVersion.map((m) => (m.content === undefined ? { path: m.path, mode: m.mode } : { path: m.path, mode: m.mode, content: m.content })));
  const gz = gzipSync(tar, { level: 9 });
  const sha256 = sha256Hex(gz);
  const dir = mkdtempSync(join(tmpdir(), "sentinel-fake-release-"));
  mkdirSync(join(dir, `standard-v${version}`));
  writeFileSync(join(dir, `standard-v${version}`, `standard-${version}.tar.gz`), gz);
  writeFileSync(join(dir, `standard-v${version}`, "SHA256SUMS"), `${sha256}  standard-${version}.tar.gz\n`);
  return { base: pathToFileURL(dir).href, sha256 };
}
