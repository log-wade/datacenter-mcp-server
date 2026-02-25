// datacenter-mcp-server/src/services/cooling-engine.ts
// Cooling load calculation engine for mission-critical facilities

import {
  BTU_PER_KW,
  KW_PER_TON,
  CFM_PER_TON,
  WATTS_PER_SQ_FT_LIGHTING,
  WATTS_PER_SQ_FT_MISC,
  PUE_REFERENCE,
} from "../constants.js";
import type { CoolingLoadInput, CoolingLoadResult } from "../types.js";

function getPUERating(pue: number): string {
  for (const [key, range] of Object.entries(PUE_REFERENCE)) {
    if (pue >= range.min && pue < range.max) {
      return `${range.label} (${key})`;
    }
  }
  return "Unknown";
}

function getAltitudeDerating(altitude_ft: number): number {
  // Equipment derating above 5,000 ft — approximately 1% per 1,000 ft
  if (altitude_ft <= 5000) return 1.0;
  const derating = 1 - ((altitude_ft - 5000) / 1000) * 0.01;
  return Math.max(derating, 0.85); // Cap at 15% derating
}

export function calculateCoolingLoad(input: CoolingLoadInput): CoolingLoadResult {
  const {
    it_load_kw,
    pue,
    safety_factor = 1.15,
    lighting_area_sqft = 0,
    include_humidification = false,
    altitude_ft = 0,
    design_outdoor_temp_f = 95,
  } = input;

  // Total facility power = IT load × PUE
  const total_facility_load_kw = it_load_kw * pue;

  // Cooling load = total facility load minus IT load (the overhead)
  // Plus the IT load itself must be rejected as heat
  let cooling_load_kw = it_load_kw; // All IT power converts to heat

  // Add lighting heat load
  if (lighting_area_sqft > 0) {
    cooling_load_kw += (lighting_area_sqft * WATTS_PER_SQ_FT_LIGHTING) / 1000;
    cooling_load_kw += (lighting_area_sqft * WATTS_PER_SQ_FT_MISC) / 1000;
  }

  // Add UPS/electrical losses as heat (PUE overhead - 1) × IT load
  const electrical_overhead_kw = it_load_kw * (pue - 1);
  // Approximately 60% of electrical overhead becomes heat in the data hall
  cooling_load_kw += electrical_overhead_kw * 0.6;

  // Humidification load (typically 5-8% of cooling)
  if (include_humidification) {
    cooling_load_kw *= 1.07;
  }

  // Apply safety factor
  cooling_load_kw *= safety_factor;

  // Altitude derating
  let altitude_derating: number | undefined;
  if (altitude_ft > 5000) {
    altitude_derating = getAltitudeDerating(altitude_ft);
    // Need more cooling capacity to compensate for thinner air
    cooling_load_kw /= altitude_derating;
  }

  const cooling_load_tons = cooling_load_kw / KW_PER_TON;
  const cooling_load_btu = cooling_load_kw * BTU_PER_KW;
  const estimated_airflow_cfm = cooling_load_tons * CFM_PER_TON;

  // Generate recommendations
  const recommendations: string[] = [];

  if (pue > 1.6) {
    recommendations.push(
      "Consider economizer cooling (airside or waterside) to reduce PUE below 1.4"
    );
  }
  if (pue > 1.2 && pue <= 1.4) {
    recommendations.push(
      "Facility PUE is good. Consider hot/cold aisle containment and variable-speed fans for further optimization"
    );
  }
  if (it_load_kw > 500 && design_outdoor_temp_f > 85) {
    recommendations.push(
      "For loads above 500 kW in warm climates, evaluate chilled water systems over DX for efficiency at scale"
    );
  }
  if (altitude_ft > 5000) {
    recommendations.push(
      `Altitude derating of ${((1 - (altitude_derating ?? 1)) * 100).toFixed(1)}% applied. Ensure all mechanical equipment is rated for ${altitude_ft} ft elevation`
    );
  }
  if (cooling_load_tons > 200) {
    recommendations.push(
      "At this scale, consider central chilled water plant with N+1 chillers and thermal energy storage"
    );
  }
  if (include_humidification) {
    recommendations.push(
      "Humidification load included. Consider widening acceptable humidity range (ASHRAE A1: 20-80% RH) to reduce humidification energy"
    );
  }

  return {
    it_load_kw,
    total_facility_load_kw: Math.round(total_facility_load_kw * 100) / 100,
    cooling_load_kw: Math.round(cooling_load_kw * 100) / 100,
    cooling_load_tons: Math.round(cooling_load_tons * 100) / 100,
    cooling_load_btu: Math.round(cooling_load_btu),
    estimated_airflow_cfm: Math.round(estimated_airflow_cfm),
    pue,
    pue_rating: getPUERating(pue),
    safety_factor,
    altitude_derating,
    recommendations,
  };
}
