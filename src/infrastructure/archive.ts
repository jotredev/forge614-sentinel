import { gunzipSync } from "fflate";
import { crc32 } from "../modules/crc32";
import { parseUstar, type TarMember } from "../modules/tar-reader";

// gunzip through fflate (pure JavaScript, pinned version: the same package
// forge614-ai compresses with) and the ecosystem's own ustar reader. fflate
// does not verify the gzip trailer, so CRC32 and ISIZE (RFC 1952 §2.3.1) are
// checked here and a flipped byte never reaches parseUstar. The standard's
// archives are a single gzip member, so the trailer is the last 8 bytes.
// No system tar, no temp files: bytes in, members out.
export function extractTarGz(bytes: Uint8Array): TarMember[] {
  if (bytes.length < 18) throw new Error("gzip: truncated stream");
  const tar = gunzipSync(bytes);
  const trailer = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 8, 8);
  if (crc32(tar) !== trailer.getUint32(0, true)) throw new Error("gzip: crc mismatch");
  if (tar.length >>> 0 !== trailer.getUint32(4, true)) throw new Error("gzip: size mismatch");
  return parseUstar(tar);
}
