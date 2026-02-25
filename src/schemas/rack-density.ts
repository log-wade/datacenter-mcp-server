// datacenter-mcp-server/src/schemas/rack-density.ts
import { z } from "zod";

export const RackDensitySchema = z.object({
  rack_count: z.number()
    .int().positive().max(10000)
    .describe("Total number of IT racks / cabinets"),
  avg_kw_per_rack: z.number()
    .positive().max(200)
    .describe("Average power draw per rack in kW (e.g., 8 for typical enterprise, 40+ for GPU/HPC)"),
  floor_area_sqft: z.number()
    .positive().max(1000000).optional()
    .describe("Total white space floor area in square feet (for W/sqft calculation)"),
  cooling_type: z.string().optional()
    .describe("Current or planned cooling type (e.g., 'air-cooled DX', 'chilled water', 'rear-door heat exchanger')"),
}).strict();

export type RackDensityParams = z.infer<typeof RackDensitySchema>;
