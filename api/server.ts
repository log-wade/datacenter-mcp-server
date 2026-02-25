// Vercel serverless handler for datacenter-mcp-server HTTP mode
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import type { Request, Response, NextFunction } from "express";

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

// Constants
import { ENGINEERING_CONSTANTS } from "../src/constants.js";

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

// Create MCP server instance
function createServer(): McpServer {
  const server = new McpServer({
    name: "datacenter-mcp-server",
    version: "1.0.0",
  });

  // Register all 8 tools (same as main index.ts)
  server.tool("dc_calculate_cooling_load", CoolingLoadSchema, async (params) => {
    const result = calculateCoolingLoad(params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("dc_analyze_power_redundancy", PowerRedundancySchema, async (params) => {
    const result = calculatePowerRedundancy(params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("dc_assess_tier_classification", TierAssessmentSchema, async (params) => {
    const result = assessTierClassification(params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("dc_generate_commissioning_plan", CommissioningPlanSchema, async (params) => {
    const result = generateCommissioningPlan(params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("dc_analyze_rack_density", RackDensitySchema, async (params) => {
    const result = analyzeRackDensity(params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("dc_gpu_cooling_optimizer", GPUCoolingSchema, async (params) => {
    const result = calculateGPUCooling(params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("dc_ups_battery_sizing", UPSSizingSchema, async (params) => {
    const result = calculateUPSSizing(params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("dc_reference_lookup", { category: { type: "string" as const }, query: { type: "string" as const } }, async (params) => {
    const results = ENGINEERING_CONSTANTS;
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  });

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
