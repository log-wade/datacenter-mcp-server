// datacenter-mcp-server/src/schemas/cooling.ts
import { z } from "zod";

export const CoolingLoadSchema = z.object({
  it_load_kw: z.number()
    .positive("IT load must be positive")
    .max(100000, "IT load exceeds realistic range")
    .describe("Total IT electrical load in kilowatts (kW)"),
  pue: z.number()
    .min(1.0, "PUE cannot be less than 1.0")
    .max(3.0, "PUE above 3.0 indicates data entry error")
    .describe("Power Usage Effectiveness — ratio of total facility power to IT power (typically 1.2-1.8)"),
  safety_factor: z.number()
    .min(1.0).max(2.0)
    .default(1.15)
    .describe("Design safety factor applied to cooling capacity (default: 1.15 = 15% margin)"),
  lighting_area_sqft: z.number()
    .min(0).default(0)
    .describe("White space floor area in square feet (for lighting/misc heat gain calculation)"),
  include_humidification: z.boolean()
    .default(false)
    .describe("Whether to include humidification load in calculation (adds ~7%)"),
  altitude_ft: z.number()
    .min(0).max(15000).default(0)
    .describe("Site altitude in feet above sea level (equipment derating applied above 5,000 ft)"),
  design_outdoor_temp_f: z.number()
    .min(-40).max(130).default(95)
    .describe("Design outdoor dry-bulb temperature in Fahrenheit (ASHRAE 0.4% cooling design day)"),
}).strict();

export type CoolingLoadParams = z.infer<typeof CoolingLoadSchema>;
