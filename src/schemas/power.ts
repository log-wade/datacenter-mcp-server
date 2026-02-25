// datacenter-mcp-server/src/schemas/power.ts
import { z } from "zod";

export const PowerRedundancySchema = z.object({
  it_load_kw: z.number()
    .positive("IT load must be positive")
    .max(100000)
    .describe("Total IT electrical load in kilowatts (kW)"),
  redundancy_config: z.enum(["N", "N+1", "2N", "2N+1"])
    .describe("Power redundancy configuration: N (none), N+1 (one spare), 2N (fully redundant), 2N+1 (redundant + spare)"),
  ups_module_size_kw: z.number()
    .positive().max(5000).default(500)
    .describe("Individual UPS module capacity in kW (default: 500 kW)"),
  generator_size_kw: z.number()
    .positive().max(10000).default(2000)
    .describe("Individual generator capacity in kW (default: 2000 kW / 2500 kVA)"),
  ups_efficiency: z.number()
    .min(0.8).max(0.99).default(0.95)
    .describe("UPS efficiency at operating load (default: 0.95 = 95%)"),
  pdu_efficiency: z.number()
    .min(0.9).max(0.999).default(0.98)
    .describe("Power distribution unit efficiency (default: 0.98 = 98%)"),
  transformer_efficiency: z.number()
    .min(0.9).max(0.999).default(0.985)
    .describe("Transformer efficiency (default: 0.985 = 98.5%)"),
}).strict();

export type PowerRedundancyParams = z.infer<typeof PowerRedundancySchema>;
