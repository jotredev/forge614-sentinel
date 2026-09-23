import { z } from "zod";
import { SemVer, Sha256 } from "./schemas/common";

// spec §5.2: where a standard comes from, as data. In 0.1 the only kind is a
// GitHub release of jotredev/forge614-ai; the version and the fingerprint
// come from the inspected repository's pointer. A version forced with
// --standard has no expected fingerprint, so sha256 is optional.
export const STANDARD_REPOSITORY = "jotredev/forge614-ai";

export const StandardSourceSchema = z
  .object({
    kind: z.literal("github-release"),
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "owner/name"),
    version: SemVer,
    sha256: Sha256.optional(),
  })
  .strict();
export type StandardSource = z.infer<typeof StandardSourceSchema>;

export function standardSource(version: string, sha256?: string): StandardSource {
  const base = { kind: "github-release" as const, repository: STANDARD_REPOSITORY, version };
  return sha256 === undefined ? base : { ...base, sha256 };
}
