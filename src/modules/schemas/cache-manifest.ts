import { z } from "zod";
import { SemVer, Sha256 } from "./common";

// <FORGE614_HOME>/standard/<version>/manifest.json (spec §5.4).
export const CacheManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: SemVer,
    sha256: Sha256,
    fetchedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/, "ISO-8601 UTC"),
  })
  .strict();
export type CacheManifest = z.infer<typeof CacheManifestSchema>;
