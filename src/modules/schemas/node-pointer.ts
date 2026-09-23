import { z } from "zod";
import { SemVer, Sha256, Slug } from "./common";
export const NodePointerSchema = z
  .object({
    schemaVersion: z.literal(1),
    node: Slug,
    kind: z.enum(["product", "internal"]),
    standard: z.object({ version: SemVer, sha256: Sha256 }).strict(),
    // acta 0022: stable group name a node belongs to (e.g. "forge614").
    ecosystem: Slug.optional(),
  })
  .strict();
export type NodePointer = z.infer<typeof NodePointerSchema>;
