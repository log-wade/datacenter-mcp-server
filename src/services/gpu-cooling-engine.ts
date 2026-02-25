// datacenter-mcp-server/src/services/gpu-cooling-engine.ts
// GPU Power & Cooling Optimizer for AI/ML workload thermal calculations

import {
  BTU_PER_KW,
  KW_PER_TON,
  CFM_PER_TON,
} from "../constants.js";
import type {
  GPUCoolingInput,
  GPUCoolingResult,
  GPUModel,
  CoolingType,
  CoolingStrategyRecommendation,
} from "../types.js";

// GPU TDP specifications (watts per chip)
const GPU_TDP_SPECS: Record<GPUModel, number> = {
  H100: 700,
  A100: 400,
  H200: 700,
  B200: 1000,
  GB200: 1200,
};

// Cooling strategy thresholds (kW/rack)
const COOLING_STRATEGY_THRESHOLDS: CoolingStrategyRecommendation[] = [
  {
    kw_per_rack: 0,
    recommended_type: "air",
    description: "Traditional air cooling (CRAH/CRAC + hot/cold aisle containment)",
    min_threshold: 0,
    max_threshold: 15,
  },
  {
    kw_per_rack: 15,
    recommended_type: "rear_door",
    description: "Rear-door heat exchangers (between hot/cold aisles)",
    min_threshold: 15,
    max_threshold: 30,
  },
  {
    kw_per_rack: 30,
    recommended_type: "direct_liquid",
    description: "Direct-to-chip liquid cooling (at CPU/GPU sockets)",
    min_threshold: 30,
    max_threshold: 60,
  },
  {
    kw_per_rack: 60,
    recommended_type: "immersion",
    description: "Full immersion cooling (servers submerged in dielectric fluid)",
    min_threshold: 60,
    max_threshold: 200,
  },
];

function getGPUTDP(model: GPUModel): number {
  return GPU_TDP_SPECS[model];
}

function getCoolingStrategy(
  kw_per_rack: number
): CoolingStrategyRecommendation {
  for (const strategy of COOLING_STRATEGY_THRESHOLDS) {
    if (
      kw_per_rack >= strategy.min_threshold &&
      kw_per_rack <= strategy.max_threshold
    ) {
      return strategy;
    }
  }
  // Return immersion for anything above 60 kW/rack
  return COOLING_STRATEGY_THRESHOLDS[COOLING_STRATEGY_THRESHOLDS.length - 1];
}

function getPUEForCoolingType(coolingType: CoolingType): {
  low: number;
  high: number;
  typical: number;
} {
  const pueRanges: Record<CoolingType, { low: number; high: number; typical: number }> = {
    air: { low: 1.4, high: 1.6, typical: 1.5 },
    rear_door: { low: 1.25, high: 1.35, typical: 1.3 },
    direct_liquid: { low: 1.1, high: 1.2, typical: 1.15 },
    immersion: { low: 1.05, high: 1.15, typical: 1.1 },
  };
  return pueRanges[coolingType];
}

function calculateCoolantFlowRate(
  power_kw: number,
  delta_t_f: number = 15
): number {
  // Q = P / (500 * deltaT)
  // where Q is in GPM, P is in kW, deltaT is in °F (typical 15°F supply-return delta)
  // 500 is the BTU heat capacity factor (BTU/min per GPM per °F)
  if (delta_t_f <= 0) delta_t_f = 15;
  return power_kw / (500 / 12000 * delta_t_f);
}

function calculateCDUCount(rack_count: number): number {
  // 1 CDU per 8-12 racks (assume 10 racks per CDU)
  return Math.ceil(rack_count / 10);
}

function calculateChilledWaterCapacity(total_heat_rejection_kw: number): number {
  // 1 ton of cooling = 12,000 BTU/hour
  // Capacity in tons = total_heat_rejection_kw * 3412 BTU/kW / 12000 BTU/ton
  const heat_rejection_btu = total_heat_rejection_kw * 3412;
  return heat_rejection_btu / 12000;
}

function calculateAnnualEnergyCost(
  load_kw: number,
  pue: number,
  cost_per_kwh: number
): number {
  // Annual hours = 8760
  // Cost = load_kw * PUE * 8760 hours * cost_per_kwh
  return load_kw * pue * 8760 * cost_per_kwh;
}

