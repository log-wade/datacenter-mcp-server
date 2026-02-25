#!/usr/bin/env node
// datacenter-mcp-server/src/index.ts
// Mission-Critical Data Center MCP Server
// Provides engineering calculation tools for AI agents

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { z } from "zod";

// Schemas
import { CoolingLoadSchema } from "./schemas/cooling.js";
import { PowerRedundancySchema } from "./schemas/power.js";
import { TierAssessmentSchema } from "./schemas/tier.js";
import { CommissioningPlanSchema } from "./schemas/commissioning.js";
import { RackDensitySchema } from "./schemas/rack-density.js";
import { GPUCoolingSchema } from "./schemas/gpu-cooling.js";
import { UPSSizingSchema } from "./schemas/ups-sizing.js";

// Engines
import { calculateCoolingLoad } from "./services/cooling-engine.js";
import { calculatePowerRedundancy } from "./services/power-engine.js";
import { assessTierClassification } from "./services/tier-engine.js";
import { generateCommissioningPlan } from "./services/commissioning-engine.js";
import { analyzeRackDensity } from "./services/rack-density-engine.js";
import { calculateGPUCooling } from "./services/gpu-cooling-engine.js";
import { calculateUPSSizing } from "./services/ups-sizing-engine.js";

// Constants
import { TIER_REQUIREMENTS, PUE_REFERENCE, RACK_DENSITY, CX_PHASES } from "./constants.js";

// Middleware
import {
  corsMiddleware,
  requestLoggerMiddleware,
  rateLimitMiddleware,
  requestSizeLimitMiddleware,
  apiKeyAuthMiddleware,
  errorSanitizerMiddleware,
} from "./middleware.js";

// ─── Server Initialization ─────────────────────────────────────────────

const server = new McpServer({
  name: "datacenter-mcp-server",
  version: "1.0.0",
});

// ─── Tool: Cooling Load Calculator ─────────────────────────────────────

