import { z } from "zod";
import { Sha256 } from "./common";

const LINE = /^([a-f0-9]{64})  (\S+)$/;

export const Sha256SumsSchema = z.array(z.object({ sha256: Sha256, file: z.string().min(1) }).strict()).min(1);
export type Sha256Sums = z.infer<typeof Sha256SumsSchema>;

// "<sha256>  <file>" per line (two spaces, the sha256sum format). Any other
// line shape is a parse failure: a release asset that does not follow the
// format is not trusted.
export function parseSha256Sums(text: string): Sha256Sums | null {
  const entries: Array<{ sha256: string; file: string }> = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const m = LINE.exec(line);
    if (m === null || m[1] === undefined || m[2] === undefined) return null;
    entries.push({ sha256: m[1], file: m[2] });
  }
  const parsed = Sha256SumsSchema.safeParse(entries);
  return parsed.success ? parsed.data : null;
}
