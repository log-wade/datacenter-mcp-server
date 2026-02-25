// datacenter-mcp-server/src/services/rack-density-engine.ts
// Rack density classification and cooling recommendation engine

import { RACK_DENSITY, CFM_PER_TON, KW_PER_TON } from "../constants.js";
import type { RackDensityInput, RackDensityResult } from "../types.js";

export function analyzeRackDensity(input: RackDensityInput): RackDensityResult {
  const { rack_count, avg_kw_per_rack, floor_area_sqft, cooling_type } = input;

  const total_it_load_kw = rack_count * avg_kw_per_rack;
  const watts_per_sqft = floor_area_sqft ? (total_it_load_kw * 1000) / floor_area_sqft : undefined;

  // Classify density
  let density_classification = "Unknown";
  let recommended_cooling = "Unknown";

  for (const [, range] of Object.entries(RACK_DENSITY)) {
    if (avg_kw_per_rack >= range.min && avg_kw_per_rack < range.max) {
      density_classification = range.label;
      recommended_cooling = range.cooling;
      break;
    }
  }
  // Handle max range
  if (avg_kw_per_rack >= 40) {
    density_classification = RACK_DENSITY.liquid_cooled.label;
    recommended_cooling = RACK_DENSITY.liquid_cooled.cooling;
  }

  // Airflow per rack estimate
  const tons_per_rack = avg_kw_per_rack / KW_PER_TON;
  const estimated_airflow_per_rack_cfm = Math.round(tons_per_rack * CFM_PER_TON);

  const containment_required = avg_kw_per_rack >= 5;
  const liquid_cooling_recommended = avg_kw_per_rack >= 30;

  // Recommendations
  const recommendations: string[] = [];

  if (avg_kw_per_rack < 5) {
    recommendations.push(
      "Standard raised-floor CRAH/CRAC cooling is sufficient at this density. Consider blanking panels and cable management for airflow optimization"
    );
  }
  if (avg_kw_per_rack >= 5 && avg_kw_per_rack < 10) {
    recommendations.push(
      "Hot aisle or cold aisle containment is required at this density to prevent hot air recirculation"
    );
    recommendations.push(
      "Consider in-row cooling units for localized heat rejection"
    );
  }
  if (avg_kw_per_rack >= 10 && avg_kw_per_rack < 20) {
    recommendations.push(
      "In-row cooling with hot aisle containment is strongly recommended. Supplement with overhead or underfloor distribution"
    );
    recommendations.push(
      "Monitor supply/return temperature differentials per rack — target 15-25°F delta-T"
    );
  }
  if (avg_kw_per_rack >= 20 && avg_kw_per_rack < 40) {
    recommendations.push(
      "Rear-door heat exchangers (RDHx) or direct liquid cooling (DLC) should be evaluated at this density"
    );
    recommendations.push(
      "Traditional air cooling alone will struggle above 20 kW/rack without significant overprovisioning"
    );
  }
  if (avg_kw_per_rack >= 40) {
    recommendations.push(
      "Direct-to-chip liquid cooling is the primary cooling strategy at this density (GPU/HPC workloads)"
    );
    recommendations.push(
      "Plan for facility water supply: ~0.5 GPM per kW of liquid-cooled IT load"
    );
    recommendations.push(
      "Ensure structural loading supports liquid-cooled rack weights (often 2,500-4,000 lbs per rack)"
    );
  }

  if (watts_per_sqft && watts_per_sqft > 200) {
    recommendations.push(
      `Floor loading at ${watts_per_sqft.toFixed(0)} W/sqft is very high. Verify structural floor capacity (typical: 250 lbs/sqft for raised floor)`
    );
  }

  if (cooling_type && cooling_type.toLowerCase().includes("air") && avg_kw_per_rack > 15) {
    recommendations.push(
      "Air-only cooling at this density will require significant overprovisioning. Consider hybrid air+liquid approach"
    );
  }

  return {
    rack_count,
    avg_kw_per_rack,
    total_it_load_kw: Math.round(total_it_load_kw * 100) / 100,
    density_classification,
    recommended_cooling,
    watts_per_sqft: watts_per_sqft ? Math.round(watts_per_sqft * 100) / 100 : undefined,
    estimated_airflow_per_rack_cfm,
    containment_required,
    liquid_cooling_recommended,
    recommendations,
  };
}
