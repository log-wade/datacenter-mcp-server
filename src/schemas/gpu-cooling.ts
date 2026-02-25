// datacenter-mcp-server/src/schemas/gpu-cooling.ts
import { z } from "zod";

export const GPUCoolingSchema = z.object({
  gpu_count: z.number()
    .positive("GPU count must be positive")
    .max(10000, "GPU count exceeds realistic range")
    .describe("Total number of GPU accelerators in the deployment"),
  gpu_model: z.enum(["H100", "A100", "H200", "B200", "GB200"])
    .describe("GPU model for TDP lookup: H100 (700W), A100 (400W), H200 (700W), B200 (1000W), GB200 (1200W)"),
  rack_count: z.number()
    .positive("Rack count must be positive")
    .max(1000, "Rack count exceeds realistic range")
    .describe("Number of racks in the GPU deployment"),
  cooling_type: z.enum(["air", "direct_liquid", "rear_door", "immersion"])
    .describe("Cooling strategy: air (traditional), rear_door (15-30 kW/rack), direct_liquid (30-60 kW/rack), immersion (>60 kW/rack)"),
  ambient_temp_f: z.number()
    .min(-40).max(130)
    .describe("Ambient supply air temperature in Fahrenheit (typical: 72-75°F)"),
  pue_target: z.number()
    .min(1.05).max(2.5)
    .describe("Target Power Usage Effectiveness for facility evaluation"),
  electricity_cost_per_kwh: z.number()
    .min(0.01).max(1.0)
    .default(0.08)
    .describe("Average electricity cost in $/kWh (default: $0.08)"),
}).strict();

export type GPUCoolingParams = z.infer<typeof GPUCoolingSchema>;