server.registerTool(
  "dc_calculate_cooling_load",
  {
    title: "Data Center Cooling Load Calculator",
    description: `Calculate the total cooling load for a data center facility based on IT load, PUE, and environmental factors.

This tool computes cooling capacity requirements in kW, tons, and BTU/hr, estimates required airflow in CFM, rates the facility's PUE efficiency, and provides actionable recommendations for cooling system design.

Accounts for: IT heat rejection, electrical overhead losses, lighting loads, humidification, and altitude derating above 5,000 ft.

Args:
  - it_load_kw (number): Total IT electrical load in kW
  - pue (number): Power Usage Effectiveness ratio (1.0-3.0)
  - safety_factor (number): Design margin (default 1.15 = 15%)
  - lighting_area_sqft (number): Floor area for lighting heat gain
  - include_humidification (boolean): Include humidification load
  - altitude_ft (number): Site altitude for equipment derating
  - design_outdoor_temp_f (number): ASHRAE design day temperature

Returns structured JSON with cooling_load_kw, cooling_load_tons, cooling_load_btu, estimated_airflow_cfm, pue_rating, and engineering recommendations.

Examples:
  - "Calculate cooling for a 2 MW data center with PUE of 1.4" -> it_load_kw: 2000, pue: 1.4
  - "What cooling do I need for 500 kW at 6000 ft altitude?" -> it_load_kw: 500, pue: 1.5, altitude_ft: 6000`,
    inputSchema: CoolingLoadSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const result = calculateCoolingLoad(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error calculating cooling load: ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: Power Redundancy Analyzer ───────────────────────────────────

server.registerTool(
  "dc_analyze_power_redundancy",
  {
    title: "Power Redundancy Analyzer",
    description: `Analyze power redundancy configuration for a mission-critical data center.

Calculates UPS module count and sizing, generator count and total capacity, PDU requirements and switchgear feeds, electrical efficiency chain losses, UPS loading percentage, and concurrent maintainability / fault tolerance assessment.

Supports N, N+1, 2N, and 2N+1 redundancy configurations.

Args:
  - it_load_kw (number): Total IT load in kW
  - redundancy_config (string): "N", "N+1", "2N", or "2N+1"
  - ups_module_size_kw (number): Individual UPS module capacity (default: 500 kW)
  - generator_size_kw (number): Individual generator capacity (default: 2000 kW)
  - ups_efficiency (number): UPS efficiency 0.8-0.99 (default: 0.95)
  - pdu_efficiency (number): PDU efficiency 0.9-0.999 (default: 0.98)
  - transformer_efficiency (number): Transformer efficiency (default: 0.985)

Returns structured JSON with complete power infrastructure sizing and recommendations.

Examples:
  - "Size a 2N UPS system for 3 MW" -> it_load_kw: 3000, redundancy_config: "2N"
  - "What do I need for N+1 at 1.5 MW with 750 kW UPS modules?" -> it_load_kw: 1500, redundancy_config: "N+1", ups_module_size_kw: 750`,
    inputSchema: PowerRedundancySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const result = calculatePowerRedundancy(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error analyzing power redundancy: ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: Tier Classification Assessment ──────────────────────────────

server.registerTool(
  "dc_assess_tier_classification",
  {
    title: "Tier Classification Assessment",
    description: `Assess a data center's Uptime Institute Tier classification based on its infrastructure configuration.

Evaluates power redundancy, cooling redundancy, distribution paths, concurrent maintainability, and fault tolerance against Tier I-IV requirements. Identifies gaps between current infrastructure and target tier.

Args:
  - target_tier (number): Target Tier level 1-4
  - power_redundancy (string): Current power config ("N", "N+1", "2N", "2N+1")
  - cooling_redundancy (string): Current cooling config
  - distribution_paths (number): Number of independent power paths
  - concurrently_maintainable (boolean): Can maintain without IT impact?
  - fault_tolerant (boolean): Automatic fault handling?
  - generator_backed (boolean): Generator backup available?
  - ups_runtime_minutes (number): UPS battery runtime (default: 10)
  - fire_suppression (boolean): Clean agent suppression installed?
  - monitoring_system (boolean): BMS/DCIM installed?

Returns target vs achieved tier, gap analysis with severity ratings, uptime expectations, and recommendations.

Examples:
  - "Does my N+1 facility qualify for Tier III?" -> target_tier: 3, power_redundancy: "N+1", cooling_redundancy: "N+1", distribution_paths: 1, concurrently_maintainable: false, fault_tolerant: false, generator_backed: true
  - "Assess our 2N facility against Tier IV" -> target_tier: 4, power_redundancy: "2N", cooling_redundancy: "2N", distribution_paths: 2, concurrently_maintainable: true, fault_tolerant: true, generator_backed: true`,
    inputSchema: TierAssessmentSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const result = assessTierClassification(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error assessing tier classification: ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: Commissioning Plan Generator ────────────────────────────────

server.registerTool(
  "dc_generate_commissioning_plan",
  {
    title: "Commissioning Plan Generator",
    description: `Generate a comprehensive data center commissioning plan following ASHRAE guidelines (Levels 1-5).

Creates a structured commissioning plan with test procedures, durations, milestones, and prerequisites scaled to facility size and tier complexity.

Commissioning Levels:
  - L1: Factory Witness Testing
  - L2: Component Verification & Startup
  - L3: System Functional Performance Testing
  - L4: Integrated Systems Testing (load bank, concurrent maintenance, fault injection)
  - L5: Operational Sustainability (seasonal verification)

Args:
  - facility_size_kw (number): Design IT capacity in kW
  - tier_level (number): Target Tier 1-4 (affects test complexity)
  - include_levels (number[]): Which commissioning levels to include [1,2,3,4,5]
  - custom_systems (string[]): Optional custom systems list

Returns structured plan with phases, test procedures, durations, milestones, and recommendations.

Examples:
  - "Generate a full Cx plan for a 5 MW Tier III facility" -> facility_size_kw: 5000, tier_level: 3, include_levels: [1,2,3,4,5]
  - "Just L3 and L4 for a 1 MW Tier II" -> facility_size_kw: 1000, tier_level: 2, include_levels: [3,4]`,
    inputSchema: CommissioningPlanSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const result = generateCommissioningPlan(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error generating commissioning plan: ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: Rack Density Analyzer ───────────────────────────────────────

server.registerTool(
  "dc_analyze_rack_density",
  {
    title: "Rack Density Analyzer",
    description: `Analyze rack density classification and recommend appropriate cooling strategies.

Classifies rack density (low/medium/high/ultra-high/liquid-cooled), recommends cooling approach, estimates airflow requirements per rack, and flags containment and liquid cooling thresholds.

Args:
  - rack_count (number): Total number of racks
  - avg_kw_per_rack (number): Average power per rack in kW
  - floor_area_sqft (number): Optional white space area for W/sqft calculation
  - cooling_type (string): Optional current/planned cooling type

Returns density classification, recommended cooling strategy, airflow estimates, and recommendations.

Examples:
  - "I have 200 racks at 8 kW each in 10,000 sqft" -> rack_count: 200, avg_kw_per_rack: 8, floor_area_sqft: 10000
  - "Cooling strategy for 50 GPU racks at 40 kW" -> rack_count: 50, avg_kw_per_rack: 40`,
    inputSchema: RackDensitySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const result = analyzeRackDensity(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error analyzing rack density: ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: GPU Power & Cooling Optimizer ──────────────────────────────

server.registerTool(
  "dc_gpu_cooling_optimizer",
  {
    title: "GPU Power & Cooling Optimizer",
    description: `Optimize cooling infrastructure for GPU/AI workloads. Calculates thermal loads for modern GPU clusters (H100, A100, H200, B200, GB200), recommends cooling strategies (air, rear-door, direct liquid, immersion), and projects energy costs and savings.

Handles the unique thermal challenges of AI/ML deployments: extreme power density (30-120+ kW/rack), liquid cooling CDU sizing, coolant flow rates, and PUE impact analysis.

Args:
  - gpu_count (number): Total number of GPUs
  - gpu_model (string): "H100", "A100", "H200", "B200", or "GB200"
  - rack_count (number): Number of racks housing GPUs
  - cooling_type (string): "air", "direct_liquid", "rear_door", or "immersion"
  - ambient_temp_f (number): Ambient temperature in °F (default: 95)
  - pue_target (number): Target PUE ratio (default: 1.3)

Returns total heat load, per-rack density, cooling strategy recommendation, CDU sizing, coolant flow rates, chilled water plant capacity, annual energy costs, and liquid vs air savings analysis.

Examples:
  - "Cool 64 H100 GPUs across 8 racks with liquid cooling" -> gpu_count: 64, gpu_model: "H100", rack_count: 8, cooling_type: "direct_liquid"
  - "What cooling do I need for 16 GB200s?" -> gpu_count: 16, gpu_model: "GB200", rack_count: 2, cooling_type: "immersion"`,
    inputSchema: GPUCoolingSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const result = calculateGPUCooling(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error calculating GPU cooling: ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: UPS & Battery Sizing Calculator ────────────────────────────

server.registerTool(
  "dc_ups_battery_sizing",
  {
    title: "UPS & Battery Sizing Calculator",
    description: `Size UPS systems and battery plants for mission-critical data center facilities. Calculates UPS module count, battery string sizing, floor space, structural load, and 10-year Total Cost of Ownership comparing VRLA vs Lithium-Ion batteries.

Supports all standard redundancy configurations (N, N+1, 2N, 2N+1) and both battery technologies with lifecycle cost analysis including replacement cycles.

Args:
  - critical_load_kw (number): Critical IT load in kW
  - redundancy (string): "N", "N+1", "2N", or "2N+1"
  - runtime_minutes (number): Required battery runtime (5, 10, 15, or 30)
  - battery_type (string): "VRLA" or "lithium_ion"
  - ups_efficiency (number): UPS efficiency 0.8-0.99 (default: 0.96)
  - growth_factor (number): Design growth margin 1.0-2.0 (default: 1.2)

Returns UPS module sizing, battery string count, energy capacity, floor space requirements, weight estimates, 10-year TCO comparison, and recommendations.

Examples:
  - "Size a 2N UPS with 15 min lithium batteries for 2 MW" -> critical_load_kw: 2000, redundancy: "2N", runtime_minutes: 15, battery_type: "lithium_ion"
  - "Compare VRLA vs lithium for 500 kW N+1" -> critical_load_kw: 500, redundancy: "N+1", runtime_minutes: 10, battery_type: "VRLA"`,
    inputSchema: UPSSizingSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const result = calculateUPSSizing(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error calculating UPS sizing: ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: Reference Data Lookup ───────────────────────────────────────

server.registerTool(
  "dc_reference_lookup",
  {
    title: "Data Center Reference Data",
    description: `Look up data center engineering reference data including Tier requirements, PUE benchmarks, rack density classifications, and commissioning phases.

Args:
  - category (string): One of "tier_requirements", "pue_benchmarks", "rack_density", "commissioning_phases"
  - tier (number): Optional — filter tier requirements by specific tier (1-4)

Returns reference data tables for data center engineering decisions.

Examples:
  - "What are the Tier III requirements?" -> category: "tier_requirements", tier: 3
  - "Show me PUE benchmarks" -> category: "pue_benchmarks"
  - "Rack density classifications" -> category: "rack_density"`,
    inputSchema: {
      category: z.enum(["tier_requirements", "pue_benchmarks", "rack_density", "commissioning_phases"])
        .describe("Reference data category to look up"),
      tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
        .optional()
        .describe("Optional: specific tier level to filter (1-4)"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    const { category, tier } = params as { category: string; tier?: 1 | 2 | 3 | 4 };

    let result: unknown;

    switch (category) {
      case "tier_requirements":
        if (tier) {
          result = { [tier]: TIER_REQUIREMENTS[tier] };
        } else {
          result = TIER_REQUIREMENTS;
        }
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
      default:
        return {
          content: [{ type: "text" as const, text: `Unknown category: ${category}. Use one of: tier_requirements, pue_benchmarks, rack_density, commissioning_phases` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result as Record<string, unknown>,
    };
  }
);

// ─── Transport Setup ───────────────────────────────────────────────────

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("datacenter-mcp-server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();

  // ─── Middleware Stack ─────────────────────────────────────────────────
  // Order is critical for security and functionality
  
  // 1. CORS - must be first for OPTIONS preflight handling
  app.use(corsMiddleware);

  // 2. Request Logger - logs all requests with timestamp, method, path, IP, response time
  app.use(requestLoggerMiddleware);

  // 3. Rate Limiting - token bucket algorithm, per-IP tracking
  app.use(rateLimitMiddleware);

  // 4. Request Size Limit - checks content-length and actual body size
  app.use(requestSizeLimitMiddleware);

  // 5. JSON Body Parser - with size limit applied
  app.use(express.json());

  // 6. API Key Authentication - checks x-api-key or Bearer token, skips /health
  app.use(apiKeyAuthMiddleware);

  // ─── Routes ───────────────────────────────────────────────────────────

  // Health check endpoint (no auth required)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "datacenter-mcp-server", version: "1.0.0" });
  });

  // MCP endpoint
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // ─── Error Handler ────────────────────────────────────────────────────
  // 7. Error Sanitizer - must be last, catches unhandled errors
  app.use(errorSanitizerMiddleware);

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.error(`datacenter-mcp-server running on http://localhost:${port}/mcp`);
  });
}

// Choose transport based on environment
const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
