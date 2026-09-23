import { z } from "zod";
import { IsoDate, Slug } from "./common";

const Cell = z
  .object({
    node: Slug,
    agent: Slug,
    status: z.enum(["supported", "partial", "unsupported", "revalidate", "not-applicable"]),
    verifiedAt: IsoDate,
    verifiedBy: z.string().min(1),
    notes: z.string(),
    revalidateSince: IsoDate.optional(),
    reason: z.string().min(1).optional(),
    deadline: IsoDate.optional(),
  })
  .strict()
  .refine((c) => c.status !== "revalidate" || c.revalidateSince !== undefined, {
    message: "revalidate requires revalidateSince",
    path: ["revalidateSince"],
  })
  .refine((c) => c.status !== "revalidate" || c.reason !== undefined, {
    message: "revalidate requires reason",
    path: ["reason"],
  });

export const SupportMatrixSchema = z
  .object({
    schemaVersion: z.literal(1),
    nodes: z.array(Slug).min(1),
    agents: z.array(Slug).min(1),
    cells: z.array(Cell),
  })
  .strict()
  .superRefine((m, ctx) => {
    m.cells.forEach((c, i) => {
      if (!m.nodes.includes(c.node)) ctx.addIssue({ code: "custom", path: ["cells", i, "node"], message: `unknown node ${c.node}` });
      if (!m.agents.includes(c.agent)) ctx.addIssue({ code: "custom", path: ["cells", i, "agent"], message: `unknown agent ${c.agent}` });
    });
  });

export type SupportMatrix = z.infer<typeof SupportMatrixSchema>;
