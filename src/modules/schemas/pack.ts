import { z } from "zod";
import { PACKAGE_NAME_PATTERN } from "../package-name";
import { Bilingual, SemVer } from "./common";

const RuleRef = z
  .string()
  .regex(PACKAGE_NAME_PATTERN)
  .refine((n) => n.split("-")[1] === "rule");

export const PackSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z
      .string()
      .regex(PACKAGE_NAME_PATTERN)
      .refine((n) => n.split("-")[1] === "pack"),
    version: SemVer,
    title: Bilingual,
    rules: z.array(RuleRef).min(1),
  })
  .strict();

export type Pack = z.infer<typeof PackSchema>;
