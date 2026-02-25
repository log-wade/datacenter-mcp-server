// datacenter-mcp-server/src/schemas/ups-sizing.ts
import { z } from "zod";

export const UPSSizingSchema = z.object({
  critical_load_kw: z.number()
    .positive("Critical load must be positive")
    .max(100000, "Critical load exceeds realistic range")
    .describe("Critical IT load requiring UPS protection in kilowatts"),
  redundancy: z.enum(["N", "N+1", "2N", "2N+1"])
    .describe("UPS redundancy configuration: N (no redundancy), N+1 (single fault tolerance), 2N (parallel dual), 2N+1 (enhanced parallel)"),
  runtime_minutes: z.number()
    .min(5).max(120)
    .describe("Required UPS battery runtime in minutes (typical: 5-15 min for generator start, 30+ for extended runtime)"),
  battery_type: z.enum(["VRLA", "lithium_ion"])
    .describe("Battery technology: VRLA (traditional lead-acid), lithium_ion (LiFePO4 modern)"),
  ups_efficiency: z.number()
    .min(0.85).max(0.99)
    .default(0.96)
    .describe("UPS rectifier/inverter efficiency at rated load (default: 0.96 = 96%)"),
  growth_factor: z.number()
    .min(1.0).max(2.0)
    .default(1.2)
    .describe("Design growth factor for future expansion (default: 1.2 = 20% growth margin)"),
}).strict();

export type UPSSizingParams = z.infer<typeof UPSSizingSchema>;
