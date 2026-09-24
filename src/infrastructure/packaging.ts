import { gzipSync, zipSync } from "fflate";
import { buildUstarArchive } from "../modules/tar";

// Release archives for the installers: install.sh expects
// forge614-<node>-<os>-<arch>.tar.gz with the binary at the root (it runs
// chmod 0755 after extracting, the tar mode is belt and braces);
// install.ps1 expects forge614-<node>-windows-x64.zip with the .exe at the
// root. Reproducibility of these bytes is not a goal (the sha256 published
// in SHA256SUMS is computed from what was actually built).
export function packTarGz(entries: Array<{ path: string; mode: number; content: Uint8Array }>): Uint8Array {
  return gzipSync(buildUstarArchive(entries), { level: 6 });
}

export function packZip(entries: Record<string, Uint8Array>): Uint8Array {
  return zipSync(entries, { level: 6 });
}
