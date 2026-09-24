import { z } from "zod";
import packageJson from "../../../package.json";
import { printJson } from "./output";

export const PRODUCT_NAME = "forge614-sentinel";

// package.json is bundled into the compiled binary (resolveJsonModule), so
// `--version` never reads the disk: it works from any working directory.
const PackageVersion = z.object({ name: z.literal(PRODUCT_NAME), version: z.string().regex(/^\d+\.\d+\.\d+$/) }).passthrough();
export const SENTINEL_VERSION: string = PackageVersion.parse(packageJson).version;

// STANDARD §4: `--version` is always available and never blocking. Every
// CLI calls this first, before any other argument parsing.
export function printVersionIfRequested(argv: string[]): boolean {
  if (!argv.includes("--version")) return false;
  printJson({ schemaVersion: 1, name: PRODUCT_NAME, version: SENTINEL_VERSION });
  return true;
}
