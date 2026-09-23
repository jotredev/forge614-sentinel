import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Text(text: string): string {
  return sha256Hex(new TextEncoder().encode(text));
}

export function sha256File(path: string): string {
  return sha256Hex(readFileSync(path));
}
