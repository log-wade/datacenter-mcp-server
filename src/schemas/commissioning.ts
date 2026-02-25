// datacenter-mcp-server/src/schemas/commissioning.ts
import { z } from "zod";

export const CommissioningPlanSchema = z.object({
  facility_size_kw: z.number()
    .positive().max(100000)
    .describe("Total IT design capacity of the facility in kW"),
  tier_level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .describe("Target Uptime Institute Tier level (affects test complexity and duration)"),
  include_levels: z.array(z.number().int().min(1).max(5))
    .min(1)
    .describe("Commissioning levels to include: 1=Factory Witness, 2=Component Verification, 3=System Verification, 4=Integrated Systems, 5=Operational Sustainability"),
  custom_systems: z.array(z.string()).optional()
    .describe("Optional list of specific systems to commission (defaults to standard MEP systems)"),
}).strict();

export type CommissioningPlanParams = z.infer<typeof CommissioningPlanSchema>;