export function calculateGPUCooling(input: GPUCoolingInput): GPUCoolingResult {
  const {
    gpu_count,
    gpu_model,
    rack_count,
    cooling_type,
    ambient_temp_f,
    pue_target,
    electricity_cost_per_kwh = 0.08,
  } = input;

  // Step 1: Calculate GPU TDP and total IT load
  const gpu_tdp = getGPUTDP(gpu_model);
  const total_gpu_load_kw = (gpu_count * gpu_tdp) / 1000;

  // Step 2: Add networking/storage/CPU overhead (15%)
  const total_it_load_with_overhead_kw = total_gpu_load_kw * 1.15;

  // Step 3: Calculate per-rack heat rejection
  const heat_rejection_per_rack_kw =
    total_it_load_with_overhead_kw / rack_count;

  // Step 4: Determine cooling strategy
  const coolingStrategy = getCoolingStrategy(heat_rejection_per_rack_kw);

  // Step 5: Generate cooling strategy analysis (all thresholds)
  const cooling_strategy_analysis: CoolingStrategyRecommendation[] = [
    ...COOLING_STRATEGY_THRESHOLDS,
  ];

  // Step 6: Calculate coolant flow rate if liquid cooling
  let coolant_flow_rate_gpm: number | undefined;
  let cdu_count_required: number | undefined;
  let chilled_water_capacity_tons: number | undefined;

  if (
    cooling_type === "direct_liquid" ||
    cooling_type === "immersion"
  ) {
    coolant_flow_rate_gpm = calculateCoolantFlowRate(
      total_it_load_with_overhead_kw,
      15
    );
    cdu_count_required = calculateCDUCount(rack_count);
    chilled_water_capacity_tons = calculateChilledWaterCapacity(
      total_it_load_with_overhead_kw
    );
  }

  // Step 7: Calculate facility PUE for selected cooling type
  const pue_liquid = getPUEForCoolingType(cooling_type);
  const pue_air = getPUEForCoolingType("air");
  const facility_pue_selected = pue_liquid.typical;
  const facility_pue_air = pue_air.typical;

  // Step 8: Calculate annual facility energy costs
  const annual_facility_energy_cost_liquid = calculateAnnualEnergyCost(
    total_it_load_with_overhead_kw,
    facility_pue_selected,
    electricity_cost_per_kwh
  );
  const annual_facility_energy_cost_air = calculateAnnualEnergyCost(
    total_it_load_with_overhead_kw,
    facility_pue_air,
    electricity_cost_per_kwh
  );

  // Step 9: Calculate savings (liquid vs air)
  const estimated_annual_savings = Math.max(
    0,
    annual_facility_energy_cost_air - annual_facility_energy_cost_liquid
  );

  // Step 10: Generate recommendations
  const recommendations: string[] = [];
  const warnings: string[] = [];

  if (heat_rejection_per_rack_kw > 40) {
    recommendations.push(
      `Ultra-high density deployment (${heat_rejection_per_rack_kw.toFixed(1)} kW/rack). Immersion or advanced liquid cooling strongly recommended to manage thermal density.`
    );
  }
  if (heat_rejection_per_rack_kw > 30) {
    recommendations.push(
      "Direct-to-chip liquid cooling required for this density. Ensure CDU sizing and chilled water plant capacity."
    );
  }
  if (cooling_type === "direct_liquid" || cooling_type === "immersion") {
    recommendations.push(
      `Liquid cooling deployment achieves PUE of ${facility_pue_selected}. Annual facility energy cost: $${annual_facility_energy_cost_liquid.toLocaleString("en-US", { maximumFractionDigits: 0 })} vs $${annual_facility_energy_cost_air.toLocaleString("en-US", { maximumFractionDigits: 0 })} for air cooling. Potential annual savings: $${estimated_annual_savings.toLocaleString("en-US", { maximumFractionDigits: 0 })}.`
    );
  }
  if (gpu_model === "GB200" || gpu_model === "B200") {
    recommendations.push(
      `${gpu_model} GPUs have high TDP (${gpu_tdp}W). Plan for robust power delivery and thermal management. Ensure PDU positioning near racks and adequate coolant supply.`
    );
  }
  if (ambient_temp_f > 80) {
    warnings.push(
      `Ambient temperature ${ambient_temp_f}°F is elevated. Ensure proper economizer usage when available. This may require chilled water supplementation even with outside air cooling.`
    );
  }
  if (rack_count > 50) {
    recommendations.push(
      "Large-scale deployment: Implement centralized chilled water plant with N+1 chiller redundancy. Consider thermal energy storage for peak shaving."
    );
  }
  if (cdu_count_required !== undefined && cdu_count_required > 3) {
    recommendations.push(
      `CDU count: ${cdu_count_required} units. Distribute across facility zones for balanced cooling and fault tolerance. Implement redundancy per critical infrastructure standards.`
    );
  }

  return {
    gpu_count,
    gpu_model,
    gpu_tdp_watts: gpu_tdp,
    total_gpu_load_kw: Math.round(total_gpu_load_kw * 100) / 100,
    total_it_load_with_overhead_kw: Math.round(
      total_it_load_with_overhead_kw * 100
    ) / 100,
    rack_count,
    heat_rejection_per_rack_kw: Math.round(
      heat_rejection_per_rack_kw * 100
    ) / 100,
    cooling_type_selected: cooling_type,
    cooling_strategy_analysis,
    coolant_flow_rate_gpm: coolant_flow_rate_gpm
      ? Math.round(coolant_flow_rate_gpm * 10) / 10
      : undefined,
    cdu_count_required,
    chilled_water_capacity_tons: chilled_water_capacity_tons
      ? Math.round(chilled_water_capacity_tons * 100) / 100
      : undefined,
    facility_pue_liquid_cooling: Math.round(facility_pue_selected * 100) / 100,
    facility_pue_air_cooling: Math.round(facility_pue_air * 100) / 100,
    annual_facility_energy_cost_liquid_kw: Math.round(
      annual_facility_energy_cost_liquid
    ),
    annual_facility_energy_cost_air_kw: Math.round(
      annual_facility_energy_cost_air
    ),
    estimated_annual_savings_liquid_vs_air: Math.round(estimated_annual_savings),
    recommendations,
    warnings,
  };
}
