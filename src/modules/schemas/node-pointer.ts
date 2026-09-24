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
    // Plan A2 (spec 2026-09-24 §4): Sentinel release this node pins; its
    // CI installs exactly this version (`bun run sentinel:install`).
    // Optional and additive (acta 0024): pointers without it stay valid.
    sentinel: z.object({ version: SemVer }).strict().optional(),
  })
  .strict();
export type NodePointer = z.infer<typeof NodePointerSchema>;
