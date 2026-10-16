import { z } from "zod";
import { SemVer, Sha256, Slug } from "./common";
const InstallDependency = z.object({
  node: Slug,
  minimumVersion: SemVer.nullable(),
  requiredCapabilities: z.array(z.object({ agent: Slug, field: z.enum(["supportsMcp", "supportsHooks", "supportsHeadlessExec", "supportsReasoningLevel", "supportsReadOnly", "fullySupported"]) }).strict()),
  compatibility: z.enum(["installed", "version", "capabilities", "version-and-capabilities"]),
}).strict();
const InstallBlock = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  minimumNodeVersion: SemVer,
  systems: z.array(z.object({ os: z.enum(["darwin", "linux", "windows"]), architectures: z.array(z.enum(["arm64", "x64"])).min(1) }).strict()).min(1),
  tagFormat: z.literal("vX.Y.Z"),
  asset: z.object({ type: z.enum(["binary-tar-gzip", "raw-binary", "node-package-tar-gzip", "binary-tar-gzip-or-zip"]), pattern: z.string().min(1), checksumFile: z.literal("SHA256SUMS") }).strict(),
  dependencies: z.array(InstallDependency),
  path: z.object({ modify: z.boolean(), retireWhen: z.string().nullable() }).strict(),
  smokeTest: z.array(z.string()),
}).strict();
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
    install: InstallBlock.optional(),
  })
  .strict();
export type NodePointer = z.infer<typeof NodePointerSchema>;
