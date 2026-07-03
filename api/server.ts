// Vercel serverless handler for datacenter-mcp-server HTTP mode
//
// AUDIT NOTE (2026-07-03): rewritten to fix CRITICAL-4a/4b from CODE-AUDIT.md —
// phantom ENGINEERING_CONSTANTS import removed, tool registrations migrated to
// registerTool with raw shapes + explicit zod parse, dc_reference_lookup now a
// real lookup (mirrors src/index.ts). This file is typechecked via tsconfig.ci.json.
//
// STILL OPEN (CRITICAL-4): no per-customer API keys, metering, or Stripe
// fulfillment. Do not sell paid cloud access until that layer exists.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Schemas
import { CoolingLoadSchema } from "../src/schemas/cooling.js";
import { PowerRedundancySchema } from "../src/schemas/power.js";
import { TierAssessmentSchema } from "../src/schemas/tier.js";
import { CommissioningPlanSchema } from "../src/schemas/commissioning.js";
import { RackDensitySchema } from "../src/schemas/rack-density.js";
import { GPUCoolingSchema } from "../src/schemas/gpu-cooling.js";
import { UPSSizingSchema } from "../src/schemas/ups-sizing.js";

// Engines
import { calculateCoolingLoad } from "../src/services/cooling-engine.js";
import { calculatePowerRedundancy } from "../src/services/power-engine.js";
import { assessTierClassification } from "../src/services/tier-engine.js";
import { generateCommissioningPlan } from "../src/services/commissioning-engine.js";
import { analyzeRackDensity } from "../src/services/rack-density-engine.js";
import { calculateGPUCooling } from "../src/services/gpu-cooling-engine.js";
import { calculateUPSSizing } from "../src/services/ups-sizing-engine.js";

// Reference data
import {
  TIER_REQUIREMENTS,
  PUE_REFERENCE,
  RACK_DENSITY,
  CX_PHASES,
} from "../src/constants.js";

const app = express();
app.use(express.json());

// CORS
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  if (_req.method === "OPTIONS") { res.status(204).end(); return; }
  next();
});

// Health
app.get("/api/server", (_req: Request, res: Response) => {
  res.json({ status: "ok", server: "datacenter-mcp-server", version: "1.0.0", tools: 8 });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", server: "datacenter-mcp-server", version: "1.0.0" });
});

// Well-known MCP server card
app.get("/.well-known/mcp/server-card.json", (_req: Request, res: Response) => {
  res.json({
    name: "datacenter-mcp-server",
    description: "Mission-critical data center engineering MCP server with 8 calculation tools",
    version: "1.0.0",
    transport: ["streamable-http"],
    url: "/api/server"
  });
});

// Wrap engine calls so a thrown error becomes a structured MCP error,
// never a silent transport failure.
function toolResult(fn: () => unknown) {
  try {
    const result = fn();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Calculation error: ${message}` }],
      isError: true,
    };
  }
}

// Create MCP server instance
function createServer(): McpServer {
  const server = new McpServer({
    name: "datacenter-mcp-server",
    version: "1.0.0",
  });

  server.registerTool(
    "dc_calculate_cooling_load",
    { description: "Calculate data center cooling load (kW, tons, BTU/hr, CFM) from IT load, PUE, and environmental factors.", inputSchema: CoolingLoadSchema.shape },
    async (params) => toolResult(() => calculateCoolingLoad(CoolingLoadSchema.parse(params)))
  );

  server.registerTool(
    "dc_analyze_power_redundancy",
    { description: "Analyze N/N+1/2N/2N+1 power topologies: UPS modules, generators, PDUs, efficiency chain.", inputSchema: PowerRedundancySchema.shape },
    async (params) => toolResult(() => calculatePowerRedundancy(PowerRedundancySchema.parse(params)))
  );

  server.registerTool(
    "dc_assess_tier_classification",
    { description: "Assess facility against Uptime Institute Tier criteria (self-assessment aid) with gap analysis.", inputSchema: TierAssessmentSchema.shape },
    async (params) => toolResult(() => assessTierClassification(TierAssessmentSchema.parse(params)))
  );

  server.registerTool(
    "dc_generate_commissioning_plan",
    { description: "Generate a phased commissioning plan (L1–L5) with test procedures and milestones.", inputSchema: CommissioningPlanSchema.shape },
    async (params) => toolResult(() => generateCommissioningPlan(CommissioningPlanSchema.parse(params)))
  );

  server.registerTool(
    "dc_analyze_rack_density",
    { description: "Classify rack density and recommend cooling strategy, containment, and airflow.", inputSchema: RackDensitySchema.shape },
    async (params) => toolResult(() => analyzeRackDensity(RackDensitySchema.parse(params)))
  );

  server.registerTool(
    "dc_gpu_cooling_optimizer",
    { description: "Model GPU cluster cooling: load, strategy, coolant flow, CDUs, and annual energy cost delta.", inputSchema: GPUCoolingSchema.shape },
    async (params) => toolResult(() => calculateGPUCooling(GPUCoolingSchema.parse(params)))
  );

  server.registerTool(
    "dc_ups_battery_sizing",
    { description: "Size UPS modules and battery strings for target runtime and redundancy level.", inputSchema: UPSSizingSchema.shape },
    async (params) => toolResult(() => calculateUPSSizing(UPSSizingSchema.parse(params)))
  );

  const ReferenceLookupShape = {
    category: z.enum(["tier_requirements", "pue_benchmarks", "rack_density", "commissioning_phases"])
      .describe("Reference data category to look up"),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional()
      .describe("Optional: specific tier level to filter (1-4)"),
  };

  server.registerTool(
    "dc_reference_lookup",
    { description: "Look up tier requirements, PUE benchmarks, rack density classes, and commissioning phases.", inputSchema: ReferenceLookupShape },
    async (params) => {
      const { category, tier } = z.object(ReferenceLookupShape).parse(params);
      let result: unknown;
      switch (category) {
        case "tier_requirements":
          result = tier ? { [tier]: TIER_REQUIREMENTS[tier] } : TIER_REQUIREMENTS;
          break;
        case "pue_benchmarks":
          result = PUE_REFERENCE;
          break;
        case "rack_density":
          result = RACK_DENSITY;
          break;
        case "commissioning_phases":
          result = CX_PHASES;
          break;
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}

// MCP endpoint
app.post("/api/server", async (req: Request, res: Response) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res as any, req.body);
});

export default app;
