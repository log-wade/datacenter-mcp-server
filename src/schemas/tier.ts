// datacenter-mcp-server/src/schemas/tier.ts
import { z } from "zod";

export const TierAssessmentSchema = z.object({
  target_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .describe("Target Uptime Institute Tier level (1-4)"),
  power_redundancy: z.enum(["N", "N+1", "2N", "2N+1"])
    .describe("Current power redundancy configuration"),
  cooling_redundancy: z.enum(["N", "N+1", "2N", "2N+1"])
    .describe("Current cooling redundancy configuration"),
  distribution_paths: z.number()
    .int().min(1).max(4)
    .describe("Number of independent power distribution paths to IT equipment"),
  concurrently_maintainable: z.boolean()
    .describe("Whether any capacity component can be maintained without impacting IT load"),
  fault_tolerant: z.boolean()
    .describe("Whether any single component failure is automatically handled without IT impact"),
  generator_backed: z.boolean()
    .describe("Whether the facility has generator backup power"),
  ups_runtime_minutes: z.number()
    .min(0).max(120).default(10)
    .describe("UPS battery runtime in minutes at full load (default: 10 min)"),
  fire_suppression: z.boolean()
    .default(false)
    .describe("Whether clean agent fire suppression is installed in the IT space"),
  monitoring_system: z.boolean()
    .default(false)
    .describe("Whether BMS/DCIM monitoring system is installed"),
}).strict();

export type TierAssessmentParams = z.infer<typeof TierAssessmentSchema>;
