import { z } from "zod";
export const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/, "semver X.Y.Z");
export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/, "sha256 hex");
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case");
export const Bilingual = z.object({ es: z.string().min(1), en: z.string().min(1) }).strict();
