// datacenter-mcp-server/src/engines.ts
// Programmatic tool API for consumers (hosted chat, MCP shims) without MCP transport overhead.

import { z } from "zod";

import { CoolingLoadSchema } from "./schemas/cooling.js";
import { PowerRedundancySchema } from "./schemas/power.js";
import { TierAssessmentSchema } from "./schemas/tier.js";
import { CommissioningPlanSchema } from "./schemas/commissioning.js";
import { RackDensitySchema } from "./schemas/rack-density.js";
import { GPUCoolingSchema } from "./schemas/gpu-cooling.js";
import { UPSSizingSchema } from "./schemas/ups-sizing.js";

import { calculateCoolingLoad } from "./services/cooling-engine.js";
import { calculatePowerRedundancy } from "./services/power-engine.js";
import { assessTierClassification } from "./services/tier-engine.js";
import { generateCommissioningPlan } from "./services/commissioning-engine.js";
import { analyzeRackDensity } from "./services/rack-density-engine.js";
import { calculateGPUCooling } from "./services/gpu-cooling-engine.js";
import { calculateUPSSizing } from "./services/ups-sizing-engine.js";

import { TIER_REQUIREMENTS, PUE_REFERENCE, RACK_DENSITY, CX_PHASES } from "./constants.js";

export type ToolArgs = Record<string, unknown>;

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const ReferenceLookupSchema = z
  .object({
    category: z
      .enum(["tier_requirements", "pue_benchmarks", "rack_density", "commissioning_phases"])
      .describe(
        'Reference data category: "tier_requirements", "pue_benchmarks", "rack_density", or "commissioning_phases"'
      ),
    tier: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional()
      .describe("Optional tier level (1-4) when category is tier_requirements"),
  })
  .strict();

type JsonSchemaProperty = Record<string, unknown>;

function unwrapZodType(field: z.ZodTypeAny): z.ZodTypeAny {
  if (field instanceof z.ZodDefault) {
    return unwrapZodType(field._def.innerType as z.ZodTypeAny);
  }
  if (field instanceof z.ZodOptional) {
    return unwrapZodType(field._def.innerType as z.ZodTypeAny);
  }
  return field;
}

function zodFieldToProperty(field: z.ZodTypeAny): JsonSchemaProperty {
  const unwrapped = unwrapZodType(field);
  const property: JsonSchemaProperty = {};

  const description = unwrapped.description ?? field.description;
  if (description) {
    property.description = description;
  }

  if (field instanceof z.ZodDefault) {
    property.default = field._def.defaultValue();
  }

  if (unwrapped instanceof z.ZodNumber) {
    property.type = "number";
    return property;
  }
  if (unwrapped instanceof z.ZodBoolean) {
    property.type = "boolean";
    return property;
  }
  if (unwrapped instanceof z.ZodString) {
    property.type = "string";
    return property;
  }
  if (unwrapped instanceof z.ZodEnum) {
    property.type = "string";
    property.enum = unwrapped.options;
    return property;
  }
  if (unwrapped instanceof z.ZodArray) {
    const itemType = unwrapZodType(unwrapped._def.type as z.ZodTypeAny);
    property.type = "array";
    property.items =
      itemType instanceof z.ZodNumber
        ? { type: "number" }
        : itemType instanceof z.ZodString
          ? { type: "string" }
          : { type: "string" };
    return property;
  }
  if (unwrapped instanceof z.ZodUnion) {
    const options = unwrapped._def.options as z.ZodTypeAny[];
    const literals = options.filter((option) => option instanceof z.ZodLiteral);
    if (literals.length === options.length) {
      const values = literals.map((literal) => (literal as z.ZodLiteral<unknown>).value);
      property.type = typeof values[0] === "number" ? "number" : "string";
      property.enum = values;
      return property;
    }
  }

  property.type = "string";
  return property;
}

function schemaToInputSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(schema.shape)) {
    properties[key] = zodFieldToProperty(field as z.ZodTypeAny);
    if (!(field instanceof z.ZodOptional) && !(field instanceof z.ZodDefault)) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function defineTool(
  name: string,
  description: string,
  schema: z.ZodObject<z.ZodRawShape>
): ToolDefinition {
  return { name, description, inputSchema: schemaToInputSchema(schema) };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  defineTool(
    "dc_calculate_cooling_load",
    "Calculate total cooling load for a data center facility based on IT load, PUE, and environmental factors. Returns kW, tons, BTU/hr, airflow CFM, PUE rating, and recommendations.",
    CoolingLoadSchema
  ),
  defineTool(
    "dc_analyze_power_redundancy",
    "Analyze power redundancy configuration (N, N+1, 2N, 2N+1). Returns UPS module count/sizing, generator capacity, PDU requirements, efficiency chain, and maintainability assessment.",
    PowerRedundancySchema
  ),
  defineTool(
    "dc_assess_tier_classification",
    "Assess facility tier against Uptime Institute Tier I–IV standards with gap analysis and upgrade paths.",
    TierAssessmentSchema
  ),
  defineTool(
    "dc_generate_commissioning_plan",
    "Generate a commissioning plan with ASHRAE levels, test scripts, timelines, and resource requirements.",
    CommissioningPlanSchema
  ),
  defineTool(
    "dc_analyze_rack_density",
    "Analyze rack power density, floor loading, and cooling requirements for a data center deployment.",
    RackDensitySchema
  ),
  defineTool(
    "dc_gpu_cooling_optimizer",
    "Optimize GPU cluster cooling for H100, A100, H200, B200, or GB200 deployments. Returns thermal load, cooling strategy, and facility impact.",
    GPUCoolingSchema
  ),
  defineTool(
    "dc_ups_battery_sizing",
    "Size UPS and battery systems with IEEE 485 rate/aging derating. Returns module count, footprint, and lifecycle cost.",
    UPSSizingSchema
  ),
  defineTool(
    "dc_reference_lookup",
    'Look up reference data: tier_requirements, pue_benchmarks, rack_density, or commissioning_phases.',
    ReferenceLookupSchema
  ),
];

const TOOL_NAMES = TOOL_DEFINITIONS.map((tool) => tool.name);

function lookupReference(params: z.infer<typeof ReferenceLookupSchema>): unknown {
  const { category, tier } = params;

  switch (category) {
    case "tier_requirements":
      return tier ? { [tier]: TIER_REQUIREMENTS[tier] } : TIER_REQUIREMENTS;
    case "pue_benchmarks":
      return PUE_REFERENCE;
    case "rack_density":
      return RACK_DENSITY;
    case "commissioning_phases":
      return CX_PHASES;
    default: {
      const _exhaustive: never = category;
      throw new Error(`Unknown category: ${_exhaustive}`);
    }
  }
}

export function executeTool(name: string, args: ToolArgs): unknown {
  switch (name) {
    case "dc_calculate_cooling_load":
      return calculateCoolingLoad(CoolingLoadSchema.parse(args));
    case "dc_analyze_power_redundancy":
      return calculatePowerRedundancy(PowerRedundancySchema.parse(args));
    case "dc_assess_tier_classification":
      return assessTierClassification(TierAssessmentSchema.parse(args));
    case "dc_generate_commissioning_plan":
      return generateCommissioningPlan(CommissioningPlanSchema.parse(args));
    case "dc_analyze_rack_density":
      return analyzeRackDensity(RackDensitySchema.parse(args));
    case "dc_gpu_cooling_optimizer":
      return calculateGPUCooling(GPUCoolingSchema.parse(args));
    case "dc_ups_battery_sizing":
      return calculateUPSSizing(UPSSizingSchema.parse(args));
    case "dc_reference_lookup":
      return lookupReference(ReferenceLookupSchema.parse(args));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function listToolNames(): string[] {
  return [...TOOL_NAMES];
}
